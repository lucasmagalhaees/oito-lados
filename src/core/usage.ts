/* Counting the calls the app makes to its source: how many, of what kind, how long they took and how much came back.
   The counts live on the device and leave it only when the person exports them. */

/** What a call is for: the board, the odds of a fight (its distance line included), the result of a fight, the takedowns
 *  of a fight, the takedown average of an athlete, and the latest fights of an athlete. */
export type UsageKind = 'board' | 'odds' | 'result' | 'td' | 'astats' | 'form';
export const USAGE_KINDS: UsageKind[] = ['board', 'odds', 'result', 'td', 'astats', 'form'];
/** For how many days the counts are kept. */
export const USAGE_DAYS = 30;
/** Calls, the ones that failed, the time they took in all, what came back in all, and the slowest one. */
export interface UsageCell { n: number; err: number; ms: number; bytes: number; max: number }
/** A day of counts by kind, and the most calls made within one minute of it. */
export interface UsageDay { peak: number; k: Partial<Record<UsageKind, UsageCell>> }
export interface UsageLog { v: 1; days: Record<string, UsageDay>; min?: { m: number; n: number } }
/** One call: when it ended, the day it is counted on (as the device tells the date), and how it went. */
export interface UsageCall { t: number; day: string; kind: UsageKind; ms: number; bytes: number; ok: boolean }
export interface UsageSum { total: UsageCell; peak: number; k: Record<UsageKind, UsageCell>; days: number }

const cell = (): UsageCell => ({ n: 0, err: 0, ms: 0, bytes: 0, max: 0 });
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
export const usageEmpty = (): UsageLog => ({ v: 1, days: {} });

/** A saved log, as it was read from storage: what is not a count is dropped, so a damaged log never breaks the page. */
export function usageRead(x: unknown): UsageLog {
  const log = usageEmpty(), days = x && typeof x === 'object' ? (x as { days?: unknown }).days : null;
  if (!days || typeof days !== 'object') return log;
  for (const [day, d] of Object.entries(days as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !d || typeof d !== 'object') continue;
    const k = (d as { k?: unknown }).k, out: UsageDay = { peak: num((d as { peak?: unknown }).peak), k: {} };
    if (k && typeof k === 'object') for (const kind of USAGE_KINDS) {
      const c = (k as Record<string, unknown>)[kind] as Partial<UsageCell> | undefined;
      if (c && typeof c === 'object' && num(c.n)) out.k[kind] = { n: num(c.n), err: num(c.err), ms: num(c.ms), bytes: num(c.bytes), max: num(c.max) };
    }
    log.days[day] = out;
  }
  return trim(log);
}
function trim(log: UsageLog): UsageLog {
  const keys = Object.keys(log.days).sort();
  for (const old of keys.slice(0, Math.max(0, keys.length - USAGE_DAYS))) delete log.days[old];
  return log;
}
/** Counts one call in the log (which is changed and given back). Only the latest days are kept. */
export function usageAdd(log: UsageLog, c: UsageCall): UsageLog {
  const day = log.days[c.day] || (log.days[c.day] = { peak: 0, k: {} });
  const x = day.k[c.kind] || (day.k[c.kind] = cell()), ms = num(c.ms);
  x.n++; if (!c.ok) x.err++;
  x.ms += ms; x.bytes += num(c.bytes); if (ms > x.max) x.max = ms;
  const m = Math.floor(c.t / 60e3);
  if (!log.min || log.min.m !== m) log.min = { m, n: 0 };
  log.min.n++; if (log.min.n > day.peak) day.peak = log.min.n;
  return trim(log);
}
/** The counts of the days from `from` on (a day as the log names it; empty for all of them), by kind and in all. */
export function usageSum(log: UsageLog, from: string): UsageSum {
  const sum: UsageSum = { total: cell(), peak: 0, k: { board: cell(), odds: cell(), result: cell(), td: cell(), astats: cell(), form: cell() }, days: 0 };
  for (const [day, d] of Object.entries(log.days)) {
    if (day < from) continue;
    sum.days++; if (d.peak > sum.peak) sum.peak = d.peak;
    for (const kind of USAGE_KINDS) {
      const c = d.k[kind]; if (!c) continue;
      for (const to of [sum.k[kind], sum.total]) { to.n += c.n; to.err += c.err; to.ms += c.ms; to.bytes += c.bytes; if (c.max > to.max) to.max = c.max; }
    }
  }
  return sum;
}
