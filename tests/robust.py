"""The built page (dist/index.html) against damaged or old data where it reads it in: the device's storage, a backup and
the server copy. None of it may stop the screens from drawing, and what is whole in it stays.

Usage: python3 tests/robust.py   (needs: pip install -r tests/requirements.txt && playwright install chromium)
Each case seeds what an older version, a damaged save or a damaged row could leave, opens the app with the ESPN
simulated, walks the three tabs and the closed bets, and checks that no error reached the page and what was kept.
"""
import functools, http.server, json, pathlib, re, sys, threading, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from mock_espn import CLOUD, handle, local_cdn
import cov
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
now = int(time.time() * 1000)
LEG = dict(fid='f1', eid='600000001', key='ml:a', market='Vencedor', sel='Teles', cat='Vencedor', fight='Teles x Prado Jr.', event='UFC Fight Night: Almeida vs. Dunne', date=now + 3600e3, odd=1.67, src='real')
def bet(i, **kw):
    return {**dict(id='b%d' % i, t=now - i, type='single', stake=10, unit=10, odd=1.67, sgp={}, status='open', payout=0, legs=[LEG]), **kw}
GOOD = bet(0)                                         # a whole bet, next to every damaged one: it must stay
state = lambda *bets, **kw: {**dict(v=1, deposits=[dict(t=now - 5000, v=100)], bets=[GOOD, *bets], seen=now), **kw}
# what a damaged save, or a cache left by another version, can hold. (storage key, value, ids of the bets that must stay)
CASES = {
    'aposta sem seleções (null)': ('oitolados.v1', state(bet(1, legs=None)), ['b0']),
    'aposta com a lista de seleções vazia': ('oitolados.v1', state(bet(1, legs=[])), ['b0']),
    'aposta null': ('oitolados.v1', state(None), ['b0']),
    'seleção null': ('oitolados.v1', state(bet(1, legs=[None])), ['b0']),
    'seleção sem data nem luta': ('oitolados.v1', state(bet(1, legs=[{}])), ['b0']),
    'depósito null': ('oitolados.v1', state(deposits=[None, dict(t=now - 5000, v=100)]), ['b0']),
    'números escritos como texto': ('oitolados.v1', state(bet(1, stake='10', odd='1.67', unit='10')), ['b0', 'b1']),
    'cache: evento sem lutas': ('oitolados.cache.v1', dict(events=[dict(id='1', name='UFC', date=now)]), ['b0']),
    'cache: evento null': ('oitolados.cache.v1', dict(events=[None]), ['b0']),
    'cache: lutas de outro formato': ('oitolados.cache.v1', dict(events=[dict(id='1', name='UFC', date=now, fights=[dict(id='q')])]), ['b0']),
}
checks = 0
failed = []
def check(cond, what):
    global checks
    assert cond, what
    checks += 1

with sync_playwright() as p:
    b = p.chromium.launch()
    def walk(pg, errs, label):
        """The three tabs and the closed bets, as a person would go through them: each draws, and nothing reached the page."""
        for tab in ('lutas', 'apostas', 'carteira'):
            pg.click(f'.tabbar [data-tab={tab}]', timeout=3000); pg.wait_for_timeout(150)
            check(pg.locator('.tabbar .tab').count() == 3 and pg.inner_text('#view').strip(), (label, tab, 'the screen draws'))
            if tab == 'apostas': pg.click('[data-act=filter][data-f=done]', timeout=3000); pg.wait_for_timeout(100)
        check(errs == [], (label, errs))
    first = True
    for label, (key, value, keep) in CASES.items():
        c = b.new_context(viewport=dict(width=393, height=852), locale='pt-BR', timezone_id='America/Sao_Paulo')
        c.route('**/*', lambda r: handle(r) if r.request.url.startswith('http') else r.continue_()); c.route('https://cdn.jsdelivr.net/**', local_cdn)
        pg = c.new_page(); errs = []; pg.on('pageerror', lambda e, errs=errs: errs.append(str(e)))
        seed = {'oitolados.v1': state()} if key != 'oitolados.v1' else {}
        seed[key] = value
        pg.add_init_script('if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); %s }' % ''.join('localStorage.setItem(%s, %s);' % (json.dumps(k), json.dumps(json.dumps(v))) for k, v in seed.items()))
        if first: cov.start(pg)
        try:
            pg.goto((ROOT / 'dist' / 'index.html').as_uri()); pg.wait_for_function('window.__OL && window.__OL.S', timeout=5000); pg.wait_for_timeout(600)
            walk(pg, errs, label)
            check(sorted(x['id'] for x in pg.evaluate('window.__OL.S.bets')) == keep, (label, 'what is whole stays', pg.evaluate('window.__OL.S.bets.map(x => x.id)')))
            if key == 'oitolados.cache.v1':
                check(pg.evaluate('window.__OL.D.events.length') >= 1, (label, 'the board read afterwards takes the place of what was left out'))
        except Exception as e:                       # every case is tried, so a failure says which kinds of damage break the app
            failed.append(f'{label}: {errs[:1] or str(e).splitlines()[0]}'); c.close(); continue
        if first and not failed:
            # a backup from a damaged state: shown and restored without breaking anything, with what is whole in it
            pg.click('.tabbar [data-tab=carteira]'); pg.click('[data-act=restore]')
            pg.fill('#rs', json.dumps({**state(bet(1, legs=[None]), bet(2, legs=[]), None, deposits=[None, dict(t=now - 9000, v=250)]), 'app': 'oito-lados', 'savedAt': now}))
            pg.click('[data-act=dorestore]'); pg.wait_for_timeout(300)
            check([x['id'] for x in pg.evaluate('window.__OL.S.bets')] == ['b0'] and pg.evaluate('window.__OL.S.deposits.map(d => d.v)') == [250], ('a damaged backup restores what is whole in it', pg.evaluate('window.__OL.S')))
            walk(pg, errs, 'backup com aposta estragada')
            cov.stop(pg, 'robust'); first = False
        c.close()

    # the server copy: a damaged row must not stop the screens of the device that takes it in
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    site = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT / 'dist')))
    threading.Thread(target=site.serve_forever, daemon=True).start()
    SITE = f'http://127.0.0.1:{site.server_address[1]}/index.html'
    page = (ROOT / 'dist' / 'index.html').read_text()
    for name, to in (('CLOUD_URL', 'https://testetestetest.supabase.co'), ('CLOUD_KEY', 'sb_publishable_teste_teste_teste')):
        assert len(re.findall(name + r'(?:: | = )"[^"]*"', page)) == 1, ('the page has the constant once', name)
        page = re.sub(name + r'(: | = )"[^"]*"', lambda m: f'{name}{m.group(1)}"{to}"', page)
    CLOUD.update(down=False, log=[], users={'u1': 'lucas@exemplo.com'}, passwords={'u1': 'senha-boa-123'}, confirm=False, tokens={}, refresh={}, seq=0,
                 rows={'u1': state(bet(1, legs=[None]), bet(2, legs=[{}]), None)})
    c = b.new_context(viewport=dict(width=393, height=852), locale='pt-BR', timezone_id='America/Sao_Paulo', service_workers='block')
    def own(r):
        if r.request.url.split('?')[0] == SITE: r.fulfill(status=200, content_type='text/html; charset=utf-8', body=page)
        else: r.continue_()
    c.route('**/*', lambda r: own(r) if r.request.url.startswith(SITE.rsplit('/', 1)[0]) or not r.request.url.startswith('http') else handle(r)); c.route('https://cdn.jsdelivr.net/**', local_cdn)
    pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    try:
        pg.goto(SITE); pg.wait_for_function('window.__OL && window.__OL.S'); pg.click('.tabbar [data-tab=carteira]'); pg.wait_for_selector('#cloudemail')
        pg.fill('#cloudemail', 'lucas@exemplo.com'); pg.fill('#cloudpass', 'senha-boa-123'); pg.click('[data-act=cloudin]')
        pg.wait_for_function('() => { const e = document.getElementById("cloudstatus"); return e && e.textContent.includes("Sincronizado às"); }', timeout=10000)
        check([x['id'] for x in pg.evaluate('window.__OL.S.bets')] == ['b0'], ('a device with nothing takes the whole of the server copy, and only that', pg.evaluate('window.__OL.S.bets')))
        walk(pg, errs, 'linha do servidor com aposta estragada')
    except Exception as e:
        failed.append(f'linha do servidor com aposta estragada: {errs[:1] or str(e).splitlines()[0]}')
    c.close(); site.shutdown()
    b.close()
if failed: sys.exit('o app quebrou com dados estragados:\n  ' + '\n  '.join(failed))
print(f'{checks}/{checks} robustness checks passed: {len(CASES)} damaged saves and caches, a damaged backup and a damaged server row')
