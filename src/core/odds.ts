/* ---------- odds maths ---------- */
import type { Fight } from './types';

export const r2 = (x: number): number => Math.round((x + Number.EPSILON) * 100) / 100;
export const clamp = (x: number, a: number, b: number): number => Math.min(b, Math.max(a, x));
const parseAm = (v: unknown): number | null => {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (/^ev/i.test(s)) return 100;
  const n = parseFloat(s.replace('+', ''));
  return isFinite(n) ? n : null;
};
/** American odds (a number, "+130", "EVEN") to decimal with two places, or null when there is no price. */
export const am2dec = (v: unknown): number | null => { const am = parseAm(v); if (!am) return null; return r2(am > 0 ? 1 + am / 100 : 1 + 100 / Math.abs(am)); };
/** Decimal prices of one market to fair probabilities: the book's margin taken out proportionally. */
export const devig = (odds: number[]): number[] => { const q = odds.map(o => 1 / o); const s = q.reduce((a, b) => a + b, 0); return q.map(x => x / s); };
const MARGIN = 1.07;
/** The price of an estimated selection: fair probability to decimal odd with the app's margin, or null when it is too unlikely to offer. */
export const mo = (p: number): number | null => (!(p > 0.004) ? null : clamp(r2(1 / (p * MARGIN)), 1.02, 51));

// historical finish mix by division: [KO/TKO, submission, decision]. Only used when the book has no method line.
const DIV: Record<string, number[]> = {
  'Heavyweight': [.48, .12, .40], 'Light Heavyweight': [.42, .14, .44], 'Middleweight': [.36, .17, .47],
  'Welterweight': [.31, .16, .53], 'Lightweight': [.27, .19, .54], 'Featherweight': [.26, .17, .57],
  'Bantamweight': [.24, .17, .59], 'Flyweight': [.20, .20, .60], 'W Featherweight': [.22, .15, .63],
  'W Bantamweight': [.18, .17, .65], 'W Flyweight': [.13, .17, .70], 'W Strawweight': [.10, .17, .73],
  _: [.28, .17, .55]
};
export function baseMix(f: Pick<Fight, 'weight' | 'rounds'>): number[] {
  let b = DIV[f.weight] || DIV._;
  if (f.rounds >= 5) { const d = b[2] * 0.88, k = (1 - d) / (1 - b[2]); b = [b[0] * k, b[1] * k, d]; }
  return b;
}
