/* ---------- settlement ----------
   f: normalised fight, res: normalised result (or null), td: {a,b,final} takedowns landed (or null).
   early=true also returns outcomes that are already mathematically decided while the fight is live (display only). */
import { r2 } from './odds';
import type { Bet, BetStatus, Fight, Leg, Outcome, Result, Side, Takedowns } from './types';

type FightNow = Pick<Fight, 'canceled' | 'state' | 'winner' | 'period'>;

export function legOutcome(key: string, f: FightNow, res: Result | null | undefined, td: Takedowns | null | undefined, early?: boolean): Outcome | null {
  if (f.canceled) return 'void';
  const [m, p1, p2] = key.split(':');
  const live = !!early && f.state === 'in';
  const end = f.state === 'post' && res ? res : null;       // the result, once the fight is over and it has been read
  if (!end && !live) return null;
  if (end && end.method === 'nc') return 'void';
  if (end && end.method === 'unknown') return (m === 'ml' && f.winner) ? (f.winner === p1 ? 'won' : 'lost') : 'void';
  const finish = !!end && (end.method === 'ko' || end.method === 'sub');
  const round = end ? end.round : f.period;
  switch (m) {
    case 'ml': if (!end) return null; if (!f.winner) return 'void'; return f.winner === p1 ? 'won' : 'lost';
    case 'mov': if (!end) return null; return (f.winner === p1 && end.method === p2) ? 'won' : 'lost';
    case 'fm': if (!end) return null; return ((end.method === 'draw' ? 'dec' : end.method) === p1) ? 'won' : 'lost';
    case 'dist': if (!end) return null; return ((!finish) === (p1 === 'yes')) ? 'won' : 'lost';
    case 'tot': {
      const L = +p2, c = Math.ceil(L), over = p1 === 'o';
      if (round > c) return over ? 'won' : 'lost';
      if (!end) return null;
      if (round < c) return over ? 'lost' : 'won';
      if (end.time == null) return 'void';
      if (end.time === 150) return 'void';
      return ((end.time > 150) === over) ? 'won' : 'lost';
    }
    case 'rnd': { const n = +p1; if (round > n) return 'lost'; if (!end) return null; return (finish && end.round === n) ? 'won' : 'lost'; }
    case 'wr': { const n = +p2; if (round > n) return 'lost'; if (!end) return null; return (finish && end.round === n && f.winner === p1) ? 'won' : 'lost'; }
    case 'td': {
      const L = +p2, over = p1 === 'o';
      if (!td) return (end && end.tdUnavailable) ? 'void' : null;
      if (td.a + td.b > L) return over ? 'won' : 'lost';
      if (!end || !td.final) return null;
      return over ? 'lost' : 'won';
    }
    case 'tda': {
      const yes = p2 === 'yes';
      if (!td) return (end && end.tdUnavailable) ? 'void' : null;
      if (td[p1 as Side] >= 1) return yes ? 'won' : 'lost';
      if (!end || !td.final) return null;
      return yes ? 'lost' : 'won';
    }
  }
  return null;
}
export function betResult(bet: Pick<Bet, 'legs' | 'stake' | 'sgp'>, outs: (Outcome | null | undefined)[]): { status: BetStatus; payout: number } | null {
  if (outs.some(o => o === 'lost')) return { status: 'lost', payout: 0 };
  if (outs.some(o => o == null)) return null;
  const by = new Map<string, { legs: Pick<Leg, 'fid' | 'odd'>[]; outs: (Outcome | null | undefined)[] }>();
  bet.legs.forEach((l, i) => { const g = by.get(l.fid) || { legs: [], outs: [] }; g.legs.push(l); g.outs.push(outs[i]); by.set(l.fid, g); });
  let odd = 1, won = 0;
  for (const [fid, g] of by) {
    if (g.outs.some(o => o === 'void')) continue;        // a void leg takes that fight out of the bet at odd 1.00
    won++;
    odd *= (g.legs.length > 1 && bet.sgp && bet.sgp[fid]) ? bet.sgp[fid] : g.legs.reduce((p, l) => p * l.odd, 1);
  }
  if (!won) return { status: 'void', payout: bet.stake };
  return { status: 'won', payout: r2(bet.stake * r2(odd)) };
}
