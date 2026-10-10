/* ---------- the stake of a copied bet ----------
   One setting decides it, the same one that says how the slip asks for the stake (money or units), and it is followed
   to the letter: either the value is copied, or the stake is.
     money - the same amount: the money the original shows. An original that only speaks in units brings those units.
     units - the same stake: the units the original states, in my unit. An original that states no units is one unit:
             the money it shows is not copied.
   What one unit is worth to whoever made the print is not known and is not asked for. */
import { r2 } from './odds';
import { parseMoney } from './money';
import type { Bet, Fight, Fighter, Leg, Side, Tip, TipPick, TipStake, TipStakeIn } from './types';

export function tipStake(stake: TipStakeIn, mode: unknown, unit: unknown): TipStake {
  const u = Math.max(0, Number(unit) || 0);
  if (stake.kind === 'default') return { how: 'default', units: 1, value: r2(u) };
  const money = stake.money && stake.money > 0 ? stake.money : 0, units = stake.kind === 'units' ? stake.units : 0;
  if (units > 0 && (mode === 'units' || !money)) return { how: 'units', units, value: r2(units * u) };
  if (mode === 'units') return { how: 'one', units: 1, value: r2(u) };
  return { how: 'same', units: u > 0 ? money / u : null, value: money };
}

/* ---------- copying a bet from a print or a pasted tip ----------
   parseTip reads free text (typed, pasted, or what the OCR got out of a screenshot) and finds, among the fights given,
   which one it talks about, which selection, the odd it was printed with and the stake (in units or in money).
   It only names selections; whether each one can be bet on right now is decided by the caller against live prices. */
const plain = (s: unknown): string => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const reEsc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasWord = (hay: string, needle: string): boolean => needle.length >= 3 && new RegExp('(^|[^a-z0-9])' + reEsc(needle) + '($|[^a-z0-9])').test(hay);
type Named = Pick<Fighter, 'name' | 'last'>;
// the full name and the surname, and both again without a suffix such as "Jr." or "III", which the OCR often mangles
const nameForms = (x: Named): string[] => [plain(x.name), plain(x.last)].map(n => n.replace(/\./g, ' ').replace(/\s+/g, ' ').trim())
  .flatMap(n => [n, n.replace(/\s+(?:jr|sr|ii|iii|iv)$/, '')]).filter((v, i, a) => v && a.indexOf(v) === i);
const mentions = (hay: string, x: Named): boolean => nameForms(x).some(n => hasWord(hay, n));
const TIP = {
  units: /(\d+(?:[.,]\d+)?)\s*(?:unidades?|unid|un|units?|u)(?![a-z0-9])/,
  half: /meia unidade/,
  money: /(?:r\$|us\$|\$|€)\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/,
  moneyAfter: /(\d[\d.,]*\d|\d)\s*(?:brl|usd|eur|reais)(?![a-z])/,          // "1756 BRL", as some slips write it
  anyMoney: /(?:r\$|us\$|\$|€)\s*[\d.,]+|[\d.,]+\s*(?:brl|usd|eur|reais)(?![a-z])/g,
  odd: /(?:^|[^\d.,])(\d{1,2}[.,]\d{2,3})(?![\d.,])/,
  // the OCR sometimes reads the point of an odd as a colon ("1:13"). Only at the end of a line, one digit before the
  // colon, and never on a line with a date: a time of day is written "(14:14)" or "19:30" on the slips seen so far
  oddColon: /(?:^|\s)(\d)[:;](\d{2,3})\s*$/,
  date: /\d{1,2}\/\d{1,2}/,
  over: /(?:mais de|over|acima de|\+)\s*\(?\s*(\d)[.,]5/,
  under: /(?:menos de|under|abaixo de)\s*\(?\s*(\d)[.,]5|(?:^|\s)[-−](\d)[.,]5(?!\d)/,
  takedown: /queda|takedown/,
  distNo: /nao (?:vai|chega)\s+(?:ate|para|a)\s+(?:a\s+|o\s+)?(?:decisao|distancia|final)|sem decisao|antes do (?:fim|tempo)|inside the distance/,
  dist: /(?:vai|ir|chega|chegar)\s+(?:ate|para|a)\s+(?:a\s+|o\s+)?(?:decisao|distancia|final)|go(?:es)? the distance|luta completa/,
  no: /(?:^|[^a-z])nao(?:$|[^a-z])/,
  ko: /(?:^|[^a-z])(?:ko|tko|nocaute)(?:$|[^a-z])/,
  sub: /finaliza|submiss/,
  dec: /decisao|pontos|decision/,
  round: /round\s*(\d)(?!\d)|(\d)\s*[oº]?\s*round(?!s)/,
  win: /para (?:ganhar|vencer)|vencedor|moneyline|(?:^|[^a-z])ml(?:$|[^a-z])|vence(?:$|[^a-z])|to win|vitoria|(?:^|[^a-z0-9])(?:1x2|[vw][12])(?:$|[^a-z0-9])/,
  first: /(?:^|[^a-z0-9])[vw]([12])(?:$|[^a-z0-9])/,            // "1X2: V1: A - B": the first or the second name on the line
  multi: /(?:^|[^a-z])(dupla|tripla|quadrupla|quintupla|sextupla|multipla|acumulad(?:or|a)|combinada|parlay|accumulator)(?:$|[^a-z])/,
  single: /(?:^|[^a-z])(?:simples|single)(?:$|[^a-z])/,
  events: /eventos?\s*:\s*(\d{1,2})(?!\d)/
};
const LEGS: Record<string, number> = { dupla: 2, tripla: 3, quadrupla: 4, quintupla: 5, sextupla: 6 };
// an amount followed by its currency may use either decimal mark: "1.756,50", "2,500.00", "1756.5"
const amountAfter = (s: string): number => /^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(s) ? parseFloat(s.replace(/,/g, '')) : /^\d+\.\d{1,2}$/.test(s) ? parseFloat(s) : parseMoney(s);
function tipMarket(win: string, pick: Side | null, f: Pick<Fight, 'rounds'>): { key: string; assumed?: boolean } | null {
  const method = TIP.ko.test(win) ? 'ko' : TIP.sub.test(win) ? 'sub' : null;
  const rd = TIP.round.exec(win), n = rd ? +(rd[1] || rd[2]) : 0;
  // an over or under with no word about winning is about the fight, even when one name happens to stand alone on the line
  if (pick && !method && !n && !TIP.win.test(win) && !TIP.dec.test(win) && (TIP.over.test(win) || TIP.under.test(win))) pick = null;
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
  const out: Tip = { items: [], problems: [], stake: { kind: 'default', units: 1 }, odd: null, kind: null, legs: null };
  if (!raw.length) { out.problems.push({ code: 'empty' }); return out; }
  const L = raw.map(plain), N = L.map(l => l.replace(/\./g, ' ')), whole = L.join(' \n '), wholeN = N.join(' \n ');
  // the stake: units, money, or both when the original states both (which one is copied is the caller's setting)
  const u = TIP.units.exec(whole), m = TIP.money.exec(whole), ma = TIP.moneyAfter.exec(whole);
  const units = u && parseFloat(u[1].replace(',', '.')) > 0 ? parseFloat(u[1].replace(',', '.')) : TIP.half.test(whole) ? 0.5 : 0;
  const first = m && ma ? (m.index <= ma.index ? m : ma) : m || ma;          // the first amount is the stake, whichever way it is written
  const read = first ? (first === m ? parseMoney(first[1]) : amountAfter(first[1])) : 0, money = read > 0 ? read : 0;
  if (units) out.stake = money ? { kind: 'units', units, money } : { kind: 'units', units };
  else if (money) out.stake = { kind: 'money', money };

  // what the original says it is: a single, or a multiple of so many selections ("dupla", "tripla", "Eventos: 2", "Acumulador")
  const mw = /dupla (?:chance|hipotese)/.test(whole) ? null : TIP.multi.exec(whole), ev = TIP.events.exec(whole), evN = ev ? +ev[1] : 0;
  if (mw || evN > 1) { out.kind = 'multi'; out.legs = (mw && LEGS[mw[1]]) || (evN > 1 ? evN : null); }
  else if (evN === 1 || TIP.single.test(whole)) { out.kind = 'single'; out.legs = 1; }

  const both = fights.filter(f => mentions(wholeN, f.a) && mentions(wholeN, f.b));
  // One fighter named from each of several fights is a multiple by fighter ("A + B para vencer a luta"). A fight whose only
  // sign is a word that another fight explains better (a surname inside someone else's full name) is left out, and it is
  // only ambiguous when the same words could be two different fighters.
  const named = (f: TipFight): string[] => nameForms(mentions(wholeN, f.a) ? f.a : f.b).filter(n => hasWord(wholeN, n));
  const loose = both.length ? [] : fights.filter(f => mentions(wholeN, f.a) !== mentions(wholeN, f.b));
  const one = loose.filter(f => !loose.some(g => g !== f && named(g).length > named(f).length && named(f).every(n => named(g).includes(n))));
  const clash = one.some(f => one.some(g => g !== f && named(f).some(n => named(g).includes(n))));
  const found = both.length ? both : clash ? [] : one;
  if (!found.length) { out.problems.push({ code: clash ? 'ambiguous' : 'nofight' }); return out; }
  const other = (i: number, f: TipFight): boolean => found.some(g => g !== f && (mentions(N[i], g.a) || mentions(N[i], g.b)));
  const oddIn = (i: number): number | null => {
    const line = L[i].replace(TIP.anyMoney, ' ').replace(/(\d)[.,]5(?!\d)/g, ' '), od = TIP.odd.exec(line);
    if (od) return parseFloat(od[1].replace(',', '.'));
    const oc = TIP.date.test(line) ? null : TIP.oddColon.exec(line), v = oc ? parseFloat(oc[1] + '.' + oc[2]) : 0;
    return v > 1 ? v : null;
  };
  interface Sel { f: TipFight; pick: Side | null; start: number; at: number[]; mk: { key: string; assumed?: boolean }; odd: number | null; oddAt: number }
  const sels: Sel[] = [];
  for (const f of found) {
    const at = N.map(l => ({ a: mentions(l, f.a), b: mentions(l, f.b) }));
    const where = (i: number, k: Side): number => Math.min(...nameForms(f[k]).map(n => { const p = N[i].search(new RegExp('(^|[^a-z0-9])' + reEsc(n) + '($|[^a-z0-9])')); return p < 0 ? Infinity : p; }));
    // the lines that describe the selection: from `from` on, up to where another fighter or fight comes in
    const below = (from: number, own: boolean): number[] => { const idx: number[] = []; for (let i = from; i < L.length && idx.length < 4; i++) { if ((i !== from || !own) && (at[i].a || at[i].b || other(i, f))) break; idx.push(i); } return idx; };
    const text = (idx: number[]): string => idx.map(i => L[i]).join(' \n ');
    let pick: Side | null = null, start = -1, idx: number[] = [], mk: ReturnType<typeof tipMarket> = null;

    // 1. a slip line that names the fight and says "V1" or "V2": the first or the second name on that line
    const vLine = N.findIndex((l, i) => (at[i].a || at[i].b) && TIP.first.test(l));
    // 2. the two names stacked on consecutive lines, the market on the lines after them ("1X2: V2", "Total Acima de (1.5)")
    const stack = at.findIndex((x, i) => x.a !== x.b && i + 1 < at.length && at[i + 1].a !== at[i + 1].b && at[i + 1].a !== x.a);
    if (vLine >= 0) {
      const nth = TIP.first.exec(N[vLine])![1], wa = where(vLine, 'a'), wb = where(vLine, 'b');
      // with one name the OCR could not read, the other is first when nothing but the market label comes before it
      const lone = (k: Side): boolean => !/[a-z0-9]/.test(N[vLine].slice(0, where(vLine, k)).replace(/^.*:/, ''));
      const firstOne: Side = wa !== Infinity && wb !== Infinity ? (wa < wb ? 'a' : 'b') : wa !== Infinity ? (lone('a') ? 'a' : 'b') : (lone('b') ? 'b' : 'a');
      pick = (nth === '1') === (firstOne === 'a') ? 'a' : 'b'; start = vLine; idx = below(start, true); mk = { key: 'ml:' + pick };
    } else if (stack >= 0 && stack + 2 < L.length) {
      const under = below(stack + 2, false), nth = under.map(i => TIP.first.exec(N[i])).find(Boolean), top: Side = at[stack].a ? 'a' : 'b';
      const m2 = nth ? { key: 'ml:' + ((nth[1] === '1') === (top === 'a') ? 'a' : 'b') } : tipMarket(text(under), null, f);
      if (m2) { mk = m2; start = stack; idx = under; pick = nth ? (m2.key.slice(3) as Side) : null; }
    }
    if (!mk) {
      const sel = at.findIndex(x => x.a !== x.b), match = at.findIndex(x => x.a && x.b);
      pick = sel >= 0 ? (at[sel].a ? 'a' : 'b') : null;
      start = sel >= 0 ? sel : match;
      if (!pick) {                      // everything on one line: "Dunne vence no round 2 (Almeida x Dunne)"
        const backs = (k: Side): boolean => nameForms(f[k]).some(n => new RegExp('(^|[^a-z0-9])' + reEsc(n) + '\\s*[-:,]?\\s*(?:vence|ganha|por |para (?:ganhar|vencer)|ml(?![a-z])|to win)').test(N[match]));
        const times = (k: Side): number => Math.max(...nameForms(f[k]).map(n => N[match].split(n).length - 1));
        if (backs('a') !== backs('b')) pick = backs('a') ? 'a' : 'b';
        else if (times('a') !== times('b')) pick = times('a') > times('b') ? 'a' : 'b';
      }
      idx = below(start, true); mk = tipMarket(text(idx), pick, f);
      if (!mk && !pick) {               // "Mais de 2.5 rounds" written above the fight instead of below it
        const before: number[] = []; for (let i = start - 1; i >= 0 && before.length < 3; i--) { if (at[i].a || at[i].b || other(i, f)) break; before.unshift(i); }
        idx = before; mk = tipMarket(text(idx), pick, f);
      }
    }
    if (!mk) { out.problems.push({ code: 'nomarket', fid: f.id }); continue; }
    if (!/^(?:ml|mov|wr|tda):/.test(mk.key)) pick = null;
    const oddAt = idx.find(i => oddIn(i) != null);
    sels.push({ f, pick, start, at: idx, mk, odd: oddAt == null ? null : oddIn(oddAt), oddAt: oddAt == null ? -1 : oddAt });
  }
  // "A + B - para vencer a luta": a bare name with nothing but a joiner before the next selection shares that selection's
  // winner market, and whatever odd comes with it. Only the winner is shared: "A + B por KO" leaves A as a presumed winner.
  const order = sels.slice().sort((x, y) => x.start - y.start);
  const bare = (s: Sel): boolean => { let t = s.at.map(i => N[i]).join(' '); for (const n of nameForms(s.f[s.pick!])) t = t.split(n).join(' '); t = t.replace(/[^a-z0-9]+/g, ' ').trim(); return t === '' || t === 'e'; };
  for (let i = order.length - 2; i >= 0; i--) {
    const me = order[i], next = order[i + 1];
    if (me.pick && me.mk.assumed && /^ml:/.test(next.mk.key) && !next.mk.assumed && next.start === me.at[me.at.length - 1] + 1 && bare(me)) { me.mk = { key: 'ml:' + me.pick }; me.odd = next.odd; me.oddAt = next.oddAt; }
  }
  // one odd for several selections is the odd of the whole bet, not of each of them
  for (const s of sels) {
    const same = sels.filter(x => x.oddAt >= 0 && x.oddAt === s.oddAt);
    if (same.length > 1) { out.odd = s.odd; for (const x of same) { x.odd = null; x.oddAt = -1; } }
  }
  // and so is the only odd of a multiple that does not show every selection (a slip that lists its events but one market)
  const priced = sels.filter(x => x.odd != null);
  if (out.kind === 'multi' && out.odd == null && priced.length === 1 && Math.max(found.length, out.legs || 0) > sels.length) { out.odd = priced[0].odd; priced[0].odd = null; }
  for (const s of sels) out.items.push({ fid: s.f.id, key: s.mk.key, assumed: !!s.mk.assumed, printedOdd: s.odd, quote: raw[s.start] });
  if (out.kind === 'multi' && out.legs && out.items.length < out.legs && !out.problems.length) out.problems.push({ code: 'short', want: out.legs, got: out.items.length });
  return out;
}

/* ---------- completing a tip ----------
   A slip of a multiple often prints its events and the market of the first one only. The selections that are missing
   can be filled in, one per fight the tip names without a bet: chosen by hand, or taken from another original. */
export function completeTip(tip: Tip, picks: TipPick[]): Tip {
  const items = tip.items.slice(), open = new Set(tip.problems.filter(p => p.code === 'nomarket' && p.fid).map(p => p.fid as string));
  for (const p of picks) {
    if (!open.has(p.fid)) continue;                       // not a fight this tip is waiting on, or already filled
    open.delete(p.fid);
    items.push({ fid: p.fid, key: p.key, printedOdd: p.printedOdd && p.printedOdd > 1 ? p.printedOdd : null, assumed: false, quote: '' });
  }
  const problems = tip.problems.filter(p => p.code !== 'short' && !(p.code === 'nomarket' && p.fid && !open.has(p.fid)));
  if (tip.kind === 'multi' && tip.legs && items.length < tip.legs && !problems.length) problems.push({ code: 'short', want: tip.legs, got: items.length });
  return { ...tip, items, problems };
}

/* ---------- the odd of the original, kept with a copied bet ----------
   What the original printed against what the bet was placed at. The odd of the whole bet is used when the original gave
   one; otherwise the odds of the selections, multiplied when each is from a different fight. */
type Copied = Pick<Bet, 'type' | 'odd'> & { printed?: unknown; legs: Pick<Leg, 'fid' | 'printed'>[] };
export function printedEdge(bet: Copied): { printed: number; got: number; diff: number } | null {
  const whole = Number(bet.printed), legs = bet.legs || [];
  let printed = whole > 1 ? whole : 0;
  if (!printed && legs.length && legs.every(l => Number(l.printed) > 1) && new Set(legs.map(l => l.fid)).size === legs.length) printed = Math.round(legs.reduce((p, l) => p * Number(l.printed), 1) * 1000) / 1000;
  if (!(printed > 1) || !(bet.odd > 1)) return null;
  return { printed, got: bet.odd, diff: Math.round((bet.odd / printed - 1) * 1e4) / 1e4 };
}
/** Over a set of bets: how many can be compared, the average difference and how many were placed above the printed odd. */
export function edgeSummary(bets: Copied[]): { n: number; avg: number; ahead: number } {
  const ds = bets.map(printedEdge).filter((e): e is NonNullable<typeof e> => !!e).map(e => e.diff);
  return { n: ds.length, avg: ds.length ? Math.round(ds.reduce((a, d) => a + d, 0) / ds.length * 1e4) / 1e4 : 0, ahead: ds.filter(d => d > 0).length };
}
