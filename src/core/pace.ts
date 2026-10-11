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
