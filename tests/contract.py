"""Contract test: real ESPN responses recorded in tests/fixtures/espn must normalise to known values.

Usage: python3 tests/contract.py
This is what keeps the parsers honest: they are checked against what the API really returned, not against what
someone remembers it returning. Offline; exits non-zero on any mismatch.
"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
FX = {p.stem: json.loads(p.read_text()) for p in sorted((ROOT / 'tests' / 'fixtures' / 'espn').glob('*.json'))}

JS = r"""
(FX) => {
  const { Core } = window.__OL, fails = []; let n = 0;
  const eq = (name, got, want) => { n++; if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); };

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
    page.goto((ROOT / 'index.html').as_uri())
    page.wait_for_function('window.__OL && window.__OL.Core')
    res = page.evaluate(JS, FX)
    browser.close()

for f in res['fails']:
    print('FAIL', f)
print(f"{res['n'] - len(res['fails'])}/{res['n']} contract checks passed against {len(FX)} recorded responses")
sys.exit(1 if res['fails'] else 0)
