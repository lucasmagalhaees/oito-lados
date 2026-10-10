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

/** The fights with what was typed in the names of their fighters: every word typed has to be there, in either name,
 *  whatever the accents and the case ("jose ald" finds José Aldo). Nothing typed finds nothing. */
export function findFights(fights: Fight[], query: unknown): Fight[] {
  const words = plain(query).split(/[^a-z0-9]+/).filter(Boolean);
  if (!words.length) return [];
  return fights.filter(f => { const names = plain(f.a.name + ' ' + f.b.name); return words.every(w => names.includes(w)); });
}
