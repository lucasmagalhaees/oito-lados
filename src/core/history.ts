/* ---------- questions asked of the bet history ----------
   Pure functions over the list of bets: whether a bet is already there, what is at stake on a fight, how results split
   by origin, which closed bets a period covers and what closed since a given moment. */
import { r2 } from './odds';
import { edgeSummary } from './tip';
import type { Bet } from './types';

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
 *  The stake of a multiple counts whole, since all of it rides on that fight too. */
export function exposure(bets: Bet[], fid: string): { n: number; stake: number; held: { id: string; stake: number; keys: string[]; sel: string }[] } {
  const held = bets.filter(b => b.status === 'open' && b.legs.some(l => l.fid === fid))
    .map(b => { const ls = b.legs.filter(l => l.fid === fid); return { id: b.id, stake: b.stake, keys: ls.map(l => l.key), sel: ls.map(l => l.sel).join(' + ') }; });
  return { n: held.length, stake: r2(held.reduce((a, h) => a + h.stake, 0)), held };
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

/** Results by who the bets were copied from ('' for the ones with no origin), the origin with the most money first.
 *  Voided and cashed-out bets are not hits or misses. `edge` compares the odds taken with the printed ones. */
export interface OriginRow { k: string; n: number; st: number; ret: number; won: number; dec: number; edge: { n: number; avg: number; ahead: number } }
export function byOrigin(done: Bet[], all?: Bet[]): OriginRow[] {
  const m = new Map<string, OriginRow>();
  for (const b of done) {
    const k = b.from || '', r = m.get(k) || { k, n: 0, st: 0, ret: 0, won: 0, dec: 0, edge: { n: 0, avg: 0, ahead: 0 } };
    r.n++; r.st += b.stake; r.ret += b.payout;
    if (b.status === 'won' || b.status === 'lost') { r.dec++; if (b.status === 'won') r.won++; }
    m.set(k, r);
  }
  const rows = [...m.values()].sort((a, b) => b.st - a.st);
  for (const r of rows) r.edge = edgeSummary((all || done).filter(b => (b.from || '') === r.k));
  return rows;
}

/** Gives the bets of one origin another name. Naming it after an origin that exists joins the two. Without a new name
 *  nothing changes. Returns a new list, and how many bets changed. */
export function renameOrigin(bets: Bet[], from: string, to: unknown): { bets: Bet[]; n: number } {
  const name = String(to == null ? '' : to).replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!from || !name || name === from) return { bets, n: 0 };
  return { bets: bets.map(b => b.from === from ? { ...b, from: name } : b), n: bets.filter(b => b.from === from).length };
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

/** What closed by itself after a moment: how many bets, the result, and the same by origin. A cashout is left out:
 *  the person did that one and saw it. */
export function sinceSummary(bets: Bet[], since: unknown): { n: number; pnl: number; by: { k: string; n: number; pnl: number }[] } {
  const t = Number(since) || 0, closed = bets.filter(b => (b.status === 'won' || b.status === 'lost' || b.status === 'void') && (b.settledAt || 0) > t);
  const m = new Map<string, { k: string; n: number; pnl: number }>();
  for (const b of closed) { const k = b.from || '', r = m.get(k) || { k, n: 0, pnl: 0 }; r.n++; r.pnl += b.payout - b.stake; m.set(k, r); }
  const by = [...m.values()].map(r => ({ ...r, pnl: r2(r.pnl) })).sort((a, b) => b.n - a.n || a.k.localeCompare(b.k));
  return { n: closed.length, pnl: r2(closed.reduce((a, b) => a + b.payout - b.stake, 0)), by };
}
