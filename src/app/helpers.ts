import { Core } from '../core';
import { openBets } from './api';
import { $, H, parseMoney } from './format';
import { D, S, slip } from './state';
import type { Bet, Fight, FightStats, Priced, Pricing } from '../core';

/* ================= helpers over state ================= */
export const sum = <T>(xs: T[], f: (x: T) => number): number => xs.reduce((a, x) => a + f(x), 0);
/** Everything about the money, derived from the history: the balance is never stored. */
export interface Wallet {
  dep: number; open: Bet[]; done: Bet[]; atRisk: number; staked: number; ret: number; pnl: number; decided: number; won: number;
  balance: number; bank: number; unitPct: number; unit: number; units: number; unitBets: number;
}
export function wallet(): Wallet {
  const dep = sum(S.deposits, d => d.v), open = openBets(), done = S.bets.filter(b => b.status !== 'open');
  const staked = sum(done, b => b.stake), ret = sum(done, b => b.payout);
  const decided = done.filter(b => b.status === 'won' || b.status === 'lost'), won = decided.filter(b => b.status === 'won').length;   // voided and cashed-out bets are not hits or misses
  const atRisk = sum(open, b => b.stake), balance = Core.r2(dep - sum(S.bets, b => b.stake) + ret), bank = Core.r2(balance + atRisk);
  const inUnits = done.filter(b => (b.unit || 0) > 0);            // result in units, each bet measured by the unit it was placed with
  return { dep, open, done, atRisk, staked, ret, pnl: Core.r2(ret - staked), decided: decided.length, won, balance, bank,
    unitPct: Core.unitPct(S.unitPct), unit: Core.unitValue(bank, S.unitPct), units: sum(inUnits, b => (b.payout - b.stake) / b.unit!), unitBets: inUnits.length };
}
export const statsFor = (f: Fight): FightStats => ({ a: D.astats[f.a.id], b: D.astats[f.b.id] });
export const canBet = (f: Fight): boolean => f.state === 'pre' && !f.canceled && !!D.odds[f.id] && Date.now() < f.date + 8 * H;
const priced = new Map<string, { sig: string; p: Pricing }>();
export function priceOf(f: Fight): Pricing | null {
  const o = D.odds[f.id]; if (!o) return null;
  const sa = D.astats[f.a.id], sb = D.astats[f.b.id];
  const sig = [o.ts, sa ? sa.ts : 0, sb ? sb.ts : 0, f.rounds, f.a.id, f.b.id].join('|');
  const c = priced.get(f.id);
  if (c && c.sig === sig) return c.p;
  const p = Core.price(f, o, statsFor(f)); priced.set(f.id, { sig, p }); return p;
}
/** One selection of the slip against what can be bet on right now. `ok` means it has a price. */
export interface Resolved { s: { fid: string; key: string }; f: Fight | undefined; x: Priced | null | undefined; ok: boolean }
export function resolveSlip(): Resolved[] {
  return slip.sels.map(s => {
    const f = D.fights.get(s.fid), p = f && canBet(f) ? priceOf(f) : null, x = p && p.map[s.key];
    return { s, f, x, ok: !!x };
  });
}
// The stake can be typed in money or in units of the bankroll (S.stakeIn). Both forms are kept in step:
// slip.stake is the money text, slip.units the units text and slip.unitsN the exact number of units behind it.
export const inUnits = (): boolean => S.stakeIn === 'units' && wallet().unit > 0;
export function setStakeMoney(v: number): void { const u = wallet().unit; slip.stake = v > 0 ? Core.moneyText(v) : ''; slip.unitsN = v > 0 && u > 0 ? v / u : 0; slip.units = Core.unitsText(slip.unitsN); }
export function setStakeUnits(n: number): void { slip.unitsN = n > 0 ? n : 0; slip.units = Core.unitsText(slip.unitsN); slip.stake = slip.unitsN ? Core.moneyText(Core.r2(slip.unitsN * wallet().unit)) : ''; }
export function showStake(): void { const a = $<HTMLInputElement>('#stake'), b = $<HTMLInputElement>('#stakeu'); if (a) a.value = slip.stake; if (b) b.value = slip.units; }
/** The selections of one fight in the slip. Two or more are priced together, as a same-fight combo. */
export interface SlipGroup { fid: string; f: Fight | undefined; rs: Resolved[]; ok?: boolean; odd?: number; combo?: boolean; why?: 'impossible' | 'redundant'; same?: string }
export interface SlipCalc {
  rs: Resolved[]; ok: boolean; groups: SlipGroup[]; multiOk: boolean; sameFight: boolean; stake: number; n: number; odd: number;
  total: number; ret: number; balance: number; unit: number; unitPct: number;
}
export function slipCalc(): SlipCalc {
  const rs = resolveSlip(), ok = rs.length > 0 && rs.every(r => r.ok), n = rs.length;
  const groups: SlipGroup[] = [];                      // one per fight; two or more selections in a fight are priced together
  for (const r of rs) { let g = groups.find(x => x.fid === r.s.fid); if (!g) groups.push(g = { fid: r.s.fid, f: r.f, rs: [] }); g.rs.push(r); }
  for (const g of groups) {
    if (!g.rs.every(r => r.ok)) { g.ok = false; continue; }
    if (g.rs.length === 1) { g.ok = true; g.odd = g.rs[0].x!.odd; continue; }
    const pr = priceOf(g.f!)!, c = Core.combo(pr.J, g.rs.map(r => r.s.key), g.rs.map(r => r.x!.odd), pr.map);
    g.combo = true; g.ok = c.ok;
    if (c.ok) { g.odd = c.odd; g.same = c.same; } else g.why = c.why;
  }
  const multiOk = ok && n >= 2 && groups.every(g => g.ok);
  if (slip.mode === 'multi' && !multiOk) slip.mode = 'single';
  const w = wallet();
  const stake = inUnits() ? Core.r2(slip.unitsN * w.unit) : parseMoney(slip.stake);     // in units, the amount follows the unit of right now
  const odd = multiOk ? Core.r2(groups.reduce((p, g) => p * g.odd!, 1)) : (ok && n === 1 ? rs[0].x!.odd : 0);
  const total = slip.mode === 'multi' ? stake : Core.r2(stake * n);
  const ret = !ok ? 0 : slip.mode === 'multi' ? Core.r2(stake * odd) : Core.r2(sum(rs, r => stake * r.x!.odd));
  return { rs, ok, groups, multiOk, sameFight: groups.length === 1 && n > 1, stake, n, odd, total, ret, balance: w.balance, unit: w.unit, unitPct: w.unitPct };
}
