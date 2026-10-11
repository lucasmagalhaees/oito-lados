import { Core } from '../core';
import { isCurrency, setFmt } from './format';
import type { AppState, AthleteStats, CardPart, CornerPair, Currency, Fight, FightEvent, Odds, PastFight, Period, Result, Takedowns, Tip, TipPick, TipStakeIn } from '../core';

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
delete (S as { tip?: unknown }).tip;          // the separate setting for copied prints, gone since money-or-units decides it
// what closed before this moment has been seen: a state from before this existed must not announce its whole history
if (!(Number(S.seen) > 0)) S.seen = Date.now();
export const saveS = (): boolean => LS.set('oitolados.v1', S);
export function setS(next: AppState): void { S = next; }
/** The currency of the bankroll. It is always set once the page has loaded; the fallback only satisfies the type. */
export const curNow = (): Currency => S.cur || 'BRL';
export function setCurrency(code: unknown): void { S.cur = isCurrency(code) ? code : 'BRL'; setFmt(S.cur); }
setCurrency(S.cur);
/** The pairs of colours the two corners can take. `a` and `b` are the colour names of fighter a's and fighter b's corner. */
export const CORNER_SETS = [
  { id: 'red-blue', a: 'vermelho', b: 'azul' },
  { id: 'green-pink', a: 'rosa', b: 'verde' },
  { id: 'purple-orange', a: 'laranja', b: 'roxo' }
] as const;
export type CornerSet = typeof CORNER_SETS[number];
export type CornerGroup = 'men' | 'women';
export const isPair = (x: unknown): x is CornerPair => x === 'green-pink' || x === 'purple-orange';
/** The pair chosen for men's or for women's fights. */
export const cornerSetOf = (group: CornerGroup): CornerSet => { const id = S.corners && S.corners[group]; return CORNER_SETS.find(c => c.id === id) || CORNER_SETS[0]; };
/** The pair a fight of this weight class is drawn in. */
export const cornerSet = (weight: unknown): CornerSet => cornerSetOf(Core.isWomens(weight) ? 'women' : 'men');
/** What to put on an element so the stylesheet draws it in that pair (nothing for red and blue, the default). */
export const cornersAttr = (weight: unknown): string => { const id = cornerSet(weight).id; return id === 'red-blue' ? '' : ` data-corners="${id}"`; };
/** Only what was chosen and is valid, so a restored backup cannot bring anything else in. */
export function cleanCorners(c: unknown): AppState['corners'] {
  const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>, out: NonNullable<AppState['corners']> = {};
  if (isPair(o.men)) out.men = o.men;
  if (isPair(o.women)) out.women = o.women;
  return out.men || out.women ? out : undefined;
}
/** The settings in a saved state, cleaned. They are what a reset keeps and what comes back with a backup: a new
 *  setting goes here once, instead of in each of those places. */
export const isDrop = (x: unknown): x is NonNullable<AppState['copyDrop']> => x === 3 || x === 5 || x === 10;
export function settingsOf(s: unknown): Pick<AppState, 'unitPct' | 'stakeIn' | 'theme' | 'corners' | 'copyDrop'> {
  const o = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>, corners = cleanCorners(o.corners);
  return { unitPct: Core.unitPct(o.unitPct), ...(o.stakeIn === 'units' ? { stakeIn: 'units' as const } : {}),
    ...(o.theme === 'light' || o.theme === 'dark' ? { theme: o.theme } : {}), ...(corners ? { corners } : {}), ...(isDrop(o.copyDrop) ? { copyDrop: o.copyDrop } : {}) };
}
/** Light, dark, or whatever the device asks for (no attribute): the stylesheet does the rest. */
export function applyTheme(): void {
  const forced = S.theme === 'light' || S.theme === 'dark' ? S.theme : null, root = document.documentElement;
  if (forced) root.dataset.theme = forced; else delete root.dataset.theme;
  // the colour of the browser bars follows: each tag keeps the value it came with for when the choice goes back to automatic
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(m => {
    if (!m.dataset.auto) m.dataset.auto = m.content;
    m.content = forced === 'dark' ? '#0e1218' : forced === 'light' ? '#f2f3f5' : m.dataset.auto;
  });
}
applyTheme();

/** What was last read from ESPN: the card, the prices, the results and the statistics. Kept under `oitolados.cache.v1`. */
export interface Data {
  events: FightEvent[]; fights: Map<string, Fight>; odds: Record<string, Odds>; results: Record<string, Result>;
  td: Record<string, Takedowns>; astats: Record<string, AthleteStats & { ts: number }>; finalSeen: Record<string, number>;
  oddsAt: Record<string, number>; lastSync: number; from: number; err: string | null;
  /** Fights that are over with a result published under a name the app does not know yet: the name, to show while it is asked for again. */
  unread: Record<string, string>;
  /** The latest fights of each athlete, by athlete id, and when they were read. */
  form: Record<string, { ts: number; fights: PastFight[] }>;
}
export const D: Data = { events: [], fights: new Map(), odds: {}, results: {}, td: {}, astats: {}, finalSeen: {}, oddsAt: {}, lastSync: 0, from: 0, err: null, unread: {}, form: {} };
(() => { const c = LS.get('oitolados.cache.v1'); if (c && Array.isArray(c.events)) { Object.assign(D, { events: c.events, odds: c.odds || {}, results: c.results || {}, td: c.td || {}, astats: c.astats || {}, finalSeen: c.finalSeen || {}, lastSync: c.lastSync || 0, from: c.from || 0, form: c.form || {} }); index(); } })();
export function index(): void { D.fights = new Map(); for (const e of D.events) for (const f of e.fights) D.fights.set(f.id, f); }
export function saveCache(): void { LS.set('oitolados.cache.v1', { events: D.events, odds: D.odds, results: D.results, td: D.td, astats: D.astats, finalSeen: D.finalSeen, lastSync: D.lastSync, from: D.from, form: D.form }); }

/** What is on screen: nothing here is saved. */
export interface Ui {
  tab: 'lutas' | 'apostas' | 'carteira'; eventId: string | null; open: Set<string>; filter: 'open' | 'done'; sheet: boolean;
  reset: boolean; restore: boolean; backup: string | null; dep: string; placing: boolean; msg: string;
  cash: string | null; cashing: boolean; cashMsg: string; depCur: string | null; fxBusy: boolean; fxMsg: string; fxRate: number | null;
  /** The bets list shows one origin only ('' is the bets with none); null shows all. */
  origin: string | null;
  /** Which closed bets the wallet's numbers cover. */
  period: Period;
  /** A backup file that was picked, read and not applied yet: what it holds is shown first. */
  restoreFile: { name: string; text: string; bets: number; open: number; deposited: number; cur: Currency; savedAt: number | null } | null;
  /** What is typed in the search of the fights screen, and the part of the card it shows (null shows all of it). */
  q: string; part: CardPart | null;
}
export const ui: Ui = { tab: 'lutas', eventId: null, open: new Set(), filter: 'open', sheet: false, reset: false, restore: false, backup: null, dep: '', placing: false, msg: '', cash: null, cashing: false, cashMsg: '', depCur: null, fxBusy: false, fxMsg: '', fxRate: null, origin: null, period: 'all', q: '', part: null, restoreFile: null };
/** The bet slip. The stake is kept as money text, as units text and as the exact number of units behind it. */
/** What a copied bet carries from its original into the bet that is written: who it came from and the odds it printed
 *  (of each selection, by `fid|key`, and of the whole bet, which only holds for exactly the selections in `sig`). */
export interface CopyMeta { from: string; bet: number | null; sig: string; legs: Record<string, number> }
export interface Slip { sels: { fid: string; key: string }[]; mode: 'single' | 'multi'; stake: string; units: string; unitsN: number; copy: CopyMeta | null }
export const slip: Slip = { sels: [], mode: 'single', stake: '', units: '', unitsN: 0, copy: null };
/** The "copy a bet" sheet. */
/** One bet read in the copy screen: from the text field, or from one picture. */
export interface ImportOp {
  id: number; src: 'text' | 'image'; name: string; res: Tip;
  /** The text it was read from: what the OCR got out of the picture, or what was typed. */
  text: string;
  /** What the person changed in it: selections chosen for fights the original names without a bet (`src` is the item of
   *  the list they were taken from), fights not to fill in automatically, a value typed, and single or multiple. */
  picks: (TipPick & { src?: number })[]; noauto: string[]; stake: TipStakeIn | null; mode: Slip['mode'] | null;
  /** Corrections to what was read, by the position of the selection in `res.items`: another selection of that fight,
   *  or null for one taken out. `swap` is the selection whose choices are open on screen. */
  edits: Record<number, string | null>; swap: number | null;
  /** "Bet it anyway": the person saw the warning (already bet, or the odd fell) and wants it in the batch. */
  force: boolean;
  /** In a list of several, whether the item is unfolded. Null until it is first shown: then the ones that need a look
   *  start unfolded and the ones that are ready, or only a reference, start as one line. */
  open: boolean | null;
}
/** The copy screen. `ops` is the list of bets read so far; `at` and `of` count the pictures while they are being read. */
export interface ImportState { open: boolean; text: string; busy: boolean; pct: number; at: number; of: number; ops: ImportOp[]; err: string; msg: string; placing: boolean; from: string }
export const imp: ImportState = { open: false, text: '', busy: false, pct: 0, at: 0, of: 0, ops: [], err: '', msg: '', placing: false, from: '' };
export const bankEmpty = (): boolean => !S.deposits.length && !S.bets.length;
