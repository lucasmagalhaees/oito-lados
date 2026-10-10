import { Core } from '../core';
import { priceOf } from './helpers';
import { legOut } from './settle';
import { D } from './state';
import type { Bet, Cashout, CashoutWhy } from '../core';

/* ================= cashout ================= */
export const CASH_WHY: Partial<Record<CashoutWhy, string>> = {
  live: 'Cashout congelado: tem luta desta aposta em andamento.',
  settling: 'Cashout volta quando sair o resultado da luta que acabou.',
  noprice: 'Cashout indisponível agora: falta a odd atual da luta que resta.',
  unknown: 'Cashout indisponível: não achei a luta no card agora.',
  lost: ''
};
// today's fair chance of the given selections of one fight: the moneyline for a lone winner pick, the joint model that prices combos for the rest
export function chanceNow(fid: string, keys: string[]): number | null {
  const f = D.fights.get(fid);
  if (!f || f.canceled || f.state !== 'pre') return null;
  const p = priceOf(f);
  return p ? p.chance(keys) : null;
}
export const cashoutOf = (b: Bet): Cashout => Core.cashout(b, b.legs.map(l => { const f = D.fights.get(l.fid); return f ? { state: f.state, canceled: f.canceled, out: legOut(l, false) } : null; }), chanceNow);
