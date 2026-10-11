import { Core } from '../core';
import { DAY, H } from './format';
import { D, S, index, ui } from './state';
import { shownEvents } from './sync';
import { record } from './usage';
import type { Bet, Fight, Json, Leg, PastFight, UsageKind } from '../core';

/* ================= ESPN API ================= */
export const SITE = 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc';
export const CORE = 'https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc';
/** One call. `kind` says what it is for, and the call is counted under it (how long it took, how much came back,
 *  whether it failed); null is for a call that is not to ESPN, which is not counted. */
export async function getJSON(url: string, kind: UsageKind | null, ms?: number): Promise<Json> {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms || 12000), t0 = performance.now();
  let size = 0, ok = false;
  try {
    const r = await fetch(url, { signal: ctl.signal, cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status);
    const text = await r.text(); size = text.length;
    const j = JSON.parse(text); ok = true; return j;
  }
  finally { clearTimeout(t); if (kind) record(kind, performance.now() - t0, size, ok); }
}
export async function pool(jobs: (() => Promise<void>)[], n: number): Promise<void> { let i = 0; const run = async () => { while (i < jobs.length) { const j = jobs[i++]; try { await j(); } catch (e) { /* one failed call must not sink the batch */ } } }; await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, run)); }
const ATHLETES = 'https://sports.core.api.espn.com/v2/sports/mma/athletes';
/** The latest fights of an athlete: how many are read, for how long what was read stands, and for how long it is kept
 *  after that (an athlete who is not on a card any more is dropped in the end). */
export const FORM_FIGHTS = 3, FORM_TTL = 7 * DAY, FORM_KEEP = 35 * DAY;
/** How many athletes are asked for at the same time when a whole card is read. */
export const FORM_AT_ONCE = 3;
/** What is being asked for right now, and what could not be read the last time it was asked (by athlete id). Not saved. */
export const formBusy = new Set<string>(), formFailed = new Set<string>();
/** Reads the latest fights of these athletes: the event log of each, then each fight and its status, a few athletes at
 *  a time and one call after the other for each of them. A fight already read is not asked for again, since a past
 *  fight does not change; what was read stands for a week. Either all the fights of an athlete are read or none is
 *  kept, so that a list is never one fight short without saying so. */
/** Whether what is kept of an athlete still stands: read within the week, and with all that is read of a fight today
 *  (the fights kept by a version that did not read how each one ended are read again). */
export const formFresh = (id: string, now: number): boolean => { const g = D.form[id]; return !!g && now - g.ts < FORM_TTL && g.fights.every(x => typeof x.desc === 'string'); };
export async function loadForm(ids: string[]): Promise<void> {
  const now = Date.now(), todo = [...new Set(ids)].filter(id => id && !formBusy.has(id) && !formFresh(id, now));
  for (const k of Object.keys(D.form)) if (now - D.form[k].ts > FORM_KEEP && !todo.includes(k)) delete D.form[k];
  if (!todo.length) return;
  for (const id of todo) { formBusy.add(id); formFailed.delete(id); }
  await pool(todo.map(id => async () => {
    try {
      const had = (D.form[id] && D.form[id].fights) || [], fights: PastFight[] = [];
      const log = Core.normEventlog(await getJSON(`${ATHLETES}/${id}/eventlog`, 'form')).filter(x => x.played).slice(0, FORM_FIGHTS);
      for (const it of log) {
        const known = had.find(x => x.id === it.id && x.method !== 'unknown' && typeof x.desc === 'string');
        if (known) { fights.push(known); continue; }
        const c = await getJSON(it.competition, 'form'), f = Core.normPastFight(c, await getJSON(Core.statusRef(c), 'form'), id);
        if (!f) throw new Error('not a fight');
        fights.push(f);
      }
      D.form[id] = { ts: now, fights };
    } catch (e) { formFailed.add(id); }
    finally { formBusy.delete(id); }
  }), FORM_AT_ONCE);
}
export const ymd = (t: number): string => { const d = new Date(t); return d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0') + String(d.getUTCDate()).padStart(2, '0'); };
export const openBets = (): Bet[] => S.bets.filter(b => b.status === 'open');
export const openLegs = (): Leg[] => openBets().flatMap(b => b.legs);

/** How far ahead the board is read: far enough to have the three cards after the one that just ended, a week
 *  without a card included. */
export const BOARD_AHEAD = 30 * DAY;
export async function loadBoard(): Promise<void> {
  const now = Date.now();
  const from = Math.min(now - 4 * DAY, ...openLegs().map(l => l.date - DAY));
  const j = await getJSON(`${SITE}/scoreboard?dates=${ymd(from)}-${ymd(now + BOARD_AHEAD)}&limit=100`, 'board');
  D.events = ((j.events || []) as Json[]).map(Core.normEvent).filter(e => e.fights.length).sort((a, b) => a.date - b.date);
  D.from = from; index();
}
export async function loadOdds(eid: string | null, force?: boolean, onlyFids?: string[]): Promise<void> {
  const ev = D.events.find(e => e.id === eid); if (!ev || !eid) return;
  const now = Date.now();
  if (!force && !onlyFids && now - (D.oddsAt[eid] || 0) < 5 * 60e3) return;
  const fights = ev.fights.filter(f => f.state === 'pre' && !f.canceled && (!onlyFids || onlyFids.includes(f.id)));
  const jobs: (() => Promise<void>)[] = [];
  for (const f of fights) {
    jobs.push(async () => {
      const base = `${CORE}/events/${ev.id}/competitions/${f.id}/odds`;
      const o = Core.normOdds(await getJSON(base, 'odds'), f);
      if (!o) { delete D.odds[f.id]; return; }
      if (o.props) try { Core.attachDistance(o, f, await getJSON(o.props + (o.props.includes('?') ? '&' : '?') + 'limit=100', 'odds')); } catch (e) { /* distance line is optional */ }
      D.odds[f.id] = o;
    });
    for (const x of [f.a, f.b]) if (!D.astats[x.id] || now - D.astats[x.id].ts > 7 * DAY) jobs.push(async () => {
      let v = null; try { v = Core.statValue(await getJSON(`https://sports.core.api.espn.com/v2/sports/mma/athletes/${x.id}/statistics`, 'astats'), 'takedownAvg'); } catch (e) { /* debutants have no stats page */ }
      D.astats[x.id] = { tdAvg: v, ts: now };
    });
  }
  await pool(jobs, 6);
  if (!onlyFids) D.oddsAt[eid] = now;
}
export async function fetchTd(f: Fight): Promise<{ a: number; b: number }> {
  const u = (id: string): string => `${CORE}/events/${f.eventId}/competitions/${f.id}/competitors/${id}/statistics`;
  const [a, b] = await Promise.all([getJSON(u(f.a.id), 'td'), getJSON(u(f.b.id), 'td')]);
  const va = Core.statValue(a, 'takedownsLanded'), vb = Core.statValue(b, 'takedownsLanded');
  if (va == null || vb == null) throw new Error('sem stats');
  return { a: va, b: vb };
}
/** How long after its start a fight with no result the app can read is taken as one without a recognised method. */
export const UNKNOWN_AFTER = DAY;
/** How long the takedown count of a finished fight is left to stop moving before bets on it are closed. */
export const TD_FREEZE = 120e3;
export async function loadResults(): Promise<void> {
  const now = Date.now(), legs = openLegs();
  const betFids = new Set(legs.map(l => l.fid));
  const tdFids = new Set(legs.filter(l => /^td/.test(l.key)).map(l => l.fid));
  const onScreen = new Set(shownEvents().map(e => e.id));
  const jobs: (() => Promise<void>)[] = [];
  for (const f of D.fights.values()) {
    if (f.state === 'in' && (tdFids.has(f.id) || f.id === liveShown())) {
      jobs.push(async () => { const t = await fetchTd(f); D.td[f.id] = { a: t.a, b: t.b, final: false, ts: now }; });
      continue;
    }
    if (f.state !== 'post' || f.canceled) continue;
    if (!D.finalSeen[f.id]) D.finalSeen[f.id] = now;
    // a result is asked for only where it is used: on a card that is on screen, or to close a bet
    if (!D.results[f.id] && (onScreen.has(f.eventId) || betFids.has(f.id))) jobs.push(async () => {
      const r = Core.normResult(await getJSON(`${CORE}/events/${f.eventId}/competitions/${f.id}/status`, 'result'));
      // A result under a name the app does not know may still be being written, or be one a later version will know.
      // For a day it is asked for again, and only then taken as final: taking it at once would void every bet on the
      // method or the rounds of that fight for good. Winner picks do not wait for it.
      if (r && (r.method !== 'unknown' || now - f.date > UNKNOWN_AFTER)) { D.results[f.id] = r; delete D.unread[f.id]; }
      else if (r) D.unread[f.id] = r.label || 'sem nome';
      else if (now - f.date > UNKNOWN_AFTER) D.results[f.id] = { method: 'unknown', label: '', desc: '', round: f.period, time: null, clock: f.clock };
    });
    const t = D.td[f.id];
    if ((!t || !t.final) && (tdFids.has(f.id) || t)) jobs.push(async () => {
      // stats can trail the final bell by a moment, so only freeze them once the fight has been over for a couple of minutes
      const settled = now - D.finalSeen[f.id] > TD_FREEZE || now - f.date > 6 * H;
      try { const v = await fetchTd(f); D.td[f.id] = { a: v.a, b: v.b, final: settled, ts: now }; }
      catch (e) { if (now - f.date > 2 * DAY && D.results[f.id]) D.results[f.id].tdUnavailable = true; }
    });
  }
  await pool(jobs, 6);
}
export const liveShown = (): string | null => { const ev = D.events.find(e => e.id === ui.eventId); const f = ev && ev.fights.find(x => x.state === 'in'); return f ? f.id : null; };
