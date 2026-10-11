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
  /** The weight class as ESPN names it, copied with the bet; legs placed before this existed do not have it. */
  weight?: string;
  /** The odd the original printed for this selection, when the bet was copied from one that gave it. */
  printed?: number;
}
export interface CashInfo { kind: 'refund' | 'market'; full: number | null; chance: number | null }
export interface Bet {
  id: string; t: number; type: 'single' | 'multi'; stake: number; unit?: number; odd: number; sgp?: Record<string, number> | null;
  legs: Leg[]; status: BetStatus; payout: number; settledAt: number | null; cash?: CashInfo;
  /** For a copied bet: who it was copied from, as the person typed it, and the odd the original gave for the whole bet. */
  from?: string; printed?: number;
  /** The bet came from copying someone else's (a print or a text), not from the person's own picks. */
  copied?: boolean;
}
export interface Deposit { t: number; v: number }
export interface Conversion { t: number; from: Currency; to: Currency; rate: number; date: string }
export type CornerPair = 'green-pink' | 'purple-orange';
/** Everything the person owns: what is saved under `oitolados.v1`. The balance is never stored, it is derived. */
export interface AppState {
  v: number; cur?: Currency; unitPct?: number; conv?: Conversion[]; stakeIn?: 'money' | 'units';
  /** light or dark when the person chose one; absent means "follow the device" */
  theme?: 'light' | 'dark';
  /** The pair of colours of the two corners, for men's and for women's fights; an absent one means red and blue. */
  corners?: { men?: CornerPair; women?: CornerPair };
  /** Copying a bet: leave it out of the batch when the odd of now is more than this many percent below the printed one. Absent: off. */
  copyDrop?: 3 | 5 | 10;
  /** Until when the person has seen what closed: bets settled after it are summed up in the "since last time" strip. */
  seen?: number;
  deposits: Deposit[]; bets: Bet[];
}

export interface FxRates { date: string; rates: Record<Currency, number>; ts?: number }

/** The stake as the original states it. One that states both units and money is `units` with the money alongside. */
export type TipStakeIn = { kind: 'units'; units: number; money?: number } | { kind: 'money'; money: number } | { kind: 'default'; units: number };
/** The stake to copy: `units` when it comes from the units of the original, `same` when it is the money of the original,
 *  `one` when the setting says units and the original states none (one unit, whatever money it shows), and `default`
 *  when the original states no stake at all. */
export interface TipStake { how: 'units' | 'default' | 'same' | 'one'; units: number | null; value: number }
export interface TipItem { fid: string; key: string; printedOdd: number | null; assumed: boolean; quote: string }
/** Why part of a tip could not be read. `short`: the original says it is a multiple of `want` selections and only `got` were found. */
export interface TipProblem { code: 'empty' | 'nofight' | 'ambiguous' | 'nomarket' | 'short'; fid?: string; want?: number; got?: number }
/** A selection added to a tip for a fight it names without saying the bet: chosen by hand, or taken from another original. */
export interface TipPick { fid: string; key: string; printedOdd?: number | null }
/** What was read from a tip. `odd` is the printed odd of the whole bet, when one odd is given for several selections.
 *  `kind` is what the original says it is (a single, or a multiple of `legs` selections), when it says so. */
export interface Tip { items: TipItem[]; stake: TipStakeIn; problems: TipProblem[]; odd: number | null; kind: 'single' | 'multi' | null; legs: number | null }

/** How one leg of a bet stands right now, as far as a cashout offer needs to know. */
export interface LegNow { state: FightState; canceled: boolean; out: Outcome | null }
export type CashoutWhy = 'closed' | 'unknown' | 'live' | 'lost' | 'settling' | 'noprice';
export type Cashout =
  | { ok: false; why: CashoutWhy }
  | { ok: true; kind: 'refund'; value: number }
  | { ok: true; kind: 'market'; value: number; full: number; chance: number };
