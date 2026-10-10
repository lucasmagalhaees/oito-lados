import { Core } from '../core';
import { DAY, H } from './format';
import { D, S, index, ui } from './state';
import type { Bet, Fight, Json, Leg } from '../core';

/* ================= ESPN API ================= */
export const SITE = 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc';
export const CORE = 'https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc';
export async function getJSON(url: string, ms?: number): Promise<Json> {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms || 12000);
  try { const r = await fetch(url, { signal: ctl.signal, cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
export async function pool(jobs: (() => Promise<void>)[], n: number): Promise<void> { let i = 0; const run = async () => { while (i < jobs.length) { const j = jobs[i++]; try { await j(); } catch (e) { /* one failed call must not sink the batch */ } } }; await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, run)); }
export const ymd = (t: number): string => { const d = new Date(t); return d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0') + String(d.getUTCDate()).padStart(2, '0'); };
export const openBets = (): Bet[] => S.bets.filter(b => b.status === 'open');
export const openLegs = (): Leg[] => openBets().flatMap(b => b.legs);

export async function loadBoard(): Promise<void> {
  const now = Date.now();
  const from = Math.min(now - 4 * DAY, ...openLegs().map(l => l.date - DAY));
  const j = await getJSON(`${SITE}/scoreboard?dates=${ymd(from)}-${ymd(now + 16 * DAY)}&limit=100`);
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
      const o = Core.normOdds(await getJSON(base), f);
      if (!o) { delete D.odds[f.id]; return; }
      if (o.props) try { Core.attachDistance(o, f, await getJSON(o.props + (o.props.includes('?') ? '&' : '?') + 'limit=100')); } catch (e) { /* distance line is optional */ }
      D.odds[f.id] = o;
    });
    for (const x of [f.a, f.b]) if (!D.astats[x.id] || now - D.astats[x.id].ts > 7 * DAY) jobs.push(async () => {
      let v = null; try { v = Core.statValue(await getJSON(`https://sports.core.api.espn.com/v2/sports/mma/athletes/${x.id}/statistics`), 'takedownAvg'); } catch (e) { /* debutants have no stats page */ }
      D.astats[x.id] = { tdAvg: v, ts: now };
    });
  }
  await pool(jobs, 6);
  if (!onlyFids) D.oddsAt[eid] = now;
}
export async function fetchTd(f: Fight): Promise<{ a: number; b: number }> {
  const u = (id: string): string => `${CORE}/events/${f.eventId}/competitions/${f.id}/competitors/${id}/statistics`;
  const [a, b] = await Promise.all([getJSON(u(f.a.id)), getJSON(u(f.b.id))]);
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
  const jobs: (() => Promise<void>)[] = [];
  for (const f of D.fights.values()) {
    if (f.state === 'in' && (tdFids.has(f.id) || f.id === liveShown())) {
      jobs.push(async () => { const t = await fetchTd(f); D.td[f.id] = { a: t.a, b: t.b, final: false, ts: now }; });
      continue;
    }
    if (f.state !== 'post' || f.canceled) continue;
    if (!D.finalSeen[f.id]) D.finalSeen[f.id] = now;
    const recent = now - f.date < 5 * DAY;
    if (!D.results[f.id] && (recent || betFids.has(f.id))) jobs.push(async () => {
      const r = Core.normResult(await getJSON(`${CORE}/events/${f.eventId}/competitions/${f.id}/status`));
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
