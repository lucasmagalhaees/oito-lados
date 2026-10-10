"""End-to-end run of the built page (dist/index.html) against a mocked ESPN API.

Usage: python3 tests/e2e.py [dark|light]   (needs: pip install -r tests/requirements.txt && playwright install chromium)
Walks one fictional card through pre-fight -> live -> final, places singles, parlays and same-fight combos through the UI,
and prints prices, settlements and the final balance (expected: R$ 1.609,59).
"""
import json, re, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from mock_espn import PHASE, FX, handle, calls, local_cdn, cdn_calls, CDN_DOWN, ocr_files_installed, PRINT_HTML, TIP_TEXT
import base64
import cov
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHOTS = ROOT / 'tests' / 'shots'; SHOTS.mkdir(exist_ok=True)

if not ocr_files_installed():
    sys.exit('faltam os arquivos do leitor de imagem: rode  npm ci --prefix tests')

errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport=dict(width=393, height=852), device_scale_factor=2, color_scheme=sys.argv[1] if len(sys.argv)>1 else 'dark', locale='pt-BR', timezone_id='America/Sao_Paulo')
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append(m.text) if m.type in ('error',) else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR '+str(e)))
    pg.route('**/*', lambda r: handle(r) if r.request.url.startswith('http') else r.continue_())
    ctx.route('https://cdn.jsdelivr.net/**', local_cdn); pg.route('https://cdn.jsdelivr.net/**', local_cdn)
    cov.start(pg)
    pg.goto((ROOT / 'dist' / 'index.html').as_uri())
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
    # money fields: thousands mask while typing, and the display currency
    pg.click('[data-act=tab][data-tab=carteira]')
    # units chosen with an empty bankroll: there is no unit yet, so the card says so and the slip asks for money
    pg.click('[data-act=stakein][data-m=units]'); assert 'Ainda não há unidade' in pg.inner_text('#stakehow'), pg.inner_text('#stakehow')
    pg.click('.tabbar [data-tab=lutas]'); pg.click('[data-act=pick][data-fid="f1"][data-key="ml:a"]'); pg.click('#slipbtn'); pg.wait_for_selector('#stake')
    assert pg.locator('#stakeu').count() == 0 and 'Valor em dinheiro' in pg.inner_text('#panel'), pg.inner_text('#panel')
    pg.click('#panel [data-act=sheet]'); pg.click('[data-act=pick][data-fid="f1"][data-key="ml:a"]')
    pg.click('.tabbar [data-tab=carteira]'); pg.click('[data-act=stakein][data-m=money]')
    assert pg.evaluate('window.__OL.S.stakeIn') == 'money' and pg.evaluate('window.__OL.slip.sels.length') == 0
    pg.click('#dep'); pg.keyboard.type('1234567,891')
    assert pg.input_value('#dep') == '1.234.567,89', pg.input_value('#dep')
    for _ in range(5): pg.keyboard.press("Backspace")
    assert pg.input_value('#dep') == '12.345', pg.input_value('#dep')
    pg.keyboard.press('Home'); pg.keyboard.type('9')                   # editing at the start keeps the caret there
    assert pg.input_value('#dep') == '912.345', pg.input_value('#dep')
    pg.keyboard.type('8'); assert pg.input_value('#dep') == '9.812.345', pg.input_value('#dep')
    pg.fill('#dep', ''); pg.click('[data-act=depq][data-v="1000"]'); pg.click('[data-act=depq][data-v="500"]')
    assert pg.input_value('#dep') == '1.500', pg.input_value('#dep')
    # the deposit card has the high shortcuts too, and they add up like the others
    assert [pg.inner_text(f'[data-act=depq][data-v="{v}"]').replace('\xa0', ' ') for v in (10000, 100000, 1000000)] == ['R$ 10.000', 'R$ 100.000', 'R$ 1.000.000']
    for v, want in [('10000', '11.500'), ('100000', '111.500'), ('1000000', '1.111.500')]:
        pg.click(f'[data-act=depq][data-v="{v}"]'); assert pg.input_value('#dep') == want, (v, pg.input_value('#dep'))
    assert pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') == 0, 'the deposit card must not get wider than the phone'
    shot('s23-deposito-atalhos.png')
    pg.fill('#dep', '')
    assert bal().replace('\xa0', ' ') == 'R$ 0,00', bal()
    # currency: chosen where the money comes in. With an empty bankroll it is only a symbol and no rate is asked for
    txt = lambda sel: pg.inner_text(sel).replace('\xa0', ' ')
    pg.click('[data-act=depcur][data-c=USD]')
    assert pg.inner_text('.field span') == 'US$' and 'A banca passa a ser em Dólar' in txt('#fxinfo'), txt('#fxinfo')
    assert txt('[data-act=depq][data-v="1000000"]') == 'US$ 1.000.000' and pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') == 0, 'the deposit shortcuts follow the currency of the deposit and still fit'
    assert bal().replace('\xa0', ' ') == 'R$ 0,00', 'picking a currency changes nothing by itself: ' + bal()
    assert pg.inner_text('[data-act=convonly]') == 'Só trocar a moeda para Dólar', pg.inner_text('[data-act=convonly]')
    pg.click('[data-act=convonly]'); assert bal().replace('\xa0', ' ') == 'US$ 0,00' and FX['calls'] == 0 and pg.locator('[data-act=convonly]').count() == 0, (bal(), FX['calls'])
    pg.click('[data-act=depcur][data-c=EUR]'); pg.fill('#dep', '80'); pg.click('[data-act=deposit]')
    assert bal().replace('\xa0', ' ') == '€ 80,00' and FX['calls'] == 0, (bal(), FX['calls'])
    cov.reload(pg); pg.wait_for_function('window.__OL && window.__OL.S'); assert bal().replace('\xa0', ' ') == '€ 80,00', 'the currency must survive a reload: ' + bal()
    pg.click('[data-act=tab][data-tab=carteira]')
    # with money in the bankroll, depositing in another currency converts everything at the day's rate
    FX['down'] = True; pg.click('[data-act=depcur][data-c=BRL]'); pg.wait_for_selector('#fxmsg')
    assert 'Sem cotação agora' in txt('#fxmsg') and pg.is_disabled('[data-act=deposit]') and pg.is_disabled('[data-act=convonly]'), txt('#fxmsg')
    FX['down'] = False; pg.click('[data-act=depcur][data-c=BRL]'); pg.wait_for_selector('#fxinfo b')
    info = txt('#fxinfo'); print('câmbio:', info)
    shot('s13-cambio.png')
    assert '€ 1 = R$ 6,2500' in info and 'cotação de 02/01/2026' in info and 'saldo de € 80,00 vira R$ 500,00' in info, info
    assert pg.inner_text('[data-act=deposit]') == 'Converter a banca e depositar' and FX['calls'] == 2, FX['calls']
    pg.click('[data-act=depcur][data-c=EUR]'); pg.click('[data-act=depcur][data-c=BRL]'); pg.wait_for_selector('#fxinfo b')
    assert FX['calls'] == 2, 'the rate is kept on the device and not asked for again: %d' % FX['calls']
    assert pg.evaluate('JSON.parse(localStorage.getItem("oitolados.fx.v1")).date') == '2026-01-02'
    pg.click('[data-act=deposit]'); assert bal().replace('\xa0', ' ') == '€ 80,00', 'no amount, no deposit and no conversion'
    # the kept rate expired and the fresh one is different: show it and ask again instead of converting at a rate nobody saw
    pg.fill('#dep', '500'); pg.evaluate('window.__OL.FX.ts = 0'); FX['body']['rates']['EUR'] = 0.2
    pg.click('[data-act=deposit]'); pg.wait_for_selector('#fxmsg')
    assert 'A cotação mudou' in txt('#fxmsg') and '€ 1 = R$ 5,0000' in txt('#fxinfo') and bal().replace('\xa0', ' ') == '€ 80,00', (txt('#fxmsg'), txt('#fxinfo'), bal())
    pg.evaluate('window.__OL.FX.ts = 0'); FX['body']['rates']['EUR'] = 0.16
    pg.click('[data-act=deposit]'); pg.wait_for_function('document.querySelector("#fxinfo").textContent.includes("6,2500")')
    assert bal().replace('\xa0', ' ') == '€ 80,00', bal()
    # expired again and the rate service is down: the kept rate still converts
    pg.evaluate('window.__OL.FX.ts = 0'); FX['down'] = True
    pg.click('[data-act=deposit]'); pg.wait_for_function('window.__OL.S.cur === "BRL"'); FX['down'] = False
    conv = pg.evaluate('(() => { const S = window.__OL.S; return [S.cur, S.deposits.map(d => d.v), S.conv.map(c => [c.from, c.to, c.rate, c.date])]; })()')
    assert conv == ['BRL', [500, 500], [['EUR', 'BRL', 6.25, '2026-01-02']]], conv
    assert 'Banca convertida de Euro para Real' in txt('#convlog') and '€ 1 = R$ 6,2500' in txt('#convlog'), txt('#convlog')
    assert pg.inner_text('[data-act=deposit]') == 'Depositar' and pg.inner_text('.field span') == 'R$'
    assert bal().replace('\xa0',' ') == 'R$ 1.000,00', bal()
    # converting without depositing: the whole bankroll moves to the other currency and nothing is added
    pg.click('[data-act=depcur][data-c=USD]'); pg.wait_for_selector('#fxinfo b')
    assert 'US$ 1 = R$ 5,0000' in txt('#fxinfo') and 'saldo de R$ 1.000,00 vira US$ 200,00' in txt('#fxinfo'), txt('#fxinfo')
    assert pg.inner_text('[data-act=convonly]') == 'Só converter a banca, sem depositar'
    shot('s15-converter.png'); pg.click('[data-act=convonly]'); pg.wait_for_function('window.__OL.S.cur === "USD"')
    only = pg.evaluate('(() => { const S = window.__OL.S; return [S.deposits.map(d => d.v), S.conv.length, S.conv[1].from, S.conv[1].to, S.conv[1].rate]; })()')
    assert bal().replace('\xa0', ' ') == 'US$ 200,00' and only == [[100, 100], 2, 'BRL', 'USD', 0.2], (bal(), only)
    assert pg.inner_text('[data-act=deposit]') == 'Depositar' and pg.locator('[data-act=convonly]').count() == 0
    cov.reload(pg); pg.wait_for_function('window.__OL && window.__OL.S'); assert bal().replace('\xa0', ' ') == 'US$ 200,00', 'a conversion without a deposit is saved: ' + bal()
    pg.click('[data-act=tab][data-tab=carteira]'); pg.click('[data-act=depcur][data-c=BRL]'); pg.wait_for_selector('#fxinfo b')
    pg.evaluate('window.__OL.FX.ts = 0'); FX['body']['rates']['USD'] = 0.25              # the same guard as a deposit: a rate nobody saw is shown first
    pg.click('[data-act=convonly]'); pg.wait_for_selector('#fxmsg'); assert 'A cotação mudou' in txt('#fxmsg') and bal().replace('\xa0', ' ') == 'US$ 200,00', (txt('#fxmsg'), bal())
    pg.evaluate('window.__OL.FX.ts = 0'); FX['body']['rates']['USD'] = 0.2
    pg.click('[data-act=convonly]'); pg.wait_for_function('document.querySelector("#fxinfo").textContent.includes("5,0000")')
    pg.click('[data-act=convonly]'); pg.wait_for_function('window.__OL.S.cur === "BRL"')
    assert bal().replace('\xa0',' ') == 'R$ 1.000,00' and pg.evaluate('window.__OL.S.conv.length') == 3, bal()
    pg.click('.tabbar [data-tab=lutas]')
    shot('s1-lutas.png')
    pick = lambda fid, key: pg.click(f'[data-act=pick][data-fid="{fid}"][data-key="{key}"]')
    for fid in ('f1','f2','f3'): pg.click(f'[data-act=more][data-fid="{fid}"]')
    shot('s2-markets.png', True)
    # a legend of the corner colours stays in view while the markets of a fight scroll
    key = pg.locator('.fight:has([data-fid="f3"]) .corners')
    assert pg.locator('.fight .corners').count() == 3 and key.locator('.a').inner_text() == 'ALMEIDA' and key.locator('.b').inner_text() == 'DUNNE', key.inner_text()
    pg.locator('[data-fid="f3"][data-key="wr:a:3"]').scroll_into_view_if_needed(); pg.mouse.wheel(0, 200); pg.wait_for_timeout(200)
    legend = key.bounding_box(); bar = pg.locator('header.top').bounding_box()
    assert abs(legend['y'] - (bar['y'] + bar['height'])) <= 2, ('the legend must sit right under the top bar', legend, bar)
    assert 'canto vermelho' in pg.get_attribute('[data-fid="f3"][data-key="wr:a:3"]', 'title') and 'canto azul' in pg.get_attribute('[data-fid="f3"][data-key="wr:b:3"]', 'title')
    shot('s21-legenda.png'); pg.evaluate('window.scrollTo(0, 0)')
    # over and under read as + and −, and every option that belongs to a fighter carries that fighter's corner colour
    opt = lambda key, extra='': pg.locator(f'[data-act=pick][data-fid="f3"][data-key="{key}"]{extra}')
    assert [opt('tot:o:1.5').locator('.ol').inner_text(), opt('tot:u:1.5').locator('.ol').inner_text()] == ['+1.5', '−1.5']
    assert all(opt(k, '.sa').count() == 1 for k in ('wr:a:1', 'mov:a:sub', 'tda:a:yes')) and all(opt(k, '.sb').count() == 1 for k in ('wr:b:1', 'mov:b:ko', 'tda:b:no')), 'fighter options must be marked'
    assert all(opt(k, '.sa').count() + opt(k, '.sb').count() == 0 for k in ('tot:o:1.5', 'fm:ko', 'rnd:1', 'dist:yes', 'ml:a')), 'options about the whole fight (and the winner row) are not'
    # over and under have a colour scheme of their own, different from each other and from both corners
    assert all(opt(k, '.xo').count() == 1 for k in ('tot:o:1.5', 'tot:o:3.5', 'td:o:1.5')) and all(opt(k, '.xu').count() == 1 for k in ('tot:u:1.5', 'td:u:1.5')), 'over and under must be marked'
    assert all(opt(k, '.xo').count() + opt(k, '.xu').count() == 0 for k in ('wr:a:1', 'fm:ko', 'rnd:1', 'dist:yes', 'tda:a:yes')), 'and nothing else'
    bar = lambda key: pg.evaluate('k => getComputedStyle(document.querySelector(`[data-fid="f3"][data-key="${k}"]`), "::before").backgroundColor', key)
    arrow = lambda key: pg.evaluate('k => getComputedStyle(document.querySelector(`[data-fid="f3"][data-key="${k}"] .ol`), "::before").content', key)
    corner = lambda side: pg.evaluate('s => getComputedStyle(document.querySelector(`.fight:has([data-fid="f3"]) .corners .${s} i`)).backgroundColor', side)
    neutral = lambda c: (lambda v: max(v) - min(v) <= 40)([int(x) for x in re.findall(r'\d+', c)[:3]])
    assert bar('tot:o:1.5') != bar('tot:u:1.5') and bar('tot:o:1.5') == bar('td:o:1.5') and bar('tot:u:1.5') == bar('td:u:1.5'), (bar('tot:o:1.5'), bar('tot:u:1.5'))
    assert neutral(bar('tot:o:1.5')) and neutral(bar('tot:u:1.5')) and not neutral(corner('a')) and not neutral(corner('b')), 'over and under carry no hue; the corners do'
    assert (arrow('tot:o:1.5'), arrow('tot:u:1.5')) == ('"▲"', '"▼"'), (arrow('tot:o:1.5'), arrow('tot:u:1.5'))
    # the corners come in three pairs of colours, chosen in the settings separately for men's and for women's fights
    # (f1 is a women's fight, f2 and f3 are men's); over and under look the same under all of them
    legend = lambda fid, side: pg.evaluate('([f, s]) => getComputedStyle(document.querySelector(`.fight:has([data-fid="${f}"]) .corners .${s} i`)).backgroundColor', [fid, side])
    bar_of = lambda fid, key: pg.evaluate('([f, k]) => getComputedStyle(document.querySelector(`[data-fid="${f}"][data-key="${k}"]`), "::before").backgroundColor', [fid, key])
    title_of = lambda fid, key: pg.get_attribute(f'[data-fid="{fid}"][data-key="{key}"]', 'title')
    def choose(group, pair):
        pg.click('.tabbar [data-tab=carteira]'); pg.click(f'[data-act=corners][data-g={group}][data-m={pair}]')
        assert pg.get_attribute(f'[data-act=corners][data-g={group}][data-m={pair}]', 'aria-pressed') == 'true'
    red_blue = (legend('f3', 'a'), legend('f3', 'b')); neutral_bars = (bar_of('f3', 'tot:o:1.5'), bar_of('f3', 'tot:u:1.5'))
    assert (legend('f1', 'a'), legend('f1', 'b')) == red_blue, 'until a pair is chosen, every fight is red and blue'
    choose('women', 'green-pink'); assert 'femininas em rosa e verde' in txt('#cornershow') and 'Masculinas em vermelho e azul' in txt('#cornershow'), txt('#cornershow')
    shot('s24-cantos-config.png'); pg.click('.tabbar [data-tab=lutas]')
    green_pink = (legend('f1', 'a'), legend('f1', 'b'))
    assert (legend('f3', 'a'), legend('f3', 'b')) == red_blue and (legend('f2', 'a'), legend('f2', 'b')) == red_blue, "choosing for women's fights leaves the men's alone"
    assert bar_of('f1', 'wr:a:1') == green_pink[0] and bar_of('f1', 'wr:b:1') == green_pink[1], "a fighter's option carries the colour of the legend"
    assert 'canto rosa' in title_of('f1', 'wr:a:1') and 'canto verde' in title_of('f1', 'wr:b:1') and 'canto vermelho' in title_of('f3', 'wr:a:1')
    pick('f1', 'mov:a:ko'); pick('f3', 'mov:b:ko'); pg.click('#slipbtn'); pg.wait_for_selector('#panel .sel .sd')
    marks = pg.evaluate('[...document.querySelectorAll("#panel .sel .sd")].map(e => getComputedStyle(e).backgroundColor)')
    assert marks == [green_pink[0], red_blue[1]], ('in the slip each selection carries the colour of its own fight', marks)
    pg.click('#panel [data-act=sheet]'); pick('f1', 'mov:a:ko'); pick('f3', 'mov:b:ko')
    pg.locator('[data-fid="f1"][data-key="td:o:1.5"]').scroll_into_view_if_needed(); shot('s24-cantos-femininas.png'); pg.evaluate('window.scrollTo(0, 0)')
    choose('men', 'purple-orange'); pg.click('.tabbar [data-tab=lutas]')
    purple_orange = (legend('f3', 'a'), legend('f3', 'b'))
    assert (legend('f1', 'a'), legend('f1', 'b')) == green_pink and (legend('f2', 'a'), legend('f2', 'b')) == purple_orange and 'canto laranja' in title_of('f3', 'wr:a:1') and 'canto roxo' in title_of('f3', 'wr:b:1')
    assert len(set(red_blue + green_pink + purple_orange)) == 6 and not any(neutral(c) for c in green_pink + purple_orange), (red_blue, green_pink, purple_orange)
    assert (bar_of('f3', 'tot:o:1.5'), bar_of('f3', 'tot:u:1.5')) == neutral_bars and (bar_of('f1', 'td:o:1.5'), bar_of('f1', 'td:u:1.5')) == neutral_bars, 'over and under do not follow the corners'
    pg.locator('[data-fid="f3"][data-key="td:o:1.5"]').scroll_into_view_if_needed(); shot('s24-cantos-masculinas.png'); pg.evaluate('window.scrollTo(0, 0)')
    assert pg.evaluate('window.__OL.S.corners') == {'men': 'purple-orange', 'women': 'green-pink'}, pg.evaluate('window.__OL.S.corners')
    choose('men', 'red-blue'); choose('women', 'red-blue'); pg.click('.tabbar [data-tab=lutas]')
    assert pg.evaluate('"corners" in window.__OL.S') is False and (legend('f1', 'a'), legend('f3', 'b')) == red_blue, 'red and blue is the absence of a choice'
    corner = lambda key: pg.evaluate('k => getComputedStyle(document.querySelector(`[data-fid="f3"][data-key="${k}"]`), "::before").backgroundColor', key)
    assert corner('wr:a:1') != corner('wr:b:1') and corner('wr:a:1') == corner('mov:a:sub'), (corner('wr:a:1'), corner('wr:b:1'))
    pick('f3', 'wr:b:2'); pick('f3', 'tot:o:1.5'); pg.click('#slipbtn'); pg.wait_for_selector('#panel .sel')
    assert pg.locator('#panel .sel .sd.b').count() == 1 and pg.locator('#panel .sel .sd').count() == 1 and '+1.5 rounds' in pg.inner_text('#panel'), pg.inner_text('#panel')
    assert pg.locator('#panel .sel .ou.o').count() == 1, 'the over in the slip carries its arrow'
    shot('s18-cores.png'); pg.click('#panel [data-act=unpick]'); pg.click('#panel [data-act=unpick]')
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
    # copy a bet: first from a pasted tip, then from a print read on the device, then something that is not on the card
    pg.click('.tabbar [data-tab=lutas]'); pg.click('[data-act=imp]')
    pg.fill('#imptext', TIP_TEXT); pg.click('[data-act=impread]'); pg.wait_for_selector('#impres')
    got = pg.inner_text('#impres'); value = pg.inner_text('#impvalue').replace('\xa0', ' ')
    assert 'Connor Lee Dunne vence' in got and 'Odd do print 1.44' in got and 'odd agora 2.05' in got, got
    assert value == 'R$ 50,00 · 0,5u', value
    pg.click('[data-act=impgo]'); pg.wait_for_selector('#stake')
    assert pg.input_value('#stake') == '50' and pg.evaluate('JSON.stringify(window.__OL.slip.sels)') == '[{"fid":"f3","key":"ml:b"}]', pg.evaluate('JSON.stringify(window.__OL.slip)')
    pg.click('#panel [data-act=unpick]')
    art = ctx.new_page(); art.set_content(PRINT_HTML); art.locator('#print').screenshot(path=str(SHOTS / 'print.png')); art.close()
    CDN_DOWN['on'] = True                                             # the reader cannot be downloaded: say so and offer the text route
    pg.click('[data-act=imp]'); pg.set_input_files('#impfile', str(SHOTS / 'print.png')); pg.wait_for_selector('#panel .msg')
    assert 'Não consegui ler a imagem' in pg.inner_text('#panel .msg'), pg.inner_text('#panel .msg')
    CDN_DOWN['on'] = False
    pg.set_input_files('#impfile', str(SHOTS / 'print.png')); pg.wait_for_selector('#impres', timeout=120000)
    got = pg.inner_text('#impres'); value = pg.inner_text('#impvalue').replace('\xa0', ' '); read = pg.input_value('#imptext')
    print('print lido:', ' | '.join(read.splitlines()))
    assert 'Connor Lee Dunne vence' in got and 'Odd do print 2.05' in got, got
    assert value == 'R$ 250,00 · 2,5u' and 'mesmo valor do print' in pg.inner_text('#panel'), value
    shot('s12-copiar.png'); pg.click('[data-act=impgo]'); pg.wait_for_selector('#stake')
    assert pg.input_value('#stake') == '250' and pg.evaluate('window.__OL.slip.sels.length') == 1, pg.input_value('#stake')
    pg.click('#panel [data-act=unpick]')
    # what a copied bet brings follows the one setting for stakes: in money the same amount, in units the same stake
    MONEY_TIP = 'Almeida x Dunne\nDunne para vencer a luta\nR$ 250,00'; BOTH_TIP = MONEY_TIP + '\nStake 2u'
    def copied(text, expect_how):
        pg.click('.tabbar [data-tab=lutas]'); pg.click('[data-act=imp]'); pg.fill('#imptext', text); pg.click('[data-act=impread]'); pg.wait_for_selector('#impres')
        value = txt('#impvalue'); panel = txt('#panel'); assert expect_how in panel, panel
        pg.click('[data-act=impclose]'); return value
    pg.click('.tabbar [data-tab=carteira]')
    assert pg.locator('#tipcard, [data-act=tipmode], #tipsrc').count() == 0, 'there is no separate setting for prints, and nothing asks what a unit is worth to whoever made the print'
    assert 'Ao copiar um print: mesmo valor.' in txt('#tiphow') and 'vira uma aposta de R$ 1.750,00' in txt('#tiphow'), txt('#tiphow')
    assert copied(MONEY_TIP, 'mesmo valor do print') == 'R$ 250,00 · 2,5u'
    assert copied(BOTH_TIP, 'mesmo valor do print · o original também fala em 2u') == 'R$ 250,00 · 2,5u', 'in money, an original that states both brings its money, and says what it left out'
    assert copied(TIP_TEXT, '0,5u do print') == 'R$ 50,00 · 0,5u', 'in money, an original with units only brings those units'
    pg.click('.tabbar [data-tab=carteira]'); pg.click('[data-act=stakein][data-m=units]')
    assert 'Ao copiar um print: mesma stake.' in txt('#tiphow') and 'vira 2u sua (R$ 200,00)' in txt('#tiphow'), txt('#tiphow')
    pg.locator('#stakecard').scroll_into_view_if_needed(); shot('s14-print-config.png')
    assert copied(BOTH_TIP, '2u do print · o original também traz R$ 250,00') == 'R$ 200,00 · 2u', 'in units, an original that states both brings its units, and says what it left out'
    assert copied(MONEY_TIP, 'mesmo valor do print') == 'R$ 250,00 · 2,5u', 'in units, an original with money only brings that money, counted in units'
    assert copied(TIP_TEXT, '0,5u do print') == 'R$ 50,00 · 0,5u'
    pg.click('.tabbar [data-tab=lutas]'); pg.click('[data-act=imp]'); pg.fill('#imptext', BOTH_TIP); pg.click('[data-act=impread]'); pg.wait_for_selector('#impres')
    pg.click('[data-act=impgo]'); pg.wait_for_selector('#stakeu')
    assert pg.input_value('#stakeu') == '2' and 'R$ 200,00 · 2u' in txt('#slipsum'), (pg.input_value('#stakeu'), txt('#slipsum'))
    pg.click('#panel [data-act=unpick]')
    pg.click('.tabbar [data-tab=carteira]'); pg.click('[data-act=stakein][data-m=money]'); pg.click('.tabbar [data-tab=lutas]'); pg.click('[data-act=imp]')
    # appearance: automatic follows the device; light and dark hold whatever the device says
    pg.click('[data-act=impclose]'); pg.click('.tabbar [data-tab=carteira]')
    DARK, LIGHT = 'rgb(14, 18, 24)', 'rgb(242, 243, 245)'
    paper = lambda: pg.evaluate('getComputedStyle(document.body).backgroundColor')
    bars = lambda: pg.evaluate('[...document.querySelectorAll("meta[name=theme-color]")].map(m => m.content)')
    device = DARK if (sys.argv[1] if len(sys.argv) > 1 else 'dark') == 'dark' else LIGHT
    assert paper() == device and bars() == ['#0e1218', '#f2f3f5'], (paper(), bars())
    pg.click('[data-act=theme][data-m=dark]'); assert paper() == DARK and bars() == ['#0e1218', '#0e1218'], (paper(), bars())
    pg.click('[data-act=theme][data-m=light]'); assert paper() == LIGHT and bars() == ['#f2f3f5', '#f2f3f5'], (paper(), bars())
    other = 'light' if device == DARK else 'dark'                    # leave the one the device is NOT asking for, and reload
    pg.click(f'[data-act=theme][data-m={other}]'); shot('s22-tema.png')
    pg.click('[data-act=corners][data-g=women][data-m=purple-orange]')
    # a state saved by an older version still carries the setting that no longer exists
    pg.evaluate('(() => { const s = JSON.parse(localStorage.getItem("oitolados.v1")); s.tip = { mode: "units", srcUnit: 1000 }; localStorage.setItem("oitolados.v1", JSON.stringify(s)); })()')
    cov.reload(pg); pg.wait_for_function('window.__OL && window.__OL.S')
    assert pg.evaluate('document.documentElement.dataset.theme') == other and paper() != device, 'the chosen theme survives a reload'
    assert pg.evaluate('window.__OL.S.corners') == {'women': 'purple-orange'}, 'and so does the pair of corner colours'
    pg.click('.tabbar [data-tab=carteira]'); assert pg.get_attribute('[data-act=corners][data-g=women][data-m=purple-orange]', 'aria-pressed') == 'true'
    pg.click('[data-act=corners][data-g=women][data-m=red-blue]')
    assert pg.evaluate('"tip" in window.__OL.S') is False and pg.evaluate('window.__OL.S.stakeIn') in (None, 'money'), 'the old setting for prints is dropped on load, and changes nothing else'
    pg.click('.tabbar [data-tab=carteira]'); pg.click('[data-act=theme][data-m=auto]')
    assert paper() == device and bars() == ['#0e1218', '#f2f3f5'] and pg.evaluate('document.documentElement.dataset.theme') is None and pg.evaluate('"theme" in window.__OL.S') is False, (paper(), bars())
    pg.click('.tabbar [data-tab=lutas]'); pg.wait_for_selector('.fight .opt.ml'); pg.wait_for_function('document.querySelectorAll(".fight .opt.ml").length>=6')
    for fid in ('f1','f2','f3'): pg.click(f'[data-act=more][data-fid="{fid}"]')
    pg.click('[data-act=imp]')
    for text, expect in [('Fulano x Beltrano\nFulano para vencer a luta', 'Não achei nenhuma luta'), ('', 'Cola um texto'), ('Almeida x Dunne', 'não entendi qual é a aposta'), ('Dunne e Teles', 'mais de uma luta possível')]:
        pg.fill('#imptext', text); pg.click('[data-act=impread]'); pg.wait_for_selector('#panel .msg')
        assert expect in pg.inner_text('#panel .msg'), (text, pg.inner_text('#panel .msg'))
    # a print pasted from the clipboard goes through the same reader
    png = base64.b64encode((SHOTS / 'print.png').read_bytes()).decode()
    pg.evaluate('''b64 => { const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const dt = new DataTransfer(); dt.items.add(new File([bytes], 'print.png', { type: 'image/png' }));
        document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }''', png)
    pg.wait_for_selector('#impres', timeout=120000); assert 'Connor Lee Dunne vence' in pg.inner_text('#impres')
    pg.keyboard.press('Escape'); assert pg.evaluate('document.getElementById("sheet").hidden'), 'Escape closes the import sheet'
    pg.click('[data-act=imp]')
    pg.click('[data-act=impclose]'); assert pg.evaluate('document.getElementById("sheet").hidden')
    print('leitor de imagem: arquivos pedidos', sorted({u.rsplit('/', 1)[1] for u in cdn_calls}))
    # unit: 10% of the bankroll by default, adjustable; the slip can stake in units
    pg.click('.tabbar [data-tab=carteira]'); assert pg.inner_text('#unitnow').replace('\xa0', ' ') == '1u = R$ 100,00', pg.inner_text('#unitnow')
    pg.fill('#unitpct', '2,5'); pg.click('[data-act=unit]'); assert pg.inner_text('#unitnow').replace('\xa0', ' ') == '1u = R$ 25,00', pg.inner_text('#unitnow')
    pg.fill('#unitpct', '10'); pg.keyboard.press('Enter'); assert pg.inner_text('#unitnow').replace('\xa0', ' ') == '1u = R$ 100,00', pg.inner_text('#unitnow')
    pg.click('.tabbar [data-tab=lutas]'); pick('f1', 'ml:a'); pg.click('#slipbtn')
    # value shortcuts add to what is in the field, up to a million at a time; "Tudo" puts the whole balance
    assert pg.locator('[data-act=stq]').all_inner_texts() == ['+10', '+50', '+100', 'Tudo', '+10.000', '+100.000', '+1.000.000'], pg.locator('[data-act=stq]').all_inner_texts()
    for v, want in [('10000', '10.000'), ('100000', '110.000'), ('1000000', '1.110.000'), ('10', '1.110.010')]:
        pg.click(f'[data-act=stq][data-v="{v}"]'); assert pg.input_value('#stake') == want, (v, pg.input_value('#stake'))
    assert pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') == 0, 'the slip must not get wider than the phone'
    shot('s16-atalhos.png')
    pg.click('[data-act=stq][data-v=max]'); assert pg.input_value('#stake') == '1.000', pg.input_value('#stake')
    # the stake can also be typed in units of the bankroll: the amount follows, and the choice is remembered
    assert pg.locator('#panel [data-act=stakein]').count() == 0, 'money or units is a setting, not a switch on every slip'
    pg.click('#panel [data-act=sheet]'); pg.click('.tabbar [data-tab=carteira]')
    assert 'Você digita o valor em R$' in txt('#stakehow'), txt('#stakehow')
    pg.click('[data-act=stakein][data-m=units]'); assert 'Hoje 1u = R$ 100,00' in txt('#stakehow'), txt('#stakehow')
    shot('s19-configuracoes.png')
    pg.click('.tabbar [data-tab=lutas]'); pg.click('#slipbtn'); pg.wait_for_selector('#stakeu')
    assert pg.input_value('#stakeu') == '10' and pg.locator('#stake').count() == 0, 'R$ 1.000,00 at R$ 100,00 a unit is 10u'
    assert 'Valor em unidades' in txt('#panel'), txt('#panel')
    pg.fill('#stakeu', ''); pg.click('#stakeu'); pg.keyboard.type('2.5x')
    assert pg.input_value('#stakeu') == '2,5' and 'R$ 250,00 · 2,5u' in txt('#slipsum') and 'Apostar R$ 250,00' in txt('[data-act=place]'), (pg.input_value('#stakeu'), txt('#slipsum'))
    pg.click('[data-act=stu][data-u="0.5"]'); assert pg.input_value('#stakeu') == '0,5' and 'R$ 50,00 · 0,5u' in txt('#slipsum'), txt('#slipsum')
    pg.click('[data-act=stq][data-v=max]'); assert pg.input_value('#stakeu') == '10' and 'R$ 1.000,00 · 10u' in txt('#slipsum'), txt('#slipsum')
    assert pg.locator('[data-act=stq]').count() == 1, 'in units the money shortcuts give way; only "Tudo" stays'
    shot('s17-em-unidades.png')
    pg.fill('#stakeu', '1,25'); cov.reload(pg); pg.wait_for_function('window.__OL && window.__OL.S')
    assert pg.evaluate('window.__OL.S.stakeIn') == 'units', 'the way of typing the stake survives a reload'
    pg.wait_for_selector('.fight .opt.ml'); pg.wait_for_function('document.querySelectorAll(".fight .opt.ml").length>=6')
    for fid in ('f1','f2','f3'): pg.click(f'[data-act=more][data-fid="{fid}"]')
    pick('f1', 'ml:a'); pg.click('#slipbtn'); pg.wait_for_selector('#stakeu')
    pg.fill('#stakeu', '1,25'); pg.click('#panel [data-act=tab][data-tab=carteira]')            # the slip links to the setting
    assert pg.evaluate('window.__OL.ui.tab') == 'carteira' and pg.evaluate('document.getElementById("sheet").hidden')
    pg.click('[data-act=stakein][data-m=money]'); pg.click('.tabbar [data-tab=lutas]'); pg.click('#slipbtn'); pg.wait_for_selector('#stake')
    assert pg.input_value('#stake') == '125', 'switching back keeps the amount: ' + pg.input_value('#stake')
    assert pg.locator('[data-act=stq]').count() == 7 and pg.evaluate('window.__OL.S.stakeIn') == 'money'
    pg.click('[data-act=stu][data-u="2"]'); assert pg.input_value('#stake') == '200', pg.input_value('#stake')
    pg.click('[data-act=stu][data-u="1"]'); assert pg.input_value('#stake') == '100', pg.input_value('#stake')
    assert '1u' in pg.inner_text('#slipsum'), pg.inner_text('#slipsum')
    pg.click('[data-act=place]'); pg.wait_for_selector('.bet'); assert pg.inner_text('.bet .un') == '1u', pg.inner_text('.bet .un')   # wins @1.67 -> 167
    pg.click('.tabbar [data-tab=lutas]')
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
    bet([('f1','ml:a'),('f3','ml:a')], '10', 'multi')                  # both win @1.67 x 1.80 -> 30.10; used below to check cashout after the first fight
    bet([('f1','ml:a'),('f3','ml:b')], '10', 'multi')                  # cashed out below at market value once the first fight has won
    mid = pg.evaluate('window.__OL.S.bets[window.__OL.S.bets.length - 1].id')
    # cashout: a bet on a fight that has not started gives the whole stake back
    bet([('f3','ml:b')], '40')
    before = bal(); cid = pg.evaluate('window.__OL.S.bets[window.__OL.S.bets.length - 1].id')
    pg.click('.tabbar [data-tab=apostas]'); pg.click(f'[data-act=cash][data-id="{cid}"]'); shot('s10-cashout.png')
    pg.click(f'[data-act=docash][data-id="{cid}"]'); pg.wait_for_function(f'window.__OL.S.bets.find(b => b.id === "{cid}").status === "cashed"')
    cashed = pg.evaluate(f'(() => {{ const b = window.__OL.S.bets.find(b => b.id === "{cid}"); return [b.status, b.payout, b.stake]; }})()')
    assert cashed == ['cashed', 40, 40], cashed
    print('cashout', cashed, '| saldo', before, '->', bal())
    # repeat: the cashed-out bet goes back into the slip with the same selection and stake, and is placed by the usual button
    pg.click('[data-act=filter][data-f=done]'); pg.click(f'[data-act=again][data-id="{cid}"]'); pg.wait_for_selector('#stake')
    assert pg.input_value('#stake') == '40' and pg.locator('#panel .sel').count() == 1, (pg.input_value('#stake'), pg.locator('#panel .sel').count())
    shot('s11-repetir.png'); n0 = pg.evaluate('window.__OL.S.bets.length')
    pg.click('[data-act=place]'); pg.wait_for_function(f'window.__OL.S.bets.length === {n0 + 1}')
    again = pg.evaluate('(() => { const b = window.__OL.S.bets[window.__OL.S.bets.length - 1]; return [b.id, b.type, b.stake, b.status, b.legs.map(l => l.key).join("+")]; })()')
    assert again[1:] == ['single', 40, 'open', 'ml:b'], again
    pg.click(f'[data-act=cash][data-id="{again[0]}"]'); pg.click(f'[data-act=docash][data-id="{again[0]}"]')
    pg.wait_for_function(f'window.__OL.S.bets.find(b => b.id === "{again[0]}").status === "cashed"')
    print('repetir', again[1:], '-> cashout de novo | saldo', bal())
    assert bal() == before.replace('680', '720'), (before, bal())
    multi_again = pg.locator('.bet', has_text='Múltipla').first.locator('[data-act=again]')
    multi_again.click(); pg.wait_for_selector('#stake')
    kind = pg.evaluate('[window.__OL.slip.mode, window.__OL.slip.sels.length, window.__OL.slip.stake]')
    assert kind[0] == 'multi' and kind[1] >= 2, kind
    for _ in range(kind[1]): pg.click('#panel [data-act=unpick]')     # leave the slip empty again
    assert pg.locator('[data-act=cash]').count() == 13, 'every other open bet should still offer cashout before the card starts'
    pg.click('.tabbar [data-tab=lutas]')
    print('balance after bets', bal(), '| open', pg.evaluate('window.__OL.S.bets.length'))
    pg.click('.tabbar [data-tab=apostas]'); assert pg.locator('.leg .sd.a').count() >= 3 and pg.locator('.leg .sd.b').count() >= 2, 'bets name the fighter with the corner colour'; pg.click('.tabbar [data-tab=lutas]')
    PHASE['n'] = 1; sync(); pg.click('.tabbar [data-tab=apostas]'); pg.wait_for_timeout(200); shot('s4-live.png')
    frozen = pg.locator('.hint.co', has_text='Cashout congelado').count(); still = pg.locator('[data-act=cash]').count()
    print('fase 1: cashout congelado em', frozen, 'apostas, disponível em', still)
    assert frozen == 7 and still == 6, (frozen, still)       # 7 bets touch the live fight; the other 6 are on fights still to start
    print('phase1 statuses', pg.evaluate('window.__OL.S.bets.map(b=>b.status)'), 'td', pg.evaluate('JSON.stringify(window.__OL.D.td)'))
    PHASE['n'] = 2; sync(); sync(); pg.wait_for_timeout(200)
    opened = pg.evaluate('window.__OL.S.bets.filter(b => b.status === "open").length')
    offers = pg.locator('[data-cash=market]').count(); frozen = pg.locator('.hint.co', has_text='Cashout congelado').count(); still = pg.locator('[data-act=cash]').count()
    print('fase 2:', opened, 'abertas | oferta de mercado', offers, '| congelado', frozen, '| disponível', still)
    assert (opened, offers, frozen, still) == (10, 2, 4, 6), (opened, offers, frozen, still)   # offers: the two parlays whose first fight has won; frozen: bets touching the live fight; still: offers plus bets entirely on the main event
    # dynamic cashout: one leg of the parlay has won, the other fight has not started, so the offer is the fair value of what is left
    pg.click(f'[data-act=cash][data-id="{mid}"]'); shot('s12-cashout-mercado.png')
    pg.click(f'[data-act=docash][data-id="{mid}"]'); pg.wait_for_function(f'window.__OL.S.bets.find(b => b.id === "{mid}").status === "cashed"')
    dyn = pg.evaluate(f'(() => {{ const b = window.__OL.S.bets.find(b => b.id === "{mid}"); return [b.payout, b.cash.kind, b.cash.full, b.cash.chance, b.legs.map(l => l.out || null)]; }})()')
    print('cashout dinâmico', dyn)
    assert dyn[:3] == [15.19, 'market', 34.2] and abs(dyn[3] - 0.4675) < 5e-4 and dyn[4] == ['won', None], dyn   # 10 x 3.42 x 46.75% x 0.95
    print('phase2 statuses', pg.evaluate('window.__OL.S.bets.map(b=>[b.type,b.legs.map(l=>l.key).join("+"),b.status,b.payout])'), bal())
    PHASE['n'] = 3; sync(); sync()
    st = pg.evaluate('window.__OL.S.bets.map(b=>[b.type,b.legs.map(l=>l.key+"@"+l.odd).join("+"),b.stake,b.status,b.payout])')
    for s in st: print('  ', s)
    print('final balance', bal())
    assert bal().replace('\xa0', ' ') == 'R$ 1.609,59', bal()
    pg.click('[data-act=filter][data-f=done]'); shot('s5-done.png', True)
    pg.click('.tabbar [data-tab=carteira]'); pg.wait_for_timeout(200); shot('s6-carteira.png')
    units = pg.inner_text('#pnlu'); print('em unidades:', units)
    pg.locator('#chart svg').scroll_into_view_if_needed()                # the mouse can only hover what is on screen
    box = pg.locator('#chart svg').bounding_box(); pg.mouse.move(box['x'] + box['width'] * 0.5, box['y'] + box['height'] * 0.5)
    tipText = pg.inner_text('#tip'); assert 'aposta' in tipText and 'acumulado' in tipText, tipText        # hovering the chart explains the point
    pg.mouse.move(box['x'] + box['width'] * 0.5, box['y'] + box['height'] + 60); pg.wait_for_function('document.getElementById("tip").hidden')
    assert units.startswith('+6,1u'), units                   # R$ 609,59 of profit with every bet placed at a R$ 100,00 unit
    pg.click('.tabbar [data-tab=apostas]'); assert pg.locator('[data-act=again]').count() == 0, 'nothing can be repeated once every fight is over'
    pg.click('.tabbar [data-tab=lutas]'); shot('s7-final.png', True)
    pg.click('[data-act=event]'); pg.wait_for_selector('.fight')                                       # picking the event again keeps the card on screen
    ow = pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
    # the person's data: backup, restore and reset
    pg.click('.tabbar [data-tab=carteira]'); pg.click('[data-act=corners][data-g=women][data-m=green-pink]')
    final = bal(); saved = pg.evaluate('JSON.stringify(window.__OL.S)')
    settings = lambda: pg.evaluate('(() => { const S = window.__OL.S; return [S.unitPct, S.stakeIn || "money", S.theme || "auto", S.corners, S.cur]; })()')
    kept = settings(); assert kept[3] == {'women': 'green-pink'}, kept
    pg.click('[data-act=backup]'); pg.wait_for_timeout(300)                                             # copies to the clipboard, or shows the text when it cannot
    pg.click('[data-act=reset]'); pg.click('[data-act=reset]')                                           # opening and backing out of the reset keeps everything
    assert bal() == final, bal()
    pg.click('[data-act=reset]'); pg.click('[data-act=doreset]'); assert bal().replace('\xa0', ' ') == 'R$ 0,00', bal()
    assert settings() == kept and pg.evaluate('window.__OL.S.bets.length + window.__OL.S.deposits.length') == 0, ('a reset clears the money and keeps the settings', settings(), kept)
    pg.click('[data-act=restore]'); pg.fill('#rs', 'isto não é um backup'); pg.click('[data-act=dorestore]'); assert bal().replace('\xa0', ' ') == 'R$ 0,00', 'a bad backup must change nothing'
    pg.fill('#rs', saved); pg.click('[data-act=dorestore]'); pg.wait_for_timeout(400)
    assert bal() == final and pg.evaluate('window.__OL.S.bets.length') == 15, (bal(), final)
    assert settings() == kept, ('the settings come back with the backup', settings(), kept)
    print('backup e restauração: saldo', final, 'de volta depois de zerar')
    # converting a bankroll with a whole history: every amount follows, and the result in units stays the same
    assert len(pg.evaluate('window.__OL.S.conv')) == 3, 'the conversion log comes back with the backup'
    pg.click('[data-act=depcur][data-c=USD]'); pg.wait_for_selector('#fxinfo b'); pg.fill('#dep', '100'); pg.click('[data-act=deposit]'); pg.wait_for_function('window.__OL.S.cur === "USD"')
    usd = pg.evaluate('(() => { const S = window.__OL.S; return [S.bets.length, S.bets[0].stake, S.bets[0].payout, S.bets[0].unit, S.conv.length]; })()')
    print('banca convertida para dólar: saldo', bal(), '|', pg.inner_text('#pnlu'))
    assert bal().replace('\xa0', ' ') == 'US$ 421,92' and usd == [15, 20, 33.4, 20, 4] and pg.inner_text('#pnlu').startswith('+6,1u'), (bal(), usd)   # 1.609,59 x 0,20 = 321,92, plus the 100 deposited
    print('h-overflow px', ow, '| requests', len(calls), '| errors', errs)
    cov.stop(pg, 'e2e-' + (sys.argv[1] if len(sys.argv) > 1 else 'dark'))
    b.close()
assert ow == 0, f'page is {ow}px wider than the phone screen'
assert not [e for e in errs if 'PAGEERROR' in e], errs
print('e2e ok: 15 apostas encerradas (3 por cashout: 1 repetida e 1 a valor de mercado), saldo final R$ 1.609,59, banca convertida quatro vezes (duas sem depositar), sem estouro de largura e sem erro de script')
