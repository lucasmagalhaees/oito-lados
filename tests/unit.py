"""Unit tests for the pure core of index.html (odds maths, ESPN normalisers, pricing, settlement).

Usage: python3 tests/unit.py   (needs: pip install -r tests/requirements.txt && playwright install chromium)
Loads the page with the network blocked and exercises window.__OL.Core directly. Exits non-zero on any failure.
"""
import pathlib, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import cov

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
  near('chance: a lone winner pick is the moneyline without the margin', P.chance(['ml:b']), (1 / 2.05) / (1 / 1.8 + 1 / 2.05), 1e-9);
  near('chance: the two winners sum to 1', P.chance(['ml:a']) + P.chance(['ml:b']), 1, 1e-9);
  near('chance: anything else comes from the joint model', P.chance(['ml:b', 'tot:o:1.5']), J.prob(['ml:b', 'tot:o:1.5']), 1e-12);
  near('chance: a single non-winner pick too', P.chance(['dist:yes']), J.prob(['dist:yes']), 1e-12);
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

  /* ---- cashout: the stake back before anything starts; a market offer once part of a parlay has won ---- */
  const lg = (state, out, extra) => Object.assign({ state, canceled: false, out: out || null }, extra);
  const open = { status: 'open', stake: 40, legs: [leg('f1', 2)] };
  const never = () => { throw new Error('a refund must not need a price'); };
  eq('cashout before the fight returns the stake', Core.cashout(open, [lg('pre')], () => 0.5), { ok: true, kind: 'refund', value: 40 });
  eq('refund works without any price available', Core.cashout(open, [lg('pre')], () => null), { ok: true, kind: 'refund', value: 40 });
  eq('cashout frozen while the fight is live', Core.cashout(open, [lg('in')], never), { ok: false, why: 'live' });
  eq('fight over, result still to come', Core.cashout(open, [lg('post')], () => null), { ok: false, why: 'settling' });
  eq('cancelled fight is left to settlement', Core.cashout(open, [lg('post', 'void', { canceled: true })], () => null), { ok: false, why: 'settling' });
  eq('cashout needs the fight on the board', Core.cashout(open, [null], never), { ok: false, why: 'unknown' });
  eq('cashout only for open bets', Core.cashout({ status: 'won', stake: 40, legs: [leg('f1', 2)] }, [lg('pre')], never), { ok: false, why: 'closed' });
  eq('cashout only once', Core.cashout({ status: 'cashed', stake: 40, legs: [leg('f1', 2)] }, [lg('pre')], never), { ok: false, why: 'closed' });
  const two = { status: 'open', stake: 10, legs: [leg('f1', 2), leg('f2', 1.5)] };
  eq('parlay before any fight: refund', Core.cashout(two, [lg('pre'), lg('pre')], () => 0.5), { ok: true, kind: 'refund', value: 10 });
  eq('parlay frozen when one fight is live', Core.cashout(two, [lg('post', 'won'), lg('in')], never), { ok: false, why: 'live' });
  eq('parlay with a lost leg has nothing to cash out', Core.cashout(two, [lg('post', 'lost'), lg('pre')], () => 0.5), { ok: false, why: 'lost' });
  eq('parlay: one leg won, one to go -> market offer', Core.cashout(two, [lg('post', 'won'), lg('pre')], () => 0.6), { ok: true, kind: 'market', value: 17.1, full: 30, chance: 0.6 });
  const three = { status: 'open', stake: 10, legs: [leg('f1', 2), leg('f2', 1.5), leg('f3', 3)] };
  eq('parlay: two legs won, one to go', Core.cashout(three, [lg('post', 'won'), lg('post', 'won'), lg('pre')], () => 0.3), { ok: true, kind: 'market', value: 25.65, full: 90, chance: 0.3 });
  eq('parlay: one won, two to go multiplies the chances', Core.cashout(three, [lg('post', 'won'), lg('pre'), lg('pre')], fid => (fid === 'f2' ? 0.6 : 0.3)).value, Core.r2(90 * 0.18 * 0.95));
  eq('parlay: a voided leg and nothing won yet is still a refund', Core.cashout(two, [lg('post', 'void', { canceled: true }), lg('pre')], () => 0.5), { ok: true, kind: 'refund', value: 10 });
  eq('parlay: a voided leg drops out of the offer', Core.cashout(three, [lg('post', 'void'), lg('post', 'won'), lg('pre')], () => 0.5), { ok: true, kind: 'market', value: 21.38, full: 45, chance: 0.5 });
  eq('parlay: the fight that is left has no price', Core.cashout(two, [lg('post', 'won'), lg('pre')], () => null), { ok: false, why: 'noprice' });
  eq('parlay: a finished fight waiting for its result holds the offer', Core.cashout(three, [lg('post', 'won'), lg('post'), lg('pre')], () => 0.5), { ok: false, why: 'settling' });
  eq('parlay: everything already won is left to settlement', Core.cashout(two, [lg('post', 'won'), lg('post', 'won')], never), { ok: false, why: 'settling' });
  eq('offer never exceeds what the bet would pay', Core.cashout(two, [lg('post', 'won'), lg('pre')], () => 1).value, 28.5);
  const combo2 = { status: 'open', stake: 10, sgp: { f2: 4.5 }, legs: [leg('f1', 2), Object.assign(leg('f2', 2.62), { key: 'fm:ko' }), Object.assign(leg('f2', 1.27), { key: 'tot:o:1.5' })] };
  let asked = null;
  eq('same-fight combo still to come is priced as one, at its own odd', Core.cashout(combo2, [lg('post', 'won'), lg('pre'), lg('pre')], (fid, keys) => { asked = [fid, keys]; return 0.2; }), { ok: true, kind: 'market', value: 17.1, full: 90, chance: 0.2 });
  eq('the price is asked for the selections of that fight together', asked, ['f2', ['fm:ko', 'tot:o:1.5']]);
  eq('same-fight combo alone, before the fight: refund', Core.cashout({ status: 'open', stake: 10, sgp: { f2: 4.5 }, legs: [leg('f2', 2.62), leg('f2', 1.27)] }, [lg('pre'), lg('pre')], () => 0.2), { ok: true, kind: 'refund', value: 10 });
  eq('cashout margin', Core.CASHOUT_MARGIN, 0.05);

  /* ---- money fields: thousands mask and parsing (dot groups thousands, comma starts the cents) ---- */
  for (const [raw, want] of [['', ''], ['5', '5'], ['150', '150'], ['1500', '1.500'], ['15000', '15.000'], ['1234567', '1.234.567'], ['1.500', '1.500'], ['15.00', '1.500'],
      ['1500,', '1.500,'], ['1500,5', '1.500,5'], ['1500,50', '1.500,50'], ['1500,509', '1.500,50'], ['1.5,0,0', '15,00'], [',5', '0,5'], ['0015', '15'], ['0', '0'], ['0,05', '0,05'],
      ['R$ 2.000,00', '2.000,00'], ['abc', ''], ['12a3', '123']])
    eq(`mask "${raw}"`, Core.maskMoney(raw), want);
  for (const [text, want] of [['', 0], ['abc', 0], ['0', 0], ['5', 5], ['1.500', 1500], ['1.500,50', 1500.5], ['1.234.567,89', 1234567.89], ['0,5', 0.5], ['1500', 1500], ['2.000,00', 2000], ['10,999', 11]])
    eq(`parse "${text}"`, Core.parseMoney(text), want);
  for (const v of [1, 10.5, 999.99, 1000, 1234.5, 1000000, 40])
    eq(`number -> field -> number ${v}`, Core.parseMoney(Core.moneyText(v)), v);
  eq('field text of 1234.5', Core.moneyText(1234.5), '1.234,5');
  eq('field text of 730', Core.moneyText(730), '730');

  /* ---- currency: the rate answer, the cross rate and converting the whole state ---- */
  const FXJ = { amount: 1.0, base: 'BRL', date: '2026-01-02', rates: { EUR: 0.16, USD: 0.2 } };
  const fx = Core.normFx(FXJ);
  eq('fx: answer read with the base at 1', fx, { date: '2026-01-02', rates: { BRL: 1, USD: 0.2, EUR: 0.16 } });
  for (const [name, bad] of [['another base', { ...FXJ, base: 'USD' }], ['a rate missing', { ...FXJ, rates: { USD: 0.2 } }], ['a zero rate', { ...FXJ, rates: { USD: 0, EUR: 0.16 } }],
    ['a rate as text', { ...FXJ, rates: { USD: '0.2', EUR: 0.16 } }], ['no date', { ...FXJ, date: undefined }], ['a date in another shape', { ...FXJ, date: '02/01/2026' }], ['no rates', { base: 'BRL', date: '2026-01-02' }], ['null', null], ['text', 'oops']])
    eq('fx: rejects ' + name, Core.normFx(bad), null);
  near('fx: real to dollar', Core.fxRate(fx, 'BRL', 'USD'), 0.2);
  near('fx: dollar to real', Core.fxRate(fx, 'USD', 'BRL'), 5);
  near('fx: dollar to euro goes through the real', Core.fxRate(fx, 'USD', 'EUR'), 0.8);
  near('fx: same currency', Core.fxRate(fx, 'EUR', 'EUR'), 1);
  eq('fx: unknown currency', Core.fxRate(fx, 'BRL', 'GBP'), null);
  eq('fx: no rates yet', Core.fxRate(null, 'BRL', 'USD'), null);
  const ST0 = { v: 1, cur: 'BRL', unitPct: 10, deposits: [{ t: 1, v: 1000 }, { t: 2, v: 50.03 }], bets: [
    { id: 'a', stake: 100, unit: 100, payout: 167, status: 'won', legs: [] }, { id: 'b', stake: 50.03, unit: 105, payout: 0, status: 'open', legs: [] },
    { id: 'c', stake: 10, payout: 15.19, status: 'cashed', cash: { kind: 'market', full: 34.2, chance: 0.4675 }, legs: [] }, { id: 'd', stake: 40, unit: 100, payout: 40, status: 'cashed', cash: { kind: 'refund', full: null, chance: null }, legs: [] }] };
  const before = JSON.stringify(ST0), US = Core.convertState(ST0, 'USD', 0.2);
  eq('convert: the state given is left alone', JSON.stringify(ST0), before);
  eq('convert: currency', US.cur, 'USD');
  eq('convert: stakes, payouts and units', US.bets.map(b => [b.stake, b.payout, b.unit]), [[20, 33.4, 20], [10.01, 0, 21], [2, 3.04, undefined], [8, 8, 20]]);
  eq('convert: the possible return of a market cashout', [US.bets[2].cash, US.bets[3].cash], [{ kind: 'market', full: 6.84, chance: 0.4675 }, { kind: 'refund', full: null, chance: null }]);
  eq('convert: everything else is kept', [US.v, US.unitPct, US.bets[0].id, US.bets[0].status, US.deposits[1].t], [1, 10, 'a', 'won', 2]);
  eq('convert: balance before', Core.balanceOf(ST0), 1072.19);
  eq('convert: balance is the old one at the rate, to the cent', Core.balanceOf(US), 214.44);
  eq('convert: deposits', US.deposits.map(d => d.v), [200, 10.01]);
  const tight = { deposits: [{ t: 1, v: 100.06 }], bets: [{ stake: 50.03, payout: 0, status: 'open' }, { stake: 50.03, payout: 0, status: 'open' }] };
  const tightUS = Core.convertState(tight, 'USD', 0.2);
  eq('convert: a spent balance never turns negative', Core.balanceOf(tightUS), 0);
  eq('convert: the cent that rounding moved goes into the largest deposit', [tightUS.deposits[0].v, tightUS.bets.map(b => b.stake)], [20.02, [10.01, 10.01]]);
  eq('convert: tiny amounts do not vanish', Core.convertState({ deposits: [{ t: 1, v: 0.02 }], bets: [{ stake: 0.02, payout: 0 }] }, 'USD', 0.2).bets[0].stake, 0.01);
  eq('convert: empty state', Core.convertState({ v: 1, deposits: [], bets: [] }, 'EUR', 0.16), { v: 1, deposits: [], bets: [], cur: 'EUR' });
  const back = Core.convertState(US, 'BRL', 5);
  near('convert: there and back lands within cents', Core.balanceOf(back), 1072.19, 0.03);

  /* ---- unit: a percentage of the bankroll, 10% by default ---- */
  eq('unit default is 10% of the bankroll', Core.unitValue(1000, undefined), 100);
  eq('unit at 2%', Core.unitValue(1000, 2), 20);
  eq('unit at 2,5% typed with a comma', Core.unitValue(1000, '2,5'), 25);
  eq('unit rounds to cents', Core.unitValue(333.33, 10), 33.33);
  eq('unit of an empty bankroll', Core.unitValue(0, 10), 0);
  eq('unit never negative', Core.unitValue(-50, 10), 0);
  for (const [raw, want] of [[10, 10], ['5', 5], ['2,5', 2.5], [0, 10], [-3, 10], ['abc', 10], [null, 10], [250, 100], [0.01, 0.1], [33.333, 33.33]])
    eq(`unit percentage ${JSON.stringify(raw)}`, Core.unitPct(raw), want);

  /* ---- which corner a selection belongs to; over and under shown as + and − ---- */
  eq('side of a selection', ['ml:a', 'ml:b', 'mov:a:ko', 'mov:b:dec', 'wr:a:2', 'wr:b:5', 'tda:a:yes', 'tda:b:no'].map(Core.sideOf), ['a', 'b', 'a', 'b', 'a', 'b', 'a', 'b']);
  eq('selections about the whole fight have no side', ['fm:ko', 'dist:yes', 'tot:o:2.5', 'tot:u:2.5', 'rnd:1', 'td:o:1.5', 'td:u:0.5', 'x', ''].map(Core.sideOf), [null, null, null, null, null, null, null, null, null]);
  eq('every priced selection either has a side or is about the fight', Object.keys(M).every(k => [null, 'a', 'b'].includes(Core.sideOf(k))), true);
  eq('over and under rounds read as + and −', [M['tot:o:3.5'].sel, M['tot:u:3.5'].sel, M['tot:o:1.5'].sel], ['+3.5 rounds', '−3.5 rounds', '+1.5 rounds']);
  eq('over and under takedowns read as + and −', Object.keys(M).filter(k => k.startsWith('td:')).every(k => M[k].sel === (k.split(':')[1] === 'o' ? '+' : '−') + k.split(':')[2] + ' quedas na luta'), true);
  eq('no selection is worded with mais/menos de any more', Object.values(M).some(x => /mais de|menos de/i.test(x.sel)), false);

  /* ---- a stake typed in units ---- */
  for (const [typed, shown, n] of [['2', '2', 2], ['2,5', '2,5', 2.5], ['2.5', '2,5', 2.5], ['0,25', '0,25', 0.25], [',5', '0,5', 0.5], ['1,239', '1,23', 1.23], ['007', '7', 7], ['0', '0', 0],
    ['12345', '1234', 1234], ['1,2,3', '1,23', 1.23], ['2u', '2', 2], ['abc', '', 0], ['', '', 0], ['3,', '3,', 3], [null, '', 0]])
    eq(`units field: "${typed}"`, [Core.maskUnits(typed), Core.parseUnits(typed)], [shown, n]);
  eq('units as text', [2, 2.5, 0.25, 1.005, 10, 0, -1, NaN].map(Core.unitsText), ['2', '2,5', '0,25', '1,01', '10', '', '', '']);
  eq('typed units times the unit', Core.r2(Core.parseUnits('2,5') * Core.unitValue(1000, 10)), 250);

  /* ---- the stake of a copied bet: units stay units; what an amount of money becomes is a setting ---- */
  eq('tip setting: default', Core.tipCfg(undefined), { mode: 'same', srcUnit: 0 });
  eq('tip setting: cleaned', Core.tipCfg({ mode: 'units', srcUnit: '1750.004', fixU: 500 }), { mode: 'units', srcUnit: 1750 });
  eq('tip setting: junk falls back', Core.tipCfg({ mode: 'whatever', srcUnit: -3 }), { mode: 'same', srcUnit: 0 });
  eq('tip setting: a saved "fixed" mode, which no longer exists, reads as same', Core.tipCfg({ mode: 'fixed', srcUnit: 1000, fixU: 1.5 }), { mode: 'same', srcUnit: 1000 });
  eq('tip setting: not an object', Core.tipCfg('units'), { mode: 'same', srcUnit: 0 });
  const MONEY = { kind: 'money', money: 1750 }, MYU = 100;
  eq('copied stake: same amount by default', Core.tipStake(MONEY, undefined, MYU), { how: 'same', units: null, value: 1750 });
  eq('copied stake: same stake, by the unit of the source', Core.tipStake(MONEY, { mode: 'units', srcUnit: 1750 }, MYU), { how: 'conv', units: 1, value: 100 });
  eq('copied stake: half a unit of the source', Core.tipStake({ kind: 'money', money: 875 }, { mode: 'units', srcUnit: 1750 }, MYU), { how: 'conv', units: 0.5, value: 50 });
  eq('copied stake: same stake without the unit of the source keeps the amount', Core.tipStake(MONEY, { mode: 'units' }, MYU), { how: 'same', units: null, value: 1750 });
  for (const mode of Core.TIP_MODES) {
    eq(`copied stake: a tip in units keeps its units (${mode})`, Core.tipStake({ kind: 'units', units: 0.5 }, { mode, srcUnit: 1750 }, MYU), { how: 'units', units: 0.5, value: 50 });
    eq(`copied stake: no stake in the tip is one unit (${mode})`, Core.tipStake({ kind: 'default', units: 1 }, { mode, srcUnit: 1750 }, MYU), { how: 'default', units: 1, value: 100 });
  }
  eq('copied stake: no bankroll, no unit', Core.tipStake(MONEY, { mode: 'units', srcUnit: 1750 }, 0).value, 0);
  eq('the two modes', Core.TIP_MODES, ['same', 'units']);

  /* ---- copying a bet from a pasted tip or from the text read off a print ---- */
  const card = [
    { id: 'f1', rounds: 3, a: { name: 'Marina Teles', last: 'Teles' }, b: { name: 'Joana Prado Jr.', last: 'Prado Jr.' } },
    { id: 'f3', rounds: 5, a: { name: 'Rafael Almeida', last: 'Almeida' }, b: { name: 'Connor Lee Dunne', last: 'Dunne' } },
  ];
  const tip = text => { const r = Core.parseTip(text, card); return { items: r.items.map(i => [i.fid, i.key, i.printedOdd, i.assumed]), stake: r.stake, problems: r.problems }; };
  const one = (fid, key, odd, assumed) => [[fid, key, odd == null ? null : odd, !!assumed]];
  const U = n => ({ kind: 'units', units: n }), DEF = { kind: 'default', units: 1 };
  eq('tip: channel format with emojis and markdown', tip("🥊 *Rafael Almeida vs. Connor Lee Dunne*\n\n🎰 *Connor Lee Dunne* - Para vencer a luta\n\n💰 Odd - 1.44\n💎 Stake - 1 unidade"),
     { items: one('f3', 'ml:b', 1.44), stake: U(1), problems: [] });
  eq('tip: text read off a betting-slip print', tip("R$1.750,00 Simples\n& Reutilizar Seleções O Compartilhar\no Connor Lee Dunne 1.44\nPara Ganhar a Luta\nRafael Almeida x Connor Lee Dunne\nSáb 26 Sep 21:00\nAposta Retornos\nR$1.750,00 R$2.527,77"),
     { items: one('f3', 'ml:b', 1.44), stake: { kind: 'money', money: 1750 }, problems: [] });
  eq('tip: the stake of a print is its first amount, not the return', tip("R$250,00 Simples\nConnor Lee Dunne 2.05\nPara Ganhar a Luta\nRafael Almeida x Connor Lee Dunne\nAposta Retornos\nR$250,00 R$512,50").stake, { kind: 'money', money: 250 });
  eq('tip: fighter by submission', tip("Almeida x Dunne\nRafael Almeida por finalização @ 4.00\n2u"), { items: one('f3', 'mov:a:sub', 4), stake: U(2), problems: [] });
  eq('tip: fighter by KO/TKO', tip("Almeida x Dunne\nDunne por KO/TKO").items, one('f3', 'mov:b:ko', null));
  eq('tip: fighter by decision', tip("Almeida x Dunne - Almeida por decisão - 1u").items, one('f3', 'mov:a:dec', null));
  eq('tip: winner and round on one line', tip("Dunne vence no round 2 (Almeida x Dunne) 3 unidades"), { items: one('f3', 'wr:b:2', null), stake: U(3), problems: [] });
  eq('tip: selection after a colon on the matchup line', tip("Almeida x Dunne: Dunne ML").items, one('f3', 'ml:b', null));
  eq('tip: selection named twice on the matchup line', tip("Dunne - Almeida x Dunne").items, one('f3', 'ml:b', null, true));
  eq('tip: over rounds', tip("ALMEIDA X DUNNE - mais de 2.5 rounds - 0,5 unidade"), { items: one('f3', 'tot:o:2.5', null), stake: U(0.5), problems: [] });
  eq('tip: under rounds in English', tip("Almeida x Dunne\nUnder 4.5 rounds").items, one('f3', 'tot:u:4.5', null));
  eq('tip: a rounds line the fight does not have is not a market', tip("Teles x Prado Jr.\nMais de 3.5 rounds").problems, [{ code: 'nomarket', fid: 'f1' }]);
  eq('tip: goes to decision', tip("Almeida vs Dunne\nLuta vai até a decisão - Sim\nodd 2.30").items, one('f3', 'dist:yes', 2.3));
  eq('tip: does not go to decision', tip("Almeida vs Dunne\nLuta não vai até a decisão").items, one('f3', 'dist:no', null));
  eq('tip: goes to decision answered no', tip("Almeida vs Dunne\nLuta vai até a decisão - Não").items, one('f3', 'dist:no', null));
  eq('tip: fight ends by KO, written above the fight', tip("Luta termina por KO/TKO\nAlmeida x Dunne\nR$ 50,00"), { items: one('f3', 'fm:ko', null), stake: { kind: 'money', money: 50 }, problems: [] });
  eq('tip: fight ends by decision', tip("Almeida x Dunne\nLuta termina por decisão").items, one('f3', 'fm:dec', null));
  eq('tip: fight ends in a round', tip("Almeida x Dunne\nLuta acaba no round 1").items, one('f3', 'rnd:1', null));
  eq('tip: takedowns', tip("Teles x Prado Jr.\nMais de 1.5 quedas\nmeia unidade"), { items: one('f1', 'td:o:1.5', null), stake: U(0.5), problems: [] });
  eq('tip: two fights in one message', tip("Marina Teles x Joana Prado Jr.\nMarina Teles ML 1.67\n\nRafael Almeida x Connor Lee Dunne\nRafael Almeida por KO/TKO 9.00\nStake: 1u"),
     { items: [['f1', 'ml:a', 1.67, false], ['f3', 'mov:a:ko', 9, false]], stake: U(1), problems: [] });
  eq('tip: only the fighter is named', tip("Aposta no Dunne, 1u"), { items: one('f3', 'ml:b', null, true), stake: U(1), problems: [] });
  eq('tip: accents, case and a missing middle name', tip("RAFAEL ALMEIDA x CONNOR DUNNE\nconnor dunne para ganhar a luta").items, one('f3', 'ml:b', null));
  eq('tip: surname with a suffix', tip("Teles x Prado Jr\nPrado Jr para vencer a luta").items, one('f1', 'ml:b', null));
  eq('tip: no stake means one unit', tip("Almeida x Dunne\nAlmeida para vencer").stake, DEF);
  for (const [txt, units] of [['2u', 2], ['0,5u', 0.5], ['1.5 un', 1.5], ['3 unidades', 3], ['Stake - 1 unidade', 1], ['2 units', 2]])
    eq(`tip: stake "${txt}"`, tip("Almeida x Dunne\nAlmeida para vencer\n" + txt).stake, U(units));
  eq('tip: units win over a money amount', tip("R$ 100,00\nAlmeida x Dunne\nAlmeida para vencer\n1u").stake, U(1));
  eq('tip: the odd is not mistaken for the stake or the line', tip("Almeida x Dunne\nMais de 2.5 rounds 1.54\nR$ 30,00"), { items: one('f3', 'tot:o:2.5', 1.54), stake: { kind: 'money', money: 30 }, problems: [] });
  eq('tip: fight not on the card', tip("Fulano x Beltrano\nFulano para vencer"), { items: [], stake: DEF, problems: [{ code: 'nofight' }] });
  eq('tip: one fighter of each of two fights', tip("Dunne e Teles").problems, [{ code: 'ambiguous' }]);
  eq('tip: fight found but no bet described', tip("Almeida x Dunne").problems, [{ code: 'nomarket', fid: 'f3' }]);
  eq('tip: over written with a plus', tip("Almeida x Dunne\n+2.5 rounds").items, one('f3', 'tot:o:2.5', null));
  eq('tip: under written with a minus sign', tip("Almeida x Dunne\n−2.5 rounds").items, one('f3', 'tot:u:2.5', null));
  eq('tip: under written with a hyphen', tip("Teles x Prado Jr.\n-1.5 quedas").items, one('f1', 'td:u:1.5', null));
  eq('tip: a dash used as a separator is not a minus', tip("Almeida x Dunne\nAlmeida para vencer\nOdd - 1.50").items, one('f3', 'ml:a', 1.5));
  eq('tip: empty', tip("  \n ").problems, [{ code: 'empty' }]);
  eq('tip: a name inside another word is not a match', tip("Almeidas x Dunnes\nvence").problems, [{ code: 'nofight' }]);
  return { n, fails };
}
"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
    cov.start(page)
    page.goto((ROOT / 'index.html').as_uri())
    page.wait_for_function('window.__OL && window.__OL.Core')
    res = page.evaluate(JS)
    cov.stop(page, 'unit')
    browser.close()

for f in res['fails']:
    print('FAIL', f)
print(f"{res['n'] - len(res['fails'])}/{res['n']} checks passed")
sys.exit(1 if res['fails'] else 0)
