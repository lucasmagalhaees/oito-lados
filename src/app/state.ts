import { isCurrency, setFmt } from './format';
import type { AppState, AthleteStats, Currency, Fight, FightEvent, Odds, Result, Takedowns, Tip } from '../core';

/* ================= persistent state ================= */
export const LS = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(k: string): any { try { return JSON.parse(localStorage.getItem(k) as string); } catch (e) { return null; } },
  set(k: string, v: unknown): boolean { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};
export const validState = (s: unknown): s is AppState => !!s && typeof s === 'object' && Array.isArray((s as AppState).deposits) && Array.isArray((s as AppState).bets);
const saved: unknown = LS.get('oitolados.v1');
/** Everything the person owns. Other modules read it through the live binding; replacing the whole state goes through setS. */
export let S: AppState = validState(saved) ? saved : { v: 1, deposits: [], bets: [] };
export const saveS = (): boolean => LS.set('oitolados.v1', S);
export function setS(next: AppState): void { S = next; }
/** The currency of the bankroll. It is always set once the page has loaded; the fallback only satisfies the type. */
export const curNow = (): Currency => S.cur || 'BRL';
export function setCurrency(code: unknown): void { S.cur = isCurrency(code) ? code : 'BRL'; setFmt(S.cur); }
setCurrency(S.cur);

/** What was last read from ESPN: the card, the prices, the results and the statistics. Kept under `oitolados.cache.v1`. */
export interface Data {
  events: FightEvent[]; fights: Map<string, Fight>; odds: Record<string, Odds>; results: Record<string, Result>;
  td: Record<string, Takedowns>; astats: Record<string, AthleteStats & { ts: number }>; finalSeen: Record<string, number>;
  oddsAt: Record<string, number>; lastSync: number; from: number; err: string | null;
}
export const D: Data = { events: [], fights: new Map(), odds: {}, results: {}, td: {}, astats: {}, finalSeen: {}, oddsAt: {}, lastSync: 0, from: 0, err: null };
(() => { const c = LS.get('oitolados.cache.v1'); if (c && Array.isArray(c.events)) { Object.assign(D, { events: c.events, odds: c.odds || {}, results: c.results || {}, td: c.td || {}, astats: c.astats || {}, finalSeen: c.finalSeen || {}, lastSync: c.lastSync || 0, from: c.from || 0 }); index(); } })();
export function index(): void { D.fights = new Map(); for (const e of D.events) for (const f of e.fights) D.fights.set(f.id, f); }
export function saveCache(): void { LS.set('oitolados.cache.v1', { events: D.events, odds: D.odds, results: D.results, td: D.td, astats: D.astats, finalSeen: D.finalSeen, lastSync: D.lastSync, from: D.from }); }

/** What is on screen: nothing here is saved. */
export interface Ui {
  tab: 'lutas' | 'apostas' | 'carteira'; eventId: string | null; open: Set<string>; filter: 'open' | 'done'; sheet: boolean;
  reset: boolean; restore: boolean; backup: string | null; dep: string; placing: boolean; msg: string;
  cash: string | null; cashing: boolean; cashMsg: string; depCur: string | null; fxBusy: boolean; fxMsg: string; fxRate: number | null;
}
export const ui: Ui = { tab: 'lutas', eventId: null, open: new Set(), filter: 'open', sheet: false, reset: false, restore: false, backup: null, dep: '', placing: false, msg: '', cash: null, cashing: false, cashMsg: '', depCur: null, fxBusy: false, fxMsg: '', fxRate: null };
/** The bet slip. The stake is kept as money text, as units text and as the exact number of units behind it. */
export interface Slip { sels: { fid: string; key: string }[]; mode: 'single' | 'multi'; stake: string; units: string; unitsN: number }
export const slip: Slip = { sels: [], mode: 'single', stake: '', units: '', unitsN: 0 };
/** The "copy a bet" sheet. */
export interface ImportState { open: boolean; text: string; busy: boolean; pct: number; res: Tip | null; err: string }
export const imp: ImportState = { open: false, text: '', busy: false, pct: 0, res: null, err: '' };
export const bankEmpty = (): boolean => !S.deposits.length && !S.bets.length;
