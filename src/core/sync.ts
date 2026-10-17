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
 *  that changed get `setAt = now`, and a history that lost a bet or a deposit, or changed currency, gets `epoch = now`. */
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
  if (rewritten) out.epoch = now;
  if (settingsJson(prev) !== settingsJson(next)) out.setAt = now;
  return out;
}

/** Of two copies of the same bet, the one to keep: the later change; with no marks, the one further along. */
function laterBet(a: Bet, b: Bet): Bet {
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
  const el = local.epoch || 0, er = remote.epoch || 0;
  const [win, lose] = el === er ? [local, remote] : el > er ? [local, remote] : [remote, local];
  const cut = el === er ? -Infinity : (win.epoch || 0), sameCur = (win.cur || 'BRL') === (lose.cur || 'BRL');
  const take = <T extends { t: number }>(x: T): boolean => el === er || (sameCur && x.t > cut);
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
  const conv = new Map([...(el === er ? [...(lose.conv || []), ...(win.conv || [])] : win.conv || [])].map(c => [c.t, c]));
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

/** Whether two states hold the same thing (the order of the lists aside): nothing to send, nothing to write. */
export function sameState(a: AppState, b: AppState): boolean {
  const norm = (s: AppState): string => JSON.stringify({ ...s, bets: [...s.bets].sort((x, y) => (x.id < y.id ? -1 : 1)), deposits: [...s.deposits].map(depKey).sort() });
  return norm(a) === norm(b);
}

/** What there is in a state, to show before the person chooses which history to keep. */
export const stateSize = (s: AppState): { bets: number; deposits: number } => ({ bets: s.bets.length, deposits: s.deposits.length });
