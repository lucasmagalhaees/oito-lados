/* ---------- money fields ----------
   maskMoney formats what is being typed: "1500" -> "1.500", "12345,6" -> "12.345,6". Dots are always thousands
   separators and are rebuilt on every keystroke; the first comma starts the cents (two digits at most). */
import { clamp, r2 } from './odds';

export function maskMoney(raw: unknown): string {
  const s = String(raw == null ? '' : raw).replace(/[^\d,]/g, ''), i = s.indexOf(',');
  const int = (i >= 0 ? s.slice(0, i) : s).replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return i < 0 ? int : (int || '0') + ',' + s.slice(i + 1).replace(/,/g, '').slice(0, 2);
}
export function parseMoney(text: unknown): number {
  const s = String(text == null ? '' : text).replace(/[^\d,]/g, '').replace(',', '.').replace(/,/g, '');
  const n = parseFloat(s);
  return isFinite(n) && n > 0 ? r2(n) : 0;
}
export const moneyText = (n: number): string => maskMoney(String(r2(n)).replace('.', ','));      // a number as it should appear in a field

/* ---------- unit ----------
   One unit is a percentage of the bankroll (10% unless the person sets another). pct is cleaned to 0.1..100. */
const UNIT_PCT_DEFAULT = 10;
export const unitPct = (v: unknown): number => { const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v); return isFinite(n) && n > 0 ? clamp(r2(n), 0.1, 100) : UNIT_PCT_DEFAULT; };
export const unitValue = (bankroll: unknown, pct: unknown): number => r2(Math.max(0, Number(bankroll) || 0) * unitPct(pct) / 100);
// a stake typed in units: digits and one comma (a dot counts as the comma), two decimals, at most 9999,99
export function maskUnits(text: unknown): string {
  const t = String(text == null ? '' : text).replace(/\./g, ',').replace(/[^\d,]/g, ''), i = t.indexOf(',');
  const int = (i < 0 ? t : t.slice(0, i)).replace(/^0+(?=\d)/, '').slice(0, 4);
  return i < 0 ? int : (int || '0') + ',' + t.slice(i + 1).replace(/,/g, '').slice(0, 2);
}
export const parseUnits = (text: unknown): number => { const n = parseFloat(maskUnits(text).replace(',', '.')); return isFinite(n) && n > 0 ? r2(n) : 0; };
export const unitsText = (n: number): string => (isFinite(n) && n > 0 ? String(r2(n)).replace('.', ',') : '');

/* ---------- stakes in units: a suggestion for long multiples, and the steps of the field ----------
   A multiple of five or more selections is a long shot; the stake suggested for it is a fraction of a unit. */
export const LONG_MULTI = 5;
export const LONG_STAKES = [0.2, 0.3, 0.4];
export const suggestedUnits = (selections: unknown, mode: unknown): number[] => (mode === 'multi' && Number(selections) >= LONG_MULTI ? LONG_STAKES.slice() : []);
/** One step of a units field: up or down to the next half unit, never below zero nor past what the field takes. */
export function stepUnits(now: unknown, dir: number): number {
  const n = Number(now), k = (isFinite(n) && n > 0 ? n : 0) / 0.5;
  const next = dir > 0 ? Math.floor(k + 1e-9) + 1 : Math.ceil(k - 1e-9) - 1;
  return clamp(r2(next * 0.5), 0, 9999.5);
}
