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

/* ---------- what was kept, read back ---------- */
/** The latest fights of an athlete as they are kept: when they were read, and the fights. */
export interface FormEntry { ts: number; fights: PastFight[] }
const METHODS = ['ko', 'sub', 'dec', 'nc', 'draw', 'unknown'];
const str = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** A past fight read back from storage or from the server, or null when it is not one: every field of the right kind
 *  and of a sane size, and only the ways a fight can end that the app knows. What is kept is rebuilt field by field,
 *  so nothing else that came along is kept. */
export function readPastFight(x: unknown): PastFight | null {
  const f = x as Record<string, unknown> | null;
  if (!f || typeof f !== 'object' || !str(f.id, 40) || !f.id || !fin(f.date) || !str(f.weight, 60) || !fin(f.rounds) || !(f.won === true || f.won === false || f.won === null)) return null;
  if (!METHODS.includes(f.method as string) || !str(f.label, 80) || !(f.desc === undefined || str(f.desc, 80)) || !fin(f.round) || !str(f.clock, 12) || !(f.time === null || fin(f.time))) return null;
  return { id: f.id, date: f.date, weight: f.weight, rounds: f.rounds, won: f.won, method: f.method as PastFight['method'], label: f.label, ...(f.desc === undefined ? {} : { desc: f.desc }), round: f.round, clock: f.clock, time: f.time as number | null };
}
/** The latest fights of one athlete read back, or null: a time of reading and a list of at most `max` fights, all of
 *  them valid. One bad fight drops the whole entry, as a list one fight short would pass for a whole one. */
export function readForm(x: unknown, max = 10): FormEntry | null {
  const g = x as { ts?: unknown; fights?: unknown } | null;
  if (!g || typeof g !== 'object' || !fin(g.ts) || g.ts <= 0 || !Array.isArray(g.fights) || g.fights.length > max) return null;
  const fights = g.fights.map(readPastFight);
  return fights.every((f): f is PastFight => !!f) ? { ts: g.ts, fights: fights as PastFight[] } : null;
}
/** An athlete id as ESPN gives it, safe to put in an address. */
export const isAthleteId = (id: unknown): id is string => typeof id === 'string' && /^[\w-]{1,40}$/.test(id);
/** All the kept latest fights read back (`oitolados.cache.v1` keeps them by athlete): what is not valid is dropped. */
export function readForms(x: unknown, max = 10): Record<string, FormEntry> {
  const out: Record<string, FormEntry> = {};
  if (x && typeof x === 'object') for (const [id, g] of Object.entries(x as Record<string, unknown>)) { const e = isAthleteId(id) ? readForm(g, max) : null; if (e) out[id] = e; }
  return out;
}
/** The rows of the server cache of latest fights (`athlete`, `data`, `fetched_at`) that can be used now: an athlete
 *  asked for, valid fights, read within `ttl` and not later than now (a clock ahead by up to five minutes is let
 *  through). The time of reading is the one of the row, so the week counts from when the fights were read, on
 *  whichever device. */
export function formRows(rows: unknown, asked: string[], now: number, ttl: number, max = 10): Record<string, FormEntry> {
  const out: Record<string, FormEntry> = {};
  if (!Array.isArray(rows)) return out;
  for (const r of rows as Record<string, unknown>[]) {
    if (!r || typeof r !== 'object' || !isAthleteId(r.athlete) || !asked.includes(r.athlete) || typeof r.fetched_at !== 'string') continue;
    const ts = Date.parse(r.fetched_at), data = r.data as { fights?: unknown } | null;
    const e = Number.isFinite(ts) && ts <= now + 5 * 60e3 && now - ts < ttl && data && typeof data === 'object' ? readForm({ ts, fights: data.fights }, max) : null;
    if (e && (!out[r.athlete] || out[r.athlete].ts < e.ts)) out[r.athlete] = e;
  }
  return out;
}
