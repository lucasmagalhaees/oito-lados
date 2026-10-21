/* How often the source is asked again after it failed to answer. */

/** The longest the app waits before asking again. */
export const RETRY_MAX = 5 * 60e3;
/** How long to wait before the next round, given the pace of the moment and how many rounds in a row have failed: the
 *  wait doubles with each failure, up to the longest one, and is the pace of the moment again once a round goes through.
 *  A source that is down, or refusing, is not asked at the pace of a live fight. */
export function retryDelay(base: number, fails: number): number {
  const n = Number.isFinite(fails) && fails > 0 ? Math.floor(fails) : 0;
  return n ? Math.max(base, Math.min(RETRY_MAX, base * 2 ** Math.min(n, 20))) : base;
}

/** How many calls to the source a minute may hold before the reading done in the background (the latest fights of a
 *  card) waits for room, and the length of that minute. What the person asks for is never held (D105). */
export const BG_CAP = 60, BG_WINDOW = 60e3;
/** How long a background call waits so that the calls of the last minute (`times`, any order) stay under the cap,
 *  this one included. 0 when there is room now. */
export function roomIn(times: number[], now: number, cap = BG_CAP, windowMs = BG_WINDOW): number {
  const recent = times.filter(t => t > now - windowMs).sort((a, b) => a - b);
  if (recent.length < cap) return 0;
  return Math.max(0, recent[recent.length - cap] + windowMs - now);
}
