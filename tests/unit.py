"""Unit tests for the pure core of index.html (odds maths, ESPN normalisers, pricing, settlement).

Usage: python3 tests/unit.py   (needs: pip install -r tests/requirements.txt && playwright install chromium)
Loads the page with the network blocked and exercises window.__OL.Core directly. Exits non-zero on any failure.
"""
import pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent

JS = r"""
() => {
  const { Core } = window.__OL, fails = []; let n = 0;
  const eq = (name, got, want) => { n++; if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); };
  const near = (name, got, want, tol) => { n++; if (!(Math.abs(got - want) <= (tol || 1e-9))) fails.push(`${name}: got ${got}, want ${want}`); };
  const ok = (name, cond) => { n++; if (!cond) fails.push(name); };

  /* ---- odds conversion ---- */
  eq('am2dec -125', Core.am2dec(-125), 1.8);
  eq('am2dec +105', Core.am2dec(105), 2.05);
  eq('am2dec -110', Core.am2dec(-110), 1.91);
  eq('am2dec "+800"', Core.am2dec('+800'), 9);
  eq('am2dec EVEN', Core.am2dec('EVEN'), 2);
  eq('am2dec null', Core.am2dec(null), null);
  eq('am2dec 0', Core.am2dec(0), null);

  /* ---- ESPN normalisers ---- */
  const cls = (name, displayName) => { const r = Core.normResult({ result: { name, displayName }, period: 2, clock: 100, displayClock: '1:40' }); return r && r.method; };
  eq('result kotko', cls('kotko', 'KO/TKO'), 'ko');
  eq('result decision', cls('decision---unanimous', 'Decision - Unanimous'), 'dec');
  eq('result split decision', cls('decision---split', 'Decision - Split'), 'dec');
  eq('result submission', cls('submission', 'Submission'), 'sub');
  eq('result draw', cls('draw---majority', 'Draw - Majority'), 'draw');
  eq('result no contest', cls('no-contest', 'No Contest'), 'nc');
  eq('result dq counts as ko', cls('dq', 'DQ'), 'ko');
  eq('result unrecognised', cls('something-new', 'Something New'), 'unknown');
  eq('result missing', Core.normResult({ period: 1 }), null);

  const F = { id: 'x', rounds: 5, weight: 'Middleweight', a: { id: '301', name: 'Rafael Almeida', last: 'Almeida' }, b: { id: '302', name: 'Connor Lee Dunne', last: 'Dunne' } };
  const am = v => ({ american: (v > 0 ? '+' : '') + v });
  const side = (id, ml, ko, sub, dec) => ({ moneyLine: ml, current: { victoryMethod: { koTkoDq: am(ko), submission: am(sub), points: am(dec) } }, athlete: { $ref: `http://x/athletes/${id}?lang=en` } });
  const payload = { items: [{ provider: { name: 'DraftKings' }, overUnder: 3.5, overOdds: -120, underOdds: -110,
    homeAthleteOdds: side('302', 105, 200, 2200, 450), awayAthleteOdds: side('301', -125, 800, 300, 250), propBets: { $ref: 'http://x/props?lang=en' } }] };
  const O = Core.normOdds(payload, F);
  eq('odds mapped by athlete id, not home/away', O.ml, { a: 1.8, b: 2.05 });
  eq('odds method a', O.method.a, { ko: 9, sub: 4, dec: 3.5 });
  eq('odds total', O.total, { line: 3.5, over: 1.83, under: 1.91 });
  eq('odds props link is https', O.props, 'https://x/props?lang=en');
  eq('odds none', Core.normOdds({ items: [] }, F), null);
  eq('odds for another fight', Core.normOdds(payload, { ...F, a: { id: '999' } }), null);
  const dist = vals => Core.attachDistance(Core.normOdds(payload, F), F, { items: vals.map(v => ({ type: { name: 'Fight To Go The Distance' }, odds: { american: { value: v } } })) }).dist;
  eq('distance yes listed first', dist(['+130', '-170']), { yes: 2.3, no: 1.59 });
  eq('distance yes listed second', dist(['-170', '+130']), { yes: 2.3, no: 1.59 });
  eq('distance needs two prices', dist(['+130']), null);
  O.dist = { yes: 2.3, no: 1.59 };

  /* ---- pricing ---- */
  const P = Core.price(F, O, { a: { tdAvg: 1.52 }, b: { tdAvg: 0.43 } }), J = P.J, M = P.map;
  eq('real moneyline kept', [M['ml:a'].odd, M['ml:a'].src], [1.8, 'real']);
  eq('real method kept', [M['mov:b:sub'].odd, M['mov:b:sub'].src], [23, 'real']);
  eq('book total line is real', M['tot:o:3.5'].src, 'real');
  eq('alternate total line is estimated', M['tot:o:1.5'].src, 'est');
  eq('takedowns are estimated', M[Object.keys(M).find(k => k.startsWith('td:o:'))].src, 'est');
  eq('5-round fight offers round 5', !!M['rnd:5'], true);
  near('joint: everything', J.prob([]), 1);
  near('joint: winners sum to 1', J.prob(['ml:a']) + J.prob(['ml:b']), 1);
  near('joint: rounds + decision sum to 1', [1, 2, 3, 4, 5].reduce((s, r) => s + J.prob(['rnd:' + r]), 0) + J.prob(['dist:yes']), 1);
  near('joint: over + under rounds', J.prob(['tot:o:2.5']) + J.prob(['tot:u:2.5']), 1);
  near('joint: over + under takedowns', J.prob(['td:o:1.5']) + J.prob(['td:u:1.5']), 1, 2e-3);
  near('joint: decision matches the distance line', J.prob(['dist:yes']), (1 / 2.3) / (1 / 2.3 + 1 / 1.59), 1e-9);
  near('joint: under 3.5 matches the book total', J.prob(['tot:u:3.5']), (1 / 1.91) / (1 / 1.83 + 1 / 1.91), 1e-6);
  ok('longer fights have more takedowns', J.prob(['dist:yes', 'td:o:1.5']) / J.prob(['dist:yes']) > J.prob(['rnd:1', 'td:o:1.5']) / J.prob(['rnd:1']));

  const combo = ks => Core.combo(J, ks, ks.map(k => M[k].odd), M);
  eq('combo impossible: decision + under 1.5', combo(['dist:yes', 'tot:u:1.5']).why, 'impossible');
  eq('combo impossible: no takedowns + lands one', combo(['td:u:0.5', 'tda:a:yes']).why, 'impossible');
  eq('combo redundant: winner + his method', combo(['ml:a', 'mov:a:sub']).why, 'redundant');
  eq('combo equal to a market pays that market', [combo(['ml:a', 'fm:ko']).odd, combo(['ml:a', 'fm:ko']).same], [9, 'Almeida por KO/TKO']);
  const c1 = combo(['fm:ko', 'tot:o:1.5']);
  ok('combo KO + over 1.5 is valid', c1.ok);
  ok('combo KO + over 1.5 pays more than the naive product (negatively correlated)', c1.odd > M['fm:ko'].odd * M['tot:o:1.5'].odd);
  const c2 = combo(['ml:a', 'td:o:1.5']);
  ok('combo with takedowns is valid', c2.ok && c2.p > 0);
  for (const ks of [['fm:ko', 'tot:o:1.5'], ['ml:a', 'td:o:1.5'], ['mov:b:ko', 'rnd:1'], ['ml:b', 'dist:yes', 'td:u:1.5']]) {
    const c = combo(ks); ok('combo never pays less than its best leg: ' + ks.join('+'), c.ok && c.odd >= Math.max(...ks.map(k => M[k].odd)));
  }

  /* ---- settlement of one selection ---- */
  const fight = (o) => Object.assign({ state: 'post', canceled: false, rounds: 3, period: 2, winner: 'a' }, o);
  const KO = { method: 'ko', round: 2, time: 192 }, TD = { a: 2, b: 1, final: true };
  const out = (key, f, res, td, early) => Core.legOutcome(key, f, res, td, !!early);
  const table = (label, f, res, td, cases) => { for (const k in cases) eq(`${label} ${k}`, out(k, f, res, td), cases[k]); };
  table('KO R2 3:12 by a', fight(), KO, TD, {
    'ml:a': 'won', 'ml:b': 'lost', 'mov:a:ko': 'won', 'mov:a:sub': 'lost', 'mov:b:ko': 'lost', 'fm:ko': 'won', 'fm:dec': 'lost',
    'dist:no': 'won', 'dist:yes': 'lost', 'tot:o:1.5': 'won', 'tot:u:1.5': 'lost', 'tot:o:2.5': 'lost', 'tot:u:2.5': 'won',
    'rnd:2': 'won', 'rnd:1': 'lost', 'wr:a:2': 'won', 'wr:b:2': 'lost', 'wr:a:1': 'lost',
    'td:o:2.5': 'won', 'td:u:2.5': 'lost', 'td:o:3.5': 'lost', 'td:u:3.5': 'won', 'tda:b:yes': 'won', 'tda:b:no': 'lost' });
  table('finish exactly at 2:30 of R2', fight(), { method: 'sub', round: 2, time: 150 }, TD, { 'tot:o:1.5': 'void', 'tot:u:1.5': 'void', 'tot:o:2.5': 'lost' });
  table('finish at 1:00 of R2', fight(), { method: 'sub', round: 2, time: 60 }, TD, { 'tot:o:1.5': 'lost', 'tot:u:1.5': 'won', 'fm:sub': 'won', 'mov:a:sub': 'won' });
  table('decision for b', fight({ period: 3, winner: 'b' }), { method: 'dec', round: 3, time: 300 }, { a: 0, b: 0, final: true }, {
    'ml:b': 'won', 'mov:b:dec': 'won', 'mov:b:ko': 'lost', 'fm:dec': 'won', 'dist:yes': 'won', 'dist:no': 'lost', 'tot:o:2.5': 'won', 'tot:u:2.5': 'lost',
    'rnd:3': 'lost', 'wr:b:3': 'lost', 'td:u:0.5': 'won', 'td:o:0.5': 'lost', 'tda:a:no': 'won', 'tda:a:yes': 'lost' });
  table('draw', fight({ period: 3, winner: null }), { method: 'draw', round: 3, time: 300 }, TD, { 'ml:a': 'void', 'ml:b': 'void', 'mov:a:dec': 'lost', 'dist:yes': 'won', 'fm:dec': 'won', 'fm:ko': 'lost' });
  table('no contest', fight({ winner: null }), { method: 'nc', round: 1, time: 30 }, TD, { 'ml:a': 'void', 'fm:ko': 'void', 'td:o:0.5': 'void', 'rnd:1': 'void' });
  table('cancelled bout', fight({ canceled: true, winner: null }), null, null, { 'ml:a': 'void', 'td:o:1.5': 'void' });
  table('final without a recognised method', fight(), { method: 'unknown', round: 2, time: null }, TD, { 'ml:a': 'won', 'ml:b': 'lost', 'fm:ko': 'void', 'tot:o:1.5': 'void' });
  table('not started', fight({ state: 'pre', period: 0, winner: null }), null, null, { 'ml:a': null, 'tot:o:1.5': null });
  table('over but result not posted yet', fight(), null, TD, { 'ml:a': null, 'td:o:2.5': null });
  table('takedown stats missing', fight(), KO, null, { 'td:o:1.5': null, 'tda:a:yes': null, 'ml:a': 'won' });
  table('takedown stats not frozen yet', fight(), KO, { a: 1, b: 0, final: false }, { 'td:o:0.5': 'won', 'td:u:0.5': 'lost', 'td:o:1.5': null, 'td:u:1.5': null, 'tda:a:yes': 'won', 'tda:b:yes': null, 'tda:b:no': null });
  table('takedown stats never arrived', fight(), Object.assign({ tdUnavailable: true }, KO), null, { 'td:o:1.5': 'void', 'tda:a:yes': 'void' });
  const live = fight({ state: 'in', period: 3, winner: null });
  eq('live: money only moves at the final bell', out('tot:o:1.5', live, null, null, false), null);
  eq('live: over 1.5 already decided in R3', out('tot:o:1.5', live, null, null, true), 'won');
  eq('live: under 1.5 already lost in R3', out('tot:u:1.5', live, null, null, true), 'lost');
  eq('live: round 1 finish already lost', out('rnd:1', live, null, null, true), 'lost');
  eq('live: round 3 finish still open', out('rnd:3', live, null, null, true), null);
  eq('live: winner never early', out('ml:a', live, null, null, true), null);
  eq('live: takedown over already hit', out('td:o:1.5', live, null, { a: 2, b: 0, final: false }, true), 'won');

  /* ---- settlement of a whole bet ---- */
  const leg = (fid, odd) => ({ fid, odd });
  const bet = (stake, legs, sgp) => ({ stake, legs, sgp });
  eq('single won', Core.betResult(bet(100, [leg('f1', 1.67)]), ['won']), { status: 'won', payout: 167 });
  eq('single lost', Core.betResult(bet(100, [leg('f1', 1.67)]), ['lost']), { status: 'lost', payout: 0 });
  eq('single void refunds', Core.betResult(bet(100, [leg('f1', 1.67)]), ['void']), { status: 'void', payout: 100 });
  eq('single pending', Core.betResult(bet(100, [leg('f1', 1.67)]), [null]), null);
  eq('parlay won', Core.betResult(bet(10, [leg('f1', 2), leg('f2', 1.5)]), ['won', 'won']), { status: 'won', payout: 30 });
  eq('parlay pending', Core.betResult(bet(10, [leg('f1', 2), leg('f2', 1.5)]), ['won', null]), null);
  eq('parlay lost as soon as one leg loses', Core.betResult(bet(10, [leg('f1', 2), leg('f2', 1.5)]), [null, 'lost']), { status: 'lost', payout: 0 });
  eq('parlay with a void leg pays the rest', Core.betResult(bet(10, [leg('f1', 2), leg('f2', 1.5)]), ['won', 'void']), { status: 'won', payout: 20 });
  eq('parlay all void refunds', Core.betResult(bet(10, [leg('f1', 2), leg('f2', 1.5)]), ['void', 'void']), { status: 'void', payout: 10 });
  eq('same-fight combo pays its own price, not the product', Core.betResult(bet(10, [leg('f1', 2.62), leg('f1', 1.27)], { f1: 4.5 }), ['won', 'won']), { status: 'won', payout: 45 });
  eq('combo inside a parlay', Core.betResult(bet(10, [leg('f1', 2.62), leg('f1', 1.27), leg('f2', 2)], { f1: 4.5 }), ['won', 'won', 'won']), { status: 'won', payout: 90 });
  eq('combo with a void leg drops that fight', Core.betResult(bet(10, [leg('f1', 2.62), leg('f1', 1.27), leg('f2', 2)], { f1: 4.5 }), ['won', 'void', 'won']), { status: 'won', payout: 20 });
  eq('combo alone with a void leg refunds', Core.betResult(bet(10, [leg('f1', 2.62), leg('f1', 1.27)], { f1: 4.5 }), ['won', 'void']), { status: 'void', payout: 10 });
  eq('combo with a lost leg loses', Core.betResult(bet(10, [leg('f1', 2.62), leg('f1', 1.27)], { f1: 4.5 }), ['won', 'lost']), { status: 'lost', payout: 0 });

  /* ---- cashout: the whole stake, only before any of the bet's fights starts ---- */
  const ft = (state, extra) => Object.assign({ state, canceled: false }, extra);
  const open = { status: 'open', stake: 40, legs: [leg('f1', 2)] };
  eq('cashout before the fight returns the stake', Core.cashout(open, [ft('pre')]), { ok: true, value: 40 });
  eq('cashout frozen while the fight is live', Core.cashout(open, [ft('in')]), { ok: false, why: 'live' });
  eq('cashout gone once the fight is over', Core.cashout(open, [ft('post')]), { ok: false, why: 'started' });
  eq('cashout not offered for a cancelled fight (it settles as void)', Core.cashout(open, [ft('post', { canceled: true })]), { ok: false, why: 'started' });
  eq('cashout needs the fight on the board', Core.cashout(open, [null]), { ok: false, why: 'unknown' });
  eq('cashout only for open bets', Core.cashout({ status: 'won', stake: 40, legs: [leg('f1', 2)] }, [ft('pre')]), { ok: false, why: 'closed' });
  eq('cashout only once', Core.cashout({ status: 'cashed', stake: 40, legs: [leg('f1', 2)] }, [ft('pre')]), { ok: false, why: 'closed' });
  const multi = { status: 'open', stake: 10, sgp: { f1: 4.5 }, legs: [leg('f1', 2.62), leg('f1', 1.27), leg('f2', 2)] };
  eq('parlay cashout while every fight is still to start', Core.cashout(multi, [ft('pre'), ft('pre'), ft('pre')]), { ok: true, value: 10 });
  eq('parlay cashout frozen when one fight is live', Core.cashout(multi, [ft('pre'), ft('pre'), ft('in')]), { ok: false, why: 'live' });
  eq('parlay cashout gone after its first fight ended', Core.cashout(multi, [ft('post'), ft('post'), ft('pre')]), { ok: false, why: 'started' });
  eq('a live fight wins over a finished one in the reason shown', Core.cashout(multi, [ft('post'), ft('post'), ft('in')]), { ok: false, why: 'live' });
  eq('cashout value never depends on the odds', Core.cashout({ status: 'open', stake: 123.45, legs: [leg('f1', 51)] }, [ft('pre')]).value, 123.45);
  return { n, fails };
}
"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
    page.goto((ROOT / 'index.html').as_uri())
    page.wait_for_function('window.__OL && window.__OL.Core')
    res = page.evaluate(JS)
    browser.close()

for f in res['fails']:
    print('FAIL', f)
print(f"{res['n'] - len(res['fails'])}/{res['n']} checks passed")
sys.exit(1 if res['fails'] else 0)
