"""End-to-end run of index.html against a mocked ESPN API.

Usage: python3 tests/e2e.py [dark|light]   (needs: pip install -r tests/requirements.txt && playwright install chromium)
Walks one fictional card through pre-fight -> live -> final, places singles, parlays and same-fight combos through the UI,
and prints prices, settlements and the final balance (expected: R$ 1.584,30).
"""
import json, os, re, time, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
SHOTS = ROOT / "tests" / "shots"; SHOTS.mkdir(exist_ok=True)
from playwright.sync_api import sync_playwright
NOW = int(time.time()*1000)
iso = lambda ms: time.strftime('%Y-%m-%dT%H:%MZ', time.gmtime(ms/1000))
PHASE = {'n': 0}
# the default name carries markup on purpose: API text must be escaped, never rendered. OL_EVENT_NAME overrides it for screenshots.
EVENT_NAME = os.environ.get('OL_EVENT_NAME', 'UFC Fight Night: Almeida vs. Dunne <b>x</b>')
EV = '600000001'
F = {
 'f1': dict(a=('101','Marina Teles','M. Teles','10-2-0'), b=('102','Joana Prado Jr.','J. Prado Jr.','8-1-0'), rounds=3, w='W Flyweight'),
 'f2': dict(a=('201','Caio Brandt','C. Brandt','15-4-0'), b=('202','Dario Kessler','D. Kessler','12-3-0'), rounds=3, w='Lightweight'),
 'f3': dict(a=('301','Rafael Almeida','R. Almeida','27-7-0'), b=('302','Connor Lee Dunne','C. Dunne','15-2-0'), rounds=5, w='Middleweight'),
}
# status per phase: (state, name, period, clock, displayClock, winner)
ST = {
 'f1': [('pre','STATUS_SCHEDULED',0,0,'-',None), ('in','STATUS_IN_PROGRESS',2,70,'1:10',None), ('post','STATUS_FINAL',2,192,'3:12','a'), ('post','STATUS_FINAL',2,192,'3:12','a')],
 'f2': [('pre','STATUS_SCHEDULED',0,0,'-',None), ('pre','STATUS_SCHEDULED',0,0,'-',None), ('in','STATUS_IN_PROGRESS',1,200,'3:20',None), ('post','STATUS_FINAL',3,300,'5:00','b')],
 'f3': [('pre','STATUS_SCHEDULED',0,0,'-',None), ('pre','STATUS_SCHEDULED',0,0,'-',None), ('pre','STATUS_SCHEDULED',0,0,'-',None), ('post','STATUS_FINAL',4,120,'2:00','a')],
}
RES = {'f1': dict(id=356,name='kotko',displayName='KO/TKO',description='Punch',displayDescription='Punch'),
       'f2': dict(id=263,name='decision---unanimous',displayName='Decision - Unanimous'),
       'f3': dict(id=1,name='submission',displayName='Submission',description='Rear Naked Choke',displayDescription='Rear Naked Choke')}
TD = {'f1': [None,(1,0),(2,1),(2,1)], 'f2': [None,None,(0,0),(0,0)], 'f3': [None,None,None,(3,0)]}
def scoreboard():
    comps = []
    for i,(fid,f) in enumerate(F.items()):
        st = ST[fid][PHASE['n']]
        mk = lambda x, order, side: dict(id=x[0], order=order, winner=(st[5]==side), athlete=dict(displayName=x[1], fullName=x[1], shortName=x[2], flag=dict(alt='Brazil')), records=[dict(summary=x[3])])
        comps.append(dict(id=fid, date=iso(NOW-7*3600e3 + (3*3600e3 if fid=='f3' else 0)), type=dict(abbreviation=f['w']),
            competitors=[mk(f['b'],2,'b'), mk(f['a'],1,'a')],
            status=dict(clock=st[3], displayClock=st[4], period=st[2], type=dict(name=st[1], state=st[0], completed=st[0]=='post')),
            format=dict(regulation=dict(periods=f['rounds']))))
    return dict(events=[dict(id=EV, name=EVENT_NAME, date=iso(NOW-7*3600e3), status=dict(type=dict(completed=PHASE['n']==3)), competitions=comps)])
am = lambda v: dict(american=('+%d'%v if v>0 else str(v)))
def odds(fid):
    f = F[fid]
    side = lambda x, ml, ko, sub, dec: dict(moneyLine=ml, current=dict(moneyLine=am(ml), victoryMethod=dict(koTkoDq=am(ko), submission=am(sub), points=am(dec))), athlete={'$ref': 'http://sports.core.api.espn.com/v2/sports/mma/athletes/%s?lang=en'%x[0]})
    if fid=='f3': h, a, ou = side(f['a'],-125,800,300,250), side(f['b'],105,200,2200,450), (3.5,-120,-110)
    elif fid=='f2': h, a, ou = side(f['a'],-200,350,500,110), side(f['b'],170,700,1200,300), (2.5,-180,140)
    else:
        h = dict(moneyLine=-150, current=dict(moneyLine=am(-150)), athlete={'$ref': 'http://x/athletes/%s?lang=en'%f['a'][0]})
        a = dict(moneyLine=125, current=dict(moneyLine=am(125)), athlete={'$ref': 'http://x/athletes/%s?lang=en'%f['b'][0]})
        return dict(count=1, items=[dict(provider=dict(name='DraftKings'), homeAthleteOdds=h, awayAthleteOdds=a)])
    return dict(count=1, items=[dict(propBets={'$ref': 'http://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/events/x/competitions/%s/odds/100/propBets?lang=en&region=us' % fid}, provider=dict(name='DraftKings'), overUnder=ou[0], overOdds=ou[1], underOdds=ou[2], homeAthleteOdds=h, awayAthleteOdds=a)])
def props(fid):
    if fid=='f3': v=['+130','-170']
    elif fid=='f2': v=['+175','-225']   # deliberately "no" first: yes should be -225
    else: return dict(count=0, items=[])
    return dict(count=2, items=[dict(type=dict(id='63', name='Fight To Go The Distance'), odds=dict(american=dict(value=x))) for x in v])
calls = []
def handle(route):
    u = route.request.url; calls.append(u)
    def ok(o): route.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin':'*'}, body=json.dumps(o))
    if 'fonts.g' in u: return route.abort()
    if '/scoreboard' in u: return ok(scoreboard())
    m = re.search(r'/competitions/(\w+)/odds/100/propBets', u)
    if m: return ok(props(m.group(1)))
    m = re.search(r'/competitions/(\w+)/odds', u)
    if m: return ok(odds(m.group(1)))
    m = re.search(r'/competitions/(\w+)/status', u)
    if m:
        fid = m.group(1); st = ST[fid][PHASE['n']]
        o = dict(clock=st[3], displayClock=st[4], period=st[2], type=dict(name=st[1], state=st[0], completed=st[0]=='post'))
        if st[0]=='post': o['result'] = RES[fid]
        return ok(o)
    m = re.search(r'/competitions/(\w+)/competitors/(\w+)/statistics', u)
    if m:
        fid, aid = m.groups(); t = TD[fid][PHASE['n']]
        if t is None: return route.fulfill(status=404, body='{}')
        v = t[0] if aid == F[fid]['a'][0] else t[1]
        return ok(dict(splits=dict(categories=[dict(name='general', stats=[dict(name='takedownsAttempted', value=9), dict(name='takedownsLanded', value=v)])])))
    m = re.search(r'/athletes/(\w+)/statistics', u)
    if m: return ok(dict(splits=dict(categories=[dict(name='general', stats=[dict(name='takedownAvg', value={'301':1.52,'302':0.3}.get(m.group(1), 1.0))])])))
    route.fulfill(status=404, body='{}')

errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport=dict(width=393, height=852), device_scale_factor=2, color_scheme=sys.argv[1] if len(sys.argv)>1 else 'dark', locale='pt-BR', timezone_id='America/Sao_Paulo')
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append(m.text) if m.type in ('error',) else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR '+str(e)))
    pg.route('**/*', lambda r: handle(r) if r.request.url.startswith('http') else r.continue_())
    pg.goto((ROOT / 'index.html').as_uri())
    pg.wait_for_selector('.fight .opt.ml')
    pg.wait_for_function('document.querySelectorAll(".fight .opt.ml").length>=6')
    assert pg.evaluate('document.querySelector(".ev b b") === null'), 'event name was rendered as HTML'
    def shot(name, full=False):
        pg.evaluate('document.getElementById("toast").hidden = true')
        pg.screenshot(path=str(SHOTS / name), full_page=full)
    sync = lambda: (pg.evaluate('window.__OL.sync(true)'), pg.wait_for_timeout(400))
    bal = lambda: pg.inner_text('#bal')
    # markets for main event
    mk = pg.evaluate('''() => { const {Core,D} = window.__OL; const out = {}; for (const [id,f] of D.fights) { const p = Core.price(f, D.odds[id], {a:D.astats[f.a.id], b:D.astats[f.b.id]}); out[id] = {odds: D.odds[id], groups: p.groups.map(g => [g.title, g.opts.map(o => o.key+'='+o.odd+(o.src==='est'?'~':''))]), P: {pDec:p.P.pDec, sh:p.P.sh}}; } return out; }''')
    for fid in mk:
        print('==', fid, json.dumps(mk[fid]['odds']['dist']), mk[fid]['P'])
        for g in mk[fid]['groups']: print('  ', g[0], ' '.join(g[1]))
    # deposit
    pg.click('[data-act=tab][data-tab=carteira]'); pg.fill('#dep', '1.000,00'); pg.click('[data-act=deposit]')
    assert bal().replace('\xa0',' ') == 'R$ 1.000,00', bal()
    pg.click('.tabbar [data-tab=lutas]')
    shot('s1-lutas.png')
    pick = lambda fid, key: pg.click(f'[data-act=pick][data-fid="{fid}"][data-key="{key}"]')
    for fid in ('f1','f2','f3'): pg.click(f'[data-act=more][data-fid="{fid}"]')
    shot('s2-markets.png', True)
    def bet(sels, stake, mode='single'):
        for s in sels: pick(*s)
        pg.click('#slipbtn')
        if mode=='multi': pg.click('[data-act=mode][data-m=multi]')
        pg.fill('#stake', stake)
        if mode=='multi': shot('s3-slip.png')
        pg.click('[data-act=place]'); pg.wait_for_selector('.bet'); pg.click('.tabbar [data-tab=lutas]')
    tdline = [k for k in pg.evaluate('Object.keys(window.__OL.Core.price(window.__OL.D.fights.get("f1"), window.__OL.D.odds.f1, {}).map)') if k.startswith('td:o:')]
    print('f1 td lines', tdline)
    combos = pg.evaluate("""() => { const {Core,D} = window.__OL; const f = D.fights.get('f3'); const p = Core.price(f, D.odds.f3, {a:D.astats[f.a.id], b:D.astats[f.b.id]}); const J = p.J;
      const t = ks => { const c = Core.combo(J, ks, ks.map(k => p.map[k].odd), p.map); return ks.join(' + ') + ' => ' + (c.ok ? 'odd ' + c.odd + (c.same ? ' SAME AS ' + c.same : '') + ' p=' + c.p.toFixed(4) : c.why) + ' | legs ' + ks.map(k => p.map[k].odd).join(' x ') + ' = ' + ks.reduce((x,k)=>x*p.map[k].odd,1).toFixed(2); };
      const all = Object.keys(p.map); const tot1 = J.prob(['ml:a']) + J.prob(['ml:b']);
      return [t(['fm:ko','tot:o:1.5']), t(['ml:a','fm:sub']), t(['ml:a','mov:a:sub']), t(['dist:yes','tot:u:1.5']), t(['mov:b:ko','rnd:1']), t(['ml:a','td:o:1.5']), t(['fm:sub','tda:a:yes']), t(['td:u:0.5','tda:a:yes']), t(['ml:b','dist:yes','td:u:1.5']), t(['wr:a:2','tot:o:1.5']), t(['rnd:2','tot:u:1.5']), t(['ml:a','fm:ko']), t(['ml:b','rnd:3']), t(['fm:ko','fm:sub']), 'sum ml ' + tot1.toFixed(6), 'td over1.5 single ' + p.map['td:o:1.5'].odd + ' p=' + J.prob(['td:o:1.5']).toFixed(4)]; }""")
    for c in combos: print('  combo', c)
    bet([('f1','ml:a')], '100')                                   # wins @1.67 -> 167
    bet([('f1','ml:a'),('f2','dist:yes'),('f3','tot:o:3.5')], '50', 'multi')   # 1.67*1.44*1.83
    bet([('f1','td:o:2.5')], '20')                                # 3 TDs -> wins
    bet([('f3','mov:a:sub')], '10')                               # wins @4.00
    bet([('f2','rnd:1'),('f3','wr:b:1')], '5')                    # two singles, both lose
    bet([('f2','ml:a')], '30')                                    # loses
    bet([('f1','tda:b:no'),('f3','td:u:1.5')], '10')              # f1 b has 1 TD -> loses ; f3 3 TDs -> loses
    bet([('f3','fm:sub'),('f3','tot:o:1.5')], '10', 'multi')       # sub in R4 -> wins at the combo price
    bet([('f1','fm:ko'),('f1','tot:o:1.5'),('f2','ml:b')], '10', 'multi')   # f1 KO R2 3:12 -> over 1.5 ok ; f2 b wins -> wins
    pick('f3','dist:yes'); pick('f3','tot:u:1.5'); pg.click('#slipbtn'); pg.wait_for_timeout(100)
    print('impossible combo ->', pg.inner_text('.combo.bad'), '| multi disabled:', pg.get_attribute('[data-act=mode][data-m=multi]', 'disabled') is not None)
    shot('s8-combo-bad.png'); pg.click('[data-act=unpick][data-key="dist:yes"]'); pg.click('[data-act=unpick][data-key="tot:u:1.5"]')
    pick('f3','fm:ko'); pick('f3','tot:o:1.5'); pick('f2','ml:a'); pg.click('#slipbtn'); pg.click('[data-act=mode][data-m=multi]'); pg.fill('#stake','25'); shot('s9-combo.png')
    pg.click('[data-act=unpick][data-key="fm:ko"]'); pg.click('[data-act=unpick][data-key="tot:o:1.5"]'); pg.click('[data-act=unpick][data-key="ml:a"]')
    print('balance after bets', bal(), '| open', pg.evaluate('window.__OL.S.bets.length'))
    PHASE['n'] = 1; sync(); pg.click('.tabbar [data-tab=apostas]'); pg.wait_for_timeout(200); shot('s4-live.png')
    print('phase1 statuses', pg.evaluate('window.__OL.S.bets.map(b=>b.status)'), 'td', pg.evaluate('JSON.stringify(window.__OL.D.td)'))
    PHASE['n'] = 2; sync(); sync()
    print('phase2 statuses', pg.evaluate('window.__OL.S.bets.map(b=>[b.type,b.legs.map(l=>l.key).join("+"),b.status,b.payout])'), bal())
    PHASE['n'] = 3; sync(); sync()
    st = pg.evaluate('window.__OL.S.bets.map(b=>[b.type,b.legs.map(l=>l.key+"@"+l.odd).join("+"),b.stake,b.status,b.payout])')
    for s in st: print('  ', s)
    print('final balance', bal())
    assert bal().replace('\xa0', ' ') == 'R$ 1.584,30', bal()
    pg.click('[data-act=filter][data-f=done]'); shot('s5-done.png', True)
    pg.click('.tabbar [data-tab=carteira]'); pg.wait_for_timeout(200); shot('s6-carteira.png')
    pg.click('.tabbar [data-tab=lutas]'); shot('s7-final.png', True)
    ow = pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
    print('h-overflow px', ow, '| requests', len(calls), '| errors', errs)
    b.close()
