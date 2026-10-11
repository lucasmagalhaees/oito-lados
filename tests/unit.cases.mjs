// The cases of the pure core, as one function of `Core`. Two things run them: tests/core.mjs, in Node, against the core
// built by itself (no page, no browser), and tests/unit.py, in the browser, against the page that ships.
// A new rule of pricing, settlement, reading or history gets its case here first.
export default function cases(Core) {
  const fails = []; let n = 0;
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
  eq('labels: a submission is called a submission, in the market of each fighter, in how the fight ends and in the round market', [M['mov:a:sub'].sel.endsWith(' por Submission'), M['fm:sub'].sel, P.groups.find(g => g.id === 'rnd').note, Core.ML], [true, 'Luta termina por Submission', 'por nocaute ou submission', { ko: 'KO/TKO', sub: 'Submission', dec: 'Decisão' }]);
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
  // a winner pick is decided by the mark on the scoreboard, without waiting for the method to be published; nothing else is
  table('over, winner marked, result not posted yet', fight(), null, TD, { 'ml:a': 'won', 'ml:b': 'lost', 'mov:a:ko': null, 'fm:ko': null, 'dist:no': null, 'tot:o:1.5': null, 'rnd:2': null, 'wr:a:2': null, 'td:o:2.5': null, 'tda:a:yes': null });
  table('over, no winner marked, result not posted yet', fight({ winner: null }), null, TD, { 'ml:a': null, 'ml:b': null, 'fm:dec': null });
  table('a no contest that was read voids the winner pick even with a winner marked', fight(), { method: 'nc', round: 1, time: 30 }, TD, { 'ml:a': 'void', 'ml:b': 'void' });
  table('in progress, a winner mark decides nothing', fight({ state: 'in' }), null, TD, { 'ml:a': null, 'ml:b': null });
  eq('in progress, shown early: still no winner', [Core.legOutcome('ml:a', fight({ state: 'in' }), null, TD, true), Core.legOutcome('ml:b', fight({ state: 'in' }), KO, TD, true)], [null, null]);
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
  eq('which way an over/under goes', ['tot:o:2.5', 'tot:u:2.5', 'td:o:1.5', 'td:u:0.5'].map(Core.overUnder), ['o', 'u', 'o', 'u']);
  eq('every other selection is neither over nor under', ['ml:a', 'mov:b:ko', 'fm:dec', 'dist:yes', 'rnd:1', 'wr:a:2', 'tda:a:yes', 'tot:x:1', 'x', ''].map(Core.overUnder), [null, null, null, null, null, null, null, null, null, null]);
  eq('no selection is both a fighter\'s and an over/under', Object.keys(M).some(k => Core.sideOf(k) && Core.overUnder(k)), false);
  eq("women's weight classes, as ESPN names them", ['W Strawweight', 'W Flyweight', 'W Bantamweight', 'W Featherweight'].map(Core.isWomens), [true, true, true, true]);
  eq("everything else is not a women's class", ['Welterweight', 'Flyweight', 'Heavyweight', 'Catchweight', 'w flyweight', '', undefined, null].map(Core.isWomens), [false, false, false, false, false, false, false, false]);
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

  /* ---- the stake of a copied bet: the money-or-units setting decides between the same amount and the same stake ---- */
  const MONEY = { kind: 'money', money: 1750 }, UNITS = { kind: 'units', units: 0.5 }, BOTH = { kind: 'units', units: 2, money: 1750 }, NONE = { kind: 'default', units: 1 }, MYU = 100;
  eq('copied stake, in money: the same amount', Core.tipStake(MONEY, 'money', MYU), { how: 'same', units: 17.5, value: 1750 });
  eq('copied stake, in money: an original that states both brings its money', Core.tipStake(BOTH, 'money', MYU), { how: 'same', units: 17.5, value: 1750 });
  eq('copied stake, in money: an original with units only brings those units', Core.tipStake(UNITS, 'money', MYU), { how: 'units', units: 0.5, value: 50 });
  eq('copied stake, in units: the same stake', Core.tipStake(UNITS, 'units', MYU), { how: 'units', units: 0.5, value: 50 });
  eq('copied stake, in units: an original that states both brings its units', Core.tipStake(BOTH, 'units', MYU), { how: 'units', units: 2, value: 200 });
  eq('copied stake, in units: an original that states no units is one unit, whatever money it shows', Core.tipStake(MONEY, 'units', MYU), { how: 'one', units: 1, value: 100 });        // the setting is followed: the stake, not the value
  for (const mode of ['money', 'units', undefined, 'whatever'])
    eq(`copied stake: no stake in the original is one unit (${mode})`, Core.tipStake(NONE, mode, MYU), { how: 'default', units: 1, value: 100 });
  eq('copied stake: anything that is not "units" is money', [undefined, null, 'same', 7].map(m => Core.tipStake(BOTH, m, MYU).value), [1750, 1750, 1750, 1750]);
  eq('copied stake: no bankroll, no unit', [Core.tipStake(UNITS, 'units', 0), Core.tipStake(MONEY, 'units', 0), Core.tipStake(MONEY, 'money', 0), Core.tipStake(NONE, 'money', 0)], [{ how: 'units', units: 0.5, value: 0 }, { how: 'one', units: 1, value: 0 }, { how: 'same', units: null, value: 1750 }, { how: 'default', units: 1, value: 0 }]);
  eq('copied stake: each setting keeps to its own side', [Core.tipStake(MONEY, 'money', MYU).how, Core.tipStake(MONEY, 'units', MYU).how, Core.tipStake(BOTH, 'money', MYU).how, Core.tipStake(BOTH, 'units', MYU).how, Core.tipStake(UNITS, 'money', MYU).how], ['same', 'one', 'same', 'units', 'units']);
  /* stakes in units: what is suggested for a long multiple, and the steps of the field */
  eq('suggested stake: a multiple of five selections or more', [Core.suggestedUnits(5, 'multi'), Core.suggestedUnits(8, 'multi')], [[0.2, 0.3, 0.4], [0.2, 0.3, 0.4]]);
  eq('suggested stake: not for four selections, nor for singles', [Core.suggestedUnits(4, 'multi'), Core.suggestedUnits(6, 'single'), Core.suggestedUnits(0, 'multi'), Core.LONG_MULTI], [[], [], [], 5]);
  eq('units step: up to the next half unit', [0, 0.2, 0.3, 0.5, 0.75, 1, 2.5].map(v => Core.stepUnits(v, 1)), [0.5, 0.5, 0.5, 1, 1, 1.5, 3]);
  eq('units step: down to the half unit below, never under zero', [0, 0.2, 0.5, 0.75, 1, 3].map(v => Core.stepUnits(v, -1)), [0, 0, 0, 0.5, 0.5, 2.5]);
  eq('units step: nonsense counts as zero, and the top of the field holds', [Core.stepUnits('x', 1), Core.stepUnits(undefined, -1), Core.stepUnits(9999.99, 1)], [0.5, 0, 9999.5]);
  eq('the setting that used to say what a unit of the source is worth is gone', [typeof Core.tipCfg, typeof Core.TIP_MODES], ['undefined', 'undefined']);

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
  eq('tip: units and money in the same original are both kept', tip("R$ 100,00\nAlmeida x Dunne\nAlmeida para vencer\n1u").stake, { kind: 'units', units: 1, money: 100 });
  eq('tip: half a unit next to an amount', tip("Almeida x Dunne\nAlmeida para vencer\nmeia unidade\nR$ 75,50").stake, { kind: 'units', units: 0.5, money: 75.5 });
  eq('tip: the odd is not mistaken for the stake or the line', tip("Almeida x Dunne\nMais de 2.5 rounds 1.54\nR$ 30,00"), { items: one('f3', 'tot:o:2.5', 1.54), stake: { kind: 'money', money: 30 }, problems: [] });
  eq('tip: fight not on the card', tip("Fulano x Beltrano\nFulano para vencer"), { items: [], stake: DEF, problems: [{ code: 'nofight' }] });
  /* one fighter named from each of several fights is a multiple by fighter (a channel's "dupla"); it used to be refused as ambiguous */
  const tipBet = text => { const r = Core.parseTip(text, card); return { items: r.items.map(i => [i.fid, i.key, i.printedOdd, i.assumed]), odd: r.odd, stake: r.stake, problems: r.problems }; };
  const DUPLA = [['f1', 'ml:a', null, false], ['f3', 'ml:b', null, false]];
  eq('tip: a channel "dupla", one fighter per line joined by a plus', tipBet("🔥 *DUPLA* 🔥 \n\n🎰 *Marina Teles*\n               +\n*Connor Lee Dunne* - Para vencer a luta \n\n💰 Odd - 1.61\n💎 Stake - 1 unidade"),
     { items: DUPLA, odd: 1.61, stake: U(1), problems: [] });
  eq('tip: the same on one line', tipBet("Marina Teles + Connor Lee Dunne - Para vencer a luta\nOdd 1.61"), { items: DUPLA, odd: 1.61, stake: DEF, problems: [] });
  eq('tip: joined by "e", surnames only', tipBet("Teles e Dunne para vencer\n2u"), { items: DUPLA, odd: null, stake: U(2), problems: [] });
  eq('tip: bare names of two fights are two winners, flagged as presumed', tipBet("Dunne e Teles"), { items: [['f1', 'ml:a', null, true], ['f3', 'ml:b', null, true]], odd: null, stake: DEF, problems: [] });
  eq('tip: only the winner market is shared across a plus', tipBet("Marina Teles\n+\nConnor Lee Dunne por KO/TKO").items, [['f1', 'ml:a', null, true], ['f3', 'mov:b:ko', null, false]]);
  eq('tip: something other than a joiner between the names keeps the first one presumed', tipBet("Marina Teles (em grande fase)\nConnor Lee Dunne - Para vencer a luta").items, [['f1', 'ml:a', null, true], ['f3', 'ml:b', null, false]]);
  eq('tip: an odd of its own on each line stays with its selection', tipBet("Marina Teles x Joana Prado Jr.\nMarina Teles ML 1.67\n\nRafael Almeida x Connor Lee Dunne\nRafael Almeida por KO/TKO 9.00"), { items: [['f1', 'ml:a', 1.67, false], ['f3', 'mov:a:ko', 9, false]], odd: null, stake: DEF, problems: [] });
  eq('tip: a single bet has no odd of the whole bet', tipBet("Almeida x Dunne\nDunne para vencer 2.05").odd, null);
  const card3 = card.concat([{ id: 'f2', rounds: 3, a: { name: 'Caio Brandt', last: 'Brandt' }, b: { name: 'Dario Kessler', last: 'Kessler' } }]);
  eq('tip: three fighters joined', Core.parseTip("TRIPLA\nTeles\n+\nBrandt\n+\nDunne - para vencer a luta\nOdd - 2.90", card3).items.map(i => [i.fid, i.key, i.printedOdd, i.assumed]), [['f1', 'ml:a', null, false], ['f3', 'ml:b', null, false], ['f2', 'ml:a', null, false]]);
  eq('tip: three fighters joined, the odd is of the whole bet', Core.parseTip("TRIPLA\nTeles\n+\nBrandt\n+\nDunne - para vencer a luta\nOdd - 2.90", card3).odd, 2.9);
  const twins = card.concat([{ id: 'f9', rounds: 3, a: { name: 'Bruno Teles', last: 'Teles' }, b: { name: 'Ivo Rocha', last: 'Rocha' } }]);
  eq('tip: a name that could be two fighters is still ambiguous', Core.parseTip("Teles para vencer", twins).problems, [{ code: 'ambiguous' }]);
  eq('tip: and stays ambiguous inside a multiple', Core.parseTip("Teles + Dunne para vencer", twins).problems, [{ code: 'ambiguous' }]);

  /* a betting slip that names the market as "1X2: V1" and the stake as "1756 BRL" (text as the OCR read it off a real print, with invented names) */
  const SLIP = "Cupom de apostas Nº 88576601161 º\n10/10/2026 (14:14)\n& Eventos: 1 v\nTipo de aposta Aposta simples\n1X2: V1: Rafael Almeida - Connor Lee Dunne 1.68\nAposta 1756 BRL\nO Possíveis ganhos 2950.08 BRL";
  eq('tip: slip with "1X2: V1" and the stake in BRL', tipBet(SLIP), { items: one('f3', 'ml:a', 1.68), odd: null, stake: { kind: 'money', money: 1756 }, problems: [] });
  eq('tip: V2 is the second name on the line', tipBet(SLIP.replace('V1', 'V2')).items, one('f3', 'ml:b', 1.68));
  eq('tip: V1 is the first name on the line, whatever the order on the card', tipBet(SLIP.replace('Rafael Almeida - Connor Lee Dunne', 'Connor Lee Dunne - Rafael Almeida')).items, one('f3', 'ml:b', 1.68));
  eq('tip: W1, as the same slip is written in English', tipBet(SLIP.replace('V1', 'W1')).items, one('f3', 'ml:a', 1.68));
  eq('tip: without V1 or V2 the slip line still names no bet', tipBet(SLIP.replace('V1: ', '')).problems, [{ code: 'nomarket', fid: 'f3' }]);
  for (const [txt, v] of [['Aposta 1756 BRL', 1756], ['Aposta 1756.5 BRL', 1756.5], ['Aposta 1.756,50 BRL', 1756.5], ['Aposta 2,500.00 USD', 2500], ['Stake 80 EUR', 80], ['50 reais', 50]])
    eq(`tip: amount written as "${txt}"`, tip("Almeida x Dunne\nDunne para vencer\n" + txt).stake, { kind: 'money', money: v });
  eq('tip: the first amount is the stake, with the currency before or after', [tip("Almeida x Dunne\nDunne para vencer\nR$ 30,00\nRetorno 61.50 BRL").stake, tip("Almeida x Dunne\nDunne para vencer\nAposta 30 BRL\nRetorno R$ 61,50").stake], [{ kind: 'money', money: 30 }, { kind: 'money', money: 30 }]);
  eq('tip: an amount in BRL is not read as the odd', tipBet("Almeida x Dunne\nDunne para vencer\nAposta 12.50 BRL").items, one('f3', 'ml:b', null));

  /* slips of the same family as the OCR read them off real prints (invented names): an accumulator that only shows its first
     selection, names stacked on two lines, a market line with or without the names, a wrapped line, odds with three decimals */
  const read = (text, c) => { const r = Core.parseTip(text, c || card3); return { items: r.items.map(i => [i.fid, i.key, i.printedOdd, i.assumed]), odd: r.odd, kind: r.kind, legs: r.legs, problems: r.problems }; };
  eq('tip: accumulator slip that shows only its first selection', read("Cupom de apostas Nº 88578456279 º\n10/10/2026 (14:42) '\n€& Eventos: 2 (finalizado O) A\nuc Rafael Almeida - Connor Lee Dunne\nsc Caio Brandt - Dario Kessler\nTipo de aposta Acumulador\n1X2: V1: Rafael Almeida - Connor Lee Dunne 1.614\nAposta 1850 BRL\nO Possíveis ganhos 2985.75 BRL"),
     { items: [['f3', 'ml:a', null, false]], odd: 1.614, kind: 'multi', legs: 2, problems: [{ code: 'nomarket', fid: 'f2' }] });
  eq('tip: accumulator slip with a total on a wrapped line', read("Eventos: 2 (finalizado O) NA\nur. Rafael Almeida - Connor Lee Dunne\nur Caio Brandt - Dario Kessler\nTipo de aposta Acumulador\nTotal Acima de (1.5): Rafael Almeida - Connor Lee\nD 1.424\nunne\nAposta 2250 BRL\nO Possíveis ganhos 3203.55 BRL"),
     { items: [['f3', 'tot:o:1.5', null, false]], odd: 1.424, kind: 'multi', legs: 2, problems: [{ code: 'nomarket', fid: 'f2' }] });
  eq('tip: names stacked, then the market line with the names again', read("urc UFC Fight Night. 10.10.26\n10/10/2026 (18:00)\nMarina Teles\nJoana Prado Jr.\n1X2: V2: Marina Teles - Joana Prado Ir. 1.98\nStatus O Não processado\nPlacar atual v\nusc UFC Fight Night. 10.10.26\n10/10/2026 (18:30)\nCaio Brandt\nDario Kessler\n1X2: V1: Caio Brandt - Dario Kessler 1.71\nStatus O Não processado\nPlacar atual v\nurc UFC Fight Night. 10.10.26\n10/10/2026 (21:40)\nConnor Lee Dunne\nRafael Almeida\n1X2: V1: Connor Lee Dunne - Rafael Almeida 1.66\nStatus O Não processado"),
     { items: [['f1', 'ml:b', 1.98, false], ['f3', 'ml:b', 1.66, false], ['f2', 'ml:a', 1.71, false]], odd: null, kind: null, legs: null, problems: [] });
  eq('tip: names stacked, then a market line without them', read("216740. UFC Fight Night. 10.10.26\nRafael Almeida\nConnor Lee Dunne\n1X2:V1 1.232\nO Não processado\n216771. UFC Fight Night. 10.10.26\nDario Kessler\nCaio Brandt\n1X2:V2 1.26\nO Não processado\n216730. UFC Fight Night. 10.10.26\nMarina Teles\nJoana Prado Jr.\nTotal Acima de (1.5) 1:13\nO Não processado"),
     { items: [['f1', 'tot:o:1.5', 1.13, false], ['f3', 'ml:a', 1.232, false], ['f2', 'ml:a', 1.26, false]], odd: null, kind: null, legs: null, problems: [] });       // the OCR read "1.13" as "1:13"
  eq('tip: a total stays a total when only one name is whole on its line', read("Almeida x Dunne\nTotal Abaixo de (2.5): Rafael Almeida - Connor Lee").items, [['f3', 'tot:u:2.5', null, false]]);
  eq('tip: a fighter and a rounds line said together is still the fighter', read("Almeida x Dunne\nAlmeida vence e mais de 1.5 rounds").items, [['f3', 'ml:a', null, false]]);
  eq('tip: an odd with three decimals', read("Almeida x Dunne\nDunne para vencer 1.875").items, [['f3', 'ml:b', 1.875, false]]);
  eq('tip: a suffix the OCR mangled does not hide the fighter', read("Teles x Prado Ir.\nPrado para vencer").items, [['f1', 'ml:b', null, false]]);
  eq('tip: the full name settles which of two fighters with the same surname', read("Marina Teles para vencer", twins).items, [['f1', 'ml:a', null, false]]);

  /* single or multiple: the original says so in words, and how many selections a multiple should have */
  const kindOf = t => { const r = Core.parseTip(t, card3); return [r.kind, r.legs]; };
  for (const [word, n] of [['DUPLA', 2], ['Tripla', 3], ['QUÁDRUPLA', 4], ['quíntupla', 5], ['Sêxtupla', 6]])
    eq(`tip: "${word}" is a multiple of ${n}`, kindOf(`🔥 ${word} 🔥\nTeles + Dunne para vencer`), ['multi', n]);
  for (const word of ['Múltipla', 'Tipo de aposta Acumulador', 'acumulada', 'Combinada', 'parlay'])
    eq(`tip: "${word}" is a multiple, of however many`, kindOf(`${word}\nTeles + Dunne para vencer`), ['multi', null]);
  eq('tip: the number of events of a slip says the same', [kindOf("Eventos: 3 (finalizado 0)\nTeles + Dunne para vencer"), kindOf("Eventos: 1\nAlmeida x Dunne\nDunne vence")], [['multi', 3], ['single', 1]]);
  for (const word of ['R$250,00 Simples', 'Tipo de aposta Aposta simples', 'single'])
    eq(`tip: "${word}" is a single`, kindOf(`${word}\nAlmeida x Dunne\nDunne para vencer`), ['single', 1]);
  eq('tip: nothing said about the kind', kindOf("Almeida x Dunne\nDunne para vencer"), [null, null]);
  eq('tip: "dupla chance" is a market of other sports, not a multiple', kindOf("Dupla chance\nAlmeida x Dunne\nDunne para vencer"), [null, null]);
  const card5 = card3.concat([{ id: 'f4', rounds: 3, a: { name: 'Igor Sampaio', last: 'Sampaio' }, b: { name: 'Leo Vance', last: 'Vance' } }, { id: 'f5', rounds: 3, a: { name: 'Nina Kovac', last: 'Kovac' }, b: { name: 'Bia Rangel', last: 'Rangel' } }]);
  const joined = (word, names) => read(`🔥 *${word}* 🔥\n\n🎰 *${names.slice(0, -1).join('*\n               +\n*')}*\n               +\n*${names[names.length - 1]}* - Para vencer a luta\n\n💰 Odd - 4.20\n💎 Stake - 1 unidade`, card5);
  eq('tip: a channel "tripla"', joined('TRIPLA', ['Marina Teles', 'Caio Brandt', 'Connor Lee Dunne']), { items: [['f1', 'ml:a', null, false], ['f3', 'ml:b', null, false], ['f2', 'ml:a', null, false]], odd: 4.2, kind: 'multi', legs: 3, problems: [] });
  eq('tip: a channel "quádrupla"', joined('QUÁDRUPLA', ['Marina Teles', 'Caio Brandt', 'Connor Lee Dunne', 'Leo Vance']).items.map(i => i[0] + ' ' + i[1] + ' ' + i[3]).sort(), ['f1 ml:a false', 'f2 ml:a false', 'f3 ml:b false', 'f4 ml:b false']);
  eq('tip: a channel "quíntupla"', (r => [r.items.length, r.items.every(i => /^ml:/.test(i[1]) && !i[3] && i[2] === null), r.odd, r.kind, r.legs, r.problems])(joined('QUÍNTUPLA', ['Marina Teles', 'Caio Brandt', 'Connor Lee Dunne', 'Leo Vance', 'Nina Kovac'])), [5, true, 4.2, 'multi', 5, []]);
  eq('tip: a "tripla" with only two selections found says one is missing', joined('TRIPLA', ['Marina Teles', 'Fulano de Tal', 'Connor Lee Dunne']).problems, [{ code: 'short', want: 3, got: 2 }]);
  eq('tip: a multiple that names as many as it should has nothing to report', joined('DUPLA', ['Marina Teles', 'Connor Lee Dunne']).problems, []);

  /* completing a slip that names a fight without saying the bet: by hand, or with the selection another original gives */
  const ACCA = Core.parseTip("Eventos: 2 (finalizado 0)\nRafael Almeida - Connor Lee Dunne\nCaio Brandt - Dario Kessler\nTipo de aposta Acumulador\n1X2: V1: Rafael Almeida - Connor Lee Dunne 1.614\nAposta 1850 BRL", card3);
  const tipShape = r => ({ items: r.items.map(i => [i.fid, i.key, i.printedOdd, i.assumed]), odd: r.odd, kind: r.kind, legs: r.legs, stake: r.stake, problems: r.problems });
  eq('complete: the selection chosen for the fight the slip does not describe', tipShape(Core.completeTip(ACCA, [{ fid: 'f2', key: 'ml:a', printedOdd: 1.31 }])),
     { items: [['f3', 'ml:a', null, false], ['f2', 'ml:a', 1.31, false]], odd: 1.614, kind: 'multi', legs: 2, stake: { kind: 'money', money: 1850 }, problems: [] });
  eq('complete: chosen by hand, there is no printed odd', tipShape(Core.completeTip(ACCA, [{ fid: 'f2', key: 'mov:b:ko' }])).items, [['f3', 'ml:a', null, false], ['f2', 'mov:b:ko', null, false]]);
  eq('complete: nothing chosen leaves the tip as it was read', tipShape(Core.completeTip(ACCA, [])), tipShape(ACCA));
  eq('complete: the tip that was read is not changed', [Core.completeTip(ACCA, [{ fid: 'f2', key: 'ml:a' }]) !== ACCA, ACCA.items.length, ACCA.problems], [true, 1, [{ code: 'nomarket', fid: 'f2' }]]);
  eq('complete: a choice for a fight the slip already describes, or does not name at all, is ignored', tipShape(Core.completeTip(ACCA, [{ fid: 'f3', key: 'ml:b' }, { fid: 'f1', key: 'ml:a' }])), tipShape(ACCA));
  eq('complete: only the first choice for a fight counts', tipShape(Core.completeTip(ACCA, [{ fid: 'f2', key: 'ml:a' }, { fid: 'f2', key: 'ml:b' }])).items, [['f3', 'ml:a', null, false], ['f2', 'ml:a', null, false]]);
  const ACCA3 = Core.parseTip("Eventos: 3\nRafael Almeida - Connor Lee Dunne\nCaio Brandt - Dario Kessler\nTipo de aposta Acumulador\n1X2: V1: Rafael Almeida - Connor Lee Dunne 2.10", card3);
  eq('complete: once the fights it names are settled, a slip that should have more says so', Core.completeTip(ACCA3, [{ fid: 'f2', key: 'ml:a' }]).problems, [{ code: 'short', want: 3, got: 2 }]);
  eq('complete: and while one of them is still open, only that is reported', Core.completeTip(ACCA3, []).problems, [{ code: 'nomarket', fid: 'f2' }]);

  /* the odd of the original, kept with the bet: what was printed against what was taken */
  const pleg = (fid, odd, printed) => ({ fid, key: 'ml:a', odd, printed });
  eq('printed odd: a single', Core.printedEdge({ type: 'single', odd: 1.7, legs: [pleg('f1', 1.7, 1.68)] }), { printed: 1.68, got: 1.7, diff: 0.0119 });
  eq('printed odd: a multiple with the odd of the whole bet', Core.printedEdge({ type: 'multi', odd: 1.55, printed: 1.614, legs: [pleg('f1', 1.2), pleg('f2', 1.29)] }), { printed: 1.614, got: 1.55, diff: -0.0397 });
  eq('printed odd: a multiple with an odd on every selection multiplies them', Core.printedEdge({ type: 'multi', odd: 1.6, legs: [pleg('f1', 1.2, 1.232), pleg('f2', 1.33, 1.31)] }).printed, 1.614);
  eq('printed odd: the odd of the whole bet wins over the selections', Core.printedEdge({ type: 'multi', odd: 1.6, printed: 1.7, legs: [pleg('f1', 1.2, 1.232), pleg('f2', 1.33, 1.31)] }).printed, 1.7);
  eq('printed odd: a multiple missing one is not compared', Core.printedEdge({ type: 'multi', odd: 1.6, legs: [pleg('f1', 1.2, 1.232), pleg('f2', 1.33)] }), null);
  eq('printed odd: two selections of the same fight do not multiply', Core.printedEdge({ type: 'multi', odd: 3, legs: [pleg('f1', 1.5, 1.5), pleg('f1', 2.2, 2.2)] }), null);
  eq('printed odd: none on the original, or nonsense', [{ type: 'single', odd: 2, legs: [pleg('f1', 2)] }, { type: 'single', odd: 2, legs: [pleg('f1', 2, 1)] }, { type: 'single', odd: 0, legs: [pleg('f1', 0, 1.5)] }, { type: 'single', odd: 2, printed: 'x', legs: [] }].map(Core.printedEdge), [null, null, null, null]);
  const copiedBets = [{ type: 'single', odd: 2.1, legs: [pleg('f1', 2.1, 2)] }, { type: 'single', odd: 1.8, legs: [pleg('f2', 1.8, 2)] }, { type: 'single', odd: 3, legs: [pleg('f3', 3)] }];
  eq('printed odd: over all copiedBets bets, the average difference and how many were ahead', Core.edgeSummary(copiedBets), { n: 2, avg: -0.025, ahead: 1 });
  eq('printed odd: nothing to compare', Core.edgeSummary([copiedBets[2]]), { n: 0, avg: 0, ahead: 0 });
  eq('tip: fight found but no bet described', tip("Almeida x Dunne").problems, [{ code: 'nomarket', fid: 'f3' }]);
  eq('tip: over written with a plus', tip("Almeida x Dunne\n+2.5 rounds").items, one('f3', 'tot:o:2.5', null));
  eq('tip: under written with a minus sign', tip("Almeida x Dunne\n−2.5 rounds").items, one('f3', 'tot:u:2.5', null));
  eq('tip: under written with a hyphen', tip("Teles x Prado Jr.\n-1.5 quedas").items, one('f1', 'td:u:1.5', null));
  eq('tip: a dash used as a separator is not a minus', tip("Almeida x Dunne\nAlmeida para vencer\nOdd - 1.50").items, one('f3', 'ml:a', 1.5));
  /* an odd the OCR read with a colon in place of the point, and what is a time of day instead */
  eq('tip: an odd read with a colon at the end of the line', tip("Almeida x Dunne\nDunne para vencer 1:44").items, one('f3', 'ml:b', 1.44));
  eq('tip: an odd read with a semicolon', tip("Almeida x Dunne\nDunne para vencer 2;05").items, one('f3', 'ml:b', 2.05));
  eq('tip: a time of day is not an odd', ["Almeida x Dunne\nDunne para vencer 21:40", "Almeida x Dunne\nDunne para vencer (9:30)", "Almeida x Dunne\nDunne para vencer 10/10 9:30", "Almeida x Dunne\nDunne para vencer 9:30 da noite"].map(t => tip(t).items[0][2]), [null, null, null, null]);
  eq('tip: a real odd on the line wins over a colon', tip("Almeida x Dunne\nDunne para vencer 1.90 1:44").items, one('f3', 'ml:b', 1.9));

  /* questions asked of the bet history */
  const hl = (fid, key, extra) => Object.assign({ fid, key, sel: 'sel ' + key, eid: 'e1', event: 'UFC 1: Almeida vs. Dunne', date: 100, odd: 2 }, extra || {});
  const hb = (id, type, status, stake, payout, legs, extra) => Object.assign({ id, t: 1000, type, status, stake, payout, odd: 2, legs, settledAt: status === 'open' ? null : 5000 }, extra || {});
  eq('history: the selections of a bet read the same in any order', [Core.selSig([{ fid: 'f2', key: 'ml:a' }, { fid: 'f1', key: 'ml:b' }]), Core.selSig([{ fid: 'f1', key: 'ml:b' }, { fid: 'f2', key: 'ml:a' }])], ['f1|ml:b,f2|ml:a', 'f1|ml:b,f2|ml:a']);
  const book = [hb('m1', 'multi', 'open', 50, 0, [hl('f1', 'ml:a'), hl('f2', 'ml:b')]), hb('m2', 'multi', 'lost', 50, 0, [hl('f1', 'ml:a'), hl('f3', 'ml:b')]), hb('s1', 'single', 'open', 30, 0, [hl('f3', 'ml:a')]), hb('s2', 'single', 'won', 30, 60, [hl('f2', 'ml:a')])];
  const ids = bs => bs.map(b => b.id);
  eq('history: the same multiple already open, whatever the order', ids(Core.dupBets(book, [{ fid: 'f2', key: 'ml:b' }, { fid: 'f1', key: 'ml:a' }], 'multi')), ['m1']);
  eq('history: a closed bet is not a bet already placed', ids(Core.dupBets(book, [{ fid: 'f1', key: 'ml:a' }, { fid: 'f3', key: 'ml:b' }], 'multi')), []);
  eq('history: a multiple with one more selection is another bet', ids(Core.dupBets(book, [{ fid: 'f1', key: 'ml:a' }, { fid: 'f2', key: 'ml:b' }, { fid: 'f3', key: 'ml:a' }], 'multi')), []);
  eq('history: singles are looked up one by one', ids(Core.dupBets(book, [{ fid: 'f3', key: 'ml:a' }, { fid: 'f1', key: 'ml:a' }], 'single')), ['s1']);
  eq('history: a selection inside an open multiple is not that single', ids(Core.dupBets(book, [{ fid: 'f1', key: 'ml:a' }], 'single')), []);
  eq('history: one selection asked as a multiple is a single', ids(Core.dupBets(book, [{ fid: 'f3', key: 'ml:a' }], 'multi')), ['s1']);
  eq('history: what is at stake on a fight', Core.exposure(book, 'f1'), { n: 1, stake: 50, units: 0, unitBets: 0, held: [{ id: 'm1', stake: 50, keys: ['ml:a'], sel: 'sel ml:a' }] });
  eq('history: open bets only, each with what it holds there', (e => [e.n, e.stake, e.held.map(h => h.id)])(Core.exposure(book.concat(hb('s3', 'single', 'open', 20.5, 0, [hl('f3', 'mov:b:ko')])), 'f3')), [2, 50.5, ['s1', 's3']]);
  eq('history: nothing at stake', Core.exposure(book, 'f9'), { n: 0, stake: 0, units: 0, unitBets: 0, held: [] });
  eq('history: what is at stake on a fight in units, each bet by the unit it was placed with; a bet with no unit is left out of the units', (e => [e.n, e.stake, e.units, e.unitBets])(Core.exposure([hb('u1', 'single', 'open', 100, 0, [hl('f1', 'ml:a')], { unit: 50 }),
    hb('u2', 'multi', 'open', 30, 0, [hl('f1', 'ml:b'), hl('f2', 'ml:a')], { unit: 200 }), hb('u3', 'single', 'open', 7, 0, [hl('f1', 'ml:a')]), hb('u4', 'single', 'open', 500, 0, [hl('f2', 'ml:a')], { unit: 50 }), hb('u5', 'single', 'lost', 500, 0, [hl('f1', 'ml:a')], { unit: 50 })], 'f1')), [3, 137, 2.15, 2]);       // 2u + 0,15u
  eq('odd drop: the whole bet against the odd the original gives for it', Core.copyDrop(1.614, [{ fid: 'f1', printed: null, now: 1.2 }, { fid: 'f2', printed: null, now: 1.29 }]), -0.0397);       // 1.55 / 1.614
  eq('odd drop: with an odd on every selection, they are multiplied', Core.copyDrop(null, [{ fid: 'f1', printed: 1.232, now: 1.2 }, { fid: 'f2', printed: 1.31, now: 1.29 }]), -0.0397);          // 1.55 / 1.614
  eq('odd drop: one selection', [Core.copyDrop(null, [{ fid: 'f1', printed: 2.7, now: 2.5 }]), Core.copyDrop(null, [{ fid: 'f1', printed: 2, now: 2.1 }])], [-0.0741, 0.05]);
  eq('odd drop: with only some of them printed, the one that fell the most', Core.copyDrop(null, [{ fid: 'f1', printed: 2, now: 1.9 }, { fid: 'f2', printed: null, now: 1.5 }, { fid: 'f3', printed: 3, now: 2.4 }]), -0.2);
  eq('odd drop: selections of the same fight are not multiplied', Core.copyDrop(3.3, [{ fid: 'f1', printed: 1.5, now: 1.6 }, { fid: 'f1', printed: 2.2, now: 1.98 }]), -0.1);       // multiplied it would be 3.17 / 3.3, -0.0394
  eq('odd drop: nothing printed, or no price now', [Core.copyDrop(null, [{ fid: 'f1', printed: null, now: 2 }]), Core.copyDrop(2, [{ fid: 'f1', printed: 2, now: 0 }]), Core.copyDrop(2, [])], [null, null, null]);
  /* open bets by event, in the order the fights happen */
  const ol = (fid, eid, date) => hl(fid, 'ml:a', { eid, event: 'UFC ' + eid, date });
  const openOnes = [hb('late', 'single', 'open', 10, 0, [ol('f9', 'e2', 900)], { t: 1, odd: 2 }), hb('main', 'single', 'open', 20, 0, [ol('f3', 'e1', 300)], { t: 2, odd: 1.5 }),
    hb('multi', 'multi', 'open', 30, 0, [ol('f3', 'e1', 300), ol('f1', 'e1', 100)], { t: 3, odd: 3.42 }), hb('prelimB', 'single', 'open', 40, 0, [ol('f2', 'e1', 100)], { t: 4, odd: 2.7 }),
    hb('prelimA', 'single', 'open', 5, 0, [ol('f1', 'e1', 100)], { t: 5, odd: 1.67 }), hb('across', 'multi', 'open', 50, 0, [ol('f3', 'e1', 300), ol('f9', 'e2', 900)], { t: 6, odd: 4 }),
    hb('gone', 'single', 'won', 99, 200, [ol('f1', 'e1', 100)], { t: 7 })];
  const place = fid => ({ f1: 0, f2: 1, f3: 2, f9: 0 })[fid];
  eq('open bets: by event, the one that starts first on top; a bet across events on its own', Core.openByEvent(openOnes, place).map(g => [g.eid, g.event, g.date, ids(g.bets)]),
    [['e1', 'UFC e1', 100, ['multi', 'prelimA', 'prelimB', 'main']], ['', '', 300, ['across']], ['e2', 'UFC e2', 900, ['late']]]);
  eq('open bets: what is at stake in each event, and what it pays if every bet wins', Core.openByEvent(openOnes, place).map(g => [g.stake, g.ret]), [[95, 248.95], [50, 200], [10, 20]]);       // 102,60 + 8,35 + 108,00 + 30,00
  eq('open bets: the gain of each event is what it pays less what is at stake', Core.openByEvent(openOnes, place).map(g => [g.n, g.gain, g.units, g.gainUnits, g.unitBets]), [[4, 153.95, 0, 0, 0], [1, 150, 0, 0, 0], [1, 10, 0, 0, 0]]);
  const unitOnes = [hb('a', 'single', 'open', 100, 0, [ol('f1', 'e1', 100)], { odd: 2.5, unit: 100 }), hb('b', 'multi', 'open', 30, 0, [ol('f1', 'e1', 100), ol('f2', 'e1', 100)], { odd: 6.33, unit: 150 }),
    hb('c', 'single', 'open', 40, 0, [ol('f2', 'e1', 100)], { odd: 1.5 }), hb('d', 'single', 'won', 100, 300, [ol('f2', 'e1', 100)], { odd: 3, unit: 100 })];
  eq('open totals: stake and gain in money and in units, each bet by the unit it was placed with', Core.openTotals(unitOnes), { n: 3, stake: 170, ret: 499.9, gain: 329.9, units: 1.2, gainUnits: 2.566, unitBets: 2 });       // 250 + 189,90 + 60; 1u + 0,2u; +1,5u + 1,066u, and the bet with no unit only in money
  eq('open totals: the same in the group of the event', Core.openByEvent(unitOnes).map(g => [g.stake, g.ret, g.gain, g.units, g.gainUnits, g.unitBets]), [[170, 499.9, 329.9, 1.2, 2.566, 2]]);
  eq('open totals: the return of each bet is rounded to cents before it is summed, as the bet pays', Core.openTotals([hb('r1', 'single', 'open', 3.33, 0, [ol('f1', 'e1', 100)], { odd: 1.15, unit: 10 }), hb('r2', 'single', 'open', 3.33, 0, [ol('f2', 'e1', 100)], { odd: 1.15, unit: 10 })]), { n: 2, stake: 6.66, ret: 7.66, gain: 1, units: 0.666, gainUnits: 0.1, unitBets: 2 });       // 3,83 each, not 3,8295
  /* a selection voided inside an open multiple: the bet goes on without that fight, and pays less */
  const vb = hb('v', 'multi', 'open', 100, 0, [hl('f1', 'ml:a', { odd: 2.05 }), hl('f2', 'ml:a', { odd: 1.68 })], { odd: 3.44, unit: 1000 });
  eq('odd left: a void selection takes its fight out of the multiple, at odd 1.00', [Core.oddLeft(vb, ['void', null]), Core.oddLeft(vb, [null, null]), Core.oddLeft(vb, ['won', null]), Core.oddLeft(vb, ['void', 'void'])], [{ odd: 1.68, fights: 1 }, { odd: 3.44, fights: 2 }, { odd: 3.44, fights: 2 }, { odd: 1, fights: 0 }]);
  const sg = hb('sg', 'multi', 'open', 10, 0, [hl('f1', 'ml:a', { odd: 1.5 }), hl('f1', 'fm:ko', { odd: 3 }), hl('f2', 'ml:b', { odd: 2 })], { odd: 7.6, sgp: { f1: 3.8 } });
  eq('odd left: in a same-fight combo the whole fight goes, and a combo that stays keeps its own price', [Core.oddLeft(sg, [null, 'void', null]), Core.oddLeft(sg, [null, null, 'void']), Core.oddLeft(sg, [null, null, null])], [{ odd: 2, fights: 1 }, { odd: 3.8, fights: 1 }, { odd: 7.6, fights: 2 }]);
  eq('odd left: the bet is paid by the same odd when it wins', [Core.betResult(vb, ['void', 'won']), Core.betResult(vb, ['won', 'won']), Core.betResult(vb, ['void', 'void']), Core.betResult(vb, ['void', 'lost']), Core.betResult(vb, ['void', null])], [{ status: 'won', payout: 168 }, { status: 'won', payout: 344 }, { status: 'void', payout: 100 }, { status: 'lost', payout: 0 }, null]);
  const firstVoid = l => l.fid === 'f1' ? 'void' : null;
  eq('odd now: the odd the bet was placed at, or the one that is left once a selection is voided', [Core.oddNow(vb), Core.oddNow(vb, () => null), Core.oddNow(vb, firstVoid), Core.oddNow(vb, l => l.fid === 'f1' ? 'won' : null)], [3.44, 3.44, 1.68, 3.44]);
  eq('open totals: a bet with a void selection counts for what it pays now', [Core.openTotals([vb]), Core.openTotals([vb], firstVoid)].map(t => [t.stake, t.ret, t.gain, t.units, t.gainUnits]), [[100, 344, 244, 0.1, 0.244], [100, 168, 68, 0.1, 0.068]]);
  eq('open totals: and so does the group of its event', Core.openByEvent([vb], undefined, firstVoid).map(g => [g.ret, g.gain]), [[168, 68]]);
  /* where a selection stands, in the words of the bets list */
  const ls = (out, open, f) => Core.legState(out, open, f);
  eq('leg state: its outcome when it has one, whatever the fight says', [ls('won', true, { state: 'in', period: 2 }), ls('lost', true, { state: 'post', period: 3 }), ls('void', false, null), ls('won', false, undefined)], ['won', 'lost', 'void', 'won']);
  eq('leg state: in an open bet, where the fight is', [ls(null, true, { state: 'pre', period: 0 }), ls(null, true, { state: 'in', period: 0 }), ls(null, true, { state: 'in', period: 1 }), ls(null, true, { state: 'post', period: 3 }), ls(null, true, null), ls(undefined, true, undefined)], ['pending', 'starting', 'live', 'waiting', 'pending', 'pending']);
  eq('leg state: a bet that closed without needing the selection', [ls(null, false, { state: 'pre', period: 0 }), ls(undefined, false, { state: 'in', period: 1 }), ls(null, false, null)], ['unused', 'unused', 'unused']);
  eq('open totals: nothing open', Core.openTotals([unitOnes[3]]), { n: 0, stake: 0, ret: 0, gain: 0, units: 0, gainUnits: 0, unitBets: 0 });
  eq('open bets: without the place on the card, bets of the same hour keep the order they were made in', ids(Core.openByEvent(openOnes)[0].bets), ['multi', 'prelimB', 'prelimA', 'main']);
  eq('open bets: none', Core.openByEvent([openOnes[6]]), []);
  const closed = [hb('a', 'single', 'won', 100, 250, [hl('f1', 'ml:a', { printed: 2 })], { from: 'Canal A', odd: 2.2 }), hb('b', 'single', 'lost', 300, 0, [hl('f2', 'ml:a', { printed: 2 })], { from: 'Canal B', odd: 1.8 }),
    hb('c', 'single', 'void', 40, 40, [hl('f3', 'ml:a')], { from: 'Canal A' }), hb('d', 'single', 'cashed', 60, 60, [hl('f3', 'ml:b')]), hb('e', 'single', 'won', 10, 30, [hl('f1', 'ml:b')])];
  eq('origin: results by who the bets came from, the one with the most money first', Core.byOrigin(closed).map(r => [r.k, r.n, r.st, r.ret, r.won, r.dec, r.edge.n, r.edge.avg]), [['Canal B', 1, 300, 0, 0, 1, 1, -0.1], ['Canal A', 2, 140, 290, 1, 1, 1, 0.1], ['', 2, 70, 90, 1, 1, 0, 0]]);
  eq('origin: the odd against the print counts the open bets too, when they are given', Core.byOrigin(closed, closed.concat(hb('f', 'single', 'open', 10, 0, [hl('f2', 'ml:b', { printed: 2 })], { from: 'Canal A', odd: 1.8 }))).find(r => r.k === 'Canal A').edge, { n: 2, avg: 0, ahead: 1 });
  eq('origin: the result in units, each bet by the unit it was placed with', Core.byOrigin([hb('u1', 'single', 'won', 100, 300, [hl('f1', 'ml:a')], { from: 'Canal A', unit: 50 }), hb('u2', 'single', 'lost', 1000, 0, [hl('f2', 'ml:a')], { from: 'Canal A', unit: 500 }),
    hb('u3', 'single', 'won', 20, 50, [hl('f3', 'ml:a')], { from: 'Canal A' }), hb('u4', 'single', 'lost', 30, 0, [hl('f3', 'ml:b')], { unit: 10 })]).map(r => [r.k, r.units, r.unitBets, r.ret - r.st]), [['Canal A', 2, 2, -770], ['', -3, 1, -30]]);       // +4u and -2u: in money the large bet decides, in units it does not
  const ren = Core.renameOrigin(closed, 'Canal A', '  Canal   Alfa ');
  eq('origin: renamed', [ren.n, ren.bets.map(b => b.from || null), closed.map(b => b.from || null)], [2, ['Canal Alfa', 'Canal B', 'Canal Alfa', null, null], ['Canal A', 'Canal B', 'Canal A', null, null]]);
  eq('origin: named after another one, the two are joined', Core.byOrigin(Core.renameOrigin(closed, 'Canal A', 'Canal B').bets).map(r => [r.k, r.n]), [['Canal B', 3], ['', 2]]);
  eq('origin: nothing to rename, and no new name changes nothing', [Core.renameOrigin(closed, 'Canal X', 'Y').n, Core.renameOrigin(closed, 'Canal A', 'Canal A').n, Core.renameOrigin(closed, '', 'Y').n, Core.renameOrigin(closed, 'Canal B', '   ').n, Core.renameOrigin(closed, 'Canal B', '   ').bets === closed, Core.renameOrigin(closed, 'Canal A', 'x'.repeat(60)).bets[0].from.length], [0, 0, 0, 0, true, 40]);
  /* whose a bet is: the person's own pick, or a copy of a tipster's */
  const mineB = hb('mi', 'single', 'won', 100, 250, [hl('f1', 'ml:a')], { unit: 100 }), markB = hb('mk', 'single', 'lost', 100, 0, [hl('f2', 'ml:a')], { copied: true, unit: 100 });
  const namedB = hb('nm', 'single', 'won', 200, 300, [hl('f3', 'ml:a')], { from: 'Canal A', unit: 100 }), printB = hb('pr', 'single', 'lost', 50, 0, [hl('f3', 'ml:b', { printed: 2.1 })], { unit: 100 });
  const wholeB = hb('wh', 'multi', 'void', 40, 40, [hl('f1', 'ml:a'), hl('f2', 'ml:b')], { printed: 3.4 }), cashB = hb('cs', 'single', 'cashed', 60, 60, [hl('f1', 'ml:b')]);
  const sides = [mineB, markB, namedB, printB, wholeB, cashB];
  eq('tip: a bet is a tipster\'s when it says so, or carries what only a copy has (a name, a printed odd)', sides.map(Core.isTip), [false, true, true, true, true, false]);
  eq('tip: the results by whose the bets are keep the person\'s own apart from the copies with no name', Core.byOrigin(sides).map(r => [r.k, r.tip, r.n, r.st, r.ret]), [['', true, 3, 190, 40], ['Canal A', true, 1, 200, 300], ['', false, 2, 160, 310]].sort((a, b) => b[3] - a[3]));
  eq('benchmark: each side summed up, and who is ahead by return on what was staked', (r => [r.ahead, r.mine, r.tip])(Core.benchmark(sides)),
    ['mine', { n: 2, st: 160, ret: 310, won: 1, dec: 1, units: 1.5, unitBets: 1, pnl: 150, roi: 0.9375 }, { n: 4, st: 390, ret: 340, won: 1, dec: 3, units: -0.5, unitBets: 3, pnl: -50, roi: -0.1282 }]);       // voided and cashed-out bets count in the money, not in the hits
  eq('benchmark: the tipster ahead, a tie, and nothing to compare while one side has no closed bet', [Core.benchmark([markB, namedB, hb('m2', 'single', 'lost', 10, 0, [hl('f1', 'ml:a')])]).ahead, Core.benchmark([mineB, hb('t2', 'single', 'won', 10, 25, [hl('f1', 'ml:a')], { copied: true })]).ahead, Core.benchmark([mineB]).ahead, Core.benchmark([namedB]).ahead, Core.benchmark([]).ahead], ['tip', 'tie', null, null, null]);
  eq('since: the copies with no name are the tipster\'s, apart from the person\'s own', Core.sinceSummary([mineB, markB, printB], 0).by, [{ k: '', tip: true, n: 2, pnl: -150 }, { k: '', tip: false, n: 1, pnl: 150 }]);
  const named = Core.renameOrigin(sides, '', 'Canal Novo');
  eq('origin: with no origin given, the copies that have none get the name; the person\'s own bets never do', [named.n, named.bets.map(b => b.from || null)], [3, [null, 'Canal Novo', 'Canal A', 'Canal Novo', 'Canal Novo', null]]);
  const DAYMS = 24 * 3600e3, NOW = 100 * DAYMS;
  const past = [hb('old', 'single', 'won', 10, 20, [hl('f1', 'ml:a', { eid: 'e1', event: 'UFC 1: Almeida vs. Dunne', date: 60 * DAYMS })], { settledAt: 61 * DAYMS }),
    hb('mid', 'single', 'lost', 10, 0, [hl('f2', 'ml:a', { eid: 'e2', event: 'UFC 2: Teles vs. Prado', date: 90 * DAYMS })], { settledAt: 91 * DAYMS }),
    hb('x', 'multi', 'won', 10, 40, [hl('f2', 'ml:b', { eid: 'e2', event: 'UFC 2: Teles vs. Prado', date: 90 * DAYMS }), hl('f5', 'ml:a', { eid: 'e3', event: 'UFC 3: Brandt vs. Kessler', date: 97 * DAYMS })], { settledAt: 98 * DAYMS }),
    hb('new', 'single', 'lost', 10, 0, [hl('f6', 'ml:a', { eid: 'e3', event: 'UFC 3: Brandt vs. Kessler', date: 97 * DAYMS })], { settledAt: 97.5 * DAYMS })];
  eq('period: everything', (r => [ids(r.bets), r.event])(Core.periodBets(past, 'all', NOW)), [['old', 'mid', 'x', 'new'], null]);
  eq('period: the last 30 days, by when the bet closed', ids(Core.periodBets(past, '30d', NOW).bets), ['mid', 'x', 'new']);
  eq('period: the event of the bet that closed last, by its latest fight', (r => [ids(r.bets), r.event])(Core.periodBets(past, 'event', NOW)), [['x', 'new'], 'UFC 3: Brandt vs. Kessler']);
  eq('period: nothing closed, or a period that does not exist', [Core.periodBets([], 'event', NOW), ids(Core.periodBets(past, 'banana', NOW).bets).length], [{ bets: [], event: null }, 4]);
  eq('period: the last 7 and the last 15 days, by when the bet closed', [ids(Core.periodBets(past, '7d', NOW).bets), ids(Core.periodBets(past, '15d', NOW).bets), ids(Core.periodBets(past, '15d', 110 * DAYMS).bets), ids(Core.periodBets(past, '7d', 104.9 * DAYMS).bets), ids(Core.periodBets(past, 'toString', NOW).bets).length], [['x', 'new'], ['mid', 'x', 'new'], ['x', 'new'], ['x'], 4]);
  /* the statement: the same sums for each stretch of time and for each event, all the bets, the person's own and the tipsters' */
  const ev1 = { eid: 'e1', event: 'UFC 1: Almeida vs. Dunne', date: 60 * DAYMS }, ev2 = { eid: 'e2', event: 'UFC 2: Teles vs. Prado', date: 90 * DAYMS }, ev3 = { eid: 'e3', event: 'UFC 3: Brandt vs. Kessler', date: 97 * DAYMS };
  const stB = [hb('s1', 'single', 'won', 100, 250, [hl('f1', 'ml:a', ev1)], { settledAt: 61 * DAYMS, unit: 100 }),                    // mine, long ago: +1.5u
    hb('s2', 'single', 'lost', 100, 0, [hl('f2', 'ml:a', ev2)], { settledAt: 91 * DAYMS, unit: 100, copied: true }),                    // a tipster's, nine days ago: -1u
    hb('s3', 'single', 'won', 50, 150, [hl('f6', 'ml:a', ev3)], { settledAt: 97.5 * DAYMS, unit: 50, from: 'Canal A' }),                // a tipster's, this week: +2u
    hb('s4', 'single', 'lost', 20, 0, [hl('f7', 'ml:a', ev3)], { settledAt: 98 * DAYMS, unit: 40 }),                                    // mine, this week: -0.5u
    hb('s5', 'multi', 'won', 10, 40, [hl('f2', 'ml:b', ev2), hl('f6', 'ml:b', ev3)], { settledAt: 98 * DAYMS }),                         // mine, across two events, placed before bets kept their unit
    hb('s6', 'single', 'void', 30, 30, [hl('f7', 'ml:b', ev3)], { settledAt: 98 * DAYMS, unit: 30 })];                                  // mine, voided: in the units, not in the record
  const stm = Core.statement(stB, NOW), brief = r => [r.k, r.all.n, r.all.units, r.mine.units, r.tip.units, r.ahead];
  eq('statement: the last 7, 15 and 30 days and everything, in units, with who is ahead of the two', stm.spans.map(brief), [['7d', 4, 1.5, -0.5, 2, 'tip'], ['15d', 5, 0.5, -0.5, 1, 'mine'], ['30d', 5, 0.5, -0.5, 1, 'mine'], ['all', 6, 2, 1, 1, 'mine']]);
  eq('statement: the record counts won and lost; a voided bet and a bet with no unit are told apart', (a => [a.won, a.dec, a.unitBets, a.pnl, a.roi])(stm.spans[0].all), [2, 3, 3, 110, 1]);
  eq('statement: each event, the latest first, and the multiple across events in a row of its own', stm.events.map(brief), [['e3', 3, 1.5, -0.5, 2, 'tip'], ['*', 1, 0, 0, 0, null], ['e2', 1, -1, 0, -1, null], ['e1', 1, 1.5, 1.5, 0, null]]);
  eq('statement: the rows of the events carry the name and the day of each', stm.events.map(r => [r.event, r.date / DAYMS]), [['UFC 3: Brandt vs. Kessler', 97], ['', 97], ['UFC 2: Teles vs. Prado', 90], ['UFC 1: Almeida vs. Dunne', 60]]);
  eq('statement: every closed bet is in one row of the events, and one only', [stm.events.reduce((a, r) => a + r.all.n, 0), stm.events.reduce((a, r) => a + r.all.pnl, 0), stm.spans[3].all.pnl], [6, 160, 160]);
  eq('statement: whether any bet is a tipster\'s, and nothing closed', [stm.tips, Core.statement([stB[0], stB[3]], NOW).tips, (e => [e.tips, e.events, e.spans.map(r => [r.k, r.all.n, r.all.roi, r.ahead])])(Core.statement([], NOW))], [true, false, [false, [], [['7d', 0, null, null], ['15d', 0, null, null], ['30d', 0, null, null], ['all', 0, null, null]]]]);
  eq('since: what closed by itself after a moment, with the result by origin', Core.sinceSummary(closed.concat(hb('late', 'single', 'lost', 25, 0, [hl('f1', 'ml:a')], { from: 'Canal A', settledAt: 9000 }), hb('op', 'single', 'open', 5, 0, [hl('f1', 'ml:a')])), 4000),
    { n: 5, pnl: -155, units: 0, unitBets: 0, by: [{ k: 'Canal A', tip: true, n: 3, pnl: 125 }, { k: '', tip: false, n: 1, pnl: 20 }, { k: 'Canal B', tip: true, n: 1, pnl: -300 }] });                 // the cashout is not there: the person did that one
  eq('since: nothing after that moment, and a moment that was never set', [Core.sinceSummary(closed, 5000), Core.sinceSummary(closed, undefined).n], [{ n: 0, pnl: 0, units: 0, unitBets: 0, by: [] }, 4]);
  eq('since: the result in units too, each bet by the unit it was placed with', (r => [r.n, r.pnl, r.units, r.unitBets])(Core.sinceSummary([hb('w', 'single', 'won', 100, 300, [hl('f1', 'ml:a')], { unit: 50 }), hb('l', 'single', 'lost', 1000, 0, [hl('f2', 'ml:a')], { unit: 500 }),
    hb('n', 'single', 'won', 20, 50, [hl('f3', 'ml:a')]), hb('k', 'single', 'cashed', 60, 90, [hl('f3', 'ml:b')], { unit: 10 })], 0)), [3, -770, 2, 2]);       // +4u and -2u; the bet with no unit only counts in money
  /* the latest fights of an athlete (invented answers, in the shape of the recorded ones) */
  const logOf = items => ({ events: { items } }), refTo = id => ({ $ref: 'http://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/events/9/competitions/' + id + '?lang=en' });
  eq('event log: nothing, or something that is not a list of fights', [Core.normEventlog(null), Core.normEventlog({}), Core.normEventlog(logOf([{ played: true }, { competition: {} }, null]))], [[], [], []]);
  eq('event log: the id comes from the address, and a fight not fought yet says so', Core.normEventlog(logOf([{ competition: refTo('77'), played: false }, { competition: refTo('76'), played: true }, { competition: refTo('75') }])).map(x => [x.id, x.played, x.competition.slice(0, 8)]), [['77', false, 'https://'], ['76', true, 'https://'], ['75', false, 'https://']]);
  const pc = (winA, winB) => ({ id: 'p1', date: '2026-01-02T03:00Z', type: { abbreviation: 'Lightweight' }, format: { regulation: { periods: 5 } }, competitors: [{ id: '10', winner: winA }, { id: '20', winner: winB }], status: { $ref: 'http://x/status' } });
  const ps = (name, display, period, clock) => ({ period, displayClock: clock, result: { name, displayName: display } });
  eq('past fight: a decision, seen by the winner and by the loser', ['10', '20'].map(a => (f => [f.won, f.method, f.round, f.clock, f.rounds, f.weight])(Core.normPastFight(pc(true, false), ps('decision---unanimous', 'Decision - Unanimous', 5, '5:00'), a))), [[true, 'dec', 5, '5:00', 5, 'Lightweight'], [false, 'dec', 5, '5:00', 5, 'Lightweight']]);
  eq('past fight: nobody wins a draw or a no contest, whatever is marked', [Core.normPastFight(pc(false, false), ps('draw', 'Draw', 3, '5:00'), '10').won, Core.normPastFight(pc(true, false), ps('no-contest', 'No Contest', 1, '2:00'), '10').won, Core.normPastFight(pc(true, false), ps('no-contest', 'No Contest', 1, '2:00'), '10').method], [null, null, 'nc']);
  eq('past fight: with no result published the winner still counts, and the method is not made up', (f => [f.won, f.method, f.round, f.clock, f.time])(Core.normPastFight(pc(false, true), { period: 2 }, '20')), [true, 'unknown', 0, '', null]);
  eq('past fight: no winner marked on either side is not a loss', Core.normPastFight(pc(false, false), ps('kotko', 'KO/TKO', 1, '1:00'), '10').won, null);
  eq('past fight: which submission it was, as the source names it, and nothing made up when it does not say', [Core.normPastFight(pc(true, false), { period: 1, displayClock: '1:03', result: { name: 'submission', displayName: 'Submission', displayDescription: 'Rear Naked Choke' } }, '10'), Core.normPastFight(pc(true, false), ps('submission', 'Submission', 2, '3:00'), '10'), Core.normPastFight(pc(false, true), { period: 2 }, '20')].map(f => [f.method, f.desc]), [['sub', 'Rear Naked Choke'], ['sub', ''], ['unknown', '']]);
  /* the flag of a fighter's country, from the name of the country as the source writes it */
  const flag = (...cc) => String.fromCodePoint(...cc);
  eq('flag: by the name of the country', [Core.flagOf('Brazil'), Core.flagOf('China'), Core.flagOf('USA'), Core.flagOf('United States'), Core.flagOf('South Korea'), Core.flagOf('Georgia')], [flag(0x1F1E7, 0x1F1F7), flag(0x1F1E8, 0x1F1F3), flag(0x1F1FA, 0x1F1F8), flag(0x1F1FA, 0x1F1F8), flag(0x1F1F0, 0x1F1F7), flag(0x1F1EC, 0x1F1EA)]);
  eq('flag: England, Scotland and Wales have their own', [Core.flagOf('England'), Core.flagOf('Scotland'), Core.flagOf('Wales')].map(f => [...f].map(c => c.codePointAt(0).toString(16)).join(' ')), ['1f3f4 e0067 e0062 e0065 e006e e0067 e007f', '1f3f4 e0067 e0062 e0073 e0063 e0074 e007f', '1f3f4 e0067 e0062 e0077 e006c e0073 e007f']);
  eq('flag: without minding case, accents or spaces around', [Core.flagOf('  brazil '), Core.flagOf('BRAZIL'), Core.flagOf("Côte d'Ivoire"), Core.flagOf('Türkiye'), Core.flagOf('Czechia') === Core.flagOf('Czech Republic')], [flag(0x1F1E7, 0x1F1F7), flag(0x1F1E7, 0x1F1F7), flag(0x1F1E8, 0x1F1EE), flag(0x1F1F9, 0x1F1F7), true]);
  // the names on the real boards on 11/10/2026 (read from the annotations of the live check, run 38144909204), as ESPN writes them
  const SEEN = ['Albania', 'Argentina', 'Armenia', 'Aruba', 'Australia', 'Azerbaijan', 'Bahrain', 'Belgium', 'Brazil', 'Cameroon', 'Canada', 'Chile', 'China', 'Croatia', 'Cuba', 'Democratic Republic of Congo', 'Dominican Republic', 'Ecuador', 'England', 'France', 'Georgia', 'Germany', 'Haiti', 'Hungary', 'India', 'Indonesia', 'Ireland', 'Italy', 'Jamaica', 'Japan', 'Kyrgyzstan', 'Lebanon', 'Lithuania', 'Mexico', 'Moldova', 'Mongolia', 'Morocco', 'Myanmar', 'Netherlands', 'New Zealand', 'Nigeria', 'Peru', 'Poland', 'Portugal', 'Russia', 'Scotland', 'Senegal', 'Slovakia', 'South Korea', 'Spain', 'Sweden', 'Tajikistan', 'Türkiye', 'USA', 'Ukraine', 'Uzbekistan', 'Venezuela', 'Wales'];
  eq('flag: every country name seen on the real boards has one, and no two countries share a flag', [SEEN.length, SEEN.filter(c => !Core.flagOf(c)), new Set(SEEN.map(Core.flagOf)).size], [58, [], 58]);
  eq('flag: what ESPN writes for a fighter with no country is not a country', Core.flagOf('default'), '');
  /* the events on screen: the next three cards that are not over. A card marked as over is never one of them, whatever the hour */
  const DAYC = 24 * 3600e3, NOWC = 1000 * DAYC, cev = (id, days, completed, name) => ({ id, name: name || 'UFC ' + id, date: NOWC + days * DAYC, completed: !!completed });
  const cids = es => es.map(e => e.id);
  const line = [cev('old', -9, true), cev('done', -1, true), cev('cs', 2, false, "Dana White's Contender Series: Season 9, Week 1"), cev('a', 6), cev('b', 13), cev('c', 20), cev('d', 27)];
  eq('cards: a card that is over is gone, and the three after it are there; Contender Series is left out', cids(Core.cardsToShow(line, NOWC)), ['a', 'b', 'c']);
  eq('cards: over is what the source says, not the date: a card that ended a minute ago is gone, one that began yesterday and is not over stays', [cids(Core.cardsToShow([cev('justnow', -0.2, true), cev('a', 7)], NOWC)), cids(Core.cardsToShow([cev('long', -1.2), cev('a', 7)], NOWC))], [['a'], ['long', 'a']]);
  eq('cards: a card under way is one of the three', cids(Core.cardsToShow([cev('done', -3, true), cev('tonight', -0.1), cev('a', 7), cev('b', 14), cev('c', 21)], NOWC)), ['tonight', 'a', 'b']);
  eq('cards: when that card ends it leaves, and the three after it are there', cids(Core.cardsToShow([cev('done', -3, true), cev('tonight', -0.1, true), cev('a', 7), cev('b', 14), cev('c', 21)], NOWC)), ['a', 'b', 'c']);
  eq('cards: a card further ahead with a bet still open on it is shown; one that is over, an old one and Contender Series never', [cids(Core.cardsToShow(line, NOWC, new Set(['d']))), cids(Core.cardsToShow(line, NOWC, new Set(['b', 'done', 'old', 'cs'])))], [['a', 'b', 'c', 'd'], ['a', 'b', 'c']]);
  eq('cards: an event the source never marks as over leaves after five days', cids(Core.cardsToShow([cev('stuck', -6), cev('late', -4), cev('a', 6)], NOWC)), ['late', 'a']);
  eq('cards: fewer than three to come, none at all, only cards that are over, and how many and for how long', [cids(Core.cardsToShow([cev('a', 6), cev('b', 13)], NOWC)), Core.cardsToShow([], NOWC), Core.cardsToShow([cev('done', -1, true)], NOWC), Core.NEXT_CARDS, Core.RECENT_CARD / DAYC], [['a', 'b'], [], [], 3, 5]);
  /* the filter by country: the fights with a fighter from one, and the countries there are to choose from */
  const lf = (id, ca, cb) => ({ id, a: { name: 'A' + id, country: ca }, b: { name: 'B' + id, country: cb } });
  const LF = [lf('1', 'Brazil', 'England'), lf('2', 'China', 'default'), lf('3', 'Brazil', 'Brazil'), lf('4', '', 'USA'), lf('5', ' brazil ', 'Atlantis')];
  const fids = fs => fs.map(f => f.id);
  eq('country: the fights with a fighter from it, on either side, whatever the case', [fids(Core.fromCountry(LF, 'Brazil')), fids(Core.fromCountry(LF, 'ENGLAND')), fids(Core.fromCountry(LF, 'atlantis')), fids(Core.fromCountry(LF, 'usa'))], [['1', '3', '5'], ['1'], ['5'], ['4']]);
  eq('country: none given, what the source writes for no country, or one nobody is from, finds nothing', [Core.fromCountry(LF, ''), Core.fromCountry(LF, null), Core.fromCountry(LF, 'default'), Core.fromCountry(LF, 'Narnia'), Core.fromCountry([], 'Brazil')].map(x => x.length), [0, 0, 0, 0, 0]);
  eq('country: the countries there are and in how many fights each has a fighter; two of the same country count once, and no country is not one', Core.countries(LF).map(c => [c.name, c.fights]).sort(), [['Atlantis', 1], ['Brazil', 3], ['China', 1], ['England', 1], ['USA', 1]]);
  eq('country: every fight a country is counted in is one the filter finds', Core.countries(LF).map(c => Core.fromCountry(LF, c.name).length === c.fights), [true, true, true, true, true]);
  eq('country: what the table knows it by, to say its name in Portuguese', [Core.countryCode('Brazil'), Core.countryCode('england'), Core.countryCode('Wales'), Core.countryCode('Türkiye'), Core.countryCode('USA'), Core.countryCode('Atlantis'), Core.countryCode('default'), Core.countryCode(''), Core.countryCode(null), Core.countryCode('constructor')], ['BR', 'gbeng', 'gbwls', 'TR', 'US', '', '', '', '', '']);
  eq('flag: a name the table does not have gets no flag, never a guessed one', [Core.flagOf('Atlantis'), Core.flagOf(''), Core.flagOf(null), Core.flagOf(undefined), Core.flagOf('Bra'), Core.flagOf('Northern Ireland'), Core.flagOf('constructor'), Core.flagOf('BR')], ['', '', '', '', '', '', '', '']);
  eq('past fight: an answer that is not a fight', [Core.normPastFight(null, null, '10'), Core.normPastFight({}, {}, '10')], [null, null]);
  eq('past fight: where the status is asked for, by https', [Core.statusRef(pc(true, false)), Core.statusRef({}), Core.statusRef(null)], ['https://x/status', '', '']);
  const pf = (won, method, round, time) => ({ won, method, round, time });
  eq('form: wins, losses, the ones nobody won, and how the fights ended whoever won them', Core.formSummary([pf(true, 'ko', 1, 60), pf(false, 'dec', 3, 300), pf(null, 'draw', 3, 300), pf(true, 'sub', 2, 100), pf(false, 'unknown', 0, null)]), { n: 5, won: 2, lost: 2, other: 1, ko: 1, sub: 1, dec: 1 });
  eq('form: no fights', Core.formSummary([]), { n: 0, won: 0, lost: 0, other: 0, ko: 0, sub: 0, dec: 0 });
  eq('form: how long a fight lasted, and nothing when the round or the time is not told', [pf(true, 'ko', 1, 60), pf(false, 'dec', 3, 300), pf(true, 'sub', 2, 100), pf(false, 'unknown', 0, null), pf(true, 'ko', 2, null)].map(Core.fightSeconds), [60, 900, 400, null, null]);
  /* the card of an event: its parts by the hour, and finding a fight by a fighter's name */
  const cf = (id, date, idx, a, b) => ({ id, date, idx, a: { name: a }, b: { name: b } });
  const night = [cf('c1', 100, 0, 'Ana Souza', 'Bia Moura'), cf('c2', 100, 1, 'José Aldana', 'Leo Vance'), cf('c3', 200, 2, 'Caio Brandt', 'Dario Kessler'), cf('c4', 200, 3, 'Igor Sampaio', 'Otto Farias'),
    cf('c5', 300, 4, 'Marina Teles', 'Joana Prado Jr.'), cf('c6', 300, 5, 'Rafael Almeida', 'Connor Lee Dunne')];
  const parts = fs => Core.cardSections(fs).map(s => [s.part, s.date, s.fights.map(f => f.id)]);
  eq('card: three hours are main card, prelims and early prelims, the main event on top', parts(night), [['main', 300, ['c6', 'c5']], ['prelims', 200, ['c4', 'c3']], ['early', 100, ['c2', 'c1']]]);
  eq('card: with two hours there are no early prelims', parts(night.slice(2)), [['main', 300, ['c6', 'c5']], ['prelims', 200, ['c4', 'c3']]]);
  eq('card: with four hours only the earliest is early prelims', parts(night.concat(cf('c0', 50, 6, 'Nina Kovac', 'Lia Prates'))).map(p => p[0]), ['main', 'prelims', 'prelims', 'early']);
  eq('card: a single hour is all main card, and no fights is no card', [parts(night.slice(4)), parts([])], [[['main', 300, ['c6', 'c5']]], []]);
  const found = q => Core.findFights(night, q).map(f => f.id);
  eq('search: by a piece of the name, whatever the accents and the case', [found('aldana'), found('JOSE'), found('josé ald'), found('kess')], [['c2'], ['c2'], ['c2'], ['c3']]);
  eq('search: either fighter of the fight, and every word typed has to be there', [found('dunne'), found('almeida dunne'), found('almeida teles'), found('lee')], [['c6'], ['c6'], [], ['c6']]);
  eq('search: a piece of name on more than one fight finds them all, in the order given', found('ar'), ['c3', 'c4', 'c5']);       // Dario, Farias, Marina
  eq('search: a suffix with a dot is found with or without it', [found('prado jr'), found('prado jr.')], [['c5'], ['c5']]);
  eq('search: nothing typed, only spaces or signs, or a name nobody has', [found(''), found('   '), found('.-'), found(undefined), found('zzz')], [[], [], [], [], []]);
  eq('tip: empty', tip("  \n ").problems, [{ code: 'empty' }]);
  eq('tip: a name inside another word is not a match', tip("Almeidas x Dunnes\nvence").problems, [{ code: 'nofight' }]);
  return { n, fails };
}
