"""Contract test: real responses recorded in tests/fixtures (ESPN and the exchange-rate service) must normalise to known values.

Usage: python3 tests/contract.py
This is what keeps the parsers honest: they are checked against what the API really returned, not against what
someone remembers it returning. Offline; exits non-zero on any mismatch.
"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import cov

ROOT = pathlib.Path(__file__).resolve().parent.parent
FX = {p.stem: json.loads(p.read_text()) for p in sorted((ROOT / 'tests' / 'fixtures' / 'espn').glob('*.json'))}
FX['fx_latest_brl'] = json.loads((ROOT / 'tests' / 'fixtures' / 'fx' / 'latest_brl.json').read_text())

JS = r"""
(FX) => {
  const { Core } = window.__OL, fails = []; let n = 0;
  const eq = (name, got, want) => { n++; if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); };

  // the recorded answer of the exchange-rate service
  const rates = Core.normFx(FX.fx_latest_brl);
  eq('exchange rates', rates, { date: '2026-10-09', rates: { BRL: 1, USD: 0.1998, EUR: 0.1783 } });
  eq('one dollar in reais, from the recorded rates', Core.r2(Core.fxRate(rates, 'USD', 'BRL')), 5.01);

  const pre = Core.normEvent(FX.scoreboard_pre.events[0]), f = pre.fights[0];
  eq('pre event', [pre.id, pre.name, pre.completed, pre.fights.length], ['600061541', 'UFC Fight Night: Allen vs. Duncan', false, 1]);
  eq('pre event date', pre.date, Date.UTC(2026, 9, 10, 21, 0));
  eq('pre fight', [f.id, f.eventId, f.weight, f.rounds, f.state, f.canceled, f.winner, f.period], ['401916276', '600061541', 'Middleweight', 5, 'pre', false, null, 0]);
  eq('pre fight date', f.date, Date.UTC(2026, 9, 11, 0, 0));
  eq('fighter a = order 1', [f.a.id, f.a.name, f.a.last, f.a.record], ['4025699', 'Brendan Allen', 'Allen', '27-7-0']);
  eq('fighter b = order 2', [f.b.id, f.b.name, f.b.last, f.b.record], ['4848674', 'Christian Leroy Duncan', 'Duncan', '15-2-0']);

  const post = Core.normEvent(FX.scoreboard_post.events[0]), g = post.fights[0];
  eq('post event is completed (from the status name)', post.completed, true);
  eq('post fight', [g.id, g.weight, g.rounds, g.state, g.winner, g.period, g.clock], ['401912278', 'W Flyweight', 5, 'post', 'a', 5, '5:00']);

  const o = Core.normOdds(FX.odds, f);
  eq('odds book', o.book, 'DraftKings');
  eq('odds moneyline (home/away mapped by athlete id)', o.ml, { a: 1.8, b: 2.05 });
  eq('odds method', o.method, { a: { ko: 9, sub: 4, dec: 3.5 }, b: { ko: 3, sub: 23, dec: 5.5 } });
  eq('odds total rounds', o.total, { line: 3.5, over: 1.83, under: 1.91 });
  eq('odds props link', o.props, 'https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/events/600061541/competitions/401916276/odds/100/propBets?lang=en&region=us');
  Core.attachDistance(o, f, FX.propbets);
  eq('goes the distance: yes is the +130 side', o.dist, { yes: 2.3, no: 1.59 });
  eq('odds of one fight do not attach to another', Core.normOdds(FX.odds, g), null);

  const d = Core.normResult(FX.status_decision);
  eq('decision result', [d.method, d.label, d.round, d.time, d.clock], ['dec', 'Decision - Unanimous', 5, 300, '5:00']);
  const k = Core.normResult(FX.status_ko);
  eq('ko result (time read from the displayed clock)', [k.method, k.label, k.desc, k.round, k.time, k.clock], ['ko', 'KO/TKO', 'Punch', 3, 206, '3:26']);

  // a real draw: no description, and read as a draw
  const dr = Core.normResult(FX.status_draw);
  eq('draw result', [dr.method, dr.label, dr.desc, dr.round, dr.time, dr.clock], ['draw', 'Draw', '', 3, 300, '5:00']);

  // the fights an athlete has had: the event log (the latest first, the fight still to come included), then each fight and its status
  const log = Core.normEventlog(FX.athlete_eventlog);
  eq('event log: what the list holds', [log.length, log.map(x => x.played), log.slice(0, 4).map(x => x.id)], [8, [false, true, true, true, true, true, true, true], ['401927419', '401855749', '401859133', '401783702']]);
  eq('event log: each fight is asked for by https, at the address the API gives', log[1].competition, 'https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/events/600057366/competitions/401855749?lang=en&region=us');
  eq('event log: the three latest fights fought are the three recorded', log.filter(x => x.played).slice(0, 3).map(x => x.id), FX.past_competitions.map(c => c.id));
  eq('past fight: where its result is asked for', Core.statusRef(FX.past_competitions[0]), 'https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/events/600057366/competitions/401855749/status?lang=en&region=us');
  const past = FX.past_competitions.map((c, i) => Core.normPastFight(c, FX.past_statuses[i], '4077451'));
  eq('past fights: who won, how and when each one ended', past.map(x => [x.id, x.won, x.method, x.round, x.clock, x.time, x.weight, x.rounds]),
     [['401855749', false, 'sub', 1, '1:03', 63, 'Welterweight', 3], ['401859133', false, 'ko', 1, '1:42', 102, 'Welterweight', 3], ['401783702', false, 'sub', 2, '4:03', 243, 'Welterweight', 3]]);
  eq('past fights: which submission it was, as ESPN names it', past.map(x => [x.method, x.desc]), [['sub', 'Rear Naked Choke'], ['ko', 'Punches'], ['sub', 'Rear Naked Choke']]);
  eq('the country of every fighter on the recorded boards has a flag', [FX.scoreboard_pre, FX.scoreboard_post].flatMap(b => b.events.map(Core.normEvent)).flatMap(e => e.fights).flatMap(f => [f.a.country, f.b.country]).map(c => [c, !!Core.flagOf(c)]).filter(x => !x[1]), []);
  eq('the countries on the recorded boards', [...new Set([FX.scoreboard_pre, FX.scoreboard_post].flatMap(b => b.events.map(Core.normEvent)).flatMap(e => e.fights).flatMap(f => [f.a.country, f.b.country]))].sort(), ['Brazil', 'China', 'England']);
  eq('past fights: the dates, the latest first', past.map(x => x.date), [Date.UTC(2026, 2, 29, 0, 0), Date.UTC(2026, 1, 7, 22, 0), Date.UTC(2025, 5, 28, 23, 0)]);
  eq('past fights: the same fight seen from the other corner is a win', Core.normPastFight(FX.past_competitions[0], FX.past_statuses[0], '2960681').won, true);
  eq('past fights: an athlete who was not in the fight has no result in it', Core.normPastFight(FX.past_competitions[0], FX.past_statuses[0], '1').won, null);
  eq('past fights: summed up', Core.formSummary(past), { n: 3, won: 0, lost: 3, other: 0, ko: 1, sub: 2, dec: 0 });
  eq('past fights: how long each one lasted', past.map(Core.fightSeconds), [63, 102, 543]);
  eq('the numeric clock of a finish is the time elapsed, the same as the displayed one', FX.past_statuses.map(x => x.clock), [63, 102, 243]);

  eq('takedowns landed in the fight', Core.statValue(FX.competitor_statistics, 'takedownsLanded'), 3);
  eq('career takedown average', Core.statValue(FX.athlete_statistics, 'takedownAvg'), 1.52);
  eq('missing stat', Core.statValue(FX.athlete_statistics, 'takedownsLanded'), null);

  // the recorded decision settles real selections the way the rules say
  const td = { a: 3, b: 0, final: true };
  const out = key => Core.legOutcome(key, g, d, td, false);
  eq('settle recorded decision', ['ml:a', 'ml:b', 'dist:yes', 'fm:dec', 'mov:a:dec', 'tot:o:4.5', 'rnd:5', 'td:o:2.5', 'tda:b:no'].map(out),
     ['won', 'lost', 'won', 'won', 'won', 'won', 'lost', 'won', 'won']);

  // and the recorded odds price into a full market list
  const P = Core.price(f, o, { a: { tdAvg: Core.statValue(FX.athlete_statistics, 'takedownAvg') }, b: null });
  eq('markets offered', P.groups.map(x => x.id), ['ml', 'mov', 'fm', 'dist', 'tot', 'rnd', 'wr', 'td', 'tda']);
  eq('real prices pass through untouched', ['ml:a', 'ml:b', 'mov:a:sub', 'dist:yes', 'tot:o:3.5', 'tot:u:3.5'].map(x => [P.map[x].odd, P.map[x].src]),
     [[1.8, 'real'], [2.05, 'real'], [4, 'real'], [2.3, 'real'], [1.83, 'real'], [1.91, 'real']]);
  return { n, fails };
}
"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
    cov.start(page)
    page.goto((ROOT / 'dist' / 'index.html').as_uri())
    page.wait_for_function('window.__OL && window.__OL.Core')
    res = page.evaluate(JS, FX)
    cov.stop(page, 'contract')
    browser.close()

for f in res['fails']:
    print('FAIL', f)
print(f"{res['n'] - len(res['fails'])}/{res['n']} contract checks passed against {len(FX)} recorded responses")
sys.exit(1 if res['fails'] else 0)
