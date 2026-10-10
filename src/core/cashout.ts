/* ---------- cashout ----------
   Two regimes, never while a fight of the bet is live:
   - nothing of the bet has been won yet and what is left has not started: the whole stake comes back;
   - part of a parlay has already won and the rest has not started: an offer at market value, like a sportsbook's:
     what the bet would pay x the chance, at today's prices, that the remaining selections also win, less a margin.
   legs: for each leg, in order, { state, canceled, out } of its fight (out = settled outcome or null), or null when
   the fight is not on the board. probOf(fid, keys) gives today's fair probability of those selections of that fight
   all winning, or null when it cannot be priced. */
import { r2 } from './odds';
import type { Bet, Cashout, Leg, LegNow } from './types';

export const CASHOUT_MARGIN = 0.05;
type CashBet = Pick<Bet, 'stake'> & { status?: Bet['status']; sgp?: Bet['sgp']; legs: Pick<Leg, 'fid' | 'key' | 'odd'>[] };

export function cashout(bet: CashBet, legs: (LegNow | null | undefined)[], probOf?: ((fid: string, keys: string[]) => number | null | undefined) | null): Cashout {
  if (bet.status && bet.status !== 'open') return { ok: false, why: 'closed' };
  if (!legs.length || legs.some(x => !x)) return { ok: false, why: 'unknown' };
  const now = legs as LegNow[];
  if (now.some(x => x.state === 'in')) return { ok: false, why: 'live' };
  if (now.some(x => x.out === 'lost')) return { ok: false, why: 'lost' };
  const by = new Map<string, { legs: CashBet['legs']; at: LegNow[] }>();
  bet.legs.forEach((l, i) => { const g = by.get(l.fid) || { legs: [], at: [] }; g.legs.push(l); g.at.push(now[i]); by.set(l.fid, g); });
  let odd = 1, prob: number | null = 1, won = 0, pending = 0;
  for (const [fid, g] of by) {
    if (g.at.some(x => x.out === 'void')) continue;                       // a voided fight is out of the bet at odd 1.00
    const price = (g.legs.length > 1 && bet.sgp && bet.sgp[fid]) ? bet.sgp[fid] : g.legs.reduce((p, l) => p * l.odd, 1);
    if (g.at.every(x => x.out === 'won')) { odd *= price; won++; continue; }
    if (g.at.some(x => x.state !== 'pre' || x.canceled)) return { ok: false, why: 'settling' };   // over, result still to come
    pending++; odd *= price;
    const p = probOf ? probOf(fid, g.legs.map(l => l.key)) : null;
    if (p == null) prob = null; else if (prob != null) prob *= p;
  }
  if (!pending) return { ok: false, why: 'settling' };
  if (!won) return { ok: true, kind: 'refund', value: bet.stake };
  if (prob == null || !(prob > 0)) return { ok: false, why: 'noprice' };
  const full = r2(bet.stake * r2(odd)), value = Math.min(full, r2(full * prob * (1 - CASHOUT_MARGIN)));
  if (value < 0.01) return { ok: false, why: 'noprice' };
  return { ok: true, kind: 'market', value, full, chance: prob };
}
