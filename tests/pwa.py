"""The service worker, end to end: the app opens without a connection and offers a new version when one is published.

Usage: python3 tests/pwa.py   (needs dist/ built: npm run build)
Service workers only run over http(s), so this is the one test that serves dist/ from a local web server instead of
opening the file. Two "publications" are served in turn: the build as it is, and a copy that stands for a later one
(another page, another sw.js). ESPN is the mock, as in the other tests.
"""
import http.server, pathlib, re, sys, threading, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from mock_espn import handle
import cov
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
if not (DIST / 'sw.js').exists():
    sys.exit('falta dist/sw.js: rode  npm run build')

page_a, sw_a = (DIST / 'index.html').read_text(encoding='utf-8'), (DIST / 'sw.js').read_text(encoding='utf-8')
# The worker's own requests cannot be intercepted by the test, so the sw.js served here keeps files from one address
# only: the second local server below, standing for the font and image-reader hosts. Otherwise the worker would go to
# the real Google Fonts on every page load. Which hosts the real sw.js names is checked by docs_check.py.
hosts = re.search(r"const ASSET_HOSTS = \[[^\]]*\];", sw_a)
assert hosts, 'sw.js no longer declares ASSET_HOSTS the way this test expects'
sw_a = sw_a.replace(hosts.group(0), "const ASSET_HOSTS = ['localhost'];")
version_a = re.search(r"const VERSION = '([0-9a-f]{12})';", sw_a).group(1)
# a later publication: a page that says so, with another commit stamp, and the sw.js the build would emit for it
page_b = re.sub(r'<meta name="ol-commit" content="[^"]*">', '<meta name="ol-commit" content="bbbbbbb000000000000000000000000000000000"><meta name="ol-test" content="b">', page_a)
sw_b = sw_a.replace(version_a, 'bbbbbbbbbbbb')
page_c, sw_c = page_b.replace('bbbbbbb0', 'ddddddd0'), sw_b.replace('bbbbbbbbbbbb', 'dddddddddddd')        # and one more after that
assert page_b != page_a and sw_b != sw_a and page_c != page_b and sw_c != sw_b
site = {'page': page_a, 'sw': sw_a, 'down': False, 'hits': []}
class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?')[0]; site['hits'].append(path)
        if site['down']:
            self.send_response(503); self.end_headers(); return
        body, kind = (site['sw'], 'text/javascript') if path == '/sw.js' else (site['page'], 'text/html; charset=utf-8') if path in ('/', '/index.html') else (None, None)
        if body is None:
            self.send_response(404); self.end_headers(); return
        data = body.encode('utf-8')
        self.send_response(200); self.send_header('Content-Type', kind); self.send_header('Cache-Control', 'public, max-age=0, must-revalidate')
        self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data)
    def log_message(self, *a):
        pass

srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}'

# The second local server: the one address the worker keeps files from in this test (see above).
other = {'hits': 0, 'down': False}
PROBE = '.probe{color:red}'
class Other(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        other['hits'] += 1
        if other['down']:
            self.send_response(503); self.end_headers(); return
        data = PROBE.encode('utf-8')
        self.send_response(200); self.send_header('Content-Type', 'text/css'); self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data)
    def log_message(self, *a):
        pass
srv2 = http.server.ThreadingHTTPServer(('localhost', 0), Other)
threading.Thread(target=srv2.serve_forever, daemon=True).start()
OTHER = f'http://localhost:{srv2.server_address[1]}'
fails, n = [], 0

def check(name, cond, detail=''):
    global n
    n += 1
    if not cond:
        fails.append(f'{name}{": " + str(detail) if detail != "" else ""}')

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport=dict(width=393, height=852), locale='pt-BR', timezone_id='America/Sao_Paulo', service_workers='allow')
    ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) or r.request.url.startswith(OTHER) else handle(r))      # the site is real, ESPN is the mock
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    cov.start(pg)
    pg.goto(BASE + '/index.html'); pg.wait_for_function('window.__OL && window.__OL.S')

    # first visit: the worker installs, takes the page, and there is nothing to update from
    pg.wait_for_function('navigator.serviceWorker.controller !== null', timeout=15000)
    keys = pg.evaluate('caches.keys()')
    check('the page is kept on the device under this version', f'oito-lados-page-{version_a}' in keys, keys)
    check('a first install does not announce an update', pg.evaluate('document.getElementById("update").hidden') is True)
    pg.click('[data-act=tab][data-tab=carteira]')
    version = pg.inner_text('#version')
    check('the wallet says which version this is', re.search(r'Versão [0-9a-f]{7}\.', version) and 'também sem internet' in version, version)
    pg.click('[data-act=checkupdate]'); pg.wait_for_function('!document.getElementById("toast").hidden')
    check('asked by hand with nothing new: says so', 'já está na versão mais recente' in pg.inner_text('#toast'), pg.inner_text('#toast'))

    # no connection at all: the page still opens, from the device
    site['down'] = True; before = len(site['hits'])
    cov.reload(pg); pg.wait_for_function('window.__OL && window.__OL.S')
    check('opens with the site unreachable', pg.title() == 'Oito Lados' and pg.evaluate('!!document.getElementById("bal").textContent'), pg.title())
    check('the page did not come from the network', '/index.html' not in site['hits'][before:] and '/' not in site['hits'][before:], site['hits'][before:])
    # files from other addresses (fonts, the image reader): kept the first time the worker fetches them, then served from the device
    probe = f'fetch("{OTHER}/probe.css").then(r => r.text())'
    check('a file from a kept address arrives through the worker', pg.evaluate(probe) == PROBE and other['hits'] == 1, other['hits'])
    kept = pg.evaluate('caches.open("oito-lados-assets-v1").then(c => c.keys()).then(ks => ks.map(k => k.url))')
    check('and stays on the device', kept == [OTHER + '/probe.css'], kept)
    other['down'] = True
    check('the next time it comes from the device, with that address unreachable', pg.evaluate(probe) == PROBE and other['hits'] == 1, other['hits'])
    stored = pg.evaluate('caches.keys().then(ks => Promise.all(ks.map(k => caches.open(k).then(c => c.keys())))).then(all => all.flat().map(r => r.url))')
    check('the worker keeps the page and that file, and nothing from ESPN or the exchange-rate service', sorted(stored) == sorted([BASE + '/', OTHER + '/probe.css']), stored)
    pg.click('[data-act=tab][data-tab=carteira]'); pg.click('[data-act=checkupdate]')
    pg.wait_for_function('document.getElementById("toast").textContent.includes("Sem conexão")')
    check('asked by hand with no connection: says so, and offers nothing', pg.evaluate('document.getElementById("update").hidden') is True)

    # a new version is published while the app is open
    site.update(down=False, page=page_b, sw=sw_b)
    pg.evaluate('document.dispatchEvent(new Event("visibilitychange"))')            # coming back to the app is when it looks for one
    pg.wait_for_function('!document.getElementById("update").hidden', timeout=15000)
    check('the update is announced', 'Saiu uma versão nova' in pg.inner_text('#update'), pg.inner_text('#update'))
    check('and the app in use is still the old one until the person decides', pg.evaluate('document.querySelector("meta[name=ol-test]")') is None)
    shot = ROOT / 'tests' / 'shots'; shot.mkdir(exist_ok=True); pg.evaluate('document.getElementById("toast").hidden = true; window.scrollTo(0, 0)'); pg.screenshot(path=str(shot / 's20-versao-nova.png'))
    cov.keep(pg)                                                                     # the page reloads by itself next
    pg.click('[data-act=update]')
    pg.wait_for_function('document.querySelector("meta[name=ol-test]") !== null && window.__OL && window.__OL.S', timeout=15000)
    check('after the tap the page is the new version', pg.evaluate('document.querySelector("meta[name=ol-commit]").content').startswith('bbbbbbb'))
    check('and the notice is gone', pg.evaluate('document.getElementById("update").hidden') is True)
    pg.wait_for_function('caches.keys().then(k => k.filter(x => x.startsWith("oito-lados-page-")).length === 1)', timeout=15000)
    keys = pg.evaluate('caches.keys()')
    check('the old copy of the page was thrown away', 'oito-lados-page-bbbbbbbbbbbb' in keys and f'oito-lados-page-{version_a}' not in keys, keys)
    pg.click('[data-act=tab][data-tab=carteira]')
    check('the wallet shows the new version', 'Versão bbbbbbb.' in pg.inner_text('#version'), pg.inner_text('#version'))

    # publishing again without changing the app (same sw.js) asks nothing of anyone
    site['page'] = page_b.replace('bbbbbbb0', 'ccccccc0')
    pg.evaluate('document.dispatchEvent(new Event("visibilitychange"))'); pg.wait_for_timeout(1500)
    check('a publication that does not change the app is not announced', pg.evaluate('document.getElementById("update").hidden') is True)
    cov.stop(pg, 'pwa')

    # a version that was announced and never accepted takes over by itself once the app is closed and opened again
    site.update(page=page_c, sw=sw_c)
    pg.evaluate('document.dispatchEvent(new Event("visibilitychange"))')
    pg.wait_for_function('!document.getElementById("update").hidden', timeout=15000)
    pg.close()
    time.sleep(1)                # nobody reopens an app in the same instant; the browser hands over once the closed page is gone
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '/'); pg.wait_for_function('window.__OL && window.__OL.S')
    check('closing the app and opening it again lands on the new version', pg.evaluate('document.querySelector("meta[name=ol-commit]").content').startswith('ddddddd'), pg.evaluate('document.querySelector("meta[name=ol-commit]").content'))
    check('with nothing left to announce', pg.evaluate('document.getElementById("update").hidden') is True)
    check('no script errors', not errs, errs)
    browser.close()
srv.shutdown(); srv2.shutdown()

for f in fails:
    print('FAIL', f)
print(f'{n - len(fails)}/{n} offline and update checks passed')
sys.exit(1 if fails else 0)
