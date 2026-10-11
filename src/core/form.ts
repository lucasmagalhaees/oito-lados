/* ---------- an athlete's latest fights, summed up ---------- */
import type { PastFight } from './types';

/** What a few fights add up to: how many the athlete won and lost (`other` is the ones nobody won, or with no winner
 *  told), and how the fights ended, whoever won them. */
export interface Form { n: number; won: number; lost: number; other: number; ko: number; sub: number; dec: number }
export function formSummary(fights: PastFight[]): Form {
  const f: Form = { n: fights.length, won: 0, lost: 0, other: 0, ko: 0, sub: 0, dec: 0 };
  for (const x of fights) {
    if (x.won === true) f.won++; else if (x.won === false) f.lost++; else f.other++;
    if (x.method === 'ko' || x.method === 'sub' || x.method === 'dec') f[x.method]++;
  }
  return f;
}
/** How long a fight lasted, in seconds: five minutes for each round before the last, plus the time in the last. Null
 *  when the round or the time is not told. */
export function fightSeconds(f: Pick<PastFight, 'round' | 'time'>): number | null {
  return f.round > 0 && f.time != null && f.time >= 0 ? (f.round - 1) * 300 + f.time : null;
}
