import { Core } from '../core';
import { openBets } from './api';
import { $, H, fu, money, parseMoney } from './format';
import { D, S, slip } from './state';
import type { Bet, Fight, FightStats, Priced, Pricing } from '../core';

/* ================= helpers over state ================= */
export const sum = <T>(xs: T[], f: (x: T) => number): number => xs.reduce((a, x) => a + f(x), 0);
/** Everything about the money, derived from the history: the balance is never stored. */
export interface Wallet {
  dep: number; open: Bet[]; done: Bet[]; atRisk: number; staked: number; ret: number; pnl: number; decided: number; won: number;
  balance: number; bank: number; unitPct: number; unit: number; units: number; unitBets: number;
}
/** The numbers of a set of closed bets: all of them for the balance, or the ones of a period for the wallet's figures. */
export type Stats = Pick<Wallet, 'staked' | 'ret' | 'pnl' | 'decided' | 'won' | 'units' | 'unitBets'>;
export function statsOf(done: Bet[]): Stats {
  const staked = sum(done, b => b.stake), ret = sum(done, b => b.payout);
  const decided = done.filter(b => b.status === 'won' || b.status === 'lost'), won = decided.filter(b => b.status === 'won').length;   // voided and cashed-out bets are not hits or misses
  const inUnits = done.filter(b => (b.unit || 0) > 0);            // result in units, each bet measured by the unit it was placed with
  return { staked, ret, pnl: Core.r2(ret - staked), decided: decided.length, won, units: sum(inUnits, b => (b.payout - b.stake) / b.unit!), unitBets: inUnits.length };
}
export function wallet(): Wallet {
  const dep = sum(S.deposits, d => d.v), open = openBets(), done = S.bets.filter(b => b.status !== 'open'), st = statsOf(done);
  const atRisk = sum(open, b => b.stake), balance = Core.r2(dep - sum(S.bets, b => b.stake) + st.ret), bank = Core.r2(balance + atRisk);
  return { dep, open, done, atRisk, ...st, balance, bank, unitPct: Core.unitPct(S.unitPct), unit: Core.unitValue(bank, S.unitPct) };
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
/** Selections by fight, each fight with its price: the odd of a lone selection, or the one of the same-fight combo. */
export function groupsOf(rs: Resolved[]): SlipGroup[] {
  const groups: SlipGroup[] = [];                      // one per fight; two or more selections in a fight are priced together
  for (const r of rs) { let g = groups.find(x => x.fid === r.s.fid); if (!g) groups.push(g = { fid: r.s.fid, f: r.f, rs: [] }); g.rs.push(r); }
  for (const g of groups) {
    if (!g.rs.every(r => r.ok)) { g.ok = false; continue; }
    if (g.rs.length === 1) { g.ok = true; g.odd = g.rs[0].x!.odd; continue; }
    const pr = priceOf(g.f!)!, c = Core.combo(pr.J, g.rs.map(r => r.s.key), g.rs.map(r => r.x!.odd), pr.map);
    g.combo = true; g.ok = c.ok;
    if (c.ok) { g.odd = c.odd; g.same = c.same; } else g.why = c.why;
  }
  return groups;
}
/** What a stake on these selections comes back as if it wins, priced the way the slip prices it: one multiple (each
 *  fight once, a same-fight combo at its own price), or one single per selection. Null when it has no price as asked. */
export function payoutOf(rs: Resolved[], mode: 'single' | 'multi', stake: number): number | null {
  if (!rs.length || !rs.every(r => r.ok)) return null;
  if (mode === 'single' || rs.length === 1) return Core.r2(sum(rs, r => Core.r2(stake * r.x!.odd)));
  const groups = groupsOf(rs);
  return groups.every(g => g.ok) ? Core.r2(stake * Core.r2(groups.reduce((p, g) => p * g.odd!, 1))) : null;
}
export function slipCalc(): SlipCalc {
  const rs = resolveSlip(), ok = rs.length > 0 && rs.every(r => r.ok), n = rs.length;
  const groups = groupsOf(rs);
  const multiOk = ok && n >= 2 && groups.every(g => g.ok);
  if (slip.mode === 'multi' && !multiOk) slip.mode = 'single';
  const w = wallet();
  const stake = inUnits() ? Core.r2(slip.unitsN * w.unit) : parseMoney(slip.stake);     // in units, the amount follows the unit of right now
  const odd = multiOk ? Core.r2(groups.reduce((p, g) => p * g.odd!, 1)) : (ok && n === 1 ? rs[0].x!.odd : 0);
  const total = slip.mode === 'multi' ? stake : Core.r2(stake * n);
  const ret = !ok ? 0 : slip.mode === 'multi' ? Core.r2(stake * odd) : Core.r2(sum(rs, r => stake * r.x!.odd));
  return { rs, ok, groups, multiOk, sameFight: groups.length === 1 && n > 1, stake, n, odd, total, ret, balance: w.balance, unit: w.unit, unitPct: w.unitPct };
}

/** What a new bet meets in the fights it touches: the money already at stake there in open bets, and the open bets it
 *  cannot win together with (their selections in that fight and the new ones have no outcome in common). */
export function exposureNotes(sels: { fid: string; key: string }[]): string[] {
  const notes: string[] = [];
  for (const fid of [...new Set(sels.map(s => s.fid))]) {
    const f = D.fights.get(fid), ex = Core.exposure(S.bets, fid); if (!f || !ex.n) continue;
    const mine = sels.filter(s => s.fid === fid).map(s => s.key), p = priceOf(f), names = `${f.a.last} x ${f.b.last}`;
    const against = p ? ex.held.filter(h => p.J.prob([...mine, ...h.keys]) < 1e-9) : [];
    notes.push(`Você já tem ${money(ex.stake)}${ex.unitBets ? ` (${fu(ex.units)})` : ''} em jogo em ${names}, em ${ex.n} ${ex.n > 1 ? 'apostas abertas' : 'aposta aberta'}.` +
      (against.length ? ` Esta vai contra ${against.length > 1 ? 'algumas delas' : 'ela'}: ${against.map(h => h.sel).join('; ')}.` : ''));
  }
  return notes;
}
