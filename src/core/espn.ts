/* ---------- normalising ESPN payloads ----------
   The only place that knows what ESPN sends. If the API changes shape, this is where to look. */
import { am2dec, devig } from './odds';
import type { Fight, FightEvent, Fighter, FightState, Json, MethodOdds, Odds, Result } from './types';

function lastName(x: Json): string {
  const s = (x.athlete && x.athlete.shortName) || '';
  const n = s.replace(/^\S+\.\s*/, '').trim();
  if (n) return n;
  const full = (x.athlete && (x.athlete.displayName || x.athlete.fullName)) || '';
  return full.split(' ').slice(-1)[0] || full;
}
function normFight(c: Json, e: Json, i: number): Fight | null {
  const cs = [...(c.competitors || [])].sort((x, y) => (x.order || 0) - (y.order || 0));
  if (cs.length < 2) return null;
  const mk = (x: Json): Fighter => ({
    id: String(x.id), name: (x.athlete && (x.athlete.displayName || x.athlete.fullName)) || 'A definir',
    last: lastName(x), country: (x.athlete && x.athlete.flag && x.athlete.flag.alt) || '',
    record: (x.records && x.records[0] && x.records[0].summary) || '', winner: x.winner === true
  });
  const a = mk(cs[0]), b = mk(cs[1]);
  const st = c.status || {}, ty = st.type || {};
  const canceled = /CANCEL|POSTPON|FORFEIT/i.test(ty.name || '');
  return {
    id: String(c.id), eventId: String(e.id), eventName: e.name || '', date: Date.parse(c.date || e.date), idx: i,
    weight: (c.type && (c.type.abbreviation || c.type.text)) || '', rounds: (c.format && c.format.regulation && c.format.regulation.periods) || 3,
    a, b, state: (canceled ? 'post' : (ty.state || 'pre')) as FightState, canceled, period: st.period || 0, clock: st.displayClock || '',
    winner: a.winner ? 'a' : (b.winner ? 'b' : null)
  };
}
export function normEvent(e: Json): FightEvent {
  const fights = ((e.competitions || []) as Json[]).map((c, i) => normFight(c, e, i)).filter((f): f is Fight => !!f);
  const t = (e.status && e.status.type) || {};
  const completed = !!(t.completed || t.state === 'post' || /FINAL/i.test(t.name || ''));
  return { id: String(e.id), name: e.name || '', date: Date.parse(e.date), completed, fights };
}
export function normOdds(j: Json, f: Fight): Odds | null {
  const it = ((j && j.items) || []).find((x: Json) => x && x.homeAthleteOdds && x.awayAthleteOdds);
  if (!it) return null;
  const idOf = (o: Json): string | undefined => (String((o.athlete && o.athlete.$ref) || '').match(/athletes\/(\d+)/) || [])[1];
  const side: { a?: Json; b?: Json } = {};
  for (const o of [it.homeAthleteOdds, it.awayAthleteOdds]) { const id = idOf(o); if (id === f.a.id) side.a = o; else if (id === f.b.id) side.b = o; }
  if (!side.a || !side.b) return null;
  const cur = (o: Json): Json => o.current || {};
  const ml = (o: Json) => am2dec(o.moneyLine != null ? o.moneyLine : (cur(o).moneyLine || {}).american);
  const mA = ml(side.a), mB = ml(side.b);
  if (!mA || !mB) return null;
  const vm = (o: Json): MethodOdds | null => {
    const v = cur(o).victoryMethod; if (!v) return null;
    const r = { ko: am2dec((v.koTkoDq || {}).american), sub: am2dec((v.submission || {}).american), dec: am2dec((v.points || {}).american) };
    return (r.ko && r.sub && r.dec) ? { ko: r.ko, sub: r.sub, dec: r.dec } : null;
  };
  const meA = vm(side.a), meB = vm(side.b);
  const line = Number(it.overUnder), ov = am2dec(it.overOdds), un = am2dec(it.underOdds);
  const total = (line > 0 && line < f.rounds && Math.abs(line % 1 - 0.5) < 1e-9 && ov && un) ? { line, over: ov, under: un } : null;
  return { book: (it.provider && it.provider.name) || 'casa', props: String((it.propBets && it.propBets.$ref) || '').replace(/^http:/, 'https:'), ml: { a: mA, b: mB }, method: (meA && meB) ? { a: meA, b: meB } : null, total, dist: null, ts: Date.now() };
}
// "Fight To Go The Distance" arrives as two unlabeled prices; the one whose fair probability sits closer to the
// decision probability implied by the method-of-victory lines is the "yes".
export function attachDistance(o: Odds, _f: Fight, j: Json): Odds {
  const xs = (((j && j.items) || []) as Json[]).filter(x => x && x.type && /distance/i.test(x.type.name || ''))
    .map(x => am2dec(x.odds && x.odds.american && x.odds.american.value)).filter((x): x is number => !!x);
  if (xs.length !== 2 || !o.method) return o;
  const q = devig([o.method.a.ko, o.method.a.sub, o.method.a.dec, o.method.b.ko, o.method.b.sub, o.method.b.dec]);
  const pDec = q[2] + q[5], p0 = devig(xs)[0];
  o.dist = Math.abs(p0 - pDec) <= Math.abs((1 - p0) - pDec) ? { yes: xs[0], no: xs[1] } : { yes: xs[1], no: xs[0] };
  return o;
}
export function normResult(s: Json): Result | null {
  const r = s && s.result;
  if (!r) return null;
  const nm = ((r.name || '') + ' ' + (r.displayName || '')).toLowerCase();
  let method: Result['method'] = 'unknown';
  if (/no.?contest|overturn/.test(nm)) method = 'nc';
  else if (/draw/.test(nm)) method = 'draw';
  else if (/sub/.test(nm)) method = 'sub';
  else if (/dec/.test(nm)) method = 'dec';
  else if (/ko|dq|disq|stoppage|retire/.test(nm)) method = 'ko';
  // time elapsed in the final round: the displayed clock ("3:26") is what the result is published with; the numeric clock is the fallback
  const mm = /^(\d+):(\d{2})$/.exec(String(s.displayClock || '').trim());
  const time = mm ? (+mm[1]) * 60 + (+mm[2]) : (typeof s.clock === 'number' ? s.clock : null);
  return { method, label: r.displayName || '', desc: r.displayDescription || r.description || '', round: s.period || 0, time, clock: s.displayClock || '' };
}
export function statValue(j: Json, name: string): number | null {
  const cats = (j && j.splits && j.splits.categories) || [];
  for (const c of cats) for (const s of (c.stats || [])) if (s.name === name && typeof s.value === 'number') return s.value;
  return null;
}
