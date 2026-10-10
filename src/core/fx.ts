/* ---------- currency ----------
   The bankroll lives in one currency. Depositing in another one converts everything at the day's rate.
   normFx reads the Frankfurter answer for base=BRL into { date, rates: { BRL: 1, USD, EUR } }, or null if it is not that. */
import { r2 } from './odds';
import type { AppState, Bet, Currency, FxRates, Json } from './types';

export function normFx(j: Json): FxRates | null {
  if (!j || typeof j !== 'object' || j.base !== 'BRL' || !j.rates || typeof j.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(j.date)) return null;
  const rates: Record<string, number> = { BRL: 1 };
  for (const c of ['USD', 'EUR']) { const v = j.rates[c]; if (typeof v !== 'number' || !isFinite(v) || !(v > 0)) return null; rates[c] = v; }
  return { date: j.date, rates: rates as FxRates['rates'] };
}
// how many units of `to` one unit of `from` buys
export const fxRate = (fx: Pick<FxRates, 'rates'> | null | undefined, from: string, to: string): number | null => {
  const r = fx && fx.rates as Record<string, number> | undefined;
  return (r && r[from] > 0 && r[to] > 0) ? r[to] / r[from] : null;
};
type Money = Pick<AppState, 'deposits'> & { bets: Pick<Bet, 'stake' | 'payout'>[] };
export const balanceOf = (st: Money): number => r2(st.deposits.reduce((a, d) => a + d.v, 0) - st.bets.reduce((a, b) => a + b.stake, 0) + st.bets.reduce((a, b) => a + (b.payout || 0), 0));
// Every amount of the state in the new currency. Each one is rounded to cents, and whatever cents that rounding moved
// go into the largest deposit, so the balance afterwards is exactly the old balance at the rate.
export function convertState<T extends AppState>(st: T, to: Currency, rate: number): T {
  const m = (v: number): number => r2(v * rate);
  const out = Object.assign({}, st, { cur: to,
    deposits: st.deposits.map(d => Object.assign({}, d, { v: Math.max(0.01, m(d.v)) })),
    bets: st.bets.map(b => {
      const n = Object.assign({}, b, { stake: Math.max(0.01, m(b.stake)), payout: m(b.payout || 0) });
      if (b.unit && b.unit > 0) n.unit = Math.round(b.unit * rate * 1e4) / 1e4;
      if (b.cash && b.cash.full) n.cash = Object.assign({}, b.cash, { full: m(b.cash.full) });
      return n;
    }) });
  const drift = r2(Math.max(0, m(balanceOf(st))) - balanceOf(out));
  if (drift && out.deposits.length) { const big = out.deposits.reduce((a, d) => (d.v > a.v ? d : a)); big.v = r2(big.v + drift); }
  return out;
}
