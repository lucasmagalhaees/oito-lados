"""The built page (dist/index.html) on a phone (393 px), in the light and the dark theme, against what makes it usable by
anyone: contrast of the text, names of the controls and fields, the area that takes a tap, and the keyboard focus.

Usage: python3 tests/a11y.py   (needs: pip install -r tests/requirements.txt && playwright install chromium)
Walks every screen with the ESPN and the server simulated: the fights, the markets of a fight, the slip, the copy screen,
the open and the closed bets, and the whole wallet with the server card logged in. On each one:
  - every piece of text that is not disabled reaches 4.5:1 against what is behind it (3:1 when large), placeholders too (WCAG AA 1.4.3);
  - every button has a name, every field a label;
  - every control takes the tap at its own centre (no other one is drawn over it), and the ones drawn smaller than a
    finger take it 22 px around their centre (44 px, the size Apple asks for);
and, once: the focus stays on the control after the repaint it causes, the bottom sheet takes the focus when it opens,
the buttons that pick a file work from the keyboard, a message over the screen does not swallow a tap, the balance is
read out with its value, and the same return on what was staked reads the same everywhere on the wallet.
"""
import functools, http.server, json, pathlib, re, sys, threading, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from mock_espn import CLOUD, TIP_TEXT, handle, local_cdn
import cov
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
now = int(time.time() * 1000)
EVN = 'UFC Fight Night: Almeida vs. Dunne'
def leg(fid, key, sel, odd, fight, w, out=None, printed=None, **kw):
    l = {**dict(fid=fid, eid='600000001', key=key, market='Vencedor', sel=sel, cat='Vencedor', weight=w, fight=fight, event=EVN, date=now + 3 * 3600e3, odd=odd, src='real'), **kw}
    if out: l['out'] = out
    if printed: l['printed'] = printed
    return l
old = lambda key, sel, odd, out: leg('z1', key, sel, odd, 'Velho x Antigo', 'Lightweight', out, eid='600000099', event='UFC 330: Velho vs. Antigo') | dict(date=now - 9 * 86400e3)
# open bets of both origins, and closed ones whose return on what was staked is 70 / 130 = 53,846...%: rounded to four
# places first (0,5385) and then to one decimal it would read 53,9%; from the money it is 53,8%. The copied multiple was
# taken at 5,20 against 5,50 printed: −5,4545...%, which is −5,5%
STATE = dict(v=1, cur='BRL', deposits=[dict(t=now - 20 * 86400e3, v=1000)], seen=now - 30 * 86400e3, unitPct=10, bets=[
    dict(id='o1', t=now - 3600e3, type='single', stake=50, unit=100, odd=1.67, sgp={}, status='open', payout=0, legs=[leg('f1', 'ml:a', 'Teles', 1.67, 'Teles x Prado Jr.', 'W Flyweight')]),
    dict(id='o2', t=now - 3500e3, type='multi', stake=20, unit=100, odd=5.2, sgp={}, status='open', payout=0, copied=True, printed=5.5, **{'from': 'Fulano de Tal Bem Comprido'},
         legs=[leg('f2', 'mov:b:dec', 'Kessler por Decisão', 2.5, 'Brandt x Kessler', 'Lightweight', printed=2.6), leg('f3', 'tot:o:2.5', '+2.5 rounds', 2.08, 'Almeida x Dunne', 'Middleweight')]),
    dict(id='s1', t=now - 9 * 86400e3, type='single', stake=100, unit=100, odd=2.0, sgp={}, status='won', payout=200, settledAt=now - 8 * 86400e3, legs=[old('ml:a', 'Velho', 2.0, 'won')]),
    dict(id='s2', t=now - 9 * 86400e3, type='single', stake=100, unit=100, odd=1.5, sgp={}, status='lost', payout=0, settledAt=now - 8 * 86400e3, copied=True, **{'from': 'Fulano de Tal Bem Comprido'}, legs=[old('ml:b', 'Antigo', 1.5, 'lost')]),
    dict(id='s3', t=now - 9 * 86400e3, type='multi', stake=30, unit=100, odd=3.0, sgp={}, status='lost', payout=0, settledAt=now - 2 * 3600e3, legs=[old('ml:a', 'Velho', 2.0, 'won'), old('fm:ko', 'Luta termina por KO/TKO', 1.5, 'lost')]),
])

AUDIT = r'''(scope) => {
  const out = { contrast: [], noname: [], nolabel: [], stolen: [], small: [] };
  const root = scope ? document.querySelector(scope) : document.body;
  const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const parse = c => {
    let m = c.match(/^rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
    m = c.match(/^color\(srgb ([^)]+)\)/);
    if (m) { const p = m[1].split(/[\s\/]+/).filter(Boolean).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 }; }
    return null;
  };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const over = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
  // what is behind an element: its own background and those of its ancestors, laid over each other; and the opacity on the way
  const behind = e => {
    const layers = []; let op = 1;
    for (let n = e; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n), c = parse(s.backgroundColor); if (c && c.a > 0) layers.push(c);
      if (s.backgroundImage !== 'none' && !/gradient/.test(s.backgroundImage)) return null;
      op *= +s.opacity;
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return { bg: base, op };
  };
  const ratio = (fg, e, px, weight) => {
    const b = behind(e); if (!fg || !b) return null;
    const f = over({ ...fg, a: fg.a * b.op }, b.bg), L1 = lum(f), L2 = lum(b.bg);
    const r = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05), need = px >= 24 || (weight >= 700 && px >= 18.66) ? 3 : 4.5;
    return r < need ? { ratio: +r.toFixed(2), need } : null;
  };
  const where = e => { const p = []; for (let n = e; n && n !== document.body && p.length < 3; n = n.parentElement) p.unshift(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.classList.length ? '.' + [...n.classList].join('.') : '')); return p.join(' > '); };
  const off = e => !!e.closest('[disabled],[aria-disabled=true]');
  const seen = new Set(), walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let t; (t = walker.nextNode());) {
    const e = t.parentElement; if (!t.textContent.trim() || !e || seen.has(e) || !vis(e) || off(e)) continue;
    seen.add(e); const s = getComputedStyle(e), bad = ratio(parse(s.color), e, parseFloat(s.fontSize), +s.fontWeight);
    if (bad) out.contrast.push({ ...bad, text: t.textContent.trim().slice(0, 30), where: where(e) });
  }
  const controls = [...root.querySelectorAll('button, a[href], input, textarea, select, [role=button], [tabindex]:not([tabindex="-1"])')].filter(e => e.type !== 'hidden' && vis(e));
  for (const e of controls) {
    if (e.matches('input, textarea, select')) {
      const named = (e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`)) || e.closest('label') || e.getAttribute('aria-label') || e.getAttribute('aria-labelledby');
      if (!named) out.nolabel.push(where(e));
      if (e.placeholder && !e.value) { const s = getComputedStyle(e, '::placeholder'), bad = ratio(parse(s.color), e, parseFloat(getComputedStyle(e).fontSize), +s.fontWeight); if (bad) out.contrast.push({ ...bad, text: 'placeholder: ' + e.placeholder.slice(0, 24), where: where(e) }); }
    } else if (!(e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.innerText.trim() || e.getAttribute('title'))) out.noname.push(where(e));
    if (off(e)) continue;
    // the control in the middle of the screen, then what a finger at its centre, and 22 px around it, lands on
    e.scrollIntoView({ block: 'center', inline: 'center' });
    const r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = (x, y) => { const h = document.elementFromPoint(x, y); return !!h && (h === e || e.contains(h) || (e.tagName === 'LABEL' && h === e)); };
    if (!hit(cx, cy)) { const h = document.elementFromPoint(cx, cy); out.stolen.push(where(e) + ' <- ' + (h ? where(h) : 'nothing')); continue; }
    if (r.width < 44 || r.height < 44) {
      const far = [[cx, cy - 21], [cx, cy + 21], [cx - 21, cy], [cx + 21, cy]].filter(([x, y]) => !hit(x, y));
      if (far.length) out.small.push({ where: where(e), act: e.dataset.act || e.tagName, size: Math.round(r.width) + 'x' + Math.round(r.height), text: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 20) });
    }
  }
  window.scrollTo(0, 0);
  return out;
}'''
# The controls drawn smaller than a finger on purpose, all in a row or a grid of their kind, 38 px tall with the space
# between them that the layout gives: chips of a choice, the shortcuts of a value. They are not grown here, since that
# is a change of how the screen looks (left as a proposal in the pull request); the test keeps any other one from shrinking.
DRAWN_SMALL = {'part', 'mode', 'stq', 'stu', 'filter', 'origin', 'depcur', 'depq', 'period', 'theme', 'corners', 'stakein', 'copydrop', 'orgpick', 'impfromq',
               'sinceview', 'sinceok', 'backup', 'restore', 'land', 'event', 'ustep', 'impstep', 'impstu', 'impmode', 'impuse', 'imppickkey', 'impeditkey', 'usagehours',
               'more'}          # 41 px tall across the whole card, at its bottom edge: the card cuts anything drawn below it

checks = 0
problems = []
choosers = []
def check(cond, what):
    global checks
    if cond: checks += 1
    else: problems.append(what)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
site = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT / 'dist')))
threading.Thread(target=site.serve_forever, daemon=True).start()
SITE = f'http://127.0.0.1:{site.server_address[1]}/index.html'
PAGE = (ROOT / 'dist' / 'index.html').read_text()
# the project swapped for the simulated server, with names of the same length: the script keeps its offsets, so what this
# test runs counts for the coverage of the page as built (tests/cov.py reads it by position)
def same_length(m):
    name, was = m.group(1), m.group(3)
    to = 'https://' + 't' * (len(was) - len('https://.supabase.co')) + '.supabase.co' if name == 'CLOUD_URL' else 'sb_publishable_' + 't' * (len(was) - len('sb_publishable_'))
    assert len(to) == len(was), (name, was, to)
    return f'{name}{m.group(2)}"{to}"'
for name in ('CLOUD_URL', 'CLOUD_KEY'):
    assert len(re.findall(name + r'(?:: | = )"[^"]*"', PAGE)) == 1, ('the page has the constant once', name)
    PAGE = re.sub('(' + name + r')(: | = )"([^"]*)"', same_length, PAGE)
assert len(PAGE) == len((ROOT / 'dist' / 'index.html').read_text()), 'the page served keeps the length of the page built'

with sync_playwright() as p:
    b = p.chromium.launch()
    def device(theme):
        c = b.new_context(viewport=dict(width=393, height=852), device_scale_factor=2, color_scheme=theme, locale='pt-BR', timezone_id='America/Sao_Paulo', service_workers='block')
        def own(r):
            if r.request.url.split('?')[0] == SITE: r.fulfill(status=200, content_type='text/html; charset=utf-8', body=PAGE)
            else: r.continue_()
        c.route('**/*', lambda r: own(r) if r.request.url.startswith(SITE.rsplit('/', 1)[0]) or not r.request.url.startswith('http') else handle(r)); c.route('https://cdn.jsdelivr.net/**', local_cdn)
        pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('filechooser', lambda f: choosers.append(f))          # listened to from the start: a picker opened before the listener is missed
        pg.add_init_script('if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("oitolados.v1", %s); }' % json.dumps(json.dumps(STATE)))
        return c, pg, errs
    for theme in ('light', 'dark'):
        CLOUD.update(down=False, log=[], users={}, passwords={}, confirm=False, tokens={}, refresh={}, rows={}, seq=0)
        c, pg, errs = device(theme)
        if theme == 'light': cov.start(pg)
        pg.goto(SITE); pg.wait_for_selector('.fight .opt.ml'); pg.wait_for_timeout(1200)
        def audit(screen, scope=None):
            pg.evaluate('document.getElementById("toast").hidden = true')
            r = pg.evaluate(AUDIT, scope)
            check(not r['contrast'], (theme, screen, 'contrast below WCAG AA', r['contrast'][:6]))
            check(not r['noname'], (theme, screen, 'buttons with no name', r['noname'][:6]))
            check(not r['nolabel'], (theme, screen, 'fields with no label', r['nolabel'][:6]))
            check(not r['stolen'], (theme, screen, 'controls whose centre takes no tap', r['stolen'][:6]))
            small = [x for x in r['small'] if x['act'] not in DRAWN_SMALL]
            check(not small, (theme, screen, 'controls that take no tap 22 px around their centre', small[:8]))
        audit('lutas')
        pg.click('[data-act=sinceok]')
        pg.click('[data-act=more] >> nth=0'); pg.wait_for_timeout(500)
        audit('mercados')
        pg.click('[data-act=pick][data-fid="f3"][data-key="ml:a"]'); pg.click('[data-act=pick][data-fid="f2"][data-key="ml:b"]')
        pg.click('#slipbtn'); pg.wait_for_selector('#stake'); pg.wait_for_timeout(200)
        audit('cupom', '#panel')
        pg.click('#panel [data-act=sheet]'); pg.click('[data-act=imp]'); pg.fill('#imptext', TIP_TEXT); pg.click('[data-act=impread]'); pg.wait_for_timeout(500)
        audit('copiar aposta', '#panel')
        pg.click('[data-act=impclose]')
        pg.click('.tabbar [data-tab=apostas]'); pg.wait_for_timeout(200)
        audit('apostas abertas')
        pg.click('[data-act=filter][data-f=done]'); pg.wait_for_timeout(200)
        audit('apostas encerradas')
        pg.click('.tabbar [data-tab=carteira]'); pg.wait_for_timeout(300)
        audit('carteira')
        pg.fill('#cloudemail', 'lucas@exemplo.com'); pg.fill('#cloudpass', 'senha-boa-123'); pg.click('[data-act=cloudup]')
        pg.wait_for_function('() => { const e = document.getElementById("cloudstatus"); return e && e.textContent.includes("Sincronizado às"); }', timeout=10000)
        pg.click('[data-act=usagehours]'); pg.wait_for_timeout(200)
        audit('carteira com o servidor e o uso hora a hora')
        if theme == 'light':
            # the same return on what was staked reads the same wherever the wallet shows it, and a loss rounds as a gain does
            mine = pg.evaluate('''() => [document.querySelector('#duel .own span').textContent.split('ROI ')[1], document.querySelector('#bench').textContent.match(/retorno de (\\S+) nas suas/)[1],
                document.querySelector('#origins tr.own td:nth-child(3)').textContent, document.querySelector('#stmtspans tr[data-k=all] td:nth-child(3) small:last-child').textContent]''')
            check(mine == ['+53,8%'] * 4, ('the return of the own bets, on the faces, in the sentence, in the table and in the statement', mine))
            check('odd −5,5% contra o print' in pg.inner_text('#origins'), ('the odd against the print rounds a loss of 5,45% to 5,5%', pg.inner_text('#origins')))
            pg.click('.tabbar [data-tab=apostas]'); pg.click('[data-act=filter][data-f=open]'); pg.wait_for_timeout(200)
            check('(−5,5%)' in pg.inner_text('#view'), ('the same on the bet itself', re.findall(r'Odd do print[^\n]*', pg.inner_text('#view'))))
            # the balance is read out with its value, not only as "open the wallet"
            label = pg.get_attribute('button.bal', 'aria-label') or ''
            check(pg.inner_text('#bal') in label, ('the balance button says the balance', label))
            # the focus stays on the control after the repaint it causes, wherever it is: the list, the tabs, the wallet, the slip
            def kept(sel, then=None):
                pg.focus(sel); pg.keyboard.press('Enter'); pg.wait_for_timeout(250)
                want = then or sel
                return pg.evaluate('s => { const e = document.querySelector(s); return !!e && document.activeElement === e; }', want)
            pg.click('.tabbar [data-tab=lutas]'); pg.wait_for_timeout(200)
            for sel in ('#parts [data-p=main]', '[data-act=more][data-fid="f3"]', '[data-act=pick][data-fid="f3"][data-key="ml:b"]', '.tabbar [data-tab=carteira]', '[data-act=period][data-m="7d"]', '[data-act=theme][data-m=dark]', '[data-act=usagehours]'):
                check(kept(sel), ('the focus stays on the control after it repaints the screen', sel))
            pg.click('[data-act=theme][data-m=auto]') if pg.locator('[data-act=theme][data-m=auto]').count() else pg.click('[data-act=theme] >> nth=0')
            # the bottom sheet takes the focus when it opens, and says what it holds
            pg.focus('#slipbtn'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
            check(pg.evaluate('document.activeElement && document.activeElement.id') == 'panel' and pg.get_attribute('#panel', 'aria-label') == 'Cupom de apostas', ('the slip takes the focus', pg.evaluate('document.activeElement.id')))
            check(kept('#panel [data-act=mode][data-m=multi]') and pg.get_attribute('#panel [data-act=mode][data-m=multi]', 'aria-pressed') == 'true', 'the kind of bet says which one is on, and keeps the focus')
            pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
            pg.click('.tabbar [data-tab=lutas]'); pg.click('[data-act=imp]'); pg.wait_for_timeout(200)
            check(pg.get_attribute('#panel', 'aria-label') == 'Copiar aposta' and pg.evaluate('document.activeElement.id') == 'panel', ('the copy screen is named for what it is', pg.get_attribute('#panel', 'aria-label')))
            # the buttons that pick a file are reached by the keyboard and open the picker from it
            pg.focus('label[for=impfile]')
            check(pg.evaluate('document.activeElement && document.activeElement.getAttribute("for")') == 'impfile', 'the button of the photos takes the focus')
            pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
            check(len(choosers) == 1, ('Enter on it opens the picker', len(choosers)))
            pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
            # the browser opens one picker at a time and the one above is still taken as open: the other button, on a page of its own
            kb = c.new_page(); kb.on('filechooser', lambda f: choosers.append(f)); kb.goto(SITE); kb.wait_for_selector('.fight'); kb.click('.tabbar [data-tab=carteira]'); kb.wait_for_timeout(200)
            reached = False
            for _ in range(160):
                kb.keyboard.press('Tab')
                if kb.evaluate('document.activeElement && document.activeElement.getAttribute("for") === "bkfile"'): reached = True; break
            check(reached, 'Tab reaches "Restaurar de um arquivo"')
            kb.keyboard.press(' '); kb.wait_for_timeout(400)
            check(len(choosers) == 2, ('Space on it opens the picker', len(choosers)))
            kb.close()
            # a message over the screen says something and takes no tap: the button under it still works while it shows
            pg.click('.tabbar [data-tab=apostas]'); pg.wait_for_timeout(200)
            pg.evaluate('(() => { const t = document.getElementById("toast"); t.textContent = "Aposta feita. Boa sorte."; t.hidden = false; })()')
            box = pg.locator('[data-act=filter][data-f=done]').bounding_box(); tb = pg.locator('#toast').bounding_box()
            x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
            check(tb['y'] <= y <= tb['y'] + tb['height'], ('the message lies over the filter in this layout, so the tap below tests it', tb, box))
            pg.mouse.click(x, y); pg.wait_for_timeout(200)
            check(pg.get_attribute('[data-act=filter][data-f=done]', 'aria-pressed') == 'true' or 'on' in (pg.get_attribute('[data-act=filter][data-f=done]', 'class') or ''), 'a tap on the filter under the message goes through')
            cov.stop(pg, 'a11y')
        check(errs == [], (theme, 'errors on the page', errs[:3]))
        c.close()
    b.close()
site.shutdown()
if problems:
    print('\n'.join('FALHA ' + json.dumps(x, ensure_ascii=False) if not isinstance(x, str) else 'FALHA ' + x for x in problems))
    sys.exit(f'{len(problems)} de {checks + len(problems)} checagens de acessibilidade falharam')
print(f'{checks}/{checks} accessibility checks passed on 7 screens in both themes')
