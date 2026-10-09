"""Live contract check: does the real ESPN API still return what the app reads?

Usage: python3 tests/contract_live.py          (hits the real API; needs internet)
       python3 tests/contract_live.py --mock   (self-test of this script against tests/mock_espn.py)

Fetches a scoreboard, one finished fight and one upcoming fight with odds from the real API and runs the app's own
parsers (window.__OL.Core, loaded from index.html in headless Chromium) on the answers.

The HTTP calls are made from Python with a user agent that says what this is, and with the production site as Origin,
so every answer is also checked for the CORS header a browser needs. The headless browser itself never talks to ESPN:
ESPN refuses headless browsers, and this script does not disguise itself to get around that.

Exit codes: 0 the API still matches, 1 a check failed (the API changed), 3 inconclusive (this machine could not reach
the API at all, e.g. a blocked network). A warning means there was nothing to check (no card, odds not published yet).
"""
import json, os, pathlib, sys, urllib.error, urllib.request
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
MOCK = '--mock' in sys.argv

JS = r"""
async () => {
  const { Core } = window.__OL, checks = [], warns = [];
  const ok = (name, cond, detail) => checks.push({ name, ok: !!cond, detail: detail == null ? '' : String(detail).slice(0, 300) });
  const cors = [];
  const get = async u => {
    if (!window.pyGet) { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + u); return r.json(); }
    const r = await window.pyGet(u);
    if (r.error) throw new Error(r.error + ' ' + u);
    cors.push({ u, acao: r.acao });
    return r.json;
  };
  const tryGet = async u => { try { return await get(u); } catch (e) { return { __error: String(e) }; } };
  const SITE = 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc', CORE = 'https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc';
  const DAY = 864e5, now = Date.now();
  const ymd = t => { const d = new Date(t); return d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0') + String(d.getUTCDate()).padStart(2, '0'); };

  const sb = await tryGet(`${SITE}/scoreboard?dates=${ymd(now - 21 * DAY)}-${ymd(now + 21 * DAY)}&limit=100`);
  if (sb.__error) return { checks, warns, unreachable: sb.__error };
  ok('scoreboard is readable', true);
  ok('scoreboard has events[]', Array.isArray(sb.events));
  const events = (sb.events || []).map(Core.normEvent), fights = events.flatMap(e => e.fights);
  if (!fights.length) { warns.push('no UFC fights within 21 days either way: nothing else could be checked'); return { checks, warns }; }
  const bad = fights.find(f => !(f.id && f.a.id && f.b.id && f.a.last && f.b.last && isFinite(f.date) && Number.isInteger(f.rounds) && f.rounds >= 1 && f.rounds <= 5 && f.weight));
  ok(`all ${fights.length} fights have ids, names, date, weight class and a round count from 1 to 5`, !bad, bad && JSON.stringify(bad));
  // UFC bouts are 3 or 5 rounds; anything else is reported, not failed: the app uses the number as ESPN gives it
  const unusual = fights.filter(f => ![3, 5].includes(f.rounds));
  if (unusual.length) warns.push(`${unusual.length} fight(s) listed with a round count other than 3 or 5: ` + unusual.slice(0, 3).map(f => `${f.a.last} x ${f.b.last} (${f.rounds} rounds, ${f.state}, fight ${f.id})`).join('; '));
  const odd = fights.find(f => !['pre', 'in', 'post'].includes(f.state));
  ok('every fight state is pre, in or post', !odd, odd && odd.state);
  const allPost = events.filter(e => e.fights.length && e.fights.every(f => f.state === 'post'));
  ok('events whose fights are all over read as completed', allPost.every(e => e.completed), allPost.filter(e => !e.completed).map(e => e.name));

  const done = fights.filter(f => f.state === 'post' && !f.canceled).sort((a, b) => b.date - a.date)[0];
  if (!done) warns.push('no finished fight in the window: result and takedown stats not checked');
  else {
    const st = await tryGet(`${CORE}/events/${done.eventId}/competitions/${done.id}/status`);
    ok('status of a finished fight is readable', !st.__error, st.__error);
    const r = st.__error ? null : Core.normResult(st);
    ok('finished fight carries a result object', !!r, JSON.stringify(st.result || null));
    ok('result method is recognised', r && r.method !== 'unknown', r && (r.label || 'empty label'));
    ok('result has a round and an elapsed time', r && r.round >= 1 && r.time != null && r.time <= 300, r && `${r.round} / ${r.clock}`);
    const tds = [];
    for (const x of [done.a, done.b]) { const j = await tryGet(`${CORE}/events/${done.eventId}/competitions/${done.id}/competitors/${x.id}/statistics`); tds.push(j.__error ? null : Core.statValue(j, 'takedownsLanded')); }
    ok('takedownsLanded is published for both fighters of a finished fight', tds.every(v => typeof v === 'number'), JSON.stringify(tds));
  }

  const pre = fights.filter(f => f.state === 'pre' && !f.canceled).sort((a, b) => a.date - b.date);
  if (!pre.length) warns.push('no upcoming fight in the window: odds not checked');
  let priced = null, tried = 0;
  for (const f of pre.slice(0, 40)) {
    tried++;
    const j = await tryGet(`${CORE}/events/${f.eventId}/competitions/${f.id}/odds`);
    if (j.__error) { ok('odds endpoint is readable', false, j.__error); break; }
    if (!(j.items || []).length) continue;
    const o = Core.normOdds(j, f);
    ok('an odds response with items normalises', !!o, JSON.stringify(j.items[0]).slice(0, 300));
    if (o) priced = { f, o };
    break;
  }
  if (pre.length && !priced && !checks.some(c => !c.ok)) warns.push(`none of the ${tried} upcoming fights checked has odds published yet`);
  if (priced) {
    const { f, o } = priced;
    ok('moneyline is a sane decimal price on both sides', [o.ml.a, o.ml.b].every(v => v > 1 && v < 60), JSON.stringify(o.ml));
    if (!o.method) warns.push('first priced fight has no method-of-victory lines (the model fills in)');
    if (!o.total) warns.push('first priced fight has no total-rounds line (the model fills in)');
    if (o.props) { const pj = await tryGet(o.props + (o.props.includes('?') ? '&' : '?') + 'limit=100'); if (!pj.__error) Core.attachDistance(o, f, pj); if (!o.dist) warns.push('first priced fight has no usable "goes the distance" prop'); }
    else warns.push('odds response has no propBets link');
    const P = Core.price(f, o, {});
    ok('the full market list builds from live odds', P.groups.length >= 8 && P.groups[0].id === 'ml', P.groups.map(g => g.id).join(','));
    const as = await tryGet(`https://sports.core.api.espn.com/v2/sports/mma/athletes/${f.a.id}/statistics`);
    if (as.__error) warns.push('athlete statistics not available for the first priced fighter (normal for a debut)');
    else ok('athlete statistics expose takedownAvg', typeof Core.statValue(as, 'takedownAvg') === 'number');
  }
  if (window.pyGet) { const bad = cors.filter(c => !(c.acao === '*' || c.acao === window.ORIGIN)); ok(`all ${cors.length} answers carry the CORS header a browser on ${window.ORIGIN} needs`, !bad.length, bad.slice(0, 3).map(c => c.acao + ' ' + c.u).join(' | ')); }
  return { checks, warns, summary: `${events.length} events, ${fights.length} fights, finished sample ${done ? done.id : '-'}, priced sample ${priced ? priced.f.id : '-'}` };
}
"""

ORIGIN = 'https://oito-lados.vercel.app'
AGENT = 'oito-lados-contract-check/1.0 (+https://github.com/lucasmagalhaees/oito-lados)'

def py_get(url):
    req = urllib.request.Request(url.replace('http://', 'https://', 1), headers={'Origin': ORIGIN, 'User-Agent': AGENT, 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return {'json': json.loads(r.read().decode('utf-8')), 'acao': r.headers.get('access-control-allow-origin')}
    except urllib.error.HTTPError as e:
        return {'error': f'HTTP {e.code}'}
    except Exception as e:
        return {'error': f'no answer ({e})'}

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    if MOCK:
        sys.path.insert(0, str(ROOT / 'tests'))
        from mock_espn import PHASE, handle
        PHASE['n'] = 2
        page.route('**/*', lambda r: handle(r) if r.request.url.startswith('http') else r.continue_())
    else:
        page.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())   # the browser only runs the parsers
        page.expose_function('pyGet', py_get)
        page.add_init_script(f'window.ORIGIN = {json.dumps(ORIGIN)};')
    page.goto((ROOT / 'index.html').as_uri())
    page.wait_for_function('window.__OL && window.__OL.Core')
    res = page.evaluate(JS)
    browser.close()

failed = [c for c in res['checks'] if not c['ok']]

def annotate(level, text):
    # on GitHub Actions each failed check and warning becomes an annotation on the run, readable without opening the log
    if os.environ.get('GITHUB_ACTIONS') == 'true' and not MOCK:
        print(f'::{level} title=ESPN contract::' + ' '.join(str(text).split()))

for c in res['checks']:
    print(('ok   ' if c['ok'] else 'FAIL ') + c['name'] + (f"  -> {c['detail']}" if c['detail'] and not c['ok'] else ''))
    if not c['ok']:
        annotate('error', c['name'] + (' -> ' + c['detail'] if c['detail'] else ''))
for w in res['warns']:
    print('warn ' + w)
    annotate('warning', w)
print(f"{'mock' if MOCK else 'live'}: {len(res['checks']) - len(failed)}/{len(res['checks'])} checks passed, {len(res['warns'])} warnings. {res.get('summary', '')}")
if res.get('unreachable'):
    msg = f"inconclusive: this machine could not read the ESPN scoreboard ({res['unreachable']}). Nothing was checked. Run python3 tests/contract_live.py from a home connection."
    print(msg); annotate('warning', msg)
    sys.exit(3)
annotate('notice', f"{len(res['checks']) - len(failed)}/{len(res['checks'])} checks passed, {len(res['warns'])} warnings. {res.get('summary', '')}")
sys.exit(1 if failed else 0)
