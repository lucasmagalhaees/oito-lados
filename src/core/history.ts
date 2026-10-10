/* ---------- questions asked of the bet history ----------
   Pure functions over the list of bets: whether a bet is already there, what is at stake on a fight, how results split
   by origin, which closed bets a period covers and what closed since a given moment. */
import { r2 } from './odds';
import { oddLeft } from './settlement';
import { edgeSummary } from './tip';
import type { Bet, Leg, Outcome } from './types';

type Sel = { fid: string; key: string };
/** The selections of a bet as one string, whatever their order. */
export const selSig = (sels: Sel[]): string => sels.map(s => s.fid + '|' + s.key).sort().join(',');

/** The open bets that are these same selections, bet the same way: as one multiple, or each as a single. */
export function dupBets(bets: Bet[], sels: Sel[], mode: 'single' | 'multi'): Bet[] {
  const open = bets.filter(b => b.status === 'open');
  if (mode === 'multi' && sels.length > 1) { const sig = selSig(sels); return open.filter(b => b.type === 'multi' && selSig(b.legs) === sig); }
  return open.filter(b => b.type === 'single' && b.legs.length === 1 && sels.some(s => b.legs[0].fid === s.fid && b.legs[0].key === s.key));
}

/** What is already at stake on a fight: the open bets with a selection in it, and what each of them holds there.
 *  The stake of a multiple counts whole, since all of it rides on that fight too. `units` is the same stake with each
 *  bet measured by the unit it was placed with (`unitBets` of them have one). */
export function exposure(bets: Bet[], fid: string): { n: number; stake: number; units: number; unitBets: number; held: { id: string; stake: number; keys: string[]; sel: string }[] } {
  const on = bets.filter(b => b.status === 'open' && b.legs.some(l => l.fid === fid)), t = openTotals(on);
  const held = on.map(b => { const ls = b.legs.filter(l => l.fid === fid); return { id: b.id, stake: b.stake, keys: ls.map(l => l.key), sel: ls.map(l => l.sel).join(' + ') }; });
  return { n: held.length, stake: t.stake, units: t.units, unitBets: t.unitBets, held };
}

/** What a set of open bets has at stake and what it can pay: `ret` is what comes back if every one of them wins, and
 *  `gain` is that less the stakes. `units` and `gainUnits` are the stake and the gain with each bet measured by the
 *  unit it was placed with; a bet with no unit (`unitBets` counts the ones that have it) is left out of those two.
 *  Bets that are not open are ignored. With `outOf` (what each selection has come to so far) a bet with a void
 *  selection counts for what it pays now, without that fight. */
export type OutOf = (leg: Leg) => Outcome | null | undefined;
export interface OpenTotals { n: number; stake: number; ret: number; gain: number; units: number; gainUnits: number; unitBets: number }
/** The odd an open bet pays as it stands: the one it was placed at, or less when a selection of it was voided. */
export function oddNow(b: Bet, outOf?: OutOf): number {
  const outs = outOf ? b.legs.map(outOf) : [];
  return outs.includes('void') ? oddLeft(b, outs).odd : b.odd;
}
export function openTotals(bets: Bet[], outOf?: OutOf): OpenTotals {
  const t: OpenTotals = { n: 0, stake: 0, ret: 0, gain: 0, units: 0, gainUnits: 0, unitBets: 0 };
  for (const b of bets) {
    if (b.status !== 'open') continue;
    const ret = r2(b.stake * oddNow(b, outOf));
    t.n++; t.stake += b.stake; t.ret += ret;
    if (b.unit && b.unit > 0) { t.unitBets++; t.units += b.stake / b.unit; t.gainUnits += (ret - b.stake) / b.unit; }
  }
  t.stake = r2(t.stake); t.ret = r2(t.ret); t.gain = r2(t.ret - t.stake);
  t.units = Math.round(t.units * 1e4) / 1e4; t.gainUnits = Math.round(t.gainUnits * 1e4) / 1e4;
  return t;
}

/** The open bets grouped by event, in the order the fights happen: the event that starts first, and inside it the bet
 *  whose first fight comes first (`order` breaks ties between fights of the same hour: the place of the fight on the
 *  card). A multiple across events goes in a group of its own, with no event. Each group carries its totals: `ret` is
 *  what it pays if every bet in it wins, which bets against each other cannot all do. */
export interface OpenGroup extends OpenTotals { eid: string; event: string; date: number; bets: Bet[] }
export function openByEvent(bets: Bet[], order?: (fid: string) => number, outOf?: OutOf): OpenGroup[] {
  const first = (b: Bet): [number, number] => b.legs.map(l => [l.date, order ? order(l.fid) : 0] as [number, number]).sort((x, y) => x[0] - y[0] || x[1] - y[1])[0] || [0, 0];
  const m = new Map<string, { eid: string; event: string; date: number; bets: Bet[] }>();
  for (const b of bets.filter(x => x.status === 'open')) {
    const eids = [...new Set(b.legs.map(l => l.eid))], eid = eids.length === 1 ? eids[0] : '';
    const g = m.get(eid) || { eid, event: eid && b.legs[0] ? b.legs[0].event : '', date: Infinity, bets: [] };
    g.bets.push(b); g.date = Math.min(g.date, first(b)[0]);
    m.set(eid, g);
  }
  return [...m.values()].sort((x, y) => x.date - y.date || x.eid.localeCompare(y.eid)).map(g => {
    g.bets.sort((x, y) => { const fx = first(x), fy = first(y); return fx[0] - fy[0] || fx[1] - fy[1] || x.t - y.t; });
    return { ...g, ...openTotals(g.bets, outOf) };
  });
}

/** How far the odds of now are from the ones the original printed, as a share (-0.074 is 7.4% lower). The whole bet is
 *  compared when the original gives its odd, or the odd of every selection, and each selection is of a different fight;
 *  otherwise it is the selection that fell the most. Null when the original printed nothing to compare with. */
export function copyDrop(betOdd: number | null | undefined, legs: { fid: string; printed: number | null | undefined; now: number }[]): number | null {
  const round = (x: number): number => Math.round(x * 1e4) / 1e4;
  if (!legs.length || legs.some(l => !(l.now > 1))) return null;
  const apart = new Set(legs.map(l => l.fid)).size === legs.length, now = r2(legs.reduce((p, l) => p * l.now, 1));
  if (apart && betOdd && betOdd > 1) return round(now / betOdd - 1);
  if (apart && legs.length > 1 && legs.every(l => Number(l.printed) > 1)) return round(now / (Math.round(legs.reduce((p, l) => p * Number(l.printed), 1) * 1000) / 1000) - 1);
  const each = legs.filter(l => Number(l.printed) > 1).map(l => l.now / Number(l.printed) - 1);
  return each.length ? round(Math.min(...each)) : null;
}

/** A bet that came from copying someone else's, a tipster's, and not from the person's own picks: it says so itself,
 *  or it carries what only a copy has (who it is from, or an odd its original printed). */
export const isTip = (b: Bet): boolean => !!(b.copied || b.from || b.printed || b.legs.some(l => l.printed));

/** Results by whose the bets are: the person's own (`tip` false, no name) and each tipster the others were copied from
 *  (`k` is the name, '' for the copies with none), the one with the most money first. Voided and cashed-out bets are
 *  not hits or misses. `units` is the result with each bet measured by the unit it was placed with (`unitBets` of them
 *  have one), so one large bet does not decide the comparison. `edge` compares the odds taken with the printed ones. */
export interface OriginRow { k: string; tip: boolean; n: number; st: number; ret: number; won: number; dec: number; units: number; unitBets: number; edge: { n: number; avg: number; ahead: number } }
const whose = (b: Bet): string => isTip(b) ? 'T' + (b.from || '') : 'M';
function tally(r: Pick<OriginRow, 'n' | 'st' | 'ret' | 'won' | 'dec' | 'units' | 'unitBets'>, b: Bet): void {
  r.n++; r.st += b.stake; r.ret += b.payout;
  if (b.unit && b.unit > 0) { r.unitBets++; r.units += (b.payout - b.stake) / b.unit; }
  if (b.status === 'won' || b.status === 'lost') { r.dec++; if (b.status === 'won') r.won++; }
}
export function byOrigin(done: Bet[], all?: Bet[]): OriginRow[] {
  const m = new Map<string, OriginRow>();
  for (const b of done) {
    const key = whose(b), r = m.get(key) || { k: b.from || '', tip: isTip(b), n: 0, st: 0, ret: 0, won: 0, dec: 0, units: 0, unitBets: 0, edge: { n: 0, avg: 0, ahead: 0 } };
    tally(r, b); m.set(key, r);
  }
  const rows = [...m.values()].sort((a, b) => b.st - a.st);
  for (const r of rows) r.edge = edgeSummary((all || done).filter(b => isTip(b) === r.tip && (b.from || '') === r.k));
  return rows;
}

/** The person against the tipsters: the closed bets of each side summed up, and who is ahead by return on what was
 *  staked (`roi`, null with nothing staked). `ahead` is null while one of the two has nothing to compare. */
export interface BenchSide { n: number; st: number; ret: number; pnl: number; roi: number | null; won: number; dec: number; units: number; unitBets: number }
export function benchmark(done: Bet[]): { mine: BenchSide; tip: BenchSide; ahead: 'mine' | 'tip' | 'tie' | null } {
  const side = (bets: Bet[]): BenchSide => {
    const r = { n: 0, st: 0, ret: 0, won: 0, dec: 0, units: 0, unitBets: 0 };
    for (const b of bets) tally(r, b);
    const pnl = r2(r.ret - r.st);
    return { ...r, st: r2(r.st), ret: r2(r.ret), pnl, roi: r.st > 0 ? Math.round(pnl / r.st * 1e4) / 1e4 : null, units: Math.round(r.units * 1e4) / 1e4 };
  };
  const mine = side(done.filter(b => !isTip(b))), tip = side(done.filter(isTip));
  return { mine, tip, ahead: mine.roi == null || tip.roi == null ? null : mine.roi > tip.roi ? 'mine' : mine.roi < tip.roi ? 'tip' : 'tie' };
}

/** Gives the bets of one origin another name. Naming it after an origin that exists joins the two. With no origin
 *  given it names the copied bets that have none. Without a new name nothing changes. Returns a new list, and how many
 *  bets changed. */
export function renameOrigin(bets: Bet[], from: string, to: unknown): { bets: Bet[]; n: number } {
  const name = String(to == null ? '' : to).replace(/\s+/g, ' ').trim().slice(0, 40);
  const hit = (b: Bet): boolean => from ? b.from === from : isTip(b) && !b.from;
  if (!name || name === from) return { bets, n: 0 };
  return { bets: bets.map(b => hit(b) ? { ...b, from: name } : b), n: bets.filter(hit).length };
}

/** The closed bets a period of the wallet covers. `30d` goes by when the bet closed. `event` is the event of the bet
 *  that closed last (its latest fight, for a multiple across events); a bet counts when it has a selection in it. */
export type Period = 'all' | '30d' | 'event';
export function periodBets(done: Bet[], period: unknown, now: number): { bets: Bet[]; event: string | null } {
  if (period === '30d') return { bets: done.filter(b => (b.settledAt || 0) > now - 30 * 24 * 3600e3), event: null };
  if (period === 'event') {
    const last = done.slice().sort((a, b) => (b.settledAt || 0) - (a.settledAt || 0))[0];
    const leg = last && last.legs.slice().sort((a, b) => b.date - a.date)[0];
    if (!leg) return { bets: [], event: null };
    return { bets: done.filter(b => b.legs.some(l => l.eid === leg.eid)), event: leg.event };
  }
  return { bets: done, event: null };
}

/** What closed by itself after a moment: how many bets, the result (in money, and in units for the `unitBets` of them
 *  that have a unit), and the same by whose the bets are (the person's own, and each tipster). A cashout is left out:
 *  the person did that one and saw it. */
export function sinceSummary(bets: Bet[], since: unknown): { n: number; pnl: number; units: number; unitBets: number; by: { k: string; tip: boolean; n: number; pnl: number }[] } {
  const t = Number(since) || 0, closed = bets.filter(b => (b.status === 'won' || b.status === 'lost' || b.status === 'void') && (b.settledAt || 0) > t);
  const m = new Map<string, { k: string; tip: boolean; n: number; pnl: number }>();
  for (const b of closed) { const key = whose(b), r = m.get(key) || { k: b.from || '', tip: isTip(b), n: 0, pnl: 0 }; r.n++; r.pnl += b.payout - b.stake; m.set(key, r); }
  const by = [...m.values()].map(r => ({ ...r, pnl: r2(r.pnl) })).sort((a, b) => b.n - a.n || a.k.localeCompare(b.k));
  const withUnit = closed.filter(b => (b.unit || 0) > 0);
  return { n: closed.length, pnl: r2(closed.reduce((a, b) => a + b.payout - b.stake, 0)), units: Math.round(withUnit.reduce((a, b) => a + (b.payout - b.stake) / b.unit!, 0) * 1e4) / 1e4, unitBets: withUnit.length, by };
}
