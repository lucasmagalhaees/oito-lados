/* Keeping two devices in step (the phone and the computer). Each device keeps the whole state and stays the source of
   what it shows; a copy goes to the server, and the copies are joined. Pure: no page, no network, no storage.

   Three marks make the join possible, and `stamp` puts them on the state each time it is saved, by comparing it with
   what was saved before, so no other part of the app has to remember to set them:
   - `u` on each bet: when it last changed. The same bet on two devices: the later one is kept.
   - `setAt`: when a setting last changed. The later settings are kept.
   - `epoch`: when the history was rewritten as a whole (a reset, a restore, a change of currency). Two devices on
     different epochs are not joined item by item: the later rewrite wins, and from the other side only what was created
     after it, in the same currency, is kept. Otherwise a reset would come back from the other device. */
import type { AppState, Bet, Deposit } from './types';

const SETTINGS = ['unitPct', 'stakeIn', 'theme', 'corners', 'copyDrop'] as const;
const settingsJson = (s: AppState): string => JSON.stringify(SETTINGS.map(k => (s as unknown as Record<string, unknown>)[k] ?? null));
const betJson = (b: Bet): string => { const { u: _u, ...rest } = b; return JSON.stringify(rest); };
const depKey = (d: Deposit): string => `${d.t}:${d.v}`;

/** The state about to be saved, with its marks updated against what was saved before (`prev`, null on the first save
 *  of a page): a bet that changed gets `u = now` (a bet with no mark gets the time it was settled or placed), settings
 *  that changed get `setAt = now`, and a history that lost a bet or a deposit, or changed currency, gets `epoch = now`,
 *  or one past the rewrite it already knew, if that is later. */
export function stamp(prev: AppState | null, next: AppState, now: number): AppState {
  const before = new Map((prev ? prev.bets : []).map(b => [b.id, betJson(b)]));
  const bets = next.bets.map(b => {
    const was = before.get(b.id), mark = was === undefined ? (prev ? now : (b.u || b.settledAt || b.t)) : was === betJson(b) ? (b.u || b.settledAt || b.t) : now;
    return b.u === mark ? b : { ...b, u: mark };
  });
  const out: AppState = { ...next, bets };
  if (!prev) return out;
  const ids = new Set(next.bets.map(b => b.id)), deps = new Set(next.deposits.map(depKey));
  const rewritten = prev.bets.some(b => !ids.has(b.id)) || prev.deposits.some(d => !deps.has(depKey(d))) || (prev.cur || 'BRL') !== (next.cur || 'BRL');
  // never behind the rewrite already known (a device whose clock runs late must still win with its own reset)
  if (rewritten) out.epoch = Math.max(now, (prev.epoch || 0) + 1);
  if (settingsJson(prev) !== settingsJson(next)) out.setAt = now;
  return out;
}

/** Of two copies of the same bet, the one to keep. A bet that is closed (settled or cashed out) wins over the same bet
 *  still open, whatever the marks say: a bet never opens again in the app, and a cash-out cannot be redone. Otherwise the
 *  later change; with no marks, the one further along. */
function laterBet(a: Bet, b: Bet): Bet {
  const done = (x: Bet): boolean => x.status !== 'open';
  if (done(a) !== done(b)) return done(a) ? a : b;
  if ((a.u || 0) !== (b.u || 0)) return (a.u || 0) > (b.u || 0) ? a : b;
  const rank = (x: Bet): number => (x.status === 'open' ? 0 : 1) * 1e15 + (x.settledAt || 0);
  return rank(b) > rank(a) ? b : a;
}

/** What joining two copies did: the state to keep, and how many bets and deposits from the losing side of a rewrite
 *  were left out (they were made before the rewrite, or in another currency). */
export interface Joined { state: AppState; dropped: number }

/** Joins the state of this device with the copy from the server. Bets, deposits and conversions are unions; the rest
 *  goes by the marks, so with different marks the result is the same whichever side is "local". On an exact tie of
 *  marks, the local side is kept. */
export function mergeStates(local: AppState, remote: AppState): Joined {
  const el = local.epoch || 0, er = remote.epoch || 0, sameCur = (local.cur || 'BRL') === (remote.cur || 'BRL');
  // two histories in different currencies cannot be summed: if no rewrite tells them apart, the one with the later
  // activity is kept whole (then the currency), so both devices pick the same one
  const union = el === er && sameCur;
  const localWins = el !== er ? el > er : sameCur || lastAt(local) !== lastAt(remote) ? lastAt(local) >= lastAt(remote) : (local.cur || 'BRL') > (remote.cur || 'BRL');
  const [win, lose] = localWins ? [local, remote] : [remote, local];
  const cut = union ? -Infinity : (win.epoch || 0);
  const take = <T extends { t: number }>(x: T): boolean => union || (sameCur && x.t > cut);
  const bets = new Map<string, Bet>(), deps = new Map<string, Deposit>();
  for (const b of win.bets) bets.set(b.id, b);
  let dropped = 0;
  for (const b of lose.bets) {
    const have = bets.get(b.id);
    if (have) bets.set(b.id, laterBet(have, b));
    else if (take(b)) bets.set(b.id, b);
    else dropped++;
  }
  for (const d of win.deposits) deps.set(depKey(d), d);
  for (const d of lose.deposits) { if (deps.has(depKey(d))) continue; if (take(d)) deps.set(depKey(d), d); else dropped++; }
  const conv = new Map([...(union ? [...(lose.conv || []), ...(win.conv || [])] : win.conv || [])].map(c => [c.t, c]));
  const settingsFrom = (local.setAt || 0) >= (remote.setAt || 0) ? local : remote;
  const settings: Record<string, unknown> = {};
  for (const k of SETTINGS) { const v = (settingsFrom as unknown as Record<string, unknown>)[k]; if (v !== undefined) settings[k] = v; }
  const seen = Math.max(local.seen || 0, remote.seen || 0);
  const state: AppState = {
    v: 1, ...(win.cur ? { cur: win.cur } : {}), ...settings,
    ...(conv.size ? { conv: [...conv.values()].sort((a, b) => a.t - b.t).slice(-20) } : {}),
    ...(seen ? { seen } : {}), ...(win.epoch ? { epoch: win.epoch } : {}),
    ...(Math.max(local.setAt || 0, remote.setAt || 0) ? { setAt: Math.max(local.setAt || 0, remote.setAt || 0) } : {}),
    deposits: [...deps.values()].sort((a, b) => a.t - b.t), bets: [...bets.values()].sort((a, b) => a.t - b.t)
  };
  return { state, dropped };
}

/** When a state last had anything happen: the latest bet change, deposit or conversion. */
function lastAt(s: AppState): number {
  return Math.max(0, ...s.bets.map(b => b.u || b.settledAt || b.t || 0), ...s.deposits.map(d => d.t || 0), ...(s.conv || []).map(c => c.t || 0));
}

/** What to do the first time a device meets the server copy of an account (this device was never joined with it):
 *  - `push`: the server has nothing yet; this device's history goes up.
 *  - `adopt`: this device has nothing; it takes the server's history, whatever it did before (a reset, a change of
 *    currency) on its own.
 *  - `union`: one side already holds everything the other has (or both are the same), in the same currency; the two
 *    are summed, with no rewrite cutting anything out.
 *  - `ask`: each has something the other has not. The person chooses; `canJoin` says whether summing is possible
 *    (it is not when the currencies differ). */
export function firstMeet(local: AppState, remote: AppState | null): { how: 'push' | 'adopt' | 'union' | 'ask'; canJoin: boolean } {
  const sameCur = !!remote && (local.cur || 'BRL') === (remote.cur || 'BRL');
  if (!remote || (!remote.bets.length && !remote.deposits.length)) return { how: 'push', canJoin: true };
  if (!local.bets.length && !local.deposits.length) return { how: 'adopt', canJoin: true };
  const has = (s: AppState): Set<string> => new Set([...s.bets.map(b => 'b' + b.id), ...s.deposits.map(d => 'd' + depKey(d))]);
  const a = has(local), b = has(remote), aInB = [...a].every(x => b.has(x)), bInA = [...b].every(x => a.has(x));
  if (sameCur && (aInB || bInA)) return { how: 'union', canJoin: true };
  return { how: 'ask', canJoin: sameCur };
}
/** Summing two histories met for the first time: every bet and deposit of both, whatever rewrites each side had. */
export function joinBoth(local: AppState, remote: AppState): Joined {
  const epoch = Math.max(local.epoch || 0, remote.epoch || 0);
  return mergeStates({ ...local, epoch }, { ...remote, epoch });
}

/** Whether two states hold the same thing (the order of the lists aside): nothing to send, nothing to write. */
export function sameState(a: AppState, b: AppState): boolean {
  const norm = (s: AppState): string => canon({ ...s, bets: [...s.bets].sort((x, y) => (x.id < y.id ? -1 : 1)), deposits: [...s.deposits].map(depKey).sort() });
  return norm(a) === norm(b);
}
/** JSON with the keys of every object in order, so two copies that differ only in key order read the same. */
function canon(x: unknown): string {
  if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']';
  if (x && typeof x === 'object') return '{' + Object.keys(x).filter(k => (x as Record<string, unknown>)[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon((x as Record<string, unknown>)[k])).join(',') + '}';
  return JSON.stringify(x) ?? 'null';
}

/** What there is in a state, to show before the person chooses which history to keep. */
export const stateSize = (s: AppState): { bets: number; deposits: number } => ({ bets: s.bets.length, deposits: s.deposits.length });
