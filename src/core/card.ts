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
