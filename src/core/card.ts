/* ---------- the card of an event: its parts, and finding a fight by a fighter's name ---------- */
import { plain } from './tip';
import type { Fight } from './types';

/** The parts of a card. The source only says when each fight starts, so the parts come from the hours: the fights of
 *  the latest hour are the main card, the ones of the earliest of three or more hours the early prelims, the rest the
 *  prelims. */
export type CardPart = 'main' | 'prelims' | 'early';
export interface CardSection { part: CardPart; date: number; fights: Fight[] }
/** The fights of one event by part, the main card first, and inside each part the fight that comes last on top (the
 *  main event opens the list). A card with a single hour is all main card. */
export function cardSections(fights: Fight[]): CardSection[] {
  const times = [...new Set(fights.map(f => f.date))].sort((a, b) => b - a);
  return times.map((t, i) => ({
    part: i === 0 ? 'main' : i === times.length - 1 && times.length > 2 ? 'early' : 'prelims',
    date: t, fights: fights.filter(f => f.date === t).sort((a, b) => b.idx - a.idx)
  }));
}

/** How many cards still to come are shown, and how old an event the source never marks as over can be and still be shown. */
export const NEXT_CARDS = 3, RECENT_CARD = 5 * 24 * 3600e3;
/** The events the fights screen offers, of the ones the source lists (given in the order of their dates): the next
 *  three that are not over, a card under way being one of the three. A card the source marks as over is never
 *  shown: it leaves the screen, and the three after it are what is there. A card further ahead with a bet still
 *  open on it is shown too (`keep` has the ids). Contender Series is left out: it has no odds. */
export function cardsToShow<E extends { id: string; name: string; date: number; completed: boolean }>(events: E[], now: number, keep?: Set<string>): E[] {
  let ahead = 0;
  return events.filter(e => !e.completed && e.date > now - RECENT_CARD && !/Contender Series/i.test(e.name)).filter(e => ++ahead <= NEXT_CARDS || !!(keep && keep.has(e.id)));
}

/** What the source writes for a fighter with no country: not a country to filter by. */
const NO_COUNTRY = 'default';
const landKey = (c: unknown): string => { const k = plain(c).trim(); return k === NO_COUNTRY ? '' : k; };
/** The fights with a fighter from a country, by the name of the country as the source writes it, whatever the case
 *  and the accents. No country given finds nothing. */
export function fromCountry(fights: Fight[], country: unknown): Fight[] {
  const k = landKey(country);
  return k ? fights.filter(f => landKey(f.a.country) === k || landKey(f.b.country) === k) : [];
}
/** The countries of the fighters of these fights, as the source writes them, and in how many of the fights each one
 *  has a fighter. A fight between two of the same country counts once. */
export function countries(fights: Fight[]): { name: string; fights: number }[] {
  const m = new Map<string, { name: string; fights: number }>();
  for (const f of fights) for (const k of new Set([f.a.country, f.b.country].map(landKey).filter(Boolean))) {
    const r = m.get(k) || { name: landKey(f.a.country) === k ? f.a.country.trim() : f.b.country.trim(), fights: 0 };
    r.fights++; m.set(k, r);
  }
  return [...m.values()];
}

/** The fights with what was typed in the names of their fighters: every word typed has to be there, in either name,
 *  whatever the accents and the case ("jose ald" finds José Aldo). Nothing typed finds nothing. */
export function findFights(fights: Fight[], query: unknown): Fight[] {
  const words = plain(query).split(/[^a-z0-9]+/).filter(Boolean);
  if (!words.length) return [];
  return fights.filter(f => { const names = plain(f.a.name + ' ' + f.b.name); return words.every(w => names.includes(w)); });
}

/** The board after a short reading (D105): the events that came in it replace the same events of the last full board,
 *  the others are kept as they were, in the order of their dates. A short board only asks for the days around now, so
 *  the cards further ahead it does not bring stay on screen until the next full one. */
export function mergeBoard<E extends { id: string; date: number }>(kept: E[], fresh: E[]): E[] {
  const byId = new Map(kept.map(e => [e.id, e] as const));
  for (const e of fresh) byId.set(e.id, e);
  return [...byId.values()].sort((a, b) => a.date - b.date);
}
