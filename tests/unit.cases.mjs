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
  // found by mutation testing (docs/verificacao.md). eq compares JSON, where Infinity and NaN read as null: "no price" is asked for exactly
  eq('am2dec: no price is null, not an infinite odd', [Core.am2dec(null), Core.am2dec(0), Core.am2dec('abc')].map(x => x === null), [true, true, true]);
  eq('am2dec: EVEN with spaces around, and a text that only contains "ev" is not even', [Core.am2dec(' EVEN '), Core.am2dec('never')], [2, null]);
  eq('estimated odd: the fair chance with the 7% margin, between 1.02 and 51', [Core.mo(0.5), Core.mo(0.25), Core.mo(0.99), Core.mo(0.01), Core.mo(0.0041)], [1.87, 3.74, 1.02, 51, 51]);
  eq('estimated odd: a chance of 0.4% or less is not offered', [Core.mo(0.004), Core.mo(0.001), Core.mo(0), Core.mo(NaN)].map(x => x === null), [true, true, true, true]);
  /* with no method lines, the finishes follow the historical mix of the division; in a five-round fight decision is x0.88 */
  const MIX = { 'Heavyweight': [.48, .12, .40], 'Light Heavyweight': [.42, .14, .44], 'Middleweight': [.36, .17, .47], 'Welterweight': [.31, .16, .53], 'Lightweight': [.27, .19, .54], 'Featherweight': [.26, .17, .57],
    'Bantamweight': [.24, .17, .59], 'Flyweight': [.20, .20, .60], 'W Featherweight': [.22, .15, .63], 'W Bantamweight': [.18, .17, .65], 'W Flyweight': [.13, .17, .70], 'W Strawweight': [.10, .17, .73], 'Catchweight': [.28, .17, .55] };
  const mixOf = (weight, rounds) => { const p = Core.probs({ weight, rounds }, { ml: { a: 1.8, b: 2.05 }, method: null, dist: null, total: null }); return ['a', 'b'].map(s => ['ko', 'sub', 'dec'].map(m => Math.round(p.M[s][m] / (s === 'a' ? p.pa : p.pb) * 1e6) / 1e6)); };
  for (const w in MIX) eq(`no method line: the mix of ${w}, the same for both fighters`, mixOf(w, 3), [MIX[w], MIX[w]]);
  const five = (w => { const d = w[2] * 0.88, k = (1 - d) / (1 - w[2]); return [w[0] * k, w[1] * k, d].map(x => Math.round(x * 1e6) / 1e6); })(MIX.Middleweight);
  eq('no method line, five rounds: decision x0.88, the finishes take the rest in proportion', mixOf('Middleweight', 5), [five, five]);

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
  /* the board, read from an invented answer in the shape of the recorded ones (tests/fixtures/espn/scoreboard_*.json):
     found by mutation testing (docs/verificacao.md); tests/contract.py reads the real ones, but outside of these cases */
  const ath = (displayName, shortName, alt) => ({ fullName: displayName, displayName, shortName, flag: { alt } });
  const EV = { id: 'e9', name: 'UFC Teste: Almeida vs. Dunne', date: '2026-10-03T20:00Z', status: { type: { name: 'STATUS_SCHEDULED' } }, competitions: [
    { id: 'c1', date: '2026-10-04T00:00Z', type: { abbreviation: 'Middleweight' }, format: { regulation: { periods: 5 } }, status: { clock: 0, displayClock: '0:00', period: 0, type: { name: 'STATUS_SCHEDULED', state: 'pre' } },
      competitors: [{ id: '302', order: 2, winner: false, athlete: ath('Connor Lee Dunne', 'C. Lee Dunne', 'Ireland'), records: [{ summary: '10-2-0' }] }, { id: '301', order: 1, winner: false, athlete: ath('Rafael Almeida', 'R. Almeida', 'Brazil'), records: [{ summary: '20-1-0' }] }] },
    { id: 'c2', competitors: [{ id: '1', order: 1, athlete: { fullName: 'Caio Brandt' } }, { id: '2', order: 2 }], status: { type: { name: 'STATUS_CANCELED' } } },
    { id: 'c3', competitors: [{ id: '5', order: 1, athlete: ath('Ivo Rocha', 'I. Rocha', 'Peru') }] },
    { id: 'c4', date: '2026-10-04T01:00Z', type: { abbreviation: 'W Flyweight' }, format: { regulation: { periods: 3 } }, status: { displayClock: '3:10', period: 2, type: { name: 'STATUS_IN_PROGRESS', state: 'in' } },
      competitors: [{ id: '7', order: 1, winner: false, athlete: ath('Marina Teles', 'Teles', 'Brazil') }, { id: '8', order: 2, winner: true, athlete: { displayName: 'Joana Prado', shortName: 'J.' } }] }] };
  const EVN = Core.normEvent(EV), fx1 = EVN.fights[0], fx2 = EVN.fights[1], fx4 = EVN.fights[2];
  eq('board: the event, and a fight with fewer than two fighters is left out', [EVN.id, EVN.name, EVN.date, EVN.completed, EVN.fights.map(f => f.id)], ['e9', 'UFC Teste: Almeida vs. Dunne', Date.parse('2026-10-03T20:00Z'), false, ['c1', 'c2', 'c4']]);
  eq('board: a fight, fighter a being the one of order 1', [fx1.id, fx1.eventId, fx1.eventName, fx1.date, fx1.idx, fx1.weight, fx1.rounds, fx1.state, fx1.canceled, fx1.period, fx1.clock, fx1.winner], ['c1', 'e9', 'UFC Teste: Almeida vs. Dunne', Date.parse('2026-10-04T00:00Z'), 0, 'Middleweight', 5, 'pre', false, 0, '0:00', null]);
  eq('board: each fighter, the surname taken from the short name without the initial', [fx1.a, fx1.b], [{ id: '301', name: 'Rafael Almeida', last: 'Almeida', country: 'Brazil', record: '20-1-0', winner: false }, { id: '302', name: 'Connor Lee Dunne', last: 'Lee Dunne', country: 'Ireland', record: '10-2-0', winner: false }]);
  eq('board: a cancelled fight is over, and what is missing gets a default', [fx2.state, fx2.canceled, fx2.date, fx2.rounds, fx2.weight, fx2.period, fx2.clock, fx2.a.name, fx2.a.last, fx2.b.name, fx2.b.last, fx2.b.country, fx2.b.record, fx2.idx], ['post', true, Date.parse('2026-10-03T20:00Z'), 3, '', 0, '', 'Caio Brandt', 'Brandt', 'A definir', '', '', '', 1]);
  eq('board: a fight under way, the winner marked, and a short name with nothing but an initial', [fx4.state, fx4.period, fx4.clock, fx4.winner, fx4.a.last, fx4.b.last, fx4.b.winner, fx4.idx], ['in', 2, '3:10', 'b', 'Teles', 'Prado', true, 3]);
  eq('board: an event is over when the source says so in any of its three ways', [{ completed: true }, { state: 'post' }, { name: 'STATUS_FINAL' }, { name: 'STATUS_SCHEDULED', state: 'pre' }].map(type => Core.normEvent({ id: 1, date: '2026-10-03T20:00Z', status: { type } }).completed), [true, true, true, false]);
  eq('board: an event with no fights or no status', (e => [e.fights, e.completed, e.name])(Core.normEvent({ id: 2, date: '2026-10-03T20:00Z' })), [[], false, '']);
  /* the odds of a fight, read from invented answers in the shape of tests/fixtures/espn/odds.json */
  const oddsAns = (over, x) => ({ items: [{ provider: { name: 'DraftKings' }, overUnder: 3.5, overOdds: -120, underOdds: -110, homeAthleteOdds: side('302', 105, 200, 2200, 450), awayAthleteOdds: side('301', -125, 800, 300, 250), propBets: { $ref: 'http://x/props?lang=en' }, ...over }, ...(x || [])] });
  eq('odds: an item without both sides is passed over for the next one', Core.normOdds({ items: [{ homeAthleteOdds: side('302', 105, 1, 1, 1) }, oddsAns().items[0]] }, F).ml, { a: 1.8, b: 2.05 });
  eq('odds: a side of another fighter, or a side with no moneyline, is no odds', [Core.normOdds(oddsAns({ awayAthleteOdds: side('999', -125, 800, 300, 250) }), F), Core.normOdds(oddsAns({ awayAthleteOdds: { ...side('301', -125, 800, 300, 250), moneyLine: undefined } }), F), Core.normOdds(oddsAns({ homeAthleteOdds: { athlete: {}, moneyLine: 105 } }), F), Core.normOdds(null, F)], [null, null, null, null]);
  eq('odds: the moneyline can come under the current prices', Core.normOdds(oddsAns({ awayAthleteOdds: { ...side('301', null, 800, 300, 250), moneyLine: undefined, current: { moneyLine: { american: '-150' }, victoryMethod: side('301', 0, 800, 300, 250).current.victoryMethod } } }), F).ml, { a: 1.67, b: 2.05 });
  eq('odds: no method lines when one side lacks one of them', [Core.normOdds(oddsAns({ homeAthleteOdds: { ...side('302', 105, 200, 2200, 450), current: { victoryMethod: { koTkoDq: am(200), submission: am(2200) } } } }), F).method, Core.normOdds(oddsAns({ homeAthleteOdds: { ...side('302', 105, 200, 2200, 450), current: {} } }), F).method], [null, null]);
  eq('odds: a total line must be a half inside the rounds of the fight, with both prices', [3.5, 0.5, 4.5, 5.5, 0, 3, -0.5].map(l => !!Core.normOdds(oddsAns({ overUnder: l }), F).total).concat([!!Core.normOdds(oddsAns({ overOdds: null }), F).total, !!Core.normOdds(oddsAns({ underOdds: null }), F).total]), [true, true, true, false, false, false, false, false, false]);
  eq('odds: the book and the props link, with defaults', [Core.normOdds(oddsAns(), F).book, Core.normOdds(oddsAns({ provider: undefined }), F).book, Core.normOdds(oddsAns({ propBets: undefined }), F).props, Core.normOdds(oddsAns({ propBets: { $ref: 'https://x/http:/p' } }), F).props], ['DraftKings', 'casa', '', 'https://x/http:/p']);
  const distOf = (items, o) => Core.attachDistance(o || Core.normOdds(payload, F), F, { items }).dist;
  const dItem = v => ({ type: { name: 'Fight To Go The Distance' }, odds: { american: { value: v } } });
  eq('distance: only the distance items with a price count, and the other props are left aside', [distOf([dItem('+130'), { type: { name: 'Total Rounds' }, odds: { american: { value: '+500' } } }, dItem('-170'), { type: {} }, null, { odds: {} }, { type: { name: 'Distance' } }]), distOf([dItem('+130'), dItem('-170')], { ...Core.normOdds(payload, F), method: null })], [{ yes: 2.3, no: 1.59 }, null]);
  eq('distance: the decision chance of both fighters is summed to tell which price is the yes', distOf([dItem('-300'), dItem('+220')], { ...Core.normOdds(payload, F), method: { a: { ko: 9, sub: 9, dec: 2.2 }, b: { ko: 9, sub: 9, dec: 2.2 } } }), { yes: 1.33, no: 3.2 });
  const rs = (s) => Core.normResult({ period: 2, ...s });
  eq('result: the time from the displayed clock, else the numeric one, else none', [rs({ result: { name: 'kotko' }, displayClock: '3:26' }).time, rs({ result: { name: 'kotko' }, displayClock: ' 12:05 ' }).time, rs({ result: { name: 'kotko' }, displayClock: '3:2', clock: 63 }).time, rs({ result: { name: 'kotko' }, displayClock: 'x3:26', clock: 7 }).time, rs({ result: { name: 'kotko' }, displayClock: '3:26x' }).time, rs({ result: { name: 'kotko' }, clock: '63' }).time, rs({ result: { name: 'kotko' }, displayClock: 'a:bc' }).time], [206, 725, 63, 7, null, null, null]);
  eq('result: the words of the result, with nothing missing made up', [rs({ result: { displayName: 'KO/TKO' } }), rs({ result: { name: 'decision---split' } })].map(r => [r.method, r.label, r.desc, r.clock, r.round]), [['ko', 'KO/TKO', '', '', 2], ['dec', '', '', '', 2]]);
  eq('result: a no contest written without the hyphen, and one overturned', [rs({ result: { name: 'nocontest' } }).method, rs({ result: { displayName: 'Overturned' } }).method], ['nc', 'nc']);
  eq('past fight: no date, category or rounds told, and a no contest nobody won', (p => [p.date, p.weight, p.rounds, p.won, p.label])(Core.normPastFight({ id: 'p2', competitors: [{ id: '10', winner: true }, { id: '20', winner: false }] }, { period: 1, displayClock: '2:00', result: { name: 'no-contest', displayName: 'No Contest' } }, '10')), [0, '', 0, null, 'No Contest']);
  eq('past fight: a fight with a winner is a win only for the athlete who won it, and the format is read when it is there', [Core.normPastFight({ id: 'p3', format: {}, competitors: [{ id: '10', winner: true }, { id: '20', winner: false }] }, { period: 1, displayClock: '1:00', result: { name: 'kotko', displayName: 'KO/TKO' } }, '20').won, Core.normPastFight({ id: 'p3', format: { regulation: {} }, competitors: [] }, null, '20').rounds], [false, 0]);
  eq('takedowns: a stat is read only by its name and only as a number', [Core.statValue({ splits: { categories: [{ stats: [{ name: 'other', value: 9 }] }, {}, { stats: [{ name: 'takedownsLanded', value: '3' }, { name: 'takedownsLanded', value: 4 }] }] } }, 'takedownsLanded'), Core.statValue({ splits: {} }, 'x'), Core.statValue(null, 'x'), Core.statValue({}, 'x')], [4, null, null, null]);
  eq('links of the source go by https, and only at the start', [Core.statusRef({ status: { $ref: 'http://a/http:/b' } }), Core.normEventlog({ events: { items: [{ competition: { $ref: 'xhttp://a/competitions/9' } }] } })[0].competition], ['https://a/http:/b', 'xhttp://a/competitions/9']);

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
  /* pricing, as the model prices today: found by mutation testing (docs/verificacao.md). A change to the model changes these
     numbers on purpose; regenerate them only after checking the new ones are the ones wanted. */
  const shapeOf = Q => Q.groups.map(g => [g.id, g.cat, g.title, g.note || '', g.cols, g.heads ? 'h' : ''].join('|') + ': ' + g.opts.map(o => [o.key, o.label, o.full].join('|')).join(' ; '));
  const oddsOf = Q => Q.groups.map(g => g.opts.map(o => o.key + '=' + o.odd + (o.src === 'real' ? 'r' : '')).join(' ')).join(' ');
  const jointOf = Q => Object.keys(Q.map).filter(k => !/^td/.test(k)).map(k => k + '=' + Math.round(Q.J.prob([k]) * 1e4) / 1e4).join(' ');
  const F3 = { ...F, rounds: 3, weight: 'W Flyweight' }, P3 = Core.price(F3, { ml: { a: 1.25, b: 4.2 }, method: null, total: null, dist: null }, { a: { tdAvg: 0 } }), P4 = Core.price(F3, { ml: { a: 1.02, b: 21 }, method: null, total: null, dist: null });
  eq('price: the markets, their titles and the words of every selection', shapeOf(P), ["ml|Vencedor|Vencedor||2|: ml:a|Almeida|Rafael Almeida vence ; ml:b|Dunne|Connor Lee Dunne vence","mov|Método|Método de vitória||2|h: mov:a:ko|KO/TKO|Almeida por KO/TKO ; mov:b:ko|KO/TKO|Dunne por KO/TKO ; mov:a:sub|Submission|Almeida por Submission ; mov:b:sub|Submission|Dunne por Submission ; mov:a:dec|Decisão|Almeida por Decisão ; mov:b:dec|Decisão|Dunne por Decisão","fm|Método|Como a luta termina||3|: fm:ko|KO/TKO|Luta termina por KO/TKO ; fm:sub|Submission|Luta termina por Submission ; fm:dec|Decisão|Luta termina por Decisão","dist|Método|Vai até a decisão?||2|: dist:yes|Sim|Luta vai até a decisão ; dist:no|Não|Luta não vai até a decisão","tot|Rounds|Total de rounds|+ é mais de, − é menos de · X.5 = metade do round seguinte (2:30)|2|: tot:o:1.5|+1.5|+1.5 rounds ; tot:u:1.5|−1.5|−1.5 rounds ; tot:o:2.5|+2.5|+2.5 rounds ; tot:u:2.5|−2.5|−2.5 rounds ; tot:o:3.5|+3.5|+3.5 rounds ; tot:u:3.5|−3.5|−3.5 rounds ; tot:o:4.5|+4.5|+4.5 rounds ; tot:u:4.5|−4.5|−4.5 rounds","rnd|Rounds|Round em que a luta acaba|por nocaute ou submission|3|: rnd:1|Round 1|Luta acaba no round 1 ; rnd:2|Round 2|Luta acaba no round 2 ; rnd:3|Round 3|Luta acaba no round 3 ; rnd:4|Round 4|Luta acaba no round 4 ; rnd:5|Round 5|Luta acaba no round 5","wr|Rounds|Vencedor e round||2|h: wr:a:1|Round 1|Almeida vence no round 1 ; wr:b:1|Round 1|Dunne vence no round 1 ; wr:a:2|Round 2|Almeida vence no round 2 ; wr:b:2|Round 2|Dunne vence no round 2 ; wr:a:3|Round 3|Almeida vence no round 3 ; wr:b:3|Round 3|Dunne vence no round 3 ; wr:a:4|Round 4|Almeida vence no round 4 ; wr:b:4|Round 4|Dunne vence no round 4 ; wr:a:5|Round 5|Almeida vence no round 5 ; wr:b:5|Round 5|Dunne vence no round 5","td|Quedas|Quedas na luta|+ é mais de, − é menos de · soma dos dois lutadores|2|: td:o:0.5|+0.5|+0.5 quedas na luta ; td:u:0.5|−0.5|−0.5 quedas na luta ; td:o:1.5|+1.5|+1.5 quedas na luta ; td:u:1.5|−1.5|−1.5 quedas na luta ; td:o:2.5|+2.5|+2.5 quedas na luta ; td:u:2.5|−2.5|−2.5 quedas na luta","tda|Quedas|Acerta pelo menos 1 queda?||2|: tda:a:yes|Almeida: sim|Almeida acerta pelo menos 1 queda ; tda:a:no|Almeida: não|Almeida não acerta nenhuma queda ; tda:b:yes|Dunne: sim|Dunne acerta pelo menos 1 queda ; tda:b:no|Dunne: não|Dunne não acerta nenhuma queda"]);
  eq('price: the markets of a three-round fight with no lines but the winner', shapeOf(P3).map(s => s.split(': ')[0]), ["ml|Vencedor|Vencedor||2|","mov|Método|Método de vitória||2|h","fm|Método|Como a luta termina||3|","dist|Método|Vai até a decisão?||2|","tot|Rounds|Total de rounds|+ é mais de, − é menos de · X.5 = metade do round seguinte (2:30)|2|","rnd|Rounds|Round em que a luta acaba|por nocaute ou submission|3|","wr|Rounds|Vencedor e round||2|h","td|Quedas|Quedas na luta|+ é mais de, − é menos de · soma dos dois lutadores|2|","tda|Quedas|Acerta pelo menos 1 queda?||2|"]);
  eq('price: every odd of a five-round fight with all the lines (r is real)', oddsOf(P), "ml:a=1.8r ml:b=2.05r mov:a:ko=9r mov:b:ko=3r mov:a:sub=4r mov:b:sub=23r mov:a:dec=3.5r mov:b:dec=5.5r fm:ko=2.62 fm:sub=3.97 fm:dec=2.3r dist:yes=2.3r dist:no=1.59r tot:o:1.5=1.27 tot:u:1.5=3.5 tot:o:2.5=1.54 tot:u:2.5=2.37 tot:o:3.5=1.83r tot:u:3.5=1.91r tot:o:4.5=2.13 tot:u:4.5=1.67 rnd:1=4.81 rnd:2=6.43 rnd:3=8.58 rnd:4=11.45 rnd:5=15.28 wr:a:1=9.84 wr:b:1=9.43 wr:a:2=13.13 wr:b:2=12.59 wr:a:3=17.53 wr:b:3=16.8 wr:a:4=23.4 wr:b:4=22.42 wr:a:5=31.23 wr:b:5=29.93 td:o:0.5=1.36 td:u:0.5=2.97 td:o:1.5=2 td:u:1.5=1.75 td:o:2.5=2.96 td:u:2.5=1.37 tda:a:yes=1.57 tda:a:no=2.3 tda:b:yes=3.05 tda:b:no=1.35");
  eq('price: every odd of a three-round fight with the winner line only', oddsOf(P3), "ml:a=1.25r ml:b=4.2r mov:a:ko=9.33 mov:b:ko=31.34 mov:a:sub=7.13 mov:b:sub=23.97 mov:a:dec=1.73 mov:b:dec=5.82 fm:ko=7.19 fm:sub=5.5 fm:dec=1.34 dist:yes=1.34 dist:no=3.12 tot:o:1.5=1.15 tot:u:1.5=5.05 tot:o:2.5=1.27 tot:u:2.5=3.51 rnd:1=6.82 rnd:2=9.75 rnd:3=13.92 wr:a:1=8.85 wr:b:1=29.75 wr:a:2=12.65 wr:b:2=42.49 wr:a:3=18.07 wr:b:3=51 td:o:0.5=1.58 td:u:0.5=2.29 td:o:1.5=3.04 td:u:1.5=1.35 tda:a:yes=3.14 tda:a:no=1.33 tda:b:yes=2.14 tda:b:no=1.66");
  eq('price: a heavy favourite: what is too unlikely to offer is left out', oddsOf(P4), "ml:a=1.02r ml:b=21r mov:a:ko=7.54 mov:b:ko=51 mov:a:sub=5.76 mov:b:sub=51 mov:a:dec=1.4 mov:b:dec=28.82 fm:ko=7.19 fm:sub=5.5 fm:dec=1.34 dist:yes=1.34 dist:no=3.12 tot:o:1.5=1.15 tot:u:1.5=5.05 tot:o:2.5=1.27 tot:u:2.5=3.51 rnd:1=6.82 rnd:2=9.75 rnd:3=13.92 wr:a:1=7.15 wr:b:1=51 wr:a:2=10.22 wr:b:2=51 wr:a:3=14.6 td:o:0.5=1.41 td:u:0.5=2.79 td:o:1.5=2.37 td:u:1.5=1.54 td:o:2.5=4.32 td:u:2.5=1.19 tda:a:yes=2.14 tda:a:no=1.66 tda:b:yes=2.14 tda:b:no=1.66");
  eq('price: the joint model\'s chance of every selection but takedowns (their odds are above), five rounds with all the lines', jointOf(P), "ml:a=0.5391 ml:b=0.4609 mov:a:ko=0.089 mov:b:ko=0.2671 mov:a:sub=0.2003 mov:b:sub=0.0348 mov:a:dec=0.2498 mov:b:dec=0.159 fm:ko=0.3561 fm:sub=0.2351 fm:dec=0.4087 dist:yes=0.4087 dist:no=0.5913 tot:o:1.5=0.7332 tot:u:1.5=0.2668 tot:o:2.5=0.606 tot:u:2.5=0.394 tot:o:3.5=0.5107 tot:u:3.5=0.4893 tot:o:4.5=0.4393 tot:u:4.5=0.5607 rnd:1=0.1941 rnd:2=0.1454 rnd:3=0.1089 rnd:4=0.0816 rnd:5=0.0611 wr:a:1=0.095 wr:b:1=0.0991 wr:a:2=0.0712 wr:b:2=0.0743 wr:a:3=0.0533 wr:b:3=0.0556 wr:a:4=0.0399 wr:b:4=0.0417 wr:a:5=0.0299 wr:b:5=0.0312");
  eq('price: the joint model\'s chance of every selection but takedowns, three rounds with the winner line only', jointOf(P3), "ml:a=0.7706 ml:b=0.2294 mov:a:ko=0.1002 mov:b:ko=0.0298 mov:a:sub=0.131 mov:b:sub=0.039 mov:a:dec=0.5394 mov:b:dec=0.1606 fm:ko=0.13 fm:sub=0.17 fm:dec=0.7 dist:yes=0.7 dist:no=0.3 tot:o:1.5=0.8151 tot:u:1.5=0.1849 tot:o:2.5=0.7336 tot:u:2.5=0.2664 rnd:1=0.137 rnd:2=0.0959 rnd:3=0.0671 wr:a:1=0.1056 wr:b:1=0.0314 wr:a:2=0.0739 wr:b:2=0.022 wr:a:3=0.0517 wr:b:3=0.0154");
  /* pricing rules, each named: found by mutation testing (docs/verificacao.md) */
  eq('combo: an impossible or a redundant combination is refused', [combo(['dist:yes', 'tot:u:1.5']).ok, combo(['ml:a', 'mov:a:sub']).ok, combo(['ml:a', 'fm:ko']).ok], [false, false, true]);
  eq('combo: the joint chance with the 10% margin, never under the best leg', c1.odd, Math.max(Core.r2(1 / (c1.p * 1.1)), M['fm:ko'].odd, M['tot:o:1.5'].odd));
  const Osym = { ml: { a: 1.91, b: 1.91 }, method: { a: { ko: 5, sub: 9, dec: 3.5 }, b: { ko: 5, sub: 9, dec: 3.5 } }, total: null, dist: null }, Psym = Core.price(F, Osym);
  eq('combo: in an even fight, a combination is paid as the market of the right fighter', Core.combo(Psym.J, ['ml:b', 'fm:ko'], [1.91, Psym.map['fm:ko'].odd], Psym.map).same, 'Dunne por KO/TKO');
  eq('joint: a selection the model does not know has no chance', J.prob(['nope:a']), 0);
  near('chance: a winner pick together with anything else comes from the joint model', P.chance(['ml:a', 'tot:o:1.5']), J.prob(['ml:a', 'tot:o:1.5']), 1e-12);
  const pd = o => Core.probs(F, { ...O, ...o }).pDec;
  eq('distance line too sure either way is not used', [pd({ dist: { yes: 60, no: 1.01 } }), pd({ dist: { yes: 1.01, no: 60 } })].map(x => Math.round(x * 1e9)), [pd({ dist: null }), pd({ dist: null })].map(x => Math.round(x * 1e9)));
  const shOf = o => Core.probs(F, { ...O, ...o }).sh.map(x => Math.round(x * 1e9));
  eq('total line that cannot be met is not used: the rounds keep the default shape', [shOf({ total: { line: 3.5, over: 30, under: 1.01 } }), shOf({ total: { line: 4.5, over: 1.01, under: 101 } })], [shOf({ total: null }), shOf({ total: null })]);
  const P0 = Core.probs(F, O), tdaYes = st => Math.round(Core.jointModel(P0, { a: st }).prob(['tda:a:yes']) * 1e9);
  eq('takedown rate: between 0.15 and 5 a fight; 0 is a low prior of 0.5; anything else unknown is 0.9', [tdaYes({ tdAvg: 10 }) === tdaYes({ tdAvg: 5 }), tdaYes({ tdAvg: 5 }) === tdaYes({ tdAvg: 4 }), tdaYes({ tdAvg: 0.05 }) === tdaYes({ tdAvg: 0.15 }), tdaYes({ tdAvg: 0.15 }) === tdaYes({ tdAvg: 0.2 }), tdaYes({ tdAvg: 0 }) === tdaYes({ tdAvg: 0.5 }), tdaYes({}) === tdaYes({ tdAvg: 0.9 }), tdaYes({ tdAvg: '2' }) === tdaYes({ tdAvg: 0.9 }), tdaYes({ tdAvg: -1 }) === tdaYes({ tdAvg: 0.9 }), tdaYes(undefined) === tdaYes({ tdAvg: 0.9 }), Math.round(Core.jointModel(P0).prob(['tda:b:yes']) * 1e9) === Math.round(Core.jointModel(P0, { b: { tdAvg: 0.9 } }).prob(['tda:b:yes']) * 1e9)], [true, false, true, false, true, true, true, true, true, true]);
  eq('a market with nothing to offer is not shown: a one-round fight has no total', Core.price({ ...F, rounds: 1 }, { ...O, total: null }).groups.map(g => g.id).includes('tot'), false);
  near('joint: a fighter lands a takedown or does not', J.prob(['tda:a:yes']) + J.prob(['tda:a:no']), 1, 2e-3);
  eq('price: the distance with no line of its own is estimated, in the same words', ['dist:yes', 'dist:no'].map(k => [P3.map[k].sel, P3.map[k].src, P3.groups.find(g => g.id === 'dist').opts.find(o => o.key === k).label]), [['Luta vai até a decisão', 'est', 'Sim'], ['Luta não vai até a decisão', 'est', 'Não']]);
  eq('price: the takedown lines never go under 0.5', Object.keys(Core.price(F3, { ml: { a: 1.25, b: 4.2 }, method: null, total: null, dist: null }, { a: { tdAvg: 0.15 }, b: { tdAvg: 0.15 } }).map).filter(k => /^td:/.test(k)).map(k => +k.split(':')[2]).sort(), [0.5, 0.5, 1.5, 1.5]);
  eq('over/under and corner only for the markets that have them', [Core.overUnder('rnd:o'), Core.overUnder('ml:u'), Core.sideOf('fm:a'), Core.sideOf('ml:x'), Core.isWomens('Flyweight W ')], [null, null, null, null, false]);

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
  // found by mutation testing (docs/verificacao.md): each of these failed to notice a planted mistake
  eq('live, shown early: method, how it ends and the distance wait for the result', ['mov:a:ko', 'fm:ko', 'dist:yes', 'dist:no'].map(k => out(k, live, null, null, true)), [null, null, null, null]);
  eq('live, shown early: a total or a round still to come is open', [out('tot:o:1.5', fight({ state: 'in', period: 1, winner: null }), null, null, true), out('tot:u:3.5', live, null, null, true), out('wr:a:3', live, null, null, true), out('wr:a:1', live, null, null, true)], [null, null, null, 'lost']);
  eq('shown early: only a fight in the cage is read early; one that is over waits for its result', out('tot:o:1.5', fight({ period: 3, winner: null }), null, null, true), null);
  table('submission R2 1:00 by a: a finish for the distance and the round markets', fight(), { method: 'sub', round: 2, time: 60 }, TD, { 'dist:no': 'won', 'dist:yes': 'lost', 'rnd:2': 'won', 'wr:a:2': 'won', 'wr:b:2': 'lost' });
  table('KO in R2: a later round is lost too', fight(), KO, TD, { 'rnd:3': 'lost', 'wr:a:3': 'lost' });
  table('a finish in the round of the line with no time read voids the total', fight(), { method: 'ko', round: 2, time: null }, TD, { 'tot:o:1.5': 'void', 'tot:u:1.5': 'void', 'tot:o:2.5': 'lost', 'tot:u:0.5': 'lost' });

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
  eq('without a price fixed for the combo, the selections of one fight multiply', Core.betResult(bet(10, [leg('f1', 2), leg('f1', 1.5)]), ['won', 'won']), { status: 'won', payout: 30 });
  eq('a combo price fixed for a fight with a single selection is not used', Core.betResult(bet(10, [leg('f1', 2), leg('f2', 1.5)], { f1: 9 }), ['won', 'won']), { status: 'won', payout: 30 });

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
  // found by mutation testing (docs/verificacao.md): each of these failed to notice a planted mistake
  eq('parlay with one fight off the board: unknown, even when another one is', Core.cashout(two, [lg('post', 'won'), null], never), { ok: false, why: 'unknown' });
  const comboVoid = { status: 'open', stake: 10, sgp: { f2: 4.5 }, legs: [leg('f1', 2), Object.assign(leg('f2', 2.62), { key: 'fm:ko' }), Object.assign(leg('f2', 1.27), { key: 'tot:o:1.5' }), leg('f3', 3)] };
  eq('a same-fight combo with one void selection leaves the offer whole, even with its other selection won', Core.cashout(comboVoid, [lg('post', 'won'), lg('post', 'won'), lg('post', 'void'), lg('pre')], () => 0.5), { ok: true, kind: 'market', value: 28.5, full: 60, chance: 0.5 });
  const comboHalf = { status: 'open', stake: 10, sgp: { f2: 4.5 }, legs: [leg('f1', 2), Object.assign(leg('f2', 2.62), { key: 'fm:ko' }), Object.assign(leg('f2', 1.27), { key: 'tot:o:1.5' })] };
  eq('a same-fight combo with one selection won and the other still to be read holds the offer', Core.cashout(comboHalf, [lg('pre'), lg('post', 'won'), lg('post')], () => 0.5), { ok: false, why: 'settling' });
  eq('without a price fixed for the combo, the selections of one fight multiply', Core.cashout({ status: 'open', stake: 10, legs: [leg('f1', 2), leg('f2', 2), leg('f2', 1.5)] }, [lg('post', 'won'), lg('pre'), lg('pre')], () => 0.5), { ok: true, kind: 'market', value: 28.5, full: 60, chance: 0.5 });
  eq('a combo price fixed for a fight with a single selection is not used', Core.cashout({ status: 'open', stake: 10, sgp: { f1: 9 }, legs: [leg('f1', 2), leg('f2', 1.5)] }, [lg('post', 'won'), lg('pre')], () => 0.5), { ok: true, kind: 'market', value: 14.25, full: 30, chance: 0.5 });
  eq('an offer that rounds to less than a cent is no offer', Core.cashout(two, [lg('post', 'won'), lg('pre')], () => 1e-6), { ok: false, why: 'noprice' });
  eq('an offer of exactly one cent is still an offer', Core.cashout(two, [lg('post', 'won'), lg('pre')], () => 0.01 / 28.5).value, 0.01);

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
  // found by mutation testing (docs/verificacao.md)
  eq('parse agrees with the mask on commas after the first one', [Core.parseMoney('1,5,5'), Core.parseMoney(Core.maskMoney('1,5,5'))], [1.55, 1.55]);
  eq('parse: digits too many to be a number read as nothing', Core.parseMoney('9'.repeat(400)), 0);

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
  // found by mutation testing (docs/verificacao.md). eq compares JSON, where NaN reads as null and an undefined field
  // vanishes: the checks below that care about "no value" ask for it exactly
  eq('fx: rejects a date with something before or after it', [Core.normFx({ ...FXJ, date: 'x2026-01-02' }), Core.normFx({ ...FXJ, date: '2026-01-02T00:00' })], [null, null]);
  eq('fx: a date that is not text is no date, even one that reads as a date', Core.normFx({ ...FXJ, date: ['2026-01-02'] }), null);
  eq('fx: no rate for a currency it does not know, nor from one, nor at a rate of zero', [Core.fxRate(fx, 'BRL', 'GBP'), Core.fxRate(fx, 'GBP', 'BRL'), Core.fxRate({ rates: { BRL: 1, USD: 0 } }, 'BRL', 'USD'), Core.fxRate({ rates: { BRL: 0, USD: 0.2 } }, 'BRL', 'USD')].map(x => x === null), [true, true, true, true]);
  eq('convert: a bet with no unit, or one that is not positive, gets none made up', [Object.prototype.hasOwnProperty.call(US.bets[2], 'unit'), Core.convertState({ deposits: [], bets: [{ stake: 1, payout: 0, unit: -5 }] }, 'USD', 0.2).bets[0].unit], [false, -5]);
  eq('convert: the cent that rounding moved goes into the first of the largest deposits', Core.convertState({ deposits: [{ t: 1, v: 0.02 }, { t: 2, v: 50.02 }, { t: 3, v: 50.02 }], bets: [{ stake: 50.03, payout: 0 }, { stake: 50.03, payout: 0 }] }, 'USD', 0.2).deposits.map(d => d.v), [0.01, 10.01, 10]);
  eq('convert: with no deposit there is nowhere to put a cent, and nothing breaks', Core.convertState({ deposits: [], bets: [{ stake: 0.03, payout: 0 }] }, 'USD', 0.2), { deposits: [], bets: [{ stake: 0.01, payout: 0 }], cur: 'USD' });

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
  // found by mutation testing (docs/verificacao.md)
  eq('units field: only the zeros in front go, not one inside the number', [Core.maskUnits('105'), Core.maskUnits('1005'), Core.parseUnits('105')], ['105', '1005', 105]);
  eq('units step: an infinite or a negative value counts as zero', [Core.stepUnits(Infinity, 1), Core.stepUnits(-3, 1), Core.stepUnits(-3, -1)], [0.5, 0.5, 0]);
  const sug = Core.suggestedUnits(5, 'multi'); sug.push(9);
  eq('suggested stake: changing one suggestion does not change the next', Core.suggestedUnits(5, 'multi'), [0.2, 0.3, 0.4]);
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
  /* reading a tip: found by mutation testing (docs/verificacao.md) */
  eq('copied stake: no bankroll, no unit, exactly', Core.tipStake(MONEY, 'money', 0).units === null, true);
  const card4 = card.concat([{ id: 'f4', rounds: 3, a: { name: 'Ivo Yun', last: 'Yun' }, b: { name: 'Davi Kessler', last: 'Kessler' } }]);
  eq('tip: a surname of three letters is a name', Core.parseTip("Yun para vencer", card4).items.map(i => [i.fid, i.key]), [['f4', 'ml:a']]);
  for (const [txt, units] of [['1,25u', 1.25], ['10 unidades', 10], ['1 unit', 1]])
    eq(`tip: stake "${txt}"`, tip("Almeida x Dunne\nAlmeida para vencer\n" + txt).stake, U(units));
  for (const [txt, v] of [['R$ 1.750', 1750], ['R$ 1.234.567,8', 1234567.8], ['Aposta 5 BRL', 5], ['Aposta 1756BRL', 1756], ['Aposta 1756.50 BRL', 1756.5], ['Aposta 2,500 USD', 2500], ['Aposta 1,234,567.89 USD', 1234567.89]])
    eq(`tip: amount written as "${txt}"`, tip("Almeida x Dunne\nDunne para vencer\n" + txt).stake, { kind: 'money', money: v });
  eq('tip: an odd at the start of a line, an odd of two digits, and one read with a colon alone on its line', [tip("Almeida x Dunne\nDunne para vencer\n1.44").items[0][2], tip("Almeida x Dunne\nDunne para vencer 12.50").items[0][2], tip("Almeida x Dunne\nDunne para vencer\n1:44").items[0][2]], [1.44, 12.5, 1.44]);
  eq('tip: the distance with no article, and "go the distance"', [tip("Almeida x Dunne\nLuta nao vai ate decisao").items, tip("Almeida x Dunne\nFight to go the distance").items], [one('f3', 'dist:no', null), one('f3', 'dist:yes', null)]);
  eq('tip: a method at the very end of the text', tip("Almeida x Dunne\nAlmeida por KO").items, one('f3', 'mov:a:ko', null));
  eq('tip: the round written as "2º round", "2 round" or "round3"', [tip("Almeida x Dunne\nLuta acaba no 2º round").items, tip("Almeida x Dunne\nLuta acaba no 2 round").items, tip("Almeida x Dunne\nLuta acaba no round3").items], [one('f3', 'rnd:2', null), one('f3', 'rnd:2', null), one('f3', 'rnd:3', null)]);
  eq('tip: the first round and the last round of the fight are rounds', [tip("Dunne vence no round 1 (Almeida x Dunne)").items, tip("Teles vence no round 3 (Teles x Prado Jr.)").items, tip("Almeida x Dunne\nLuta acaba no round 5").items], [one('f3', 'wr:b:1', null), one('f1', 'wr:a:3', null), one('f3', 'rnd:5', null)]);
  eq('tip: "vence" and "simples" at the very end of the text', [tip("Almeida x Dunne\nDunne vence").items, Core.parseTip("Almeida x Dunne\nDunne para vencer\nAposta simples", card).kind], [one('f3', 'ml:b', null), 'single']);
  eq('tip: "Eventos: 10" is a multiple of ten, and "evento: 2" of two', [Core.parseTip("Eventos: 10\nAlmeida x Dunne\nDunne para vencer", card).legs, Core.parseTip("Evento: 2\nAlmeida x Dunne\nDunne para vencer", card).legs], [10, 2]);
  eq('complete: a printed odd of 1 or less is no printed odd', [Core.completeTip(ACCA, [{ fid: 'f2', key: 'ml:a', printedOdd: 1 }]).items[1].printedOdd, Core.completeTip(ACCA, [{ fid: 'f2', key: 'ml:a', printedOdd: 0.5 }]).items[1].printedOdd], [null, null]);

  /* the odd of the original, kept with the bet: what was printed against what was taken */
  const pleg = (fid, odd, printed) => ({ fid, key: 'ml:a', odd, printed });
  eq('printed odd: an odd of 1 printed for the whole bet, or for a selection, is no printed odd; nor an odd of 1 taken', [Core.printedEdge({ type: 'single', odd: 2, printed: 1, legs: [pleg('f1', 2, 1.9)] }).printed, Core.printedEdge({ type: 'multi', odd: 2, legs: [pleg('f1', 1, 1), pleg('f2', 2, 2)] }), Core.printedEdge({ type: 'single', odd: 1, legs: [pleg('f1', 1, 1.9)] })], [1.9, null, null]);
  eq('printed odd: a bet taken at exactly the printed odd is not ahead', Core.edgeSummary([{ type: 'single', odd: 2, legs: [pleg('f1', 2, 2)] }]), { n: 1, avg: 0, ahead: 0 });
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
  /* history: found by mutation testing (docs/verificacao.md) */
  eq('history: the other side of the same fight is not the same single', ids(Core.dupBets(book, [{ fid: 'f3', key: 'ml:b' }], 'single')), []);
  eq('history: a combo on one fight is held there as its selections joined', Core.exposure([hb('c1', 'multi', 'open', 10, 0, [hl('f1', 'ml:a'), hl('f1', 'fm:ko')])], 'f1').held[0].sel, 'sel ml:a + sel fm:ko');
  eq('history: a unit that is not positive does not count in units', [(t => [t.unitBets, t.units])(Core.openTotals([hb('nu', 'single', 'open', 10, 0, [hl('f1', 'ml:a')], { unit: -10 })])), (r => [r.unitBets, r.units])(Core.byOrigin([hb('nu', 'single', 'won', 10, 20, [hl('f1', 'ml:a')], { unit: -10 })])[0])], [[0, 0], [0, 0]]);
  const sameHour = [hb('t3', 'single', 'open', 1, 0, [ol('f1', 'e1', 100)], { t: 3 }), hb('t1', 'single', 'open', 1, 0, [ol('f1', 'e1', 100)], { t: 1 }), hb('t2', 'single', 'open', 1, 0, [ol('f1', 'e1', 100)], { t: 2 }), hb('t4', 'single', 'open', 1, 0, [ol('f1', 'e1', 100)], { t: 4 })];
  eq('open bets: bets on the same fight go in the order they were made', ids(Core.openByEvent(sameHour)[0].bets), ['t1', 't2', 't3', 't4']);
  eq('open bets: a multiple starts at its first fight on the card, even among fights of the same hour', ids(Core.openByEvent([hb('sB', 'single', 'open', 1, 0, [ol('f2', 'e1', 100)], { t: 1 }), hb('mAB', 'multi', 'open', 1, 0, [ol('f2', 'e1', 100), ol('f1', 'e1', 100)], { t: 2 }), hb('sC', 'single', 'open', 1, 0, [ol('f3', 'e1', 100)], { t: 0 })], fid => ({ f1: 0, f2: 1, f3: 2 })[fid])[0].bets), ['mAB', 'sB', 'sC']);
  eq('odd drop: no comparison while any selection has no price now, or a price of 1', [Core.copyDrop(null, [{ fid: 'f1', printed: 2, now: 1.9 }, { fid: 'f2', printed: 2, now: 0 }]), Core.copyDrop(null, [{ fid: 'f1', printed: 2, now: 1 }])].map(x => x === null), [true, true]);
  eq('odd drop: an odd of 1 or less for the whole bet is no odd to compare with', [Core.copyDrop(1, [{ fid: 'f1', printed: 2, now: 1.9 }]), Core.copyDrop(0.5, [{ fid: 'f1', printed: 2, now: 1.9 }])], [-0.05, -0.05]);
  eq('odd drop: a printed odd of 1 is no printed odd', [Core.copyDrop(null, [{ fid: 'f1', printed: 1, now: 1.5 }, { fid: 'f2', printed: 2, now: 1.9 }]), Core.copyDrop(null, [{ fid: 'f1', printed: 1, now: 1.2 }, { fid: 'f1', printed: 2, now: 2.5 }])], [-0.05, 0.25]);
  eq('odd drop: a selection with nothing printed is left out of the one that fell the most', Core.copyDrop(null, [{ fid: 'f1', printed: null, now: 2 }, { fid: 'f1', printed: 2, now: 1.9 }]), -0.05);
  eq('tip: one printed odd among the selections is enough to tell a copy', Core.isTip(hb('pp', 'multi', 'won', 1, 2, [hl('f1', 'ml:a', { printed: 2 }), hl('f2', 'ml:a')])), true);
  eq('origin: a tipster named "M" is not the person\'s own bets', Core.byOrigin([hb('o1', 'single', 'won', 10, 20, [hl('f1', 'ml:a')]), hb('o2', 'single', 'lost', 10, 0, [hl('f2', 'ml:a')], { from: 'M' })]).map(r => [r.k, r.tip, r.n]), [['', false, 1], ['M', true, 1]]);
  eq('origin: the odd against the print of each row is of its own bets only', (rs => rs.map(r => [r.tip, r.k, r.edge.n]))(Core.byOrigin([hb('o1', 'single', 'won', 20, 40, [hl('f1', 'ml:a')]), hb('o2', 'single', 'lost', 10, 0, [hl('f2', 'ml:a', { printed: 2.1 })])])), [[false, '', 0], [true, '', 1]]);
  eq('origin: no new name given is no rename', [Core.renameOrigin(closed, 'Canal A', null).n, Core.renameOrigin(closed, 'Canal A', undefined).n], [0, 0]);
  eq('period: only text names a period', ids(Core.periodBets(past, ['7d'], NOW).bets).length, 4);
  eq('period: a bet closed exactly 7 days ago is out of the last 7 days', ids(Core.periodBets([hb('edge', 'single', 'won', 1, 2, [hl('f1', 'ml:a')], { settledAt: NOW - 7 * DAYMS })], '7d', NOW).bets), []);
  eq('period: the last event is the one of the bet that closed last, wherever it is in the list, and a bet with no time of closing is the oldest', [Core.periodBets([past[2], past[0], past[1], past[3]], 'event', NOW).event, Core.periodBets([past[1], hb('nt', 'single', 'won', 1, 2, [hl('f9', 'ml:a', { eid: 'e9', event: 'UFC 9', date: 99 * DAYMS })], { settledAt: null })], 'event', NOW).event, Core.periodBets([hb('nt', 'single', 'won', 1, 2, [hl('f9', 'ml:a', { eid: 'e9', event: 'UFC 9', date: 99 * DAYMS })], { settledAt: null }), past[1]], 'event', NOW).event], ['UFC 3: Brandt vs. Kessler', 'UFC 2: Teles vs. Prado', 'UFC 2: Teles vs. Prado']);
  const inOrder = [hb('io', 'multi', 'won', 1, 2, [hl('f2', 'ml:b', { date: 90 * DAYMS }), hl('f5', 'ml:a', { date: 97 * DAYMS })], { settledAt: 98 * DAYMS })]; Core.periodBets(inOrder, 'event', NOW);
  eq('period: reading the last event leaves the selections of a bet in their order', inOrder[0].legs.map(l => l.fid), ['f2', 'f5']);
  eq('statement: a bet with no selection is in no row of the events, and the rows of time have no event', [Core.statement([hb('nl', 'single', 'won', 1, 2, [], { settledAt: 99 * DAYMS })], NOW).events, stm.spans.map(r => r.event)], [[], ['', '', '', '']]);
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
  /* the calls to the source, counted: by day and by kind, how long they took, how much came back, which failed */
  const T0 = Date.UTC(2026, 9, 11, 15, 0, 0), ucall = (kind, ms, bytes, ok = true, t = T0, day = '2026-10-11') => ({ t, day, kind, ms, bytes, ok });
  const ulog = cs => cs.reduce((l, c) => Core.usageAdd(l, c), Core.usageEmpty());
  const u1 = ulog([ucall('board', 120, 4000), ucall('board', 80, 5000), ucall('board', 300, 0, false), ucall('odds', 50, 700)]);
  eq('usage: calls of a kind add up on their day: how many, how many failed, the time, the size and the slowest', u1.days['2026-10-11'].k, { board: { n: 3, err: 1, ms: 500, bytes: 9000, max: 300 }, odds: { n: 1, err: 0, ms: 50, bytes: 700, max: 50 } });
  eq('usage: a time or a size that is not a number counts the call and adds nothing', ulog([ucall('td', NaN, -5), ucall('td', -3, undefined)]).days['2026-10-11'].k.td, { n: 2, err: 0, ms: 0, bytes: 0, max: 0 });
  const MINU = 60e3, u2 = ulog([ucall('odds', 1, 1, true, T0), ucall('odds', 1, 1, true, T0 + 59e3), ucall('odds', 1, 1, true, T0 + 59.9e3), ucall('odds', 1, 1, true, T0 + MINU), ucall('odds', 1, 1, true, T0 + MINU + 1)]);
  eq('usage: the peak is the most calls within one minute of the clock', [u2.days['2026-10-11'].peak, u1.days['2026-10-11'].peak, u2.min], [3, 4, { m: (T0 + MINU) / MINU, n: 2 }]);
  const uday = i => '2026-' + String(8 + Math.floor(i / 28)).padStart(2, '0') + '-' + String(1 + (i % 28)).padStart(2, '0');
  const u3 = ulog(Array.from({ length: 33 }, (_, i) => ucall('board', 10, 100, true, T0 + i * MINU, uday(i))));
  eq('usage: only the latest thirty days are kept', [Object.keys(u3.days).length, Object.keys(u3.days).sort()[0], Object.keys(u3.days).sort().pop(), Core.USAGE_DAYS], [30, uday(3), uday(32), 30]);
  const u4 = ulog([ucall('board', 100, 1000, true, T0, '2026-10-09'), ucall('form', 40, 300, false, T0 + 5 * MINU, '2026-10-10'), ucall('form', 60, 500, true, T0 + 5 * MINU, '2026-10-10'), ucall('result', 20, 200, true, T0 + 9 * MINU, '2026-10-11')]);
  const su = (from) => { const x = Core.usageSum(u4, from); return [x.total, x.peak, x.days, Object.fromEntries(Object.entries(x.k).filter(([, c]) => c.n).map(([k, c]) => [k, c.n]))]; };
  eq('usage: the sum from a day on, by kind and in all', [su('2026-10-10'), su('2026-10-11'), su('2026-10-12')], [[{ n: 3, err: 1, ms: 120, bytes: 1000, max: 60 }, 2, 2, { result: 1, form: 2 }], [{ n: 1, err: 0, ms: 20, bytes: 200, max: 20 }, 1, 1, { result: 1 }], [{ n: 0, err: 0, ms: 0, bytes: 0, max: 0 }, 0, 0, {}]]);
  eq('usage: the sum of everything, with every kind there even when it has no call', [su('')[0], Object.keys(Core.usageSum(u4, '').k), Core.USAGE_KINDS], [{ n: 4, err: 1, ms: 220, bytes: 2000, max: 100 }, ['board', 'odds', 'result', 'td', 'astats', 'form'], ['board', 'odds', 'result', 'td', 'astats', 'form']]);
  eq('usage: a log read back from storage is the same log', Core.usageRead(JSON.parse(JSON.stringify({ v: 1, days: u4.days }))).days, u4.days);
  eq('usage: what is not a log reads as an empty one', [Core.usageRead(null), Core.usageRead('x'), Core.usageRead({ days: 7 }), Core.usageRead({ days: { 'not a day': { peak: 1, k: {} }, '2026-10-11': 3 } })].map(l => l.days), [{}, {}, {}, {}]);
  eq('usage: what is damaged in a saved log is dropped, and the rest stands', Core.usageRead({ days: { '2026-10-11': { peak: 'many', k: { board: { n: 2, err: -1, ms: '9', bytes: 10, max: null }, made_up: { n: 5 }, odds: { n: 0, ms: 4 }, td: 'x' } } } }).days, { '2026-10-11': { peak: 0, k: { board: { n: 2, err: 0, ms: 0, bytes: 10, max: 0 } } } });
  eq('usage: a saved log longer than what is kept is cut to the latest days', Object.keys(Core.usageRead({ days: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [uday(i), { peak: 1, k: { board: { n: 1 } } }])) }).days).length, 30);
  /* the same counts hour by hour, of the latest days, and the hours read back in the order asked */
  const hcall = (kind, hour, bytes, ok = true, t = T0, day = '2026-10-11') => ({ t, day, hour, kind, ms: 10, bytes, ok });
  const uh = ulog([hcall('board', 21, 1000), hcall('td', 21, 200), hcall('td', 21, 300, false), hcall('board', 22, 1000, true, T0 + 61 * MINU), hcall('odds', 0, 50, true, T0 + 200 * MINU, '2026-10-12')]);
  eq('usage hours: the calls of an hour, the ones that failed, the size, the peak within a minute and the calls of each kind', uh.days['2026-10-11'].h, { 21: { n: 3, err: 1, bytes: 1500, peak: 3, k: { board: 1, td: 2 } }, 22: { n: 1, err: 0, bytes: 1000, peak: 1, k: { board: 1 } } });
  eq('usage hours: the day keeps its own counts as before', [uh.days['2026-10-11'].k.td, uh.days['2026-10-11'].peak], [{ n: 2, err: 1, ms: 20, bytes: 500, max: 10 }, 3]);
  eq('usage hours: read back in the order asked, across midnight, leaving out the hours with no call', Core.usageHours(uh, [{ day: '2026-10-12', hour: 0 }, { day: '2026-10-11', hour: 23 }, { day: '2026-10-11', hour: 22 }, { day: '2026-10-11', hour: 21 }, { day: '2026-10-10', hour: 21 }]).map(x => [x.day, x.hour, x.n]), [['2026-10-12', 0, 1], ['2026-10-11', 22, 1], ['2026-10-11', 21, 3]]);
  eq('usage hours: an hour that is not one counts the call on its day and in no hour', [ulog([hcall('board', 24, 1), hcall('board', -1, 1), hcall('board', 1.5, 1), hcall('board', undefined, 1)]).days['2026-10-11'].h, ulog([hcall('board', 24, 1)]).days['2026-10-11'].k.board.n], [undefined, 1]);
  const u7 = ulog(Array.from({ length: 10 }, (_, i) => hcall('board', 9, 100, true, T0 + i * MINU, uday(i))));
  eq('usage hours: only the latest seven days keep their hours; the older ones keep the day', [Object.keys(u7.days).filter(d => u7.days[d].h).sort(), Object.keys(u7.days).length, Core.USAGE_HOURLY], [Array.from({ length: 7 }, (_, i) => uday(i + 3)), 10, 7]);
  eq('usage hours: saved and read back they are the same, and what is damaged in them is dropped', [Core.usageRead(JSON.parse(JSON.stringify({ days: uh.days }))).days, Core.usageRead({ days: { '2026-10-11': { peak: 1, k: { board: { n: 1 } }, h: { 21: { n: 2, err: 'x', bytes: 5, peak: -1, k: { board: 2, made_up: 9, td: 0 } }, 24: { n: 1 }, '07': { n: 1 }, 5: { n: 0 }, 6: 'x' } } } }).days['2026-10-11'].h], [uh.days, { 21: { n: 2, err: 0, bytes: 5, peak: 0, k: { board: 2 } } }]);
  /* the pace after a round that failed: the wait doubles, up to five minutes, and never goes under the pace of the moment */
  // the short board and the room left for background reading (D105)
  const mbOld = [{ id: 'a', date: 10, v: 1 }, { id: 'b', date: 20, v: 1 }, { id: 'c', date: 30, v: 1 }];
  eq('short board: what came replaces the same event, the rest stays, in date order', Core.mergeBoard(mbOld, [{ id: 'b', date: 20, v: 2 }, { id: 'n', date: 15, v: 2 }]).map(e => e.id + e.v), ['a1', 'n2', 'b2', 'c1']);
  eq('short board: nothing came, nothing is lost; nothing was kept, what came is all there is', [Core.mergeBoard(mbOld, []).map(e => e.id), Core.mergeBoard([], [{ id: 'x', date: 1 }]).map(e => e.id)], [['a', 'b', 'c'], ['x']]);
  const rmNow = 1e6, rmTimes = Array.from({ length: 60 }, (_, i) => rmNow - 59000 + i * 1000);
  eq('room: under the cap there is room now; at the cap, the wait lasts until the oldest call of the minute leaves it', [Core.roomIn(rmTimes.slice(1), rmNow), Core.roomIn(rmTimes, rmNow), Core.roomIn(rmTimes, rmNow + 500), Core.roomIn(rmTimes, rmNow + 1000)], [0, 1000, 500, 0]);
  eq('room: calls older than a minute do not count, the order they come in does not matter, and the cap is 60 a minute', [Core.roomIn(rmTimes.map(t => t - 60000), rmNow), Core.roomIn([...rmTimes].reverse(), rmNow), Core.BG_CAP, Core.BG_WINDOW], [0, 1000, 60, 60000]);
  eq('retry: no failure, the pace of the moment', [Core.retryDelay(8e3, 0), Core.retryDelay(120e3, 0), Core.retryDelay(15e3, -2), Core.retryDelay(15e3, NaN), Core.retryDelay(15e3, undefined)], [8e3, 120e3, 15e3, 15e3, 15e3]);
  eq('retry: each failure in a row doubles the wait, up to five minutes', [1, 2, 3, 4, 5, 6, 7, 50].map(n => Core.retryDelay(8e3, n)), [16e3, 32e3, 64e3, 128e3, 256e3, 300e3, 300e3, 300e3]);
  eq('retry: from the slow pace too, and the longest wait is five minutes', [Core.retryDelay(30e3, 1), Core.retryDelay(30e3, 3), Core.retryDelay(120e3, 1), Core.retryDelay(120e3, 2), Core.RETRY_MAX], [60e3, 240e3, 240e3, 300e3, 300e3]);
  eq('retry: a pace slower than the longest wait is kept as it is', [Core.retryDelay(600e3, 3), Core.retryDelay(8e3, 2.9)], [600e3, 32e3]);
  /* keeping two devices in step: the marks put on each save, and the join of two copies */
  const syb = (id, t, extra) => ({ id, t, type: 'single', stake: 10, odd: 2, legs: [], status: 'open', payout: 0, settledAt: null, ...extra });
  const sys = (bets, deposits, extra) => ({ v: 1, deposits: deposits || [], bets: bets || [], ...extra });
  const SY0 = sys([syb('a', 100), syb('b', 200, { status: 'won', payout: 20, settledAt: 300 })], [{ t: 50, v: 1000 }], { unitPct: 10 });
  const sy1 = Core.stamp(null, SY0, 999);
  eq('stamp: on the first save a bet with no mark gets the time it was settled or placed, and nothing else is marked', [sy1.bets.map(b => b.u), sy1.epoch, sy1.setAt], [[100, 300], undefined, undefined]);
  const sy2s = { ...sy1, bets: [{ ...sy1.bets[0], status: 'lost', settledAt: 400 }, sy1.bets[1], syb('c', 500)] };
  const sy2 = Core.stamp(sy1, sy2s, 1000);
  eq('stamp: a bet that changed and a new bet are marked now; one that did not change keeps its mark', sy2.bets.map(b => [b.id, b.u]), [['a', 1000], ['b', 300], ['c', 1000]]);
  eq('stamp: placing and settling bets is not a rewrite, and no setting changed', [sy2.epoch, sy2.setAt], [undefined, undefined]);
  eq('stamp: a renamed tipster is a change of the bet', Core.stamp(sy2, { ...sy2, bets: sy2.bets.map(b => b.id === 'b' ? { ...b, from: 'Zé' } : b) }, 1100).bets.find(b => b.id === 'b').u, 1100);
  eq('stamp: a setting changed marks the settings', [Core.stamp(sy2, { ...sy2, unitPct: 5 }, 1200).setAt, Core.stamp(sy2, { ...sy2, theme: 'dark' }, 1300).setAt, Core.stamp(sy2, { ...sy2, seen: 5 }, 1400).setAt], [1200, 1300, undefined]);
  eq('stamp: a reset, a restore that drops bets, a deposit gone and a change of currency are rewrites', [Core.stamp(sy2, { ...sy2, bets: [], deposits: [] }, 2000).epoch, Core.stamp(sy2, { ...sy2, bets: sy2.bets.slice(1) }, 2100).epoch, Core.stamp(sy2, { ...sy2, deposits: [] }, 2200).epoch, Core.stamp(sy2, { ...sy2, cur: 'USD' }, 2300).epoch, Core.stamp(sy2, { ...sy2, cur: 'BRL' }, 2400).epoch], [2000, 2100, 2200, 2300, undefined]);
  // the join
  const syPh = sys([syb('a', 100, { u: 100 }), syb('p', 600, { u: 600 })], [{ t: 50, v: 1000 }, { t: 610, v: 200 }], { unitPct: 10, setAt: 0, seen: 700 });
  const syPc = sys([syb('a', 100, { status: 'won', payout: 20, settledAt: 800, u: 800 }), syb('q', 650, { u: 650 })], [{ t: 50, v: 1000 }], { unitPct: 5, setAt: 900, seen: 650, theme: 'dark' });
  const syJ1 = Core.mergeStates(syPh, syPc), syJ2 = Core.mergeStates(syPc, syPh);
  eq('join: bets and deposits are a union by id, the same bet keeps its later change', [syJ1.state.bets.map(b => [b.id, b.status]), syJ1.state.deposits, syJ1.dropped], [[['a', 'won'], ['p', 'open'], ['q', 'open']], [{ t: 50, v: 1000 }, { t: 610, v: 200 }], 0]);
  eq('join: the later settings, and the latest "seen"', [syJ1.state.unitPct, syJ1.state.theme, syJ1.state.setAt, syJ1.state.seen], [5, 'dark', 900, 700]);
  eq('join: the same whichever device joins', Core.sameState(syJ1.state, syJ2.state), true);
  eq('join: joining again changes nothing', [Core.sameState(Core.mergeStates(syJ1.state, syPc).state, syJ1.state), Core.sameState(Core.mergeStates(syJ1.state, syJ1.state).state, syJ1.state)], [true, true]);
  eq('join: with no marks, the bet that is further along is kept', Core.mergeStates(sys([syb('x', 1)]), sys([syb('x', 1, { status: 'lost', settledAt: 5 })])).state.bets[0].status, 'lost');
  // a reset on one device does not come back from the other
  const syReset = sys([syb('n', 3000, { u: 3000 })], [{ t: 2900, v: 500 }], { epoch: 2800 });
  const syOld = sys([syb('a', 100, { u: 100 }), syb('late', 3100, { u: 3100 })], [{ t: 50, v: 1000 }, { t: 3050, v: 70 }]);
  const syJ3 = Core.mergeStates(syOld, syReset);
  eq('join: after a rewrite on one side, what the other made before it is left out, and what it made after it is kept', [syJ3.state.bets.map(b => b.id), syJ3.state.deposits.map(d => d.v), syJ3.state.epoch, syJ3.dropped], [['n', 'late'], [500, 70], 2800, 2]);
  eq('join: in either order', Core.sameState(Core.mergeStates(syReset, syOld).state, syJ3.state), true);
  eq('join: after a change of currency, nothing from the other side in the old currency is mixed in', Core.mergeStates(syOld, { ...syReset, cur: 'USD' }).state.bets.map(b => b.id), ['n']);
  // what the review of PR #35 found, each as it was found
  const syServer = sys([syb('a', 100, { u: 100 }), syb('b', 200, { u: 200 })], [{ t: 50, v: 1000 }], { epoch: 0 });
  const syWiped = sys([], [], { epoch: 9000 });
  eq('first meeting: a device that was reset, with nothing on it, takes the server history and does not wipe it', [Core.firstMeet(syWiped, syServer).how, Core.firstMeet(syWiped, syServer).canJoin], ['adopt', true]);
  eq('first meeting: nothing on the server yet, this device goes up', [Core.firstMeet(syServer, null).how, Core.firstMeet(syServer, sys([], [])).how], ['push', 'push']);
  eq('first meeting: one side holds all the other has, in the same currency, so they are summed without asking', [Core.firstMeet(sys([syb('a', 100)], [{ t: 50, v: 1000 }], { epoch: 9000 }), syServer).how, Core.firstMeet(syServer, sys([syb('a', 100)])).how], ['union', 'union']);
  eq('first meeting: each with something of its own, the person is asked; summing is offered only in the same currency', [Core.firstMeet(sys([syb('z', 300)]), syServer), Core.firstMeet(sys([syb('z', 300)], [], { cur: 'USD' }), syServer)], [{ how: 'ask', canJoin: true }, { how: 'ask', canJoin: false }]);
  const syBoth = Core.joinBoth(sys([syb('z', 300, { u: 300 })], [{ t: 20, v: 5 }], { epoch: 9000 }), syServer);
  eq('"Juntar os dois" sums both, even when one side had a rewrite', [syBoth.state.bets.map(b => b.id), syBoth.state.deposits.map(d => d.v), syBoth.dropped], [['a', 'b', 'z'], [5, 1000], 0]);
  const syUsd = sys([syb('u1', 10, { u: 10 })], [{ t: 5, v: 200 }], { cur: 'USD' }), syBrl = sys([syb('r1', 20, { u: 20 })], [{ t: 6, v: 1000 }], { cur: 'BRL' });
  const syCur1 = Core.mergeStates(syUsd, syBrl), syCur2 = Core.mergeStates(syBrl, syUsd);
  eq('two currencies with no rewrite are never summed: the later activity is kept whole, the same in both orders', [syCur1.state.cur, syCur1.state.deposits.map(d => d.v), syCur1.dropped, Core.sameState(syCur1.state, syCur2.state)], ['BRL', [1000], 2, true]);
  const syCashed = syb('c', 100, { status: 'cashed', payout: 15, settledAt: 500, u: 500 }), syRenamed = syb('c', 100, { from: 'Zé', u: 900 });
  eq('a bet closed on one device is not opened again by a later change to the old open copy, in either order', [Core.mergeStates(sys([syCashed]), sys([syRenamed])).state.bets[0].status, Core.mergeStates(sys([syRenamed]), sys([syCashed])).state.bets[0].status], ['cashed', 'cashed']);
  eq('two copies that differ only in the order of their keys are the same, so nothing is sent again', [Core.sameState({ v: 1, cur: 'BRL', deposits: [], bets: [syb('a', 1, { u: 1 })] }, { bets: [{ ...syb('a', 1), u: 1, payout: 0 }], deposits: [], cur: 'BRL', v: 1 }), Core.sameState(sys([syb('a', 1)]), sys([syb('a', 2)]))], [true, false]);
  eq('a rewrite is never behind the one already known, even with the clock of the device running late', Core.stamp(sys([syb('a', 1)], [], { epoch: 5000 }), sys([], [], { epoch: 5000 }), 2000).epoch, 5001);
  eq('join: the conversions of the side that wins a rewrite; a union otherwise', [Core.mergeStates(sys([], [], { conv: [{ t: 1 }] }), sys([], [], { conv: [{ t: 2 }] })).state.conv.map(c => c.t), Core.mergeStates(sys([], [], { conv: [{ t: 1 }] }), sys([], [], { epoch: 5, conv: [{ t: 2 }] })).state.conv.map(c => c.t)], [[1, 2], [2]]);
  eq('state size: what each side holds', Core.stateSize(syPh), { bets: 2, deposits: 2 });
  eq('retry: an infinite number of failures is no number', Core.retryDelay(8e3, Infinity), 8e3);
  eq('cloud: the project that ships is a whole one', Core.cloudSet(Core.CLOUD_URL, Core.CLOUD_KEY), true);
  eq('cloud: nothing before or after the address or the key', [Core.cloudSet('xhttps://abcdefghijkl.supabase.co', 'sb_publishable_abcdefghij'), Core.cloudSet('https://abcdefghijkl.supabase.co.evil.com', 'sb_publishable_abcdefghij'), Core.cloudSet('https://abcdefghijkl.supabase.co', 'xsb_publishable_abcdefghij'), Core.cloudSet('https://abcdefghijkl.supabase.co', 'sb_publishable_abcdefghij!')], [false, false, false, false]);
  eq('cloud: a key that only contains the new prefix is an old-format one', Core.cloudHeaders('xsb_publishable_abc', null).Authorization, 'Bearer xsb_publishable_abc');
  eq('cloud: an e-mail with a longer domain, and nothing after it', [Core.isEmail('ana@exemplo.com'), Core.isEmail('ana@x.com y')], [true, false]);
  /* the join: found by mutation testing (docs/verificacao.md) */
  const pick2 = (x, y) => [Core.mergeStates(sys([x]), sys([y])).state.bets[0], Core.mergeStates(sys([y]), sys([x])).state.bets[0]];
  eq('join: of two open copies of a bet, the one changed later, in either order', pick2(syb('o', 1, { u: 50, stake: 10 }), syb('o', 1, { u: 70, stake: 20 })).map(b => b.stake), [20, 20]);
  eq('join: of two closed copies of a bet, the one changed later, in either order', pick2(syb('o', 1, { status: 'won', payout: 20, settledAt: 90, u: 90 }), syb('o', 1, { status: 'won', payout: 25, settledAt: 80, u: 95 })).map(b => b.payout), [25, 25]);
  eq('join: a copy with no mark is older than one with a mark', pick2(syb('o', 1, { stake: 10 }), syb('o', 1, { u: 5, stake: 20 })).map(b => b.stake), [20, 20]);
  eq('join: two closed copies with no marks, the one settled later, in either order; no time of settling is the oldest', [pick2(syb('o', 1, { status: 'won', payout: 20, settledAt: 90 }), syb('o', 1, { status: 'won', payout: 25, settledAt: 95 })).map(b => b.payout), pick2(syb('o', 1, { status: 'won', payout: 20 }), syb('o', 1, { status: 'won', payout: 25, settledAt: 95 })).map(b => b.payout)], [[25, 25], [25, 25]]);
  const dep = { t: 10000, v: 1 };       // a later deposit makes the side with the older copy of the bet the one that wins the join
  eq('join: the copy changed later is kept even from the side with the older activity', [Core.mergeStates(sys([syb('o', 1, { u: 50, stake: 10 })], [dep]), sys([syb('o', 1, { u: 70, stake: 20 })])).state.bets[0].stake, Core.mergeStates(sys([syb('o', 1, { u: 70, stake: 20 })]), sys([syb('o', 1, { u: 50, stake: 10 })], [dep])).state.bets[0].stake], [20, 20]);
  eq('join: with no marks, the copy settled later is kept even from the side with the older activity', [Core.mergeStates(sys([syb('o', 1, { status: 'won', payout: 20, settledAt: 90 })], [dep]), sys([syb('o', 1, { status: 'won', payout: 25, settledAt: 95 })])).state.bets[0].payout, Core.mergeStates(sys([syb('o', 1, { status: 'won', payout: 25, settledAt: 95 })]), sys([syb('o', 1, { status: 'won', payout: 20 })], [dep])).state.bets[0].payout], [25, 25]);
  eq('join: on an exact tie of marks, the copy of this device is kept', [Core.mergeStates(sys([syb('o', 1, { u: 5, stake: 10 })]), sys([syb('o', 1, { u: 5, stake: 20 })])).state.bets[0].stake, Core.mergeStates(sys([syb('o', 1, { stake: 10 })]), sys([syb('o', 1, { stake: 20 })])).state.bets[0].stake], [10, 10]);
  const curWin = (x, y) => [Core.mergeStates(x, y).state.cur || 'BRL', Core.mergeStates(y, x).state.cur || 'BRL'];
  eq('two currencies with the same last activity: the same one is kept in either order, also when one never named its currency', [curWin(sys([syb('a', 10, { u: 10 })], [], { cur: 'EUR' }), sys([syb('b', 10, { u: 10 })], [], { cur: 'USD' })), curWin(sys([syb('a', 10, { u: 10 })]), sys([syb('b', 10, { u: 10 })], [], { cur: 'USD' }))], [['USD', 'USD'], ['USD', 'USD']]);
  const lastBy = (lhs, rhs) => curWin(sys(lhs[0], lhs[1], { ...lhs[2], cur: 'USD' }), sys(rhs[0], rhs[1], { ...rhs[2], cur: 'EUR' }));
  eq('two currencies: the later activity is a bet settled, a bet placed, a deposit or a conversion, even with no marks', [lastBy([[syb('a', 1, { status: 'won', payout: 1, settledAt: 50 })]], [[syb('b', 40)]]), lastBy([[syb('a', 60)]], [[syb('b', 40, { status: 'won', payout: 1, settledAt: 50 })]]), lastBy([[], [{ t: 70, v: 1 }]], [[syb('b', 40)]]), lastBy([[], [], { conv: [{ t: 80 }] }], [[], [{ t: 75, v: 1 }]])], [['USD', 'USD'], ['USD', 'USD'], ['USD', 'USD'], ['USD', 'USD']]);
  const lastBy2 = (lhs, rhs) => curWin(sys(lhs[0], lhs[1], { cur: 'USD' }), sys(rhs[0], rhs[1], { cur: 'EUR' }));
  eq('two currencies: the later activity by the bets, the other way round', [lastBy2([[syb('a', 40)]], [[syb('b', 1, { status: 'won', payout: 1, settledAt: 50 })]]), lastBy2([[syb('a', 40, { status: 'won', payout: 1, settledAt: 50 })]], [[syb('b', 60)]])], [['EUR', 'EUR'], ['EUR', 'EUR']]);
  eq('join: after a rewrite, what the other side made at the very moment of the rewrite is from before it', Core.mergeStates(sys([syb('x', 2800, { u: 2800 })]), syReset).state.bets.map(b => b.id), ['n']);
  eq('join: after a rewrite, a deposit both sides have is kept once and not counted as left out', (j => [j.state.deposits.map(d => d.v), j.dropped])(Core.mergeStates(sys([], [{ t: 50, v: 1000 }]), sys([], [{ t: 50, v: 1000 }], { epoch: 2800 }))), [[1000], 0]);
  eq('join: conversions of one side only, and none on the side that wins a rewrite', [Core.mergeStates(sys([], [], { conv: [{ t: 1 }] }), sys([], [])).state.conv, Core.mergeStates(sys([], []), sys([], [], { conv: [{ t: 1 }] })).state.conv, Object.prototype.hasOwnProperty.call(Core.mergeStates(sys([], [], { conv: [{ t: 1 }] }), sys([], [], { epoch: 5 })).state, 'conv')], [[{ t: 1 }], [{ t: 1 }], false]);
  eq('join: conversions in order of time, the latest 20', (c => [c.length, c[0].t, c[19].t])(Core.mergeStates(sys([], [], { conv: [5, 1, 9, 3, 7, 11, 13, 15, 17, 19, 21, 23, 25].map(t => ({ t })) }), sys([], [], { conv: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24].map(t => ({ t })) })).state.conv), [20, 6, 25]);
  eq('join: deposits and bets in order of time', (s => [s.deposits.map(d => d.t), s.bets.map(b => b.id)])(Core.mergeStates(sys([syb('c', 30), syb('a', 10)], [{ t: 30, v: 1 }, { t: 10, v: 1 }]), sys([syb('b', 20)], [{ t: 20, v: 1 }])).state), [[10, 20, 30], ['a', 'b', 'c']]);
  const setFrom = (l, r) => Core.mergeStates(sys([], [], l), sys([], [], r)).state.unitPct;
  eq('join: the settings changed later; on a tie, and with no mark on either side, those of this device', [setFrom({ unitPct: 1 }, { unitPct: 2, setAt: 5 }), setFrom({ unitPct: 1, setAt: 5 }, { unitPct: 2 }), setFrom({ unitPct: 1, setAt: 5 }, { unitPct: 2, setAt: 5 }), setFrom({ unitPct: 1 }, { unitPct: 2 })], [2, 1, 1, 1]);
  eq('join: no mark of settings, and no setting neither side has, is made up', Object.keys(Core.mergeStates(sys([], []), sys([], [])).state).sort(), ['bets', 'deposits', 'v']);
  eq('stamp: a bet saved with no mark keeps the time it was settled as its mark while it does not change', Core.stamp(sys([syb('s', 10, { status: 'won', payout: 20, settledAt: 40 })]), sys([syb('s', 10, { status: 'won', payout: 20, settledAt: 40 })]), 99).bets[0].u, 40);
  eq('stamp: one deposit gone of two is a rewrite', Core.stamp(sys([], [{ t: 1, v: 5 }, { t: 2, v: 7 }]), sys([], [{ t: 1, v: 5 }]), 300).epoch, 300);
  eq('first meeting: going up or summing can always join', [Core.firstMeet(syServer, null).canJoin, Core.firstMeet(syServer, sys([syb('a', 100)])).canJoin], [true, true]);
  eq('first meeting: deposits that differ, or histories that only overlap, are asked about', [Core.firstMeet(sys([], [{ t: 1, v: 5 }]), sys([], [{ t: 2, v: 7 }])).how, Core.firstMeet(sys([syb('a', 100), syb('z', 300)]), syServer).how], ['ask', 'ask']);
  eq('"Juntar os dois" keeps the later of the two rewrites, whichever side had it', [Core.joinBoth(sys([], [], { epoch: 9000 }), sys([], [], { epoch: 10 })).state.epoch, Core.joinBoth(sys([], [], { epoch: 10 }), sys([], [], { epoch: 9000 })).state.epoch, Core.joinBoth(sys([]), sys([], [], { epoch: 9000 })).state.epoch, Core.joinBoth(sys([], [], { epoch: 9000 }), sys([])).state.epoch], [9000, 9000, 9000, 9000]);
  eq('same state: the order of bets and deposits aside; different deposits, or numbers run together, are not the same', [Core.sameState(sys([syb('b', 1), syb('a', 2), syb('c', 3)], [{ t: 2, v: 1 }, { t: 1, v: 1 }]), sys([syb('c', 3), syb('a', 2), syb('b', 1)], [{ t: 1, v: 1 }, { t: 2, v: 1 }])), Core.sameState(sys([syb('a', 2), syb('c', 3), syb('b', 1)]), sys([syb('b', 1), syb('c', 3), syb('a', 2)])), Core.sameState(sys([], [{ t: 1, v: 1 }]), sys([], [{ t: 1, v: 2 }])), Core.sameState(sys([], [], { x: [1, 23] }), sys([], [], { x: [12, 3] }))], [true, true, false, false]);
  eq('same state: a field left undefined is the same as no field', Core.sameState(sys([], [], { theme: undefined }), sys([], [])), true);
  eq('same state: lists inside lists are told apart', Core.sameState(sys([], [], { x: [[1], [2]] }), sys([], [], { x: [[1, 2]] })), false);
  /* the server copy: how a call is signed, and what is typed to log in */
  eq('cloud: a new-format key goes only in apikey; the token, once there is one, in Authorization', [Core.cloudHeaders('sb_publishable_abc', null), Core.cloudHeaders('sb_publishable_abc', 'tok')], [{ apikey: 'sb_publishable_abc', 'Content-Type': 'application/json' }, { apikey: 'sb_publishable_abc', 'Content-Type': 'application/json', Authorization: 'Bearer tok' }]);
  eq('cloud: an old-format key (a token itself) stands in for the token while there is none; a secret key never goes as a token', [Core.cloudHeaders('eyJold', null).Authorization, Core.cloudHeaders('eyJold', 'tok').Authorization, Core.cloudHeaders('sb_secret_x', null).Authorization], ['Bearer eyJold', 'Bearer tok', undefined]);
  eq('cloud: a project is an address of Supabase and a publishable key', [Core.cloudSet('https://abcdefghijkl.supabase.co', 'sb_publishable_abcdefghij'), Core.cloudSet('https://PROJETO.supabase.co', 'sb_publishable_abcdefghij'), Core.cloudSet('https://abcdefghijkl.supabase.co', 'sb_secret_abcdefghijkl'), Core.cloudSet('http://abcdefghijkl.supabase.co', 'sb_publishable_abcdefghij'), Core.cloudSet('https://evil.com', 'sb_publishable_abcdefghij')], [true, false, false, false, false]);
  eq('cloud: a password of 8 to 72 bytes, and an e-mail', [Core.isPassword('1234567'), Core.isPassword('12345678'), Core.isPassword('x'.repeat(72)), Core.isPassword('x'.repeat(73)), Core.isPassword('é'.repeat(36)), Core.isPassword('é'.repeat(37)), Core.isPassword(undefined), Core.isEmail(' lucas@x.com '), Core.isEmail('lucas@x'), Core.isEmail('a b@x.com'), Core.MIN_PASSWORD, Core.TOKEN_MARGIN], [false, true, true, false, true, false, false, true, false, false, 8, 60000]);
  // the latest fights read back from storage or from the server (D103): only what the app itself would have written
  const fcF = (x) => ({ id: '401', date: 1760000000000, weight: 'Lightweight', rounds: 3, won: true, method: 'sub', label: 'Submission', desc: 'Rear Naked Choke', round: 2, clock: '3:10', time: 490, ...x });
  eq('cache: a past fight is read back field by field, and what else came along is dropped', Core.readPastFight({ ...fcF(), extra: '<img onerror=x>' }), fcF());
  eq('cache: a past fight with a field of the wrong kind, an unknown way to end, or too long a text is not one', [Core.readPastFight(fcF({ date: '2026' })), Core.readPastFight(fcF({ method: 'magic' })), Core.readPastFight(fcF({ label: 'x'.repeat(81) })), Core.readPastFight(fcF({ won: 'yes' })), Core.readPastFight(fcF({ id: '' })), Core.readPastFight(null), Core.readPastFight(fcF({ time: null, desc: undefined }))], [null, null, null, null, null, null, fcF({ time: null, desc: undefined })]);
  eq('cache: one bad fight drops the athlete, as a list one fight short would pass for a whole one', [Core.readForm({ ts: 5, fights: [fcF(), fcF({ round: 'x' })] }), Core.readForm({ ts: 5, fights: [fcF()] }), Core.readForm({ ts: 0, fights: [] }), Core.readForm({ ts: 5, fights: Array(11).fill(fcF()) }), Core.readForm({ ts: 5, fights: [] })], [null, { ts: 5, fights: [fcF()] }, null, null, { ts: 5, fights: [] }]);
  eq('cache: an athlete id is safe in an address', [Core.isAthleteId('3022677'), Core.isAthleteId('4,5)'), Core.isAthleteId('a b'), Core.isAthleteId(''), Core.isAthleteId('x'.repeat(41)), Core.isAthleteId(7)], [true, false, false, false, false, false]);
  eq('cache: what is kept on the device is read back the same way, and what is not valid is dropped', Core.readForms({ '10': { ts: 5, fights: [fcF()] }, '20': { ts: 5, fights: [{}] }, 'a,b': { ts: 5, fights: [] } }), { '10': { ts: 5, fights: [fcF()] } });
  eq('cache: an old cache with no latest fights reads as none', [Core.readForms(undefined), Core.readForms('x')], [{}, {}]);
  const fcNow = Date.parse('2026-10-17T12:00:00Z'), fcTtl = 7 * 864e5, fcRow = (athlete, iso, fights) => ({ athlete, fetched_at: iso, data: { fights } });
  eq('cache: the rows of the server that can be used now', Core.formRows([
    fcRow('10', '2026-10-16T12:00:00Z', [fcF()]),                    // read yesterday on the other device
    fcRow('20', '2026-10-01T12:00:00Z', [fcF()]),                    // older than a week
    fcRow('30', '2026-10-17T12:00:00Z', [fcF({ method: 'x' })]),     // not a valid fight
    fcRow('40', '2026-10-17T12:00:00Z', [fcF()]),                    // not asked for
    fcRow('50', '2026-10-18T12:00:00Z', [fcF()]),                    // a clock a day ahead
    fcRow('60', '2026-10-17T12:03:00Z', [fcF()]),                    // a clock three minutes ahead: let through
    fcRow('70', 'ontem', [fcF()]), { athlete: '80' }, null
  ], ['10', '20', '30', '50', '60', '70', '80'], fcNow, fcTtl), { '10': { ts: Date.parse('2026-10-16T12:00:00Z'), fights: [fcF()] }, '60': { ts: Date.parse('2026-10-17T12:03:00Z'), fights: [fcF()] } });
  eq('cache: two rows of the same athlete keep the later reading, and an answer that is not a list gives nothing', [Core.formRows([fcRow('10', '2026-10-15T00:00:00Z', []), fcRow('10', '2026-10-16T00:00:00Z', [fcF()])], ['10'], fcNow, fcTtl)['10'].fights.length, Core.formRows({ message: 'JWT expired' }, ['10'], fcNow, fcTtl)], [1, {}]);
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
  /* the latest fights, the card and the usage counts: found by mutation testing (docs/verificacao.md) */
  eq('form: a fight with no round, or a time that is not a time, has no length; one that ended at 0:00 of a round does', [Core.fightSeconds({ round: 0, time: 30 }), Core.fightSeconds({ round: 2, time: -5 }), Core.fightSeconds({ round: 2, time: 0 })], [null, null, 300]);
  eq('cache: every way a fight can end that the app knows is read back', ['ko', 'sub', 'dec', 'nc', 'draw', 'unknown'].map(method => !!Core.readPastFight(fcF({ method }))), [true, true, true, true, true, true]);
  eq('cache: a won, a lost and a fight nobody won are read back; a text of the longest size is kept', [Core.readPastFight(fcF({ won: true })).won, Core.readPastFight(fcF({ won: false })).won, Core.readPastFight(fcF({ won: null })).won, Core.readPastFight(fcF({ id: 'x'.repeat(40) })).id.length], [true, false, null, 40]);
  eq('cache: an infinite date, a description or a time that is not text or a number is not a fight', [Core.readPastFight(fcF({ date: Infinity })), Core.readPastFight(fcF({ desc: 123 })), Core.readPastFight(fcF({ time: 'x' }))], [null, null, null]);
  eq('cache: a fight with no description has no description field', Object.prototype.hasOwnProperty.call(Core.readPastFight(fcF({ desc: undefined })), 'desc'), false);
  eq('cache: nothing is not a list of fights, and as many fights as allowed is one', [Core.readForm(null), Core.readForm({ ts: 5, fights: Array(10).fill(fcF()) }).fights.length, Core.readForms(null)], [null, 10, {}]);
  eq('cache: a row that is nothing, or whose time of reading is not text, is skipped', Core.formRows([null, { athlete: '10', fetched_at: 1760659200000, data: { fights: [fcF()] } }], ['10'], fcNow, fcTtl), {});
  eq('cache: a clock exactly five minutes ahead is let through; a reading exactly a week old is not', Object.keys(Core.formRows([fcRow('10', new Date(fcNow + 5 * 60e3).toISOString(), [fcF()]), fcRow('20', new Date(fcNow - fcTtl).toISOString(), [fcF()])], ['10', '20'], fcNow, fcTtl)), ['10']);
  eq('cache: two rows of the same athlete keep the later reading whichever comes first', Core.formRows([fcRow('10', '2026-10-16T00:00:00Z', [fcF()]), fcRow('10', '2026-10-15T00:00:00Z', [])], ['10'], fcNow, fcTtl)['10'].fights.length, 1);
  eq('country: the name of a country is given without the spaces around it', Core.countries([lf('1', ' Brazil ', ' Peru')]).map(c => c.name), ['Brazil', 'Peru']);
  eq('country: what the table knows a name by, with spaces around it', Core.countryCode(' Brazil '), 'BR');
  eq('search: the two names are not run together', found('aco'), []);       // "Almeida" + "Connor"
  eq('cards: an event exactly five days old the source never marked as over has left', cids(Core.cardsToShow([cev('five', -5), cev('a', 6)], NOWC)), ['a']);
  eq('usage: a saved log with days that are nothing, or with a day in another shape, reads as empty', [Core.usageRead({ days: null }).days, Core.usageRead({ days: { 'x2026-10-11': { peak: 1, k: { board: { n: 1 } } }, '2026-10-11x': { peak: 1, k: { board: { n: 1 } } } } }).days], [{}, {}]);
  eq('usage: what is nothing inside a saved day is dropped, and the rest of it stands', Core.usageRead({ days: { '2026-10-11': { peak: 2, k: null, h: null }, '2026-10-12': { peak: 1, k: { board: null, odds: { n: Infinity } }, h: { 3: null, 4: { n: 1, k: null } } } } }).days, { '2026-10-11': { peak: 2, k: {} }, '2026-10-12': { peak: 1, k: {}, h: { 4: { n: 1, err: 0, bytes: 0, peak: 0, k: {} } } } });
  eq('usage: hour 23 is an hour', [Object.keys(ulog([hcall('board', 23, 10)]).days['2026-10-11'].h), Object.keys(Core.usageRead({ days: { '2026-10-11': { peak: 1, k: {}, h: { 23: { n: 1 } } } } }).days['2026-10-11'].h)], [['23'], ['23']]);
  eq('usage: only the latest thirty days are kept, whatever the order they were saved in', Object.keys(Core.usageRead({ days: Object.fromEntries(Array.from({ length: 31 }, (_, i) => [uday(30 - i), { peak: 1, k: { board: { n: 1 } } }])) }).days).sort()[0], uday(1));
  eq('usage: the slowest call stays the slowest, and the peak of an hour stays its peak, when quieter ones come after', (l => [l.days['2026-10-11'].k.board.max, l.days['2026-10-11'].h[21].peak])(ulog([hcall('board', 21, 1), hcall('board', 21, 1), hcall('board', 21, 1), { ...hcall('board', 21, 1, true, T0 + MINU), ms: 300 }, { ...hcall('board', 21, 1, true, T0 + 2 * MINU), ms: 5 }])), [300, 3]);
  return { n, fails };
}
