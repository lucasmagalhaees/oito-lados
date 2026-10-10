import { loadBoard, loadOdds, loadResults, openBets } from './api';
import { DAY, H } from './format';
import { render } from './render';
import { settle } from './settle';
import { D, saveCache, slip, ui } from './state';
import type { Fight, FightEvent } from '../core';

/* ================= sync loop ================= */
export let busy = false;
let timer: ReturnType<typeof setTimeout> | undefined;
export async function sync(force: boolean): Promise<void> {
  if (busy) return; busy = true;
  try {
    await loadBoard();
    D.err = null; D.lastSync = Date.now();
    pickEvent(); render();
    await Promise.all([loadOdds(ui.eventId, force), loadResults()]);
    const other = [...new Set(slip.sels.map(s => D.fights.get(s.fid)).filter((f): f is Fight => !!f && f.eventId !== ui.eventId).map(f => f.eventId))];
    for (const eid of other) await loadOdds(eid, force);
    const left = [...new Set(openBets().filter(b => b.legs.some(l => { const f = D.fights.get(l.fid); return f && f.state === 'post'; })).flatMap(b => b.legs).map(l => D.fights.get(l.fid)).filter((f): f is Fight => !!f && f.state === 'pre' && f.eventId !== ui.eventId && !other.includes(f.eventId)).map(f => f.eventId))];
    for (const eid of left) await loadOdds(eid, force);
    settle(); saveCache();
  } catch (e) { const err = e as { name?: string; message?: string } | null; D.err = (err && err.name === 'AbortError') ? 'tempo esgotado' : String((err && err.message) || e); }
  finally { busy = false; render(); schedule(); }
}
export function schedule(): void {
  clearTimeout(timer);
  if (document.hidden) return;
  const now = Date.now(), fs = [...D.fights.values()];
  const live = fs.some(f => f.state === 'in');
  const night = D.events.some(e => !e.completed && now > e.date - H && now < e.date + 12 * H);
  timer = setTimeout(() => sync(false), live ? 15e3 : night ? 30e3 : 120e3);
}
export function initSync(): void { document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(false); else clearTimeout(timer); }); }
export function pickEvent(): void {
  const evs = shownEvents();
  if (evs.find(e => e.id === ui.eventId)) return;
  const now = Date.now();
  const next = evs.find(e => !e.completed && e.date > now - 14 * H) || evs[evs.length - 1];
  ui.eventId = next ? next.id : null;
}
export const shownEvents = (): FightEvent[] => D.events.filter(e => e.date > Date.now() - 5 * DAY && !/Contender Series/i.test(e.name));
