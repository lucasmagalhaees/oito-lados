"""Mocked ESPN API for the tests: one fictional card that can be moved through four phases.

PHASE['n']: 0 = everything scheduled, 1 = first fight live, 2 = first fight over and second live, 3 = card finished.
All fighters are invented, because the fixture invents results.
"""
import json, os, re, time

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



# ---- OCR files: the app loads them from the CDN; tests answer those requests with the same files from tests/node_modules
import pathlib as _pathlib
_NPM = _pathlib.Path(__file__).resolve().parent / 'node_modules'
_CDN = [(r'/npm/tesseract\.js@[\d.]+/dist/([\w.-]+)$', 'tesseract.js/dist/{0}'),
        (r'/npm/tesseract\.js-core@[\d.]+/([\w.-]+)$', 'tesseract.js-core/{0}'),
        (r'/npm/@tesseract\.js-data/(\w+)@[\d.]+/([\w.]+)/([\w.]+)$', '@tesseract.js-data/{0}/{1}/{2}')]
_TYPES = {'.js': 'application/javascript', '.wasm': 'application/wasm', '.gz': 'application/octet-stream'}
cdn_calls = []
CDN_DOWN = {'on': False}          # set to True to simulate the CDN being unreachable

def local_cdn(route):
    url = route.request.url.split('?')[0]; cdn_calls.append(url)
    if CDN_DOWN['on']:
        return route.abort()
    for pattern, target in _CDN:
        hit = re.search(pattern, url)
        if hit:
            path = _NPM / target.format(*hit.groups())
            if path.exists():
                return route.fulfill(status=200, headers={'access-control-allow-origin': '*', 'content-type': _TYPES.get(path.suffix, 'application/octet-stream')}, body=path.read_bytes())
    route.fulfill(status=404, body='not in tests/node_modules')

def ocr_files_installed():
    return (_NPM / 'tesseract.js' / 'dist' / 'tesseract.min.js').exists()

# a bet print like the ones people share, with the invented fighters of this card (rendered to an image by the tests)
PRINT_HTML = """<div id="print" style="width:420px;background:#2b3030;color:#fff;font:16px Arial,sans-serif;padding:18px">
  <div style="color:#19e6a2;font-weight:700;font-size:18px">R$250,00 Simples</div>
  <div style="margin:14px 0;display:flex;gap:8px"><span style="background:#444;padding:8px 14px">Reutilizar Seleções</span><span style="background:#444;padding:8px 14px">Compartilhar</span></div>
  <div><b style="font-size:17px">Connor Lee Dunne</b> &nbsp; 2.05</div>
  <div style="color:#ccc;font-size:13px;margin:6px 0 12px">Para Ganhar a Luta</div>
  <div style="font-weight:700;font-size:13px">Rafael Almeida x Connor Lee Dunne</div>
  <div style="color:#999;font-size:12px">Sáb 10 Out 21:00</div>
  <div style="display:flex;justify-content:space-between;margin-top:28px"><div>Aposta<br><b>R$250,00</b></div><div style="text-align:right">Retornos<br><b>R$512,50</b></div></div>
  <div style="background:#1b8a5e;text-align:center;padding:12px;margin-top:12px;font-weight:700">Encerrar Aposta R$250,00</div>
</div>"""
TIP_TEXT = "🥊 *Rafael Almeida vs. Connor Lee Dunne*\n\n🎰 *Connor Lee Dunne* - Para vencer a luta\n\n💰 Odd - 1.44\n💎 Stake - 0,5 unidade"
