/* ---------- pricing ---------- */
import { baseMix, clamp, devig, mo, r2 } from './odds';
import type { AthleteStats, Combo, Fight, FightStats, Finish, JointModel, Market, Odds, Option, Priced, Pricing, Probs, Side } from './types';

const SIDES: Side[] = ['a', 'b'];
const FINISHES: Finish[] = ['ko', 'sub', 'dec'];

const shares = (g: number, R: number): number[] => { const a: number[] = []; let t = 0; for (let r = 0; r < R; r++) { a.push(Math.pow(g, r)); t += a[r]; } return a.map(x => x / t); };
// share of finishes that happen before the X.5 mark (halfway through round ceil(X.5))
const cumShare = (sh: number[], L: number): number => { const c = Math.ceil(L); let x = 0; for (let r = 1; r < c; r++) x += sh[r - 1] || 0; return x + 0.5 * (sh[c - 1] || 0); };
export function probs(f: Fight, o: Odds): Probs {
  const [pa, pb] = devig([o.ml.a, o.ml.b]);
  const base = baseMix(f);
  let M: Probs['M'];
  if (o.method) {
    const q = devig([o.method.a.ko, o.method.a.sub, o.method.a.dec, o.method.b.ko, o.method.b.sub, o.method.b.dec]);
    M = { a: { ko: q[0], sub: q[1], dec: q[2] }, b: { ko: q[3], sub: q[4], dec: q[5] } };
  } else {
    M = { a: { ko: pa * base[0], sub: pa * base[1], dec: pa * base[2] }, b: { ko: pb * base[0], sub: pb * base[1], dec: pb * base[2] } };
  }
  let pDec = M.a.dec + M.b.dec;
  if (o.dist) {
    const py = devig([o.dist.yes, o.dist.no])[0];
    if (py > 0.02 && py < 0.98 && pDec > 0 && pDec < 1) {
      const kd = py / pDec, kf = (1 - py) / (1 - pDec);
      for (const s of SIDES) { M[s].dec *= kd; M[s].ko *= kf; M[s].sub *= kf; }
      pDec = py;
    }
  }
  const F = 1 - pDec, R = f.rounds;
  let g = 0.7;                                   // each round holds ~70% of the finishes of the one before
  if (o.total && F > 0.02) {                     // ...unless the book's total-rounds line says otherwise
    const target = devig([o.total.over, o.total.under])[1] / F;
    if (target > 0.02 && target < 0.99) {
      let lo = 0.15, hi = 3;
      for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (cumShare(shares(mid, R), o.total.line) > target) lo = mid; else hi = mid; }
      g = (lo + hi) / 2;
    }
  }
  return { pa, pb, M, pDec, F, R, sh: shares(g, R) };
}
// negative binomial: takedown counts are burstier than Poisson
// takedowns landed per 15 min. ESPN reports 0 both for pure strikers and for fighters with no UFC minutes yet, so 0 gets a low prior rather than "never".
const tdRate = (x: AthleteStats | null | undefined): number => (x && typeof x.tdAvg === 'number' && x.tdAvg > 0) ? clamp(x.tdAvg, 0.15, 5) : (x && x.tdAvg === 0) ? 0.5 : 0.9;
function nbPmf(lam: number, r: number, K: number): number[] {
  const out: number[] = new Array(K + 1); let p = lam <= 0 ? 1 : Math.pow(r / (r + lam), r); out[0] = p;
  for (let i = 0; i < K; i++) { p = lam <= 0 ? 0 : p * (i + r) / (i + 1) * (lam / (r + lam)); out[i + 1] = p; }
  return out;
}
/** One way a fight can end: who wins, how, in which round and in which half of it, how long it ran and how likely it is. */
interface Atom { w: Side; m: Finish; r: number; late: boolean; mins: number; p: number }
// what a non-takedown selection requires of a fight ending {w: winner, m: method, r: round, late: second half of that round}
function pred(q: string[]): ((a: Atom) => boolean) | null {
  const p1 = q[1], p2 = q[2];
  switch (q[0]) {
    case 'ml': return a => a.w === p1;
    case 'mov': return a => a.w === p1 && a.m === p2;
    case 'fm': return a => a.m === p1;
    case 'dist': return a => (a.m === 'dec') === (p1 === 'yes');
    case 'tot': { const c = Math.ceil(+p2), over = p1 === 'o'; return a => (a.m === 'dec' || a.r > c || (a.r === c && a.late)) === over; }
    case 'rnd': return a => a.m !== 'dec' && a.r === +p1;
    case 'wr': return a => a.m !== 'dec' && a.w === p1 && a.r === +p2;
  }
  return null;
}
const tdOk = (q: string[], i: number, j: number): boolean => q[0] === 'td' ? ((i + j > +q[2]) === (q[1] === 'o')) : (((q[1] === 'a' ? i : j) >= 1) === (q[2] === 'yes'));
// Joint model of one fight: every way it can end (who, how, which round, which half of the round) with its probability,
// plus takedown counts that grow with how long that ending lets the fight run. Selections from the same fight are
// priced from the probability that all of them happen together, never by multiplying their odds.
export function jointModel(P: Probs, st?: FightStats): JointModel {
  const atoms: Atom[] = [];
  for (const w of SIDES) {
    atoms.push({ w, m: 'dec', r: P.R, late: true, mins: 5 * P.R, p: P.M[w].dec });
    for (const m of ['ko', 'sub'] as const) for (let r = 1; r <= P.R; r++) for (const late of [false, true])
      atoms.push({ w, m, r, late, mins: 5 * (r - 1) + (late ? 3.75 : 1.25), p: P.M[w][m] * P.sh[r - 1] * 0.5 });
  }
  const ra = tdRate(st && st.a), rb = tdRate(st && st.b), K = 40, grids = new Map<number, [number[], number[]]>();
  const grid = (mins: number): [number[], number[]] => { if (!grids.has(mins)) grids.set(mins, [nbPmf(ra * mins / 15, 1.6, K), nbPmf(rb * mins / 15, 1.6, K)]); return grids.get(mins)!; };
  function prob(keys: string[]): number {
    const fp: ((a: Atom) => boolean)[] = [], tp: string[][] = [];
    for (const k of keys) { const q = k.split(':'); if (q[0] === 'td' || q[0] === 'tda') tp.push(q); else { const g = pred(q); if (!g) return 0; fp.push(g); } }
    let tot = 0;
    for (const a of atoms) {
      if (!a.p || !fp.every(g => g(a))) continue;
      if (!tp.length) { tot += a.p; continue; }
      const [pa, pb] = grid(a.mins); let sum = 0;
      for (let i = 0; i <= K; i++) { if (!pa[i]) continue; for (let j = 0; j <= K; j++) if (tp.every(q => tdOk(q, i, j))) sum += pa[i] * pb[j]; }
      tot += a.p * sum;
    }
    return tot;
  }
  return { prob };
}
const COMBO_MARGIN = 1.10;
// legOdds: the single price of each selection. A combo is harder to hit than any one of its legs, so it never pays less than the best of them.
export function combo(J: JointModel, keys: string[], legOdds: number[], map?: Record<string, Priced> | null): Combo {
  const p = J.prob(keys), each = keys.map(k => J.prob([k]));
  if (!(p > 1e-9)) return { ok: false, why: 'impossible' };
  if (p > 0.97 * Math.min(...each)) return { ok: false, why: 'redundant' };
  // "Allen vence" + "termina por finalização" is exactly the market "Allen por finalização": pay that market's price, not a different one
  if (map && !keys.some(k => /^td/.test(k))) for (const k in map) {
    if (/^td/.test(k) || keys.includes(k)) continue;
    if (Math.abs(J.prob([k]) - p) < 1e-9 && Math.abs(J.prob(keys.concat(k)) - p) < 1e-9) return { ok: true, p, odd: Math.max(map[k].odd, ...legOdds), same: map[k].sel };
  }
  return { ok: true, p, odd: Math.max(clamp(r2(1 / (p * COMBO_MARGIN)), 1.02, 301), ...legOdds) };
}
export const ML: Record<Finish, string> = { ko: 'KO/TKO', sub: 'Finalização', dec: 'Decisão' };
export function price(f: Fight, o: Odds, st?: FightStats): Pricing {
  const P = probs(f, o), R = f.rounds, A = f.a.last, B = f.b.last;
  const groups: Market[] = [], map: Record<string, Priced> = {};
  const add = (g: Market): void => {
    g.opts = g.opts.filter(x => x && x.odd);
    if (!g.opts.length) return;
    groups.push(g);
    for (const x of g.opts) map[x.key] = { odd: x.odd as number, src: x.src, market: g.title, sel: x.full, cat: g.cat };
  };
  const real = (key: string, label: string, full: string, odd: number): Option => ({ key, label, full, odd, src: 'real' });
  const est = (key: string, label: string, full: string, p: number): Option => ({ key, label, full, odd: mo(p), src: 'est' });

  add({ id: 'ml', cat: 'Vencedor', title: 'Vencedor', cols: 2, opts: [real('ml:a', A, f.a.name + ' vence', o.ml.a), real('ml:b', B, f.b.name + ' vence', o.ml.b)] });

  const mov: Option[] = [];
  for (const m of FINISHES) for (const s of SIDES) {
    const full = (s === 'a' ? A : B) + ' por ' + ML[m];
    mov.push(o.method ? real(`mov:${s}:${m}`, ML[m], full, o.method[s][m]) : est(`mov:${s}:${m}`, ML[m], full, P.M[s][m]));
  }
  add({ id: 'mov', cat: 'Método', title: 'Método de vitória', cols: 2, heads: true, opts: mov });

  add({ id: 'fm', cat: 'Método', title: 'Como a luta termina', cols: 3, opts: FINISHES.map(m =>
    (m === 'dec' && o.dist) ? real('fm:dec', ML.dec, 'Luta termina por Decisão', o.dist.yes) : est('fm:' + m, ML[m], 'Luta termina por ' + ML[m], P.M.a[m] + P.M.b[m])) });

  add({ id: 'dist', cat: 'Método', title: 'Vai até a decisão?', cols: 2, opts: o.dist
    ? [real('dist:yes', 'Sim', 'Luta vai até a decisão', o.dist.yes), real('dist:no', 'Não', 'Luta não vai até a decisão', o.dist.no)]
    : [est('dist:yes', 'Sim', 'Luta vai até a decisão', P.pDec), est('dist:no', 'Não', 'Luta não vai até a decisão', P.F)] });

  const tot: Option[] = [];
  for (let L = 0.5; L < R; L += 1) {
    const line = (o.total && o.total.line === L) ? o.total : null;        // the one line the book publishes
    if (L === 0.5 && !line) continue;
    const pu = P.F * cumShare(P.sh, L);
    tot.push(line ? real(`tot:o:${L}`, '+' + L, `+${L} rounds`, line.over) : est(`tot:o:${L}`, '+' + L, `+${L} rounds`, 1 - pu));
    tot.push(line ? real(`tot:u:${L}`, '−' + L, `−${L} rounds`, line.under) : est(`tot:u:${L}`, '−' + L, `−${L} rounds`, pu));
  }
  add({ id: 'tot', cat: 'Rounds', title: 'Total de rounds', note: '+ é mais de, − é menos de · X.5 = metade do round seguinte (2:30)', cols: 2, opts: tot });

  add({ id: 'rnd', cat: 'Rounds', title: 'Round em que a luta acaba', note: 'por nocaute ou finalização', cols: 3,
    opts: P.sh.map((s, i) => est('rnd:' + (i + 1), 'Round ' + (i + 1), 'Luta acaba no round ' + (i + 1), P.F * s)) });

  const wr: Option[] = [];
  for (let i = 0; i < R; i++) for (const s of SIDES)
    wr.push(est(`wr:${s}:${i + 1}`, 'Round ' + (i + 1), `${s === 'a' ? A : B} vence no round ${i + 1}`, (P.M[s].ko + P.M[s].sub) * P.sh[i]));
  add({ id: 'wr', cat: 'Rounds', title: 'Vencedor e round', cols: 2, heads: true, opts: wr });

  const J = jointModel(P, st), po: Record<number, number> = {}, td: Option[] = [];
  let best = 0.5, bd = 9;
  for (let L = 0.5; L <= 9.5; L += 1) { po[L] = J.prob(['td:o:' + L]); const d = Math.abs(po[L] - 0.5); if (d < bd) { bd = d; best = L; } }
  for (const L of [best - 1, best, best + 1].filter(x => x >= 0.5)) {
    td.push(est(`td:o:${L}`, '+' + L, `+${L} quedas na luta`, po[L]));
    td.push(est(`td:u:${L}`, '−' + L, `−${L} quedas na luta`, 1 - po[L]));
  }
  add({ id: 'td', cat: 'Quedas', title: 'Quedas na luta', note: '+ é mais de, − é menos de · soma dos dois lutadores', cols: 2, opts: td });

  const tda: Option[] = [];
  for (const s of SIDES) {
    const nm = s === 'a' ? A : B, p1 = J.prob([`tda:${s}:yes`]);
    tda.push(est(`tda:${s}:yes`, nm + ': sim', nm + ' acerta pelo menos 1 queda', p1));
    tda.push(est(`tda:${s}:no`, nm + ': não', nm + ' não acerta nenhuma queda', 1 - p1));
  }
  add({ id: 'tda', cat: 'Quedas', title: 'Acerta pelo menos 1 queda?', cols: 2, opts: tda });
  // Fair chance of a set of selections of this fight. A lone winner pick reads the moneyline itself: it is the one real
  // market the joint model does not reproduce exactly (its winner split comes from the method lines when they exist).
  const chance = (keys: string[]): number => (keys.length === 1 && keys[0] === 'ml:a') ? P.pa : (keys.length === 1 && keys[0] === 'ml:b') ? P.pb : J.prob(keys);
  return { groups, map, P, J, chance };
}

// which way an over/under selection goes ('o' more than the line, 'u' less), or null for every other market
export const overUnder = (key: unknown): 'o' | 'u' | null => { const q = String(key).split(':'); return (q[0] === 'tot' || q[0] === 'td') && (q[1] === 'o' || q[1] === 'u') ? q[1] : null; };
// the corner a selection belongs to ('a' or 'b'), or null when it is about the fight as a whole
export const sideOf = (key: unknown): Side | null => { const q = String(key).split(':'); return ['ml', 'mov', 'wr', 'tda'].includes(q[0]) && (q[1] === 'a' || q[1] === 'b') ? q[1] : null; };
