import { Core } from '../core';
import { formFresh, loadBoard, loadForm, loadOdds, loadResults, openBets, openLegs } from './api';
import { H } from './format';
import { render } from './render';
import { settle } from './settle';
import { D, saveCache, slip, ui } from './state';
import type { Fight, FightEvent } from '../core';

/* ================= sync loop ================= */
export let busy = false;
let timer: ReturnType<typeof setTimeout> | undefined;
/** How many rounds in a row could not read the board, and how long until the next one (shown while the source is out of reach). */
let fails = 0;
export let nextIn = 0;
export async function sync(force: boolean): Promise<void> {
  if (busy) return; busy = true;
  try {
    await loadBoard(!force && atCardPace(Date.now()));
    D.err = null; fails = 0; D.lastSync = Date.now();
    pickEvent(); render();
    await Promise.all([loadOdds(ui.eventId, force), loadResults()]);
    const other = [...new Set(slip.sels.map(s => D.fights.get(s.fid)).filter((f): f is Fight => !!f && f.eventId !== ui.eventId).map(f => f.eventId))];
    for (const eid of other) await loadOdds(eid, force);
    const left = [...new Set(openBets().filter(b => b.legs.some(l => { const f = D.fights.get(l.fid); return f && f.state === 'post'; })).flatMap(b => b.legs).map(l => D.fights.get(l.fid)).filter((f): f is Fight => !!f && f.state === 'pre' && f.eventId !== ui.eventId && !other.includes(f.eventId)).map(f => f.eventId))];
    for (const eid of left) await loadOdds(eid, force);
    settle(); saveCache();
    preloadForm();
  } catch (e) { fails++; const err = e as { name?: string; message?: string } | null; D.err = (err && err.name === 'AbortError') ? 'tempo esgotado' : String((err && err.message) || e); }
  finally { busy = false; schedule(); render(); }
}
/** Whether an open bet is waiting on a fight that is already over: for its result, or for its takedown count to stop
 *  moving. Only for half an hour after the fight was first seen over, so a result that never comes does not keep the
 *  app asking at this pace. */
export function settling(now: number): boolean {
  return openLegs().some(l => {
    const f = D.fights.get(l.fid);
    if (!f || f.state !== 'post' || f.canceled || now - (D.finalSeen[f.id] || now) > 30 * 60e3) return false;
    return !D.results[f.id] || (/^td/.test(l.key) && !(D.td[f.id] && D.td[f.id].final));
  });
}
/** Whether the app is asking at the pace of a card: a fight under way, the night of an event, or a bet waiting on a fight
 *  that is over. Then the board is the short one (D105). */
export function atCardPace(now: number): boolean {
  return [...D.fights.values()].some(f => f.state === 'in') || settling(now) || D.events.some(e => !e.completed && now > e.date - H && now < e.date + 12 * H);
}
export function schedule(): void {
  clearTimeout(timer);
  if (document.hidden) return;
  const now = Date.now(), fs = [...D.fights.values()];
  const live = fs.some(f => f.state === 'in');
  const night = D.events.some(e => !e.completed && now > e.date - H && now < e.date + 12 * H);
  nextIn = Core.retryDelay(settling(now) ? 8e3 : live ? 15e3 : night ? 30e3 : 120e3, fails);
  timer = setTimeout(() => sync(false), nextIn);
}
export function initSync(): void {
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(false); else clearTimeout(timer); });
  // coming back to the app does not always arrive as a change of visibility: a page restored from memory, a connection that returns
  const back = (): void => { if (!document.hidden && Date.now() - D.lastSync > 5e3) sync(false); };
  window.addEventListener('pageshow', back); window.addEventListener('online', back);
}
/** The card of the week: the next event that is not over, or the last one there is. */
export function weekEvent(): FightEvent | undefined {
  const evs = shownEvents(), now = Date.now();
  return evs.find(e => !e.completed && e.date > now - 14 * H) || evs[evs.length - 1];
}
export function pickEvent(): void {
  if (shownEvents().find(e => e.id === ui.eventId)) return;
  const next = weekEvent();
  ui.eventId = next ? next.id : null;
}
/** How long before the reading of a card that stopped half way is tried again: a source that is refusing is not asked
 *  at every round of the sync loop. */
export const FORM_RETRY = 10 * 60e3;
let formAt = 0;
/** Reads ahead the latest fights of everybody who still has a fight on the card of the week, so that the details of a
 *  fight open with them already there. It runs beside the sync loop and never holds it; what is read stands for a week. */
export function preloadForm(): void {
  const ev = weekEvent(), now = Date.now();
  if (!ev || now - formAt < FORM_RETRY) return;
  const ids = ev.fights.filter(f => f.state === 'pre' && !f.canceled).flatMap(f => [f.a.id, f.b.id]).filter(id => !formFresh(id, now));
  if (!ids.length) return;
  formAt = now;
  loadForm(ids, true).then(() => { saveCache(); render(); });
}
/** The events on screen: the next three cards that are not over (`Core.cardsToShow`), and any card further ahead with a bet still open on it. */
export const shownEvents = (): FightEvent[] => Core.cardsToShow(D.events, Date.now(), new Set(openLegs().map(l => l.eid)));
