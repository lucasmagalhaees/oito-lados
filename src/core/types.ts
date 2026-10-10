// Shapes shared by the pure core and the app. Nothing here touches the DOM, the network or storage.

/** Red corner is `a` (ESPN `order` 1), blue corner is `b`. */
export type Side = 'a' | 'b';
export type FightState = 'pre' | 'in' | 'post';
export type Finish = 'ko' | 'sub' | 'dec';
export type Outcome = 'won' | 'lost' | 'void';
export type BetStatus = 'open' | Outcome | 'cashed';
export type Currency = 'BRL' | 'USD' | 'EUR';

/** What ESPN and the exchange-rate service send. It is not ours and not documented: every read of it lives in a `norm*` function. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;

export interface Fighter { id: string; name: string; last: string; country: string; record: string; winner: boolean }
export interface Fight {
  id: string; eventId: string; eventName: string; date: number; idx: number; weight: string; rounds: number;
  a: Fighter; b: Fighter; state: FightState; canceled: boolean; period: number; clock: string; winner: Side | null;
}
export interface FightEvent { id: string; name: string; date: number; completed: boolean; fights: Fight[] }

export type MethodOdds = Record<Finish, number>;
export interface Odds {
  book: string; props: string; ml: Record<Side, number>; method: Record<Side, MethodOdds> | null;
  total: { line: number; over: number; under: number } | null; dist: { yes: number; no: number } | null; ts: number;
}
export interface Result {
  method: Finish | 'nc' | 'draw' | 'unknown'; label: string; desc: string; round: number; time: number | null; clock: string;
  /** set by the app when the takedown statistics never showed up */
  tdUnavailable?: boolean;
}
/** Takedowns landed in a fight. `final` means the statistics have stopped moving. */
export interface Takedowns { a: number; b: number; final: boolean; ts?: number }
/** Career numbers of one fighter, as far as the model uses them. */
export interface AthleteStats { tdAvg: number | null; ts?: number }
export type FightStats = { a?: AthleteStats | null; b?: AthleteStats | null } | null | undefined;

/** Fair probabilities of one fight, before any margin. */
export interface Probs { pa: number; pb: number; M: Record<Side, Record<Finish, number>>; pDec: number; F: number; R: number; sh: number[] }
export interface JointModel { prob(keys: string[]): number }
export interface Option { key: string; label: string; full: string; odd: number | null; src: 'real' | 'est' }
export interface Market { id: string; cat: string; title: string; note?: string; cols: number; heads?: boolean; opts: Option[] }
export interface Priced { odd: number; src: 'real' | 'est'; market: string; sel: string; cat: string }
export interface Pricing { groups: Market[]; map: Record<string, Priced>; P: Probs; J: JointModel; chance(keys: string[]): number }
export type Combo = { ok: false; why: 'impossible' | 'redundant' } | { ok: true; p: number; odd: number; same?: string };

export interface Leg {
  fid: string; eid: string; key: string; market: string; sel: string; cat: string; fight: string; event: string; date: number;
  odd: number; src: 'real' | 'est'; out?: Outcome | null; res?: string;
}
export interface CashInfo { kind: 'refund' | 'market'; full: number | null; chance: number | null }
export interface Bet {
  id: string; t: number; type: 'single' | 'multi'; stake: number; unit?: number; odd: number; sgp?: Record<string, number> | null;
  legs: Leg[]; status: BetStatus; payout: number; settledAt: number | null; cash?: CashInfo;
}
export interface Deposit { t: number; v: number }
export interface Conversion { t: number; from: Currency; to: Currency; rate: number; date: string }
export interface TipCfg { mode: 'same' | 'units'; srcUnit: number }
/** Everything the person owns: what is saved under `oitolados.v1`. The balance is never stored, it is derived. */
export interface AppState {
  v: number; cur?: Currency; unitPct?: number; conv?: Conversion[]; tip?: TipCfg; stakeIn?: 'money' | 'units';
  deposits: Deposit[]; bets: Bet[];
}

export interface FxRates { date: string; rates: Record<Currency, number>; ts?: number }

export type TipStakeIn = { kind: 'units'; units: number } | { kind: 'money'; money: number } | { kind: 'default'; units: number };
export interface TipStake { how: 'units' | 'default' | 'conv' | 'same'; units: number | null; value: number }
export interface TipItem { fid: string; key: string; printedOdd: number | null; assumed: boolean; quote: string }
export interface TipProblem { code: 'empty' | 'nofight' | 'ambiguous' | 'nomarket'; fid?: string }
export interface Tip { items: TipItem[]; stake: TipStakeIn; problems: TipProblem[] }

/** How one leg of a bet stands right now, as far as a cashout offer needs to know. */
export interface LegNow { state: FightState; canceled: boolean; out: Outcome | null }
export type CashoutWhy = 'closed' | 'unknown' | 'live' | 'lost' | 'settling' | 'noprice';
export type Cashout =
  | { ok: false; why: CashoutWhy }
  | { ok: true; kind: 'refund'; value: number }
  | { ok: true; kind: 'market'; value: number; full: number; chance: number };
