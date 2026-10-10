/* ---------- the stake of a copied bet ----------
   A tip that speaks in units always uses those units. What to do with one that brings an amount of money is a setting:
     same  - the same amount (the default)
     units - the same stake: the amount is turned into units by what one unit is worth to whoever made the print
             (srcUnit), and that many of my units are staked */
import { r2 } from './odds';
import { parseMoney } from './money';
import type { Fight, Fighter, Side, Tip, TipCfg, TipStake, TipStakeIn } from './types';

export const TIP_MODES: TipCfg['mode'][] = ['same', 'units'];
export function tipCfg(c: unknown): TipCfg {
  const o = (c && typeof c === 'object' ? c : {}) as { mode?: unknown; srcUnit?: unknown };
  const src = Number(o.srcUnit);
  return { mode: TIP_MODES.includes(o.mode as TipCfg['mode']) ? o.mode as TipCfg['mode'] : 'same', srcUnit: isFinite(src) && src > 0 ? r2(src) : 0 };
}
export function tipStake(stake: TipStakeIn, cfg: unknown, unit: unknown): TipStake {
  const c = tipCfg(cfg), u = Math.max(0, Number(unit) || 0);
  if (stake.kind === 'units') return { how: 'units', units: stake.units, value: r2(stake.units * u) };
  if (stake.kind !== 'money') return { how: 'default', units: 1, value: r2(u) };
  if (c.mode === 'units' && c.srcUnit > 0) { const n = stake.money / c.srcUnit; return { how: 'conv', units: n, value: r2(n * u) }; }
  return { how: 'same', units: null, value: stake.money };
}

/* ---------- copying a bet from a print or a pasted tip ----------
   parseTip reads free text (typed, pasted, or what the OCR got out of a screenshot) and finds, among the fights given,
   which one it talks about, which selection, the odd it was printed with and the stake (in units or in money).
   It only names selections; whether each one can be bet on right now is decided by the caller against live prices. */
const plain = (s: unknown): string => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const reEsc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasWord = (hay: string, needle: string): boolean => needle.length >= 3 && new RegExp('(^|[^a-z0-9])' + reEsc(needle) + '($|[^a-z0-9])').test(hay);
type Named = Pick<Fighter, 'name' | 'last'>;
const nameForms = (x: Named): string[] => [plain(x.name), plain(x.last)].map(n => n.replace(/\./g, ' ').replace(/\s+/g, ' ').trim()).filter((v, i, a) => v && a.indexOf(v) === i);
const mentions = (hay: string, x: Named): boolean => nameForms(x).some(n => hasWord(hay, n));
const TIP = {
  units: /(\d+(?:[.,]\d+)?)\s*(?:unidades?|unid|un|units?|u)(?![a-z0-9])/,
  half: /meia unidade/,
  money: /(?:r\$|us\$|\$|€)\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/,
  anyMoney: /(?:r\$|us\$|\$|€)\s*[\d.,]+/g,
  odd: /(?:^|[^\d.,])(\d{1,2}[.,]\d{2})(?![\d.,])/,
  over: /(?:mais de|over|acima de|\+)\s*(\d)[.,]5/,
  under: /(?:menos de|under|abaixo de)\s*(\d)[.,]5|(?:^|\s)[-−](\d)[.,]5(?!\d)/,
  takedown: /queda|takedown/,
  distNo: /nao (?:vai|chega)\s+(?:ate|para|a)\s+(?:a\s+|o\s+)?(?:decisao|distancia|final)|sem decisao|antes do (?:fim|tempo)|inside the distance/,
  dist: /(?:vai|ir|chega|chegar)\s+(?:ate|para|a)\s+(?:a\s+|o\s+)?(?:decisao|distancia|final)|go(?:es)? the distance|luta completa/,
  no: /(?:^|[^a-z])nao(?:$|[^a-z])/,
  ko: /(?:^|[^a-z])(?:ko|tko|nocaute)(?:$|[^a-z])/,
  sub: /finaliza|submiss/,
  dec: /decisao|pontos|decision/,
  round: /round\s*(\d)(?!\d)|(\d)\s*[oº]?\s*round(?!s)/,
  win: /para (?:ganhar|vencer)|vencedor|moneyline|(?:^|[^a-z])ml(?:$|[^a-z])|vence(?:$|[^a-z])|to win|vitoria/
};
function tipMarket(win: string, pick: Side | null, f: Pick<Fight, 'rounds'>): { key: string; assumed?: boolean } | null {
  const method = TIP.ko.test(win) ? 'ko' : TIP.sub.test(win) ? 'sub' : null;
  const rd = TIP.round.exec(win), n = rd ? +(rd[1] || rd[2]) : 0;
  if (pick) {
    if (method) return { key: `mov:${pick}:${method}` };
    if (n >= 1 && n <= f.rounds) return { key: `wr:${pick}:${n}` };
    if (TIP.dec.test(win) && !TIP.dist.test(win)) return { key: `mov:${pick}:dec` };
    return { key: 'ml:' + pick, assumed: !TIP.win.test(win) };
  }
  const ov = TIP.over.exec(win), un = TIP.under.exec(win);
  if (ov || un) {
    const line = +(ov ? ov[1] : un![1] || un![2]) + 0.5, side = ov ? 'o' : 'u';
    if (TIP.takedown.test(win)) return { key: `td:${side}:${line}` };
    if (line < f.rounds) return { key: `tot:${side}:${line}` };
  }
  if (TIP.distNo.test(win)) return { key: 'dist:no' };
  if (TIP.dist.test(win)) return { key: 'dist:' + (TIP.no.test(win) ? 'no' : 'yes') };
  if (method) return { key: 'fm:' + method };
  if (TIP.dec.test(win)) return { key: 'fm:dec' };
  if (n >= 1 && n <= f.rounds) return { key: 'rnd:' + n };
  return null;
}
type TipFight = Pick<Fight, 'id' | 'rounds'> & { a: Named; b: Named };
export function parseTip(text: unknown, fights: TipFight[]): Tip {
  const raw = String(text == null ? '' : text).split(/\r?\n/).map(l => l.replace(/[*_`~]+/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out: Tip = { items: [], problems: [], stake: { kind: 'default', units: 1 } };
  if (!raw.length) { out.problems.push({ code: 'empty' }); return out; }
  const L = raw.map(plain), N = L.map(l => l.replace(/\./g, ' ')), whole = L.join(' \n '), wholeN = N.join(' \n ');
  const u = TIP.units.exec(whole), m = TIP.money.exec(whole);
  if (u && parseFloat(u[1].replace(',', '.')) > 0) out.stake = { kind: 'units', units: parseFloat(u[1].replace(',', '.')) };
  else if (TIP.half.test(whole)) out.stake = { kind: 'units', units: 0.5 };
  else if (m && parseMoney(m[1]) > 0) out.stake = { kind: 'money', money: parseMoney(m[1]) };

  const both = fights.filter(f => mentions(wholeN, f.a) && mentions(wholeN, f.b));
  const one = both.length ? [] : fights.filter(f => mentions(wholeN, f.a) !== mentions(wholeN, f.b));
  const found = both.length ? both : (one.length === 1 ? one : []);
  if (!found.length) { out.problems.push({ code: one.length > 1 ? 'ambiguous' : 'nofight' }); return out; }
  const other = (i: number, f: TipFight): boolean => found.some(g => g !== f && (mentions(N[i], g.a) || mentions(N[i], g.b)));
  for (const f of found) {
    const at = N.map(l => ({ a: mentions(l, f.a), b: mentions(l, f.b) }));
    const sel = at.findIndex(x => x.a !== x.b), match = at.findIndex(x => x.a && x.b);
    let pick: Side | null = sel >= 0 ? (at[sel].a ? 'a' : 'b') : null;
    const start = sel >= 0 ? sel : match;
    if (!pick) {                      // everything on one line: "Dunne vence no round 2 (Almeida x Dunne)"
      const backs = (k: Side): boolean => nameForms(f[k]).some(n => new RegExp('(^|[^a-z0-9])' + reEsc(n) + '\\s*[-:,]?\\s*(?:vence|ganha|por |para (?:ganhar|vencer)|ml(?![a-z])|to win)').test(N[match]));
      const times = (k: Side): number => Math.max(...nameForms(f[k]).map(n => N[match].split(n).length - 1));
      if (backs('a') !== backs('b')) pick = backs('a') ? 'a' : 'b';
      else if (times('a') !== times('b')) pick = times('a') > times('b') ? 'a' : 'b';
    }
    // the selection is described on its line and on the next ones, up to where another fighter or fight comes in
    const lines: string[] = [];
    for (let i = start; i < L.length && lines.length < 4; i++) { if (i !== start && (at[i].a || at[i].b || other(i, f))) break; lines.push(L[i]); }
    let win = lines.join(' \n '), mk = tipMarket(win, pick, f);
    if (!mk && !pick) {               // "Mais de 2.5 rounds" written above the fight instead of below it
      const before: string[] = []; for (let i = start - 1; i >= 0 && before.length < 3; i--) { if (at[i].a || at[i].b || other(i, f)) break; before.unshift(L[i]); }
      win = before.join(' \n '); mk = tipMarket(win, pick, f);
    }
    if (!mk) { out.problems.push({ code: 'nomarket', fid: f.id }); continue; }
    const od = TIP.odd.exec(win.replace(TIP.anyMoney, ' ').replace(/(\d)[.,]5(?!\d)/g, ' '));
    out.items.push({ fid: f.id, key: mk.key, assumed: !!mk.assumed, printedOdd: od ? parseFloat(od[1].replace(',', '.')) : null, quote: raw[start] });
  }
  return out;
}
