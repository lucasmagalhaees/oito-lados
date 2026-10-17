"""End-to-end run of the built page (dist/index.html) against a mocked ESPN API.

Usage: python3 tests/e2e.py [dark|light]   (needs: pip install -r tests/requirements.txt && playwright install chromium)
Walks one fictional card through pre-fight -> live -> final, places singles, parlays and same-fight combos through the UI,
and prints prices, settlements and the final balance (expected: R$ 1.609,59).
"""
import json, re, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from mock_espn import PHASE, FX, ESPN, CLOUD, handle, calls, local_cdn, cdn_calls, CDN_DOWN, ocr_files_installed, PRINT_HTML, SLIP_HTML, ACCA_HTML, LIST_HTML, TIP_TEXT
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
    unum = lambda t: float(t.replace('u', '').replace('−', '-').replace('+', '').replace('.', '').replace(',', '.'))   # '+1.234,5u' as a number
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
    # the card comes in its parts, by the hour the fights start, and one part can be shown alone
    nfights = lambda: pg.locator('#list article.fight').count()
    secs = lambda: [e.get_attribute('data-part') for e in pg.locator('#list .sec').element_handles()]
    assert pg.locator('#parts button').all_inner_texts() == ['Tudo (3)', 'Principal (1)', 'Preliminares (2)'] and nfights() == 3 and secs() == ['main', 'prelims'], (pg.locator('#parts button').all_inner_texts(), secs())
    pg.click('#parts [data-p=main]'); assert nfights() == 1 and secs() == ['main'] and 'DUNNE' in txt('#list').upper() and 'TELES' not in txt('#list').upper(), txt('#list')
    pg.click('#parts [data-p=prelims]'); assert nfights() == 2 and secs() == ['prelims'] and pg.get_attribute('#parts [data-p=prelims]', 'aria-pressed') == 'true' and 'DUNNE' not in txt('#list').upper()
    shot('s39-preliminares.png')
    pg.click('#parts button >> nth=0'); assert nfights() == 3 and pg.get_attribute('#parts button >> nth=0', 'aria-pressed') == 'true'
    # a fight is found by a piece of a fighter's name, whatever the accents and the case, and the field keeps the focus while the list changes
    focused = lambda: pg.evaluate('document.activeElement && document.activeElement.id')
    pg.click('#q'); pg.keyboard.type('TÉLES')
    assert nfights() == 1 and txt('#qinfo') == '1 luta com "TÉLES".' and pg.locator('#parts').count() == 0 and focused() == 'q' and pg.is_visible('[data-act=qclear]'), (nfights(), txt('#qinfo'), focused())
    assert secs() == ['prelims'] and pg.locator('#list .qev').count() == 1, 'what is found keeps its event and its part of the card'
    # on a phone a tapped button leaves the focus in the field: the pick still shows, because the list under the field is repainted
    tap = lambda sel: pg.evaluate('s => document.querySelector(s).dispatchEvent(new MouseEvent("click", { bubbles: true }))', sel)
    tap('[data-act=pick][data-fid="f1"][data-key="ml:a"]')
    assert focused() == 'q' and pg.get_attribute('[data-act=pick][data-fid="f1"][data-key="ml:a"]', 'aria-pressed') == 'true' and pg.input_value('#q') == 'TÉLES' and pg.evaluate('window.__OL.slip.sels.length') == 1
    tap('[data-act=pick][data-fid="f1"][data-key="ml:a"]'); assert pg.get_attribute('[data-act=pick][data-fid="f1"][data-key="ml:a"]', 'aria-pressed') == 'false' and pg.evaluate('window.__OL.slip.sels.length') == 0
    shot('s40-busca.png')
    pg.fill('#q', 'almeida dunne'); assert nfights() == 1 and secs() == ['main']
    pg.fill('#q', 'jr'); assert nfights() == 1 and 'PRADO' in txt('#list').upper()
    pg.fill('#q', 'almeida teles'); assert nfights() == 0 and txt('#qinfo') == 'Nenhuma luta com "almeida teles" nos eventos carregados.', txt('#qinfo')
    pg.fill('#q', '<b>zz</b>'); assert nfights() == 0 and '"<b>zz</b>"' in txt('#qinfo') and pg.locator('#qinfo b').count() == 0, 'what is typed is shown as text'
    pg.click('[data-act=qclear]'); assert pg.input_value('#q') == '' and nfights() == 3 and pg.locator('#parts').count() == 1 and focused() == 'q' and not pg.is_visible('[data-act=qclear]'), 'the x empties the field and leaves it ready'
    # the filter by country: Brazil has a shortcut of its own, and every country with a fighter on the cards is in the list, by its name in Portuguese
    BR, EN, CN = '\U0001F1E7\U0001F1F7', '\U0001F3F4\U000E0067\U000E0062\U000E0065\U000E006E\U000E0067\U000E007F', '\U0001F1E8\U0001F1F3'
    chip = lambda c='Brazil': pg.get_attribute(f'[data-act=land][data-c="{c}"]', 'aria-pressed')
    lands = lambda: pg.locator('#lands button').all_inner_texts()
    assert lands() == [BR + ' Brasileiros (2)', 'Atlantis (1)', CN + ' China (1)', EN + ' Inglaterra (1)'] and chip() == 'false', lands()          # the fighter with no country is not there
    assert pg.locator('#view select').count() == 0, 'the countries are buttons of the app: the list of the device takes its colours from the phone, not from the theme chosen here'
    assert pg.locator('#lands button .flag').count() == 3 and pg.locator('#lands button .flag').first.get_attribute('aria-label') == 'Brazil', 'each flag is in an element of its own, which has the font that draws it where the system has none'
    tap('[data-act=land]'); assert focused() != 'q'
    assert nfights() == 2 and txt('#qinfo') == f'2 lutas · {BR} Brasil, neste card.' and pg.locator('#parts').count() == 0 and chip() == 'true' and secs() == ['main', 'prelims'] and pg.locator('#qinfo .flag').count() == 1, (nfights(), txt('#qinfo'), secs())
    assert 'KESSLER' not in txt('#list').upper() and 'TELES' in txt('#list').upper() and 'ALMEIDA' in txt('#list').upper() and 'on' in pg.get_attribute('[data-act=land]', 'class')
    assert pg.evaluate('(() => { const c = s => getComputedStyle(document.querySelector(s)).backgroundColor; return c("#lands button.on") !== c("#lands button:not(.on)") && c("#lands button:not(.on)") === c(".fight"); })()'), 'the one chosen stands out, and the others have the colour of a card'
    assert pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') == 0; shot('s49-filtro-por-pais.png')
    pg.click('[data-act=pick][data-fid="f3"][data-key="ml:a"]'); assert pg.get_attribute('[data-act=pick][data-fid="f3"][data-key="ml:a"]', 'aria-pressed') == 'true' and nfights() == 2 and chip() == 'true', 'a pick inside the filtered list shows, and the filter stays'
    pg.click('[data-act=pick][data-fid="f3"][data-key="ml:a"]'); assert pg.evaluate('window.__OL.slip.sels.length') == 0
    # a name typed as well: a fight has to pass both
    pg.fill('#q', 'prado'); assert nfights() == 1 and txt('#qinfo') == f'1 luta com "prado" · {BR} Brasil, neste card.', txt('#qinfo')
    pg.fill('#q', 'kessler'); assert nfights() == 0 and txt('#qinfo') == f'Nenhuma luta com "kessler" · {BR} Brasil neste card.', txt('#qinfo')
    pg.fill('#q', ''); assert nfights() == 2
    # any other country of the card has its button; one country at a time
    pg.click('[data-act=land][data-c="England"]'); assert nfights() == 1 and txt('#qinfo') == f'1 luta · {EN} Inglaterra, neste card.' and chip() == 'false' and chip('England') == 'true' and 'PRADO' in txt('#list').upper(), txt('#qinfo')
    pg.click('[data-act=land][data-c="Atlantis"]'); assert nfights() == 1 and txt('#qinfo') == '1 luta · Atlantis, neste card.' and 'DUNNE' in txt('#list').upper() and chip('England') == 'false', txt('#qinfo')          # a country the app has no flag for is still a country
    pg.click('[data-act=land]'); assert nfights() == 2 and chip() == 'true' and chip('Atlantis') == 'false'
    pg.click('[data-act=land]'); assert nfights() == 3 and pg.locator('#parts').count() == 1 and chip() == 'false' and pg.locator('#qinfo').count() == 0 and pg.evaluate('window.__OL.ui.land') is None, 'a second tap lets go of the filter'
    pg.click('#q')
    # with another event on the board the search covers it too, and a tap on its name opens that card with the search still there
    ESPN['next'] = True; assert focused() == 'q'; tap('[data-act=refresh]'); assert focused() != 'q', 'a tap outside the list lets go of the field, so the whole screen can follow'
    pg.wait_for_function('window.__OL.D.events.length === 2'); assert pg.locator('.events .ev').count() == 2
    pg.fill('#q', 'teles'); assert nfights() == 2 and txt('#qinfo') == '2 lutas com "teles", nos 2 eventos carregados.' and pg.locator('#list .qev').count() == 2, txt('#qinfo')
    assert 'TELES VS. FARIAS' in txt('#list button.qev').upper() and 'abrir este card' in txt('#list button.qev').lower() and pg.locator('#list .qev >> nth=0').evaluate('e => e.tagName') == 'DIV', 'the event on screen comes first, and the other one is a button'
    assert pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') == 0; shot('s41-busca-dois-eventos.png')
    pg.click('#list button.qev'); pg.wait_for_function('window.__OL.ui.eventId === "600000002"')
    assert pg.input_value('#q') == 'teles' and nfights() == 2 and 'TELES VS. FARIAS' in pg.locator('#list .qev >> nth=0').inner_text().upper() and 'on' in pg.get_attribute('.events .ev >> nth=1', 'class'), 'that card is the one on screen now, and the search is still there'
    pg.fill('#q', ''); assert nfights() == 1 and pg.locator('#parts').count() == 0, 'a card with one hour has no parts to choose'
    # the filter by country looks at the card on screen only, and stays on from one card to the other
    assert lands() == [BR + ' Brasileiros (1)'], lands()          # this card has two Brazilians in one fight, and nobody else
    pg.click('[data-act=land]'); assert nfights() == 1 and txt('#qinfo') == f'1 luta · {BR} Brasil, neste card.' and pg.locator('#list .qev').count() == 1 and pg.locator('#list button.qev').count() == 0, (nfights(), txt('#qinfo'))
    pg.click('.events .ev >> nth=0'); pg.wait_for_function('window.__OL.ui.eventId === "600000001"')
    assert pg.evaluate('window.__OL.ui.land') == 'Brazil' and chip() == 'true' and nfights() == 2 and lands()[0] == BR + ' Brasileiros (2)' and txt('#qinfo') == f'2 lutas · {BR} Brasil, neste card.', (lands(), txt('#qinfo'))
    pg.fill('#q', 'teles'); assert nfights() == 1 and txt('#qinfo') == f'1 luta com "teles" · {BR} Brasil, neste card.' and pg.locator('#list button.qev').count() == 0, 'with a country chosen the name is looked for on this card only: the other card has a Teles too'
    pg.fill('#q', '')
    # a country chosen on one card stays in the row on a card that has nobody from it, so that it can be let go of
    pg.click('[data-act=land][data-c="England"]'); assert nfights() == 1
    pg.click('.events .ev >> nth=1'); pg.wait_for_function('window.__OL.ui.eventId === "600000002"')
    assert lands() == [BR + ' Brasileiros (1)', EN + ' Inglaterra (0)'] and chip('England') == 'true' and nfights() == 0 and txt('#qinfo') == f'Nenhuma luta · {EN} Inglaterra neste card.', (lands(), txt('#qinfo'))
    pg.click('[data-act=land][data-c="England"]'); assert lands() == [BR + ' Brasileiros (1)'] and nfights() == 1 and pg.evaluate('window.__OL.ui.land') is None
    # the keyboard's own "search" puts the keyboard away; picking an event at the top leaves the search
    pg.fill('#q', 'farias'); pg.press('#q', 'Enter'); assert focused() != 'q' and nfights() == 1 and pg.input_value('#q') == 'farias'
    pg.click('.events .ev >> nth=0'); pg.wait_for_function('window.__OL.ui.eventId === "600000001"'); assert pg.input_value('#q') == '' and nfights() == 3
    ESPN['next'] = False; pg.click('[data-act=refresh]'); pg.wait_for_function('window.__OL.D.events.length === 1'); assert nfights() == 3 and pg.locator('.events .ev').count() == 1
    pick = lambda fid, key: pg.click(f'[data-act=pick][data-fid="{fid}"][data-key="{key}"]')
    # the latest fights of everybody on the card of the week are read ahead, beside the sync loop: one call for the list and two for each fight
    logs = lambda: sum(1 for u in calls if '/eventlog' in u); past = lambda: sum(1 for u in calls if re.search(r'/competitions/p\w+', u))
    pg.wait_for_function('Object.keys(window.__OL.D.form).length === 6')
    assert (logs(), past()) == (6, 26) and pg.locator('.fcol').count() == 0, (logs(), past())          # six athletes; 3 + 1 + 0 + 3 + 3 + 3 fights, two calls each; nothing was opened yet
    # a few athletes at a time, and one call after the other for each: never more than three fights asked for and still waiting for their status
    waiting, most = set(), 0
    for u in calls:
        m = re.search(r'/competitions/(p\w+)(/status)?', u)
        if m: (waiting.discard if m.group(2) else waiting.add)(m.group(1)); most = max(most, len(waiting))
    assert 1 <= most <= 3, most
    for fid in ('f1','f2','f3'): pg.click(f'[data-act=more][data-fid="{fid}"]')
    # the details of a fight bring the three latest fights of each of the two: won or lost, how and when each one ended
    assert pg.locator('.fcol').count() == 6 and 'Buscando' not in txt('#list') and (logs(), past()) == (6, 26), 'opening a fight finds them already there, and asks for nothing'
    fcol = lambda aid: pg.locator(f'.fcol[data-athlete="{aid}"]')
    rows = lambda aid: [[li.locator('i').inner_text(), li.locator('span b').inner_text(), [re.sub(r'[a-zç]{3}/\d\d$', '<when>', t) for t in li.locator('small').all_inner_texts()]] for li in fcol(aid).locator('li').all()]
    assert txt('.form[data-fid=f1] h4').upper().startswith('ÚLTIMAS 3 LUTAS') and fcol('101').locator('.fname').inner_text().upper().strip().endswith('TELES'), txt('.form[data-fid=f1]')
    assert fcol('101').locator('.fsum').inner_text() == '2V 1D' and fcol('101').locator('.fends').inner_text() == 'Como acabaram: 1 por KO/TKO, 1 por submission, 1 por decisão' and rows('101') == [['V', 'KO/TKO', ['R1 2:10 · <when>']], ['V', 'Decisão', ['3 rounds · <when>']], ['D', 'Submission', ['R2 3:45 · <when>']]], (fcol('101').inner_text(), rows('101'))          # she has four: only the latest three
    assert all(re.search(r' · [a-zç]{3}/\d\d$', t) for t in fcol('101').locator('li small').all_inner_texts()), fcol('101').locator('li small').all_inner_texts()
    assert fcol('102').locator('.fsum').inner_text() == '0V 1D' and fcol('102').locator('.fends').inner_text() == 'Como acabaram: 1 por decisão' and len(rows('102')) == 1, 'an athlete with one fight shows one'
    assert 'Nenhuma luta anterior na ESPN.' in fcol('201').inner_text() and fcol('201').locator('li').count() == 0, 'a debut has nothing to show, and says so'
    assert fcol('202').locator('.fsum').inner_text() == '1V 0D 2E' and fcol('202').locator('.fends').count() == 0 and rows('202') == [['E', 'Empate', ['3 rounds · <when>']], ['–', 'No contest', ['R1 2:00 · <when>']], ['V', 'resultado não informado', ['<when>']]], (fcol('202').inner_text(), rows('202'))
    # a submission is called a submission, and by its name when the source gives one (the one of 101, above, came with none)
    assert rows('301') == [['V', 'Submission', ['Rear Naked Choke', 'R1 1:03 · <when>']], ['V', 'Submission', ['Triangle Choke', 'R2 4:03 · <when>']], ['V', 'KO/TKO', ['R1 0:45 · <when>']]] and 'inaliza' not in txt('#list'), rows('301')          # the knockout came with a description too, and it is not shown
    # the flag of each one's country comes before the name, on the card and in this box; a country the app has no flag for, or none at all, shows no flag
    BR, EN, CN = '\U0001F1E7\U0001F1F7', '\U0001F3F4\U000E0067\U000E0062\U000E0065\U000E006E\U000E0067\U000E007F', '\U0001F1E8\U0001F1F3'
    who = lambda fid, k: pg.locator(f'.fight .row.{k}', has=pg.locator(f'[data-fid="{fid}"]')).locator('.who b')
    flags = [[f.inner_text(), f.get_attribute('aria-label')] if f.count() else None for f in [who(fid, k).locator('.flag') for fid in ('f1', 'f2', 'f3') for k in ('a', 'b')]]
    assert flags == [[BR, 'Brazil'], [EN, 'England'], [CN, 'China'], None, [BR, 'Brazil'], None], flags
    assert who('f1', 'a').inner_text().replace('\xa0', ' ').upper().endswith('TELES') and who('f3', 'b').inner_text().upper() == 'DUNNE' and 'Atlantis' not in txt('#list'), who('f1', 'a').inner_text()
    assert [fcol(a).locator('.fname .flag').inner_text() if fcol(a).locator('.fname .flag').count() else '' for a in ('101', '102', '201', '202', '302')] == [BR, EN, CN, '', ''] and all(e.is_visible() for e in pg.locator('.flag').all())
    pg.locator('.form[data-fid=f3]').scroll_into_view_if_needed(); shot('s48-bandeira-e-submission.png')
    assert fcol('301').locator('.fends').inner_text() == 'Como acabaram: 1 por KO/TKO, 2 por submission' and fcol('302').locator('.fsum').inner_text() == '2V 1D' and fcol('302').locator('.fends').inner_text() == 'Como acabaram: 1 por KO/TKO, 2 por decisão' and rows('302')[1] == ['V', 'Decisão', ['5 rounds · <when>']]
    assert pg.evaluate('getComputedStyle(document.querySelector(".fcol li.w > i")).backgroundColor !== getComputedStyle(document.querySelector(".fcol li.l > i")).backgroundColor') and all(e.is_visible() for e in pg.locator('.fcol').all())
    # what was read is kept and not asked for again
    pg.click('[data-act=more][data-fid="f1"]'); pg.click('[data-act=more][data-fid="f1"]'); pg.wait_for_timeout(300); assert (logs(), past()) == (6, 26) and fcol('101').locator('li').count() == 3, 'closing and opening the fight asks for nothing'
    assert pg.evaluate('JSON.parse(localStorage.getItem("oitolados.cache.v1")).form["101"].fights.length') == 3, 'and it is kept on the device with the rest of what was read'
    # after a week the list is asked for again, and the fights already read are not; an athlete nobody asked about for five weeks is dropped
    pg.evaluate('(() => { const F = window.__OL.D.form, day = 864e5, now = Date.now(); window.__was = now - 8 * day; F["101"].ts = window.__was; F["998"] = { ts: now - 10 * day, fights: [] }; F["999"] = { ts: now - 40 * day, fights: [] }; })()')
    pg.click('[data-act=more][data-fid="f1"]'); pg.click('[data-act=more][data-fid="f1"]'); pg.wait_for_function('window.__OL.D.form["101"].ts > window.__was')
    assert (logs(), past()) == (7, 26) and fcol('101').locator('li').count() == 3, (logs(), past())
    assert pg.evaluate('["998", "999"].map(k => k in window.__OL.D.form)') == [True, False]; pg.evaluate('delete window.__OL.D.form["998"]')
    # fights read by a version that did not keep how each one ended are read again, once, to get the name of the submission
    was = (logs(), past()); pg.evaluate('window.__OL.D.form["301"].fights.forEach(x => { delete x.desc; })'); pg.click('[data-act=more][data-fid="f3"]'); pg.click('[data-act=more][data-fid="f3"]')
    pg.wait_for_function('window.__OL.D.form["301"].fights.every(x => typeof x.desc === "string")'); pg.wait_for_timeout(300)
    assert (logs() - was[0], past() - was[1]) == (1, 6) and rows('301')[0][2][0] == 'Rear Naked Choke', (logs() - was[0], past() - was[1])
    pg.click('[data-act=more][data-fid="f3"]'); pg.click('[data-act=more][data-fid="f3"]'); pg.wait_for_timeout(300); assert (logs() - was[0], past() - was[1]) == (1, 6), 'and not again after that'
    # when the source cannot be reached it says so, keeps nothing half read, and a new opening of the fight tries again
    pg.evaluate('delete window.__OL.D.form["101"]'); ESPN['formdown'] = True; pg.click('[data-act=more][data-fid="f1"]'); pg.click('[data-act=more][data-fid="f1"]')
    pg.wait_for_function('document.querySelector(\'.fcol[data-athlete="101"]\').textContent.includes("Não deu pra buscar agora")'); assert pg.evaluate('window.__OL.D.form["101"]') is None and fcol('102').locator('li').count() == 1
    # the reading ahead tries it once more at the next round of the sync loop, and then leaves a source that is refusing alone for a while
    sync(); asked = logs(); sync(); sync(); assert logs() == asked and pg.evaluate('window.__OL.D.form["101"]') is None, (logs(), asked)
    ESPN['formdown'] = False; pg.click('[data-act=more][data-fid="f1"]'); pg.click('[data-act=more][data-fid="f1"]'); pg.wait_for_function('document.querySelectorAll(\'.fcol[data-athlete="101"] li\').length === 3')
    assert pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') == 0
    pg.locator('.form[data-fid=f1]').scroll_into_view_if_needed(); shot('s44-ultimas-lutas.png'); window_top = pg.evaluate('window.scrollTo(0, 0)')
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
    assert copied(MONEY_TIP, '1u, pela sua configuração: o print só traz R$ 250,00, que não é copiado') == 'R$ 100,00 · 1u', 'in units the setting is followed: an original that states no units is one unit, whatever money it shows'
    assert copied(TIP_TEXT, '0,5u do print') == 'R$ 50,00 · 0,5u'
    # in units the value of an item has steps of half a unit, up and down
    pg.click('.tabbar [data-tab=lutas]'); pg.click('[data-act=imp]'); pg.fill('#imptext', TIP_TEXT); pg.click('[data-act=impread]'); pg.wait_for_selector('#impres')
    assert 'print que não diz unidades entra com 1u' in txt('#panel') and pg.input_value('.opstake') == '0,5' and pg.locator('[data-act=impstep]').count() == 2
    pg.click('[data-act=impstep][data-d="1"]'); assert pg.input_value('.opstake') == '1' and txt('#impvalue') == 'R$ 100,00 · 1u' and 'valor que você escreveu' in txt('#panel'), txt('#impvalue')
    pg.click('[data-act=impstep][data-d="1"]'); assert pg.input_value('.opstake') == '1,5' and txt('#impvalue') == 'R$ 150,00 · 1,5u'
    pg.click('[data-act=impstep][data-d="-1"]'); pg.click('[data-act=impstep][data-d="-1"]'); assert pg.input_value('.opstake') == '0,5' and txt('#impvalue') == 'R$ 50,00 · 0,5u'
    pg.click('[data-act=impstep][data-d="-1"]'); assert pg.input_value('.opstake') == '0,5' and '0,5u do print' in txt('#panel'), 'below half a unit there is nothing to bet: the item goes back to what the original says'
    pg.click('[data-act=impclear]'); pg.click('[data-act=impclose]')
    pg.click('.tabbar [data-tab=lutas]'); pg.click('[data-act=imp]'); pg.fill('#imptext', BOTH_TIP); pg.click('[data-act=impread]'); pg.wait_for_selector('#impres')
    pg.click('[data-act=impgo]'); pg.wait_for_selector('#stakeu')
    assert pg.input_value('#stakeu') == '2' and 'R$ 200,00 · 2u' in txt('#slipsum'), (pg.input_value('#stakeu'), txt('#slipsum'))
    pg.click('#panel [data-act=unpick]')
    pg.click('.tabbar [data-tab=carteira]'); pg.click('[data-act=stakein][data-m=money]'); pg.click('.tabbar [data-tab=lutas]'); pg.click('[data-act=imp]')
    # the paste button takes the text on the clipboard and reads it at once (the clipboard of the test is a stand-in)
    assert pg.locator('[data-act=impstep]').count() == 0, 'in money there are no unit steps'
    clip = lambda js: pg.evaluate('f => { window.__clip = navigator.clipboard; Object.defineProperty(navigator, "clipboard", { configurable: true, value: { readText: new Function("return " + f)() } }); }', js)
    clip('async () => "Almeida x Dunne\\nDunne para vencer a luta\\nR$ 250,00"'); pg.click('[data-act=imppaste]'); pg.wait_for_selector('#impres')
    assert pg.input_value('#imptext') == MONEY_TIP and 'Connor Lee Dunne vence' in txt('#impres') and txt('#impvalue') == 'R$ 250,00 · 2,5u', (pg.input_value('#imptext'), txt('#impvalue'))
    assert 'sáb' in txt('#impres') or 'dom' in txt('#impres') or ':' in txt('#impres'), 'each selection says when its fight is'
    clip('async () => "   "'); pg.click('[data-act=imppaste]'); pg.wait_for_selector('#imperr'); assert 'não tem texto' in txt('#imperr') and pg.input_value('#imptext') == MONEY_TIP, txt('#imperr')
    clip('async () => { throw new Error("denied"); }'); pg.click('[data-act=imppaste]'); pg.wait_for_function('document.getElementById("imperr").textContent.includes("Não consegui ler")')
    pg.evaluate('Object.defineProperty(navigator, "clipboard", { configurable: true, value: window.__clip })'); pg.click('[data-act=impclear]')
    # with a card of five fights, a multiple of five read from a text is a long shot: a fraction of a unit is suggested, a tap away
    ESPN['extra'] = True; sync()
    assert lands() == [BR + ' Brasileiros (4)', EN + ' Inglaterra (2)', 'Atlantis (1)', CN + ' China (1)'], ('after Brazil, the country with the most fights on the card comes first', lands())
    # this browser has a mouse, which cannot swipe a row sideways: the buttons that do not fit go to the next line, and none is cut
    inside = lambda box, items: pg.evaluate('''([box, items]) => { const b = document.querySelector(box), r = b.getBoundingClientRect(), xs = [...document.querySelectorAll(items)].map(e => e.getBoundingClientRect());
        return [xs.every(x => x.left >= r.left - 0.5 && x.right <= r.right + 0.5), b.scrollWidth <= b.clientWidth, new Set(xs.map(x => Math.round(x.top))).size, xs.length]; }''', [box, items])
    assert inside('#lands', '#lands button') == [True, True, 2, 4], ('with a mouse every country button is whole, on as many lines as it takes', inside('#lands', '#lands button'))
    pg.fill('#imptext', 'QUÍNTUPLA\nTeles + Brandt + Almeida + Sampaio + Kovac - para vencer a luta\nR$ 100,00'); pg.click('[data-act=impread]'); pg.wait_for_selector('#impres')
    assert txt('.impkind') == 'Múltipla de 5 seleções' and pg.locator('.impsug button').all_inner_texts() == ['0,2u', '0,3u', '0,4u'] and 'Múltipla de 5 seleções: stake sugerida de 0,2u a 0,4u' in txt('#panel'), txt('#panel')
    pg.click('.impsug [data-u="0.3"]'); assert txt('#impvalue') == 'R$ 30,00 · 0,3u' and 'valor que você escreveu' in txt('#panel'), txt('#impvalue')
    pg.click('[data-act=impmode][data-m=single]'); assert pg.locator('.impsug').count() == 0, 'five singles are not a long shot'
    pg.click('[data-act=impclear]'); ESPN['extra'] = False; sync(); assert pg.evaluate('window.__OL.D.fights.size') == 3
    # "Limpar" empties the copy screen; closing it does not
    assert pg.is_disabled('[data-act=impclear]'), 'nothing to clear yet'
    pg.fill('#imptext', MONEY_TIP); pg.click('[data-act=impread]'); pg.wait_for_selector('#impres')
    pg.click('[data-act=impclose]'); pg.click('[data-act=imp]')
    assert pg.input_value('#imptext') == MONEY_TIP and pg.locator('.impop').count() == 1, 'closing keeps the text and what was read'
    pg.click('[data-act=impclear]')
    assert pg.input_value('#imptext') == '' and pg.locator('.impop').count() == 0 and pg.is_disabled('[data-act=impclear]'), 'cleared'
    # one fighter from each of two fights joined by a plus is a multiple, and the odd it prints is of the whole bet
    DUPLA = '🔥 *DUPLA* 🔥\n\n🎰 *Marina Teles*\n               +\n*Connor Lee Dunne* - Para vencer a luta\n\n💰 Odd - 1.61\n💎 Stake - 1 unidade'
    pg.fill('#imptext', DUPLA); pg.click('[data-act=impread]'); pg.wait_for_selector('#impres')
    assert pg.locator('#impres .sel').count() == 2 and txt('.impkind') == 'Múltipla de 2 seleções' and 'considerei vencedor' not in txt('#impres'), txt('#panel')
    assert txt('.impodd') == '1.61 · agora 3.42' and txt('#impvalue') == 'R$ 100,00 · 1u', (txt('.impodd'), txt('#impvalue'))            # 1.67 x 2.05
    shot('s25-dupla.png'); pg.click('[data-act=impgo]'); pg.wait_for_selector('#stake')
    assert pg.evaluate('[window.__OL.slip.mode, window.__OL.slip.sels.length]') == ['multi', 2] and pg.input_value('#stake') == '100' and 'R$ 342,00' in txt('#slipsum') and txt('#slipgain') == '+R$ 242,00 · +2,42u', txt('#slipsum')
    pg.click('#panel [data-act=unpick] >> nth=0'); pg.click('#panel [data-act=unpick] >> nth=0'); pg.click('[data-act=imp]')
    pg.fill('#imptext', 'TRIPLA\nTeles + Dunne + Fulano de Tal - para vencer a luta'); pg.click('[data-act=impread]'); pg.wait_for_selector('#impres')
    assert 'O original é uma múltipla de 3 seleções e só achei 2' in txt('#panel'), txt('#panel')
    pg.fill('#imptext', 'Dunne e Teles'); pg.click('[data-act=impread]'); pg.wait_for_selector('#impres')
    assert txt('#impres').count('considerei vencedor') == 2 and txt('.impkind') == 'Múltipla de 2 seleções', 'two bare names are two presumed winners: ' + txt('#impres')
    pg.fill('#imptext', 'Aposta simples\nDunne e Teles para vencer\nR$ 30,00'); pg.click('[data-act=impread]'); pg.wait_for_selector('#impres')
    assert txt('.impkind') == '2 apostas simples' and 'Valor de cada uma' in txt('#panel') and txt('#impvalue') == 'R$ 30,00 · 0,3u', txt('#panel')
    pg.click('[data-act=impgo]'); pg.wait_for_selector('#stake'); assert pg.evaluate('[window.__OL.slip.mode, window.__OL.slip.sels.length]') == ['single', 2]
    pg.click('#panel [data-act=unpick] >> nth=0'); pg.click('#panel [data-act=unpick] >> nth=0'); pg.click('[data-act=imp]')
    # several prints at once: each picture is a bet of its own, and the ones that are whole are made together
    art = ctx.new_page()
    for name, html in (('simples.png', SLIP_HTML), ('acumulada.png', ACCA_HTML), ('lista.png', LIST_HTML)): art.set_content(html); art.locator('#print').screenshot(path=str(SHOTS / name))
    art.close()
    kept = pg.evaluate('localStorage.getItem("oitolados.v1")'); had = pg.evaluate('window.__OL.S.bets.length')
    opn = lambda n: pg.locator('.impop').nth(n)                                       # the nth item of the list
    ot = lambda n, sel: opn(n).locator(sel).inner_text().replace('\xa0', ' ')
    pg.set_input_files('#impfile', [str(SHOTS / n) for n in ('print.png', 'simples.png', 'acumulada.png', 'lista.png')])
    pg.wait_for_function('document.querySelectorAll(".impop").length === 4 && !document.querySelector("#impfile").disabled', timeout=240000)
    assert [t.lower() for t in pg.locator('.impop .oph .label').all_inner_texts()] == ['foto 1', 'foto 2', 'foto 3', 'foto 4'], 'pictures are numbered; a phone gives them names nobody can read'
    # each item of a list is one line: what is ready, or only a reference, starts folded, with what it is and where it stands
    assert pg.locator('.impop.folded').count() == 4 and pg.locator('.impres').count() == 0 and [t.lower() for t in pg.locator('.impop .st').all_inner_texts()] == ['pronta', 'pronta', 'pronta', 'referência'], pg.locator('.impop .st').all_inner_texts()
    assert pg.locator('.impop .brief').all_inner_texts() == ['Connor Lee Dunne vence', 'Dario Kessler vence', 'Marina Teles vence + Connor Lee Dunne vence', 'Marina Teles vence + Connor Lee Dunne vence'], pg.locator('.impop .brief').all_inner_texts()
    assert [t.replace('\xa0', ' ') for t in pg.locator('.impop .amt').all_inner_texts()] == ['R$ 250,00 · 2,5u', 'R$ 100,00 · 1u', 'R$ 80,00 · 0,8u'], 'the stake is on the line whole, in money and in units; the list with no value has none'
    assert pg.locator('.impop .fold .when').count() == 4 and all(':' in t for t in pg.locator('.impop .fold .when').all_inner_texts()) and txt('#imptotalu') == '4,3u', 'each line says when its first fight is, and the total is in units too'
    # with the setting on units the same prints are one unit each: the money they show is not copied, and they still go in the batch
    pg.click('[data-act=impclose]'); pg.click('.tabbar [data-tab=carteira]'); pg.click('[data-act=stakein][data-m=units]'); pg.click('.tabbar [data-tab=lutas]'); pg.click('[data-act=imp]')
    assert [t.replace('\xa0', ' ') for t in pg.locator('.impop .amt').all_inner_texts()] == ['1u · R$ 100,00', '1u · R$ 100,00', '1u · R$ 100,00'] and txt('#imptotal') == 'R$ 300,00' and txt('#imptotalu') == '3u' and txt('[data-act=impall]') == 'Apostar as 3 de uma vez', (pg.locator('.impop .amt').all_inner_texts(), txt('.impall'))
    assert txt('#impret') == 'R$ 817,00' and txt('#impgain') == '+R$ 517,00 · +5,17u' and 'Retorno se todas baterem' in txt('.impall'), txt('.impall')          # 205,00 + 270,00 + 342,00 back on 1u each
    pg.locator('#impgain').scroll_into_view_if_needed(); shot('s38-lote-ganho.png')
    pg.click('[data-act=impclose]'); pg.click('.tabbar [data-tab=carteira]'); pg.click('[data-act=stakein][data-m=money]'); pg.click('.tabbar [data-tab=lutas]'); pg.click('[data-act=imp]')
    assert txt('#imptotal') == 'R$ 430,00' and pg.locator('.impop.folded').count() == 4
    assert all(pg.evaluate('e => e.getBoundingClientRect().right <= e.closest(".oph").getBoundingClientRect().right', e) for e in pg.locator('.impop .amt').element_handles()), 'and it is never pushed off the line by a long selection'
    assert txt('#imptotal') == 'R$ 430,00' and pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') == 0; shot('s33-lista-recolhida.png')
    opn(1).locator('[data-act=impopen]').click(); assert opn(1).locator('.impres').count() == 1 and pg.locator('.impop.folded').count() == 3 and opn(1).locator('.brief').count() == 0
    opn(1).locator('[data-act=impopen]').click(); assert pg.locator('.impop.folded').count() == 4
    def unfold():                                                   # the rest of this walk-through looks inside every item
        while pg.locator('[data-act=impopen][aria-expanded=false]').count(): pg.locator('[data-act=impopen][aria-expanded=false]').first.click()
    unfold()
    assert pg.locator('.impkind').all_inner_texts() == ['Simples', 'Simples', 'Múltipla de 2 seleções', 'Múltipla de 2 seleções'], pg.locator('.impkind').all_inner_texts()
    assert [v.replace('\xa0', ' ') for v in pg.locator('.impvalue').all_inner_texts()] == ['R$ 250,00 · 2,5u', 'R$ 100,00 · 1u', 'R$ 80,00 · 0,8u', 'R$ 100,00 · 1u'], pg.locator('.impvalue').all_inner_texts()
    assert 'Dario Kessler vence' in ot(1, '.impres') and 'Odd do print 2.70 · odd agora 2.70' in ot(1, '.impres'), 'V2 is the second name on the slip line: ' + ot(1, '.impres')
    # the accumulator shows the market of its first fight only; the list of selections has the other one, and it is filled in
    assert 'Marina Teles vence' in ot(2, '.impres') and 'Connor Lee Dunne vence' in ot(2, '.impres') and 'Completada com a foto 4' in ot(2, '.via'), ot(2, '.impres')
    assert 'Odd do print 1.67' in ot(2, '.impres') and 'Odd do print 2.05' in ot(2, '.impres'), 'the list also gives the odd of each selection: ' + ot(2, '.impres')
    assert ot(2, '.impodd') == '3.42 · agora 3.42' and 'bate com o cupom' in ot(2, '.impcheck') and '1.67 × 2.05 = 3.42' in ot(2, '.impcheck'), (ot(2, '.impodd'), ot(2, '.impcheck'))
    assert opn(2).locator('.impmiss').count() == 0 and 'serviu pra completar outra aposta' in ot(3, '.impref'), 'the list is a reference, not a bet'
    assert txt('#imptotal') == 'R$ 430,00' and '1 da lista fica de fora' in txt('#impout') and txt('[data-act=impall]') == 'Apostar as 3 de uma vez', txt('.impall')
    opn(2).scroll_into_view_if_needed(); shot('s26-varias-fotos.png')
    # what was read can be corrected in the list: a selection swapped for another of the same fight, or taken out
    assert opn(0).locator('.impedit').count() == 0; opn(0).locator('[data-act=impswap]').click()
    assert opn(0).locator('[data-act=impswap]').inner_text() == 'cancelar' and 'Tirar esta seleção' in opn(0).locator('.impedit').inner_text()
    # the choices are buttons of the app, under the name of each market and with the odd of now: no list drawn by the device, so they
    # have the colours of the theme
    opts = opn(0).locator('.impedit .mkopts button'); labels = opn(0).locator('.impedit .label').all_inner_texts()
    assert pg.locator('select').count() == 0 and opts.count() > 20 and labels[0].upper() == 'VENCEDOR' and len(labels) >= 6 and re.fullmatch(r'Rafael Almeida vence\s+1\.80', opts.first.inner_text()), (opts.count(), labels, opts.first.inner_text())
    bg = [int(v) for v in re.findall(r'\d+', opts.first.evaluate('e => getComputedStyle(e).backgroundColor'))[:3]]; ink = [int(v) for v in re.findall(r'\d+', opts.first.evaluate('e => getComputedStyle(e).color'))[:3]]
    assert (max(bg) < 70 and min(ink) > 180) if (sys.argv[1] if len(sys.argv) > 1 else 'dark') == 'dark' else (min(bg) > 220 and max(ink) < 90), ('the choices are drawn in the colours of the theme', bg, ink)
    assert pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') == 0; opn(0).locator('.impedit').scroll_into_view_if_needed(); shot('s55-trocar-selecao.png')
    opn(0).locator('.impedit [data-key="mov:b:ko"]').click()
    assert 'Dunne por KO/TKO' in ot(0, '.impres') and 'Trocada por você' in ot(0, '.fixed') and 'Odd do print' not in ot(0, '.impres') and opn(0).locator('.impedit').count() == 0, ot(0, '.impres')
    assert pg.evaluate('window.__OL.imp.ops[0].edits') == {'0': 'mov:b:ko'}, 'the print odd was of the selection that was read, not of this one'
    opn(0).locator('[data-act=impunedit]').click(); assert 'Connor Lee Dunne vence' in ot(0, '.impres') and 'Odd do print 2.05' in ot(0, '.impres') and opn(0).locator('.fixed').count() == 0
    opn(0).locator('[data-act=impswap]').click(); opn(0).locator('.impedit [data-key="ml:b"]').click()                      # the one it already has: nothing changes
    assert pg.evaluate('window.__OL.imp.ops[0].edits') == {} and opn(0).locator('.impedit').count() == 0
    # taken out of the list of selections, that selection no longer completes the accumulator; put back, it does again
    opn(3).locator('[data-act=impswap] >> nth=1').click(); opn(3).locator('.impedit [data-key=__drop]').click()
    assert 'Tirada por você: Connor Lee Dunne vence' in ot(3, '.impgone') and ot(3, '.impkind') == 'Simples' and opn(2).locator('.impmiss').count() == 1 and opn(2).locator('.via').count() == 0, ot(3, '.impgone')
    opn(3).locator('[data-act=impunedit]').click(); assert opn(3).locator('.impgone').count() == 0 and 'Completada com a foto 4' in ot(2, '.via') and txt('#imptotal') == 'R$ 430,00'
    # the text the reader got out of each picture can be seen
    raw = opn(1).locator('.impraw pre').text_content(); assert 'Kessler' in raw and 'BRL' in raw and opn(1).locator('[data-act=impfixtext]').count() == 1, raw
    # undone, the fight is open again: the selection can be taken from another item of the list, or chosen from the fight's markets
    opn(2).locator('[data-act=impunpick]').click()
    assert 'Achei Almeida x Dunne, mas a aposta nela não está nessa imagem' in ot(2, '.impmiss') and 'costuma mostrar só a primeira seleção' in ot(2, '.hint') and ot(2, '.impkind') == 'Múltipla (só uma seleção lida)', ot(2, '.impmiss')
    assert [t.replace('\xa0', ' ') for t in opn(2).locator('[data-act=impuse]').all_inner_texts()] == ['Usar da foto 1: Connor Lee Dunne vence · 2.05', 'Usar da foto 4: Connor Lee Dunne vence · 2.05'], opn(2).locator('[data-act=impuse]').all_inner_texts()
    assert opn(3).locator('.impref').count() == 0 and 'O original não diz o valor' in ot(3, '.impnoval') and txt('[data-act=impall]') == 'Apostar as 2 de uma vez', 'a list with no value does not go in the batch by itself'
    # the markets of that fight open at a tap, and close again once one is chosen
    assert opn(2).locator('.imppick').count() == 0 and opn(2).locator('[data-act=imppickopen]').inner_text() == 'Escolher a aposta nessa luta'
    opn(2).locator('[data-act=imppickopen]').click(); assert opn(2).locator('.imppick .mkopts button').count() > 20 and opn(2).locator('[data-act=imppickopen]').inner_text() == 'Fechar as opções' and 'Tirar esta seleção' not in ot(2, '.imppick')
    opn(2).locator('[data-act=imppickopen]').click(); assert opn(2).locator('.imppick').count() == 0; opn(2).locator('[data-act=imppickopen]').click()
    opn(2).locator('.imppick [data-key="mov:a:ko"]').click(); assert opn(2).locator('.imppick').count() == 0 and pg.locator('select').count() == 0
    assert 'Almeida por KO/TKO' in ot(2, '.impres') and 'Escolhida por você' in ot(2, '.via') and ot(2, '.impkind') == 'Múltipla de 2 seleções' and opn(2).locator('.impcheck').count() == 0, ot(2, '.impres')
    opn(2).locator('[data-act=impunpick]').click(); assert opn(2).locator('.imppick').count() == 0 and opn(2).locator('[data-act=imppickopen]').inner_text() == 'Escolher a aposta nessa luta', 'undone, the fight is open again with its markets closed: choosing one had closed them'
    opn(2).locator('[data-act=impuse] >> nth=1').click()
    assert 'Completada com a foto 4' in ot(2, '.via') and 'bate com o cupom' in ot(2, '.impcheck') and opn(3).locator('.impref').count() == 1, ot(2, '.impres')
    # the value and the kind of each item can be changed in the list
    opn(1).locator('.opstake').fill('1500'); assert opn(1).locator('.opstake').input_value() == '1.500', 'the field has the thousands mask'
    opn(1).locator('.opstake').fill('150'); opn(1).locator('.opstake').blur()
    assert ot(1, '.impvalue') == 'R$ 150,00 · 1,5u' and 'valor que você escreveu' in ot(1, '.sum') and txt('#imptotal') == 'R$ 480,00', (ot(1, '.impvalue'), txt('#imptotal'))
    assert ot(1, '.impgain') == '+R$ 255,00 · +2,55u' and 'Ganho se bater' in ot(1, '.sum'), ot(1, '.sum')          # R$ 150,00 at 2.70
    opn(2).locator('[data-act=impmode][data-m=single]').click()
    assert ot(2, '.impkind') == '2 apostas simples' and 'Valor de cada uma' in ot(2, '.sum') and txt('#imptotal') == 'R$ 560,00' and '4 apostas' in txt('.impall'), txt('.impall')
    assert ot(2, '.impgain') == '+R$ 137,60 · +1,38u' and 'Ganho se todas baterem' in ot(2, '.sum'), ot(2, '.sum')          # two singles of R$ 80,00, at 1.67 and at 2.05: 133,60 + 164,00 back
    opn(2).locator('[data-act=impmode][data-m=multi]').click(); assert ot(2, '.impkind') == 'Múltipla de 2 seleções' and txt('#imptotal') == 'R$ 480,00'
    opn(3).locator('.opstake').fill('20'); opn(3).locator('.opstake').blur()
    # a list given a value is a bet of its own, and here it is the very bet the accumulator above it already is: it waits to be told
    assert opn(3).locator('.impref').count() == 0 and 'Igual à foto 3, que já está na lista' in ot(3, '.impdup') and txt('#imptotal') == 'R$ 480,00' and txt('[data-act=impall]') == 'Apostar as 3 de uma vez', txt('.impall')
    opn(3).locator('[data-act=impforce]').click()
    assert 'mesmo assim' in ot(3, '.impforced') and txt('#imptotal') == 'R$ 500,00' and txt('[data-act=impall]') == 'Apostar as 4 de uma vez', 'told to bet it anyway: ' + txt('.impall')
    opn(3).locator('[data-act=impforce]').click(); assert opn(3).locator('.impforced').count() == 0 and txt('[data-act=impall]') == 'Apostar as 3 de uma vez'
    opn(3).locator('.opstake').fill(''); opn(3).locator('.opstake').blur()
    assert opn(3).locator('.impref').count() == 1 and txt('#imptotal') == 'R$ 480,00' and txt('[data-act=impall]') == 'Apostar as 3 de uma vez', 'and without it, a reference again: ' + txt('.impall')
    # a pasted text joins the list next to the pictures, and any of them can be taken out
    pg.fill('#imptext', MONEY_TIP); pg.click('[data-act=impread]'); pg.wait_for_function('document.querySelectorAll(".impop").length === 5')
    # it is the same bet as the first picture: one of the two is held back, and the total does not count it twice
    assert pg.locator('.impop .oph .label').first.inner_text().lower() == 'texto' and 'Igual ao texto, que já está na lista' in ot(1, '.impdup') and txt('#imptotal') == 'R$ 480,00' and txt('[data-act=impall]') == 'Apostar as 3 de uma vez', txt('.impall')
    assert '2 da lista ficam de fora' in txt('#impout') and 'já está apostada' in txt('#impout'), txt('#impout')
    pg.click('.impop >> nth=0 >> [data-act=impdrop]'); assert pg.locator('.impop').count() == 4 and txt('#imptotal') == 'R$ 480,00', txt('.impall')
    # who the bets are from goes with them
    pg.fill('#impfrom', 'Canal do Zé')
    ESPN['down'] = True; pg.click('[data-act=impall]'); pg.wait_for_selector('#impmsg')                 # the source cannot be reached: nothing is written
    assert 'Sem conexão com a ESPN' in txt('#impmsg') and pg.evaluate('window.__OL.S.bets.length') == had, txt('#impmsg')
    ESPN['down'] = False; ESPN['f2b'] = 150                                                             # the line moved since the list was shown: nothing is written either
    pg.click('[data-act=impall]'); pg.wait_for_function('(document.getElementById("impmsg") || {}).textContent && document.getElementById("impmsg").textContent.includes("mudou")')
    assert pg.evaluate('window.__OL.S.bets.length') == had and 'odd agora 2.50' in txt('#panel') and pg.input_value('#impfrom') == 'Canal do Zé', 'the new odd is on the screen to be confirmed: ' + txt('#panel')
    # with a floor set in the wallet, a bet whose odd fell further than that against its print waits to be told
    assert pg.locator('.implow').count() == 0
    pg.click('[data-act=impclose]'); pg.click('.tabbar [data-tab=carteira]')
    assert pg.get_attribute('[data-act=copydrop][data-m="0"]', 'aria-pressed') == 'true' and 'Desligada' in txt('#drophow'), txt('#drophow')
    pg.click('[data-act=copydrop][data-m="10"]'); assert pg.evaluate('window.__OL.S.copyDrop') == 10 and 'mais de 10% abaixo' in txt('#drophow'), txt('#drophow')
    pg.click('.tabbar [data-tab=lutas]'); pg.click('[data-act=imp]'); assert pg.locator('.implow').count() == 0 and txt('[data-act=impall]') == 'Apostar as 3 de uma vez', '2.50 against 2.70 is 7.4% down: inside a 10% floor'
    pg.click('[data-act=impclose]'); pg.click('.tabbar [data-tab=carteira]'); pg.click('[data-act=copydrop][data-m="5"]'); pg.locator('#copycard').scroll_into_view_if_needed(); shot('s29-odd-minima.png')
    pg.click('.tabbar [data-tab=lutas]'); pg.click('[data-act=imp]')
    assert 'A odd caiu 7,4% em relação ao print. Seu limite é 5%.' in ot(1, '.implow') and txt('#imptotal') == 'R$ 330,00' and txt('[data-act=impall]') == 'Apostar as 2 de uma vez', txt('.impall')
    opn(1).scroll_into_view_if_needed(); shot('s30-odd-caiu.png')
    opn(1).locator('[data-act=impforce]').click(); assert txt('#imptotal') == 'R$ 480,00' and txt('[data-act=impall]') == 'Apostar as 3 de uma vez' and pg.input_value('#impfrom') == 'Canal do Zé'
    pg.click('[data-act=impall]'); pg.wait_for_function(f'window.__OL.S.bets.length === {had + 3}')
    made = pg.evaluate('window.__OL.S.bets.slice(-3).map(b => [b.type, b.stake, b.odd, b.from, b.printed || null, b.legs.map(l => [l.key, l.odd, l.printed || null])])')
    assert made == [['single', 250, 2.05, 'Canal do Zé', None, [['ml:b', 2.05, 2.05]]], ['single', 150, 2.5, 'Canal do Zé', None, [['ml:b', 2.5, 2.7]]],
                    ['multi', 80, 3.42, 'Canal do Zé', 3.424, [['ml:a', 1.67, 1.67], ['ml:b', 2.05, 2.05]]]], made
    assert '3 apostas feitas' in pg.inner_text('#toast') and bal().replace('\xa0', ' ') == 'R$ 520,00', (pg.inner_text('#toast'), bal())
    # open bets go by event, in the order the fights happen, with what is at stake and what the event can pay
    assert pg.locator('.grp').count() == 1 and 'almeida vs. dunne' in txt('.grp').lower() and txt('.grpsum .hint') == '3 apostas · retorno e ganho se todas baterem', (txt('.grp'), txt('.grpsum'))
    # the event says what is at stake and what it can pay, in money and in units: 512,50 + 375,00 + 273,60 back, and 2,625u + 2,25u + 1,936u of gain
    tot = lambda box: [txt(f'{box} .{c}').replace('\xa0', ' ') for c in ('st', 'stu', 'rt', 'gn', 'gnu')]
    assert tot('.grpsum') == ['R$ 480,00', '4,8u', 'R$ 1.161,10', '+R$ 681,10', '+6,81u'] and pg.locator('.opentot').count() == 0, tot('.grpsum')
    assert [t.replace('\xa0', ' ') for t in pg.locator('.bet .gain b').all_inner_texts()] == ['+R$ 193,60 · +1,94u', '+R$ 225,00 · +2,25u', '+R$ 262,50 · +2,63u'], pg.locator('.bet .gain b').all_inner_texts()
    assert pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') == 0; shot('s36-ganho-por-evento.png')
    assert [b.locator('.leg b').first.inner_text() for b in pg.locator('.bet').all()] == ['Marina Teles vence', 'Dario Kessler vence', 'Connor Lee Dunne vence'], 'the bet whose first fight comes first is on top'
    # and each fight on the card says what is already riding on it, a tap away from the bets
    pg.click('.tabbar [data-tab=lutas]')
    assert {f: txt(f'.chip.mine[data-fid="{f}"]') for f in ('f1', 'f2', 'f3')} == {'f1': '1 aposta · R$ 80,00 · 0,8u', 'f2': '1 aposta · R$ 150,00 · 1,5u', 'f3': '2 apostas · R$ 330,00 · 3,3u'}, 'the multiple counts whole on each of its fights'
    assert pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') == 0; shot('s34-apostas-na-luta.png')
    pg.click('.chip.mine[data-fid="f3"]'); assert pg.evaluate('window.__OL.ui.tab') == 'apostas' and pg.locator('.grp').count() == 1
    assert pg.evaluate('document.getElementById("sheet").hidden') and pg.evaluate('window.__OL.ui.tab') == 'apostas', 'everything was bet and the reference list went with it: the list is empty and closes'
    # the wallet says the same about everything that is open
    pg.click('.tabbar [data-tab=carteira]')
    # the bankroll at a glance: what it is, what is at stake and what a unit is worth, and where it goes if the open bets all win or all lose
    assert [txt('#bankv'), txt('#atrisk b'), txt('#atrisk .un'), txt('#unitv')] == ['R$ 1.000,00', 'R$ 480,00', '4,8u · 3 apostas', 'R$ 100,00'] and '10% da banca' in txt('#bank .kp3'), txt('#bank')
    assert [txt('#ifwin small').lower(), txt('#ifwin b'), txt('#ifwin span')] == ['se todas baterem', '+R$ 681,10 · +6,81u', 'retorno de R$ 1.161,10 · banca vai a R$ 1.681,10'], txt('#ifwin')          # R$ 520,00 of balance plus the R$ 1.161,10 back
    assert [txt('#iflose small').lower(), txt('#iflose b'), txt('#iflose span')] == ['se todas perderem', '−R$ 480,00 · −4,8u', 'banca vai a R$ 520,00'] and txt('#deptotal') == 'R$ 1.000,00 depositados no total', txt('#iflose')
    assert pg.evaluate('getComputedStyle(document.querySelector("#ifwin b")).color !== getComputedStyle(document.querySelector("#iflose b")).color') and pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') == 0, 'gain and loss are told apart by colour, and it fits the phone'
    shot('s37-carteira-em-jogo.png')
    # with bets on more than one event there is also the total of everything open; a bet from before units existed counts in money only
    pg.evaluate('(() => { const b = window.__OL.S.bets.filter(x => x.status === "open")[0]; window.__keep = [b.unit, b.legs.map(l => [l.eid, l.event, l.date])]; delete b.unit; b.legs.forEach(l => { l.eid = "e9"; l.event = "UFC 999: Brandt vs. Kessler"; l.date += 7 * 864e5; }); })()')
    pg.click('.tabbar [data-tab=apostas]')
    assert pg.locator('.grp').count() == 2 and pg.locator('.grpsum').count() == 2 and 'brandt vs. kessler' in pg.locator('.grp').nth(1).inner_text().lower() and txt('#openall').lower() == 'tudo em aberto', pg.locator('.grp').all_inner_texts()
    assert tot('.opentot')[::2] == ['R$ 480,00', 'R$ 1.161,10', '+4,19u'] and txt('.opentot .stu') == '2,3u' and 'unidades de 2 delas' in txt('.opentot .hint'), (tot('.opentot'), txt('.opentot .hint'))     # without the R$ 250,00 at 2.05: 4,8u - 2,5u and 6,811u - 2,625u
    assert [txt(f'.grpsum >> nth={i} >> .st') for i in (0, 1)] == ['R$ 230,00', 'R$ 250,00'] and pg.locator('.grpsum >> nth=1 >> .un').count() == 0 and '1 aposta · retorno e ganho se bater' == txt('.grpsum >> nth=1 >> .hint'), 'each event with its own; the one with no unit says no units'
    assert pg.locator('.bet .gain b').last.inner_text().replace('\xa0', ' ') == '+R$ 262,50', 'and its gain is in money only'
    pg.evaluate('(() => { const b = window.__OL.S.bets.filter(x => x.status === "open")[0], k = window.__keep; b.unit = k[0]; b.legs.forEach((l, i) => { [l.eid, l.event, l.date] = k[1][i]; }); })()')
    pg.click('.tabbar [data-tab=carteira]'); pg.click('.tabbar [data-tab=apostas]'); assert pg.locator('.grp').count() == 1 and pg.locator('.opentot').count() == 0 and tot('.grpsum')[1] == '4,8u'
    # figures of hundreds of thousands still fit a phone: three to a row become two, and no number is broken in the middle
    oneline = lambda sel: pg.evaluate('s => [...document.querySelectorAll(s)].every(e => e.getClientRects().length === 1 && e.getBoundingClientRect().height < 30)', sel)
    assert 'wide' not in pg.get_attribute('.grpsum', 'class') and oneline('.tot b') and oneline('.bf b')
    pg.evaluate('(() => { const S = window.__OL.S, b = S.bets.filter(x => x.status === "open")[0]; window.__keep = [b.stake, S.deposits[0].v]; b.stake = 250000; S.deposits[0].v += 5e6; })()')
    pg.click('.tabbar [data-tab=carteira]')
    assert 'wide' in pg.get_attribute('#bank .kp3', 'class') and oneline('#bank .kp3 b') and oneline('#bank .scn b') and pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') == 0, txt('#bank')
    pg.click('.tabbar [data-tab=apostas]')
    assert 'wide' in pg.get_attribute('.grpsum', 'class') and txt('.grpsum .rt') == 'R$ 513.148,60' and oneline('.tot b') and oneline('.bf b') and oneline('.gain b') and pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') == 0, txt('.grpsum')          # 250.000 x 2.05 + 375,00 + 273,60
    shot('s43-valores-altos.png')
    pg.evaluate('(() => { const S = window.__OL.S, b = S.bets.filter(x => x.status === "open")[0]; [b.stake, S.deposits[0].v] = window.__keep; })()')
    pg.click('.tabbar [data-tab=carteira]'); pg.click('.tabbar [data-tab=apostas]'); assert tot('.grpsum')[0] == 'R$ 480,00' and 'wide' not in pg.get_attribute('.grpsum', 'class')
    # the bets say where they came from and how the odd taken compares with the printed one
    notes = [t.replace('\xa0', ' ') for t in pg.locator('.bet .src').all_inner_texts()]
    assert sorted(notes) == sorted(['Odd do print 2.70, você pegou 2.50 (−7,4%)', 'Odd do print 3.42, você pegou 3.42 (−0,1%)', 'Odd do print 2.05, você pegou 2.05 (0,0%)']), notes
    # what came in through the copy screen is the tipster's, and says so on the bet; the mark is kept with the bet
    assert [t.lower() for t in pg.locator('.bet .owner').all_inner_texts()] == ['tipster · canal do zé'] * 3 and pg.locator('.bet .owner.tipster').count() == 3 and all(e.is_visible() for e in pg.locator('.bet .owner').all()) and pg.evaluate('window.__OL.S.bets.slice(-3).every(b => b.copied === true)'), pg.locator('.bet .owner').all_inner_texts()
    shot('s27-origem.png')
    # repeating a tipster's bet is still the tipster's pick: the mark and the name go along, the printed odds do not
    pg.locator('[data-act=again]').first.click(); pg.wait_for_selector('#stake')
    assert pg.evaluate('window.__OL.slip.copy') == {'from': 'Canal do Zé', 'bet': None, 'sig': '', 'legs': {}} and 'entra como do tipster' in txt('#slipcopy'), pg.evaluate('window.__OL.slip.copy')
    while pg.evaluate('window.__OL.slip.sels.length'): pg.click('#panel [data-act=unpick] >> nth=0')
    assert pg.evaluate('window.__OL.slip.copy') is None and pg.evaluate('document.getElementById("sheet").hidden')
    cid = pg.evaluate('window.__OL.S.bets.slice(-3)[0].id')                                              # one of them is closed (cashed out), so that the wallet has a result by origin
    pg.click(f'[data-act=cash][data-id="{cid}"]'); pg.click(f'[data-act=docash][data-id="{cid}"]'); pg.wait_for_function(f'window.__OL.S.bets.find(b => b.id === "{cid}").status === "cashed"')
    pg.click('.tabbar [data-tab=carteira]')
    assert 'em 3 apostas copiadas com odd no original, você pegou em média −2,5% em relação ao print (0 acima)' in txt('#edge'), txt('#edge')
    cells = lambda tr: [' | '.join(x.strip() for x in c.replace('\xa0', ' ').split('\n') if x.strip()) for c in tr.locator('td').all_inner_texts()]
    assert cells(pg.locator('#origins tbody tr.tipster').first) == ['Canal do Zé | 1 aposta · R$ 250,00 · odd −2,5% contra o print', 'R$ 0,00 | 0u', '0,0%', '—'], pg.locator('#origins').inner_text()
    assert cells(pg.locator('#origins tbody tr.own').first) == ['Minhas | 0 apostas · R$ 0,00', 'R$ 0,00', '—', '—'] and txt('#bench') == 'Ainda não dá pra comparar: falta aposta encerrada sua nesse período.', (pg.locator('#origins').inner_text(), txt('#bench'))
    assert pg.evaluate('(e => e.scrollWidth - e.clientWidth)(document.getElementById("origins"))') == 0, 'the table by origin fits the phone, with no column hidden to the side'
    # an origin can be given another name; without a new name nothing changes
    froms = lambda: pg.evaluate('[...new Set(window.__OL.S.bets.map(b => b.from).filter(Boolean))]')
    assert pg.locator('#orgfrom button').all_inner_texts() == ['Canal do Zé'] and pg.locator('#orgfrom button.on').count() == 1 and pg.locator('select').count() == 0, 'the tipster to rename is picked among buttons of the app'
    pg.click('[data-act=orgrename]'); assert 'Escolhe a origem' in pg.inner_text('#toast') and froms() == ['Canal do Zé'], 'an empty name must not strip the origin'
    pg.fill('#orgto', 'Zé'); pg.click('[data-act=orgrename]'); assert '3 apostas mudaram de origem' in pg.inner_text('#toast') and froms() == ['Zé'], (pg.inner_text('#toast'), froms())
    assert cells(pg.locator('#origins tbody tr.tipster').first)[0].startswith('Zé | 1 aposta')
    pg.fill('#orgto', 'Canal do Zé'); pg.click('[data-act=orgrename]'); assert froms() == ['Canal do Zé']
    # a copy that came with no name is still the tipster's, and can be given a name later
    pg.evaluate(f'delete window.__OL.S.bets.find(b => b.id === "{cid}").from'); pg.click('.tabbar [data-tab=apostas]'); pg.click('.tabbar [data-tab=carteira]')
    assert pg.locator('#orgfrom button').all_inner_texts() == ['Tipster (1)', 'Canal do Zé'] and pg.locator('#orgfrom button.on').inner_text() == 'Tipster (1)' and cells(pg.locator('#origins tbody tr.tipster').first)[0].startswith('Tipster | 1 aposta'), pg.locator('#origins').inner_text()
    # picked with the name already being typed: the field holds the screen as it is, and the button is marked all the same; and the
    # choice stays when the screen is painted again
    pg.fill('#orgto', 'Canal do Zé'); pg.click('#orgfrom [data-k="Canal do Zé"]')
    assert pg.locator('#orgfrom button.on').all_inner_texts() == ['Canal do Zé'] and pg.input_value('#orgto') == 'Canal do Zé' and pg.locator('#orgfrom [data-k=""]').get_attribute('aria-pressed') == 'false'
    pg.evaluate('document.activeElement.blur()'); pg.click('.tabbar [data-tab=apostas]'); pg.click('.tabbar [data-tab=carteira]'); assert pg.locator('#orgfrom button.on').all_inner_texts() == ['Canal do Zé'], 'the one picked is still the one picked'
    pg.click('#orgfrom [data-k=""]'); assert pg.locator('#orgfrom button.on').all_inner_texts() == ['Tipster (1)']
    pg.fill('#orgto', 'Canal do Zé'); pg.click('[data-act=orgrename]')
    assert '1 aposta mudou de origem' in pg.inner_text('#toast') and pg.evaluate(f'window.__OL.S.bets.find(b => b.id === "{cid}").from') == 'Canal do Zé' and pg.locator('#orgfrom button').all_inner_texts() == ['Canal do Zé'], pg.inner_text('#toast')
    # the list of bets can show one origin at a time
    pg.click('.tabbar [data-tab=apostas]'); plain = pg.evaluate('window.__OL.S.bets.some(b => !b.from)')
    assert pg.locator('#byorigin button').all_inner_texts() == ['Todas', 'Minhas', 'Tipster', 'Canal do Zé'] and plain is False, pg.locator('#byorigin button').all_inner_texts()
    pg.click('[data-act=filter][data-f=open]'); pg.click('#byorigin button >> nth=1'); assert pg.locator('.bet').count() == 0 and txt('.empty') == 'Nenhuma aposta aberta sua.', txt('#view')
    pg.click('#byorigin button >> nth=2'); assert pg.locator('.bet').count() == 2 and pg.locator('.bet .owner.tipster').count() == 2, 'every bet of a tipster, whatever the name'
    pg.click('#byorigin button >> nth=3'); pg.click('[data-act=filter][data-f=open]')
    assert pg.locator('.bet').count() == 2 and 'Abertas (2)' in txt('.filter') and 'Encerradas (1)' in txt('.filter'), txt('.filter')
    pg.click('[data-act=filter][data-f=done]'); assert pg.locator('.bet').count() == 1 and txt('.bet .owner').lower() == 'tipster · canal do zé'
    pg.click('#byorigin button >> nth=0'); pg.click('[data-act=filter][data-f=open]'); assert pg.evaluate('window.__OL.ui.origin') is None
    pg.click('.tabbar [data-tab=lutas]'); pg.click('[data-act=imp]')
    assert pg.locator('#impfroms button').all_inner_texts() == ['Canal do Zé'] and pg.input_value('#impfrom') == 'Canal do Zé' and pg.get_attribute('#impfroms button', 'aria-pressed') == 'true', 'the origin of the last bets is still there, and offered as a button'
    pg.click('#impfroms button'); assert pg.input_value('#impfrom') == '' and pg.get_attribute('#impfroms button', 'aria-pressed') == 'false', 'a tap on the one in use takes it off'
    pg.click('#impfroms button'); assert pg.input_value('#impfrom') == 'Canal do Zé', 'and a tap on one that is not in use puts it there'
    # one bet, through the slip: the origin and the printed odd go along, and a slip started by hand carries nothing
    pg.fill('#impfrom', 'Canal do Zé'); pg.fill('#imptext', TIP_TEXT); pg.click('[data-act=impread]'); pg.wait_for_selector('#impres')
    # what is already at stake on the fight is said before the bet goes anywhere, here and in the slip
    assert txt('.impexpo') == 'Você já tem R$ 80,00 (0,8u) em jogo em Almeida x Dunne, em 1 aposta aberta.' and pg.locator('.impdup').count() == 0, txt('#panel')
    pg.click('[data-act=impgo]'); pg.wait_for_selector('#stake'); assert txt('.slipexpo') == 'Você já tem R$ 80,00 (0,8u) em jogo em Almeida x Dunne, em 1 aposta aberta.', txt('#panel')
    assert 'Aposta copiada de Canal do Zé' in txt('#slipcopy') and pg.evaluate('window.__OL.slip.copy') == {'from': 'Canal do Zé', 'bet': None, 'sig': 'f3|ml:b', 'legs': {'f3|ml:b': 1.44}}, pg.evaluate('window.__OL.slip.copy')
    pg.click('#panel [data-act=unpick]'); assert pg.evaluate('window.__OL.slip.copy') is None
    pick('f1', 'ml:b'); pg.click('#slipbtn'); pg.wait_for_selector('#stake')                 # the other side of a fight that already has a bet on it
    assert txt('.slipexpo') == 'Você já tem R$ 80,00 (0,8u) em jogo em Teles x Prado Jr., em 1 aposta aberta. Esta vai contra ela: Marina Teles vence.', txt('.slipexpo')
    pg.click('#panel [data-act=sheet]')
    pick('f1', 'ml:a'); pg.click('#slipbtn'); pg.wait_for_selector('#stake'); assert pg.locator('#slipcopy').count() == 0 and 'vai contra' not in txt('.slipexpo')
    # that bet, made by hand, is the person's own: closed, it is the "Minhas" row, against the tipster's
    pg.fill('#stake', '40'); pg.click('[data-act=place]'); pg.wait_for_function(f'window.__OL.S.bets.length === {had + 4}')
    hid, plain = pg.evaluate('(b => [b.id, "copied" in b || "from" in b || "printed" in b || b.legs.some(l => "printed" in l)])(window.__OL.S.bets.slice(-1)[0])'); assert plain is False, 'a bet made by hand keeps nothing of a print'
    pg.click('.tabbar [data-tab=apostas]'); assert pg.locator('.bet .owner.own').count() == 1 and pg.locator('.bet .owner.own').inner_text().lower() == 'minha' and pg.locator('.bet .owner.tipster').count() == 2, pg.locator('.bet .owner').all_inner_texts()
    pg.click(f'[data-act=cash][data-id="{hid}"]'); pg.click(f'[data-act=docash][data-id="{hid}"]'); pg.wait_for_function(f'window.__OL.S.bets.find(b => b.id === "{hid}").status === "cashed"')
    pg.click('.tabbar [data-tab=carteira]')
    rows = [cells(tr) for tr in pg.locator('#origins tbody tr').all()]
    assert rows == [['Minhas | 1 aposta · R$ 40,00', 'R$ 0,00 | 0u', '0,0%', '—'], ['Canal do Zé | 1 aposta · R$ 250,00 · odd −2,5% contra o print', 'R$ 0,00 | 0u', '0,0%', '—']], rows
    assert txt('#bench') == 'Empate: retorno de 0,0% nas suas apostas e de 0,0% nas do tipster.' and all(tr.is_visible() for tr in pg.locator('#origins tbody tr').all()), txt('#bench')          # both were cashed out for what was staked
    assert pg.evaluate('(e => e.scrollWidth - e.clientWidth)(document.getElementById("origins"))') == 0
    pg.locator('#origins').scroll_into_view_if_needed(); shot('s28-por-origem.png'); pg.click('.tabbar [data-tab=lutas]')
    # the slip can change between the copy and the bet: the odd of the whole bet is kept only while the selections are still the ones of the print
    for extra, whole in ((None, 1.61), ('f2', None)):
        n0 = pg.evaluate('window.__OL.S.bets.length')
        pg.click('[data-act=imp]'); pg.fill('#imptext', DUPLA); pg.click('[data-act=impread]'); pg.wait_for_selector('#impres'); pg.click('[data-act=impgo]'); pg.wait_for_selector('#stake')
        if extra: pg.click('#panel [data-act=sheet]'); pick(extra, 'ml:b'); pg.click('#slipbtn'); pg.wait_for_selector('#stake')
        pg.click('[data-act=place]'); pg.wait_for_function(f'window.__OL.S.bets.length === {n0 + 1}')
        got = pg.evaluate('(b => [b.type, b.legs.length, b.from, b.printed || null])(window.__OL.S.bets.slice(-1)[0])')
        assert got == ['multi', 3 if extra else 2, 'Canal do Zé', whole], got
        pg.click('.tabbar [data-tab=lutas]')
    # the same prints sent again: what is already placed is said, and stays out of the batch until told otherwise
    pg.click('[data-act=imp]'); pg.set_input_files('#impfile', [str(SHOTS / n) for n in ('simples.png', 'acumulada.png', 'lista.png')])
    pg.wait_for_function('document.querySelectorAll(".impop").length === 3 && !document.querySelector("#impfile").disabled', timeout=240000)
    assert [t.lower() for t in pg.locator('.impop .oph .label').all_inner_texts()] == ['foto 1', 'foto 2', 'foto 3'], 'an emptied list counts its pictures from one again'
    assert 'Você já tem esta aposta aberta: R$ 150,00, feita em' in ot(0, '.impdup') and 'A odd caiu 7,4%' in ot(0, '.implow'), ot(0, '.impdup')
    assert ot(1, '.impdup') == 'Você já tem 2 apostas abertas iguais a esta.' and opn(1).locator('.impexpo').count() == 0, ot(1, '.impdup')
    # what needs a look starts unfolded and says why on its line; the list that only completes another one stays folded
    assert [t.lower() for t in pg.locator('.impop .st').all_inner_texts()] == ['já apostada', 'já apostada', 'referência'] and pg.locator('.impop.folded').count() == 1 and opn(2).locator('.impref').count() == 0, pg.locator('.impop .st').all_inner_texts()
    opn(2).locator('[data-act=impopen]').click(); assert 'serviu pra completar' in ot(2, '.impref'); opn(2).locator('[data-act=impopen]').click()
    assert '3 da lista ficam de fora' in txt('#impout') and pg.locator('[data-act=impall]').count() == 0, txt('.impall')
    opn(1).scroll_into_view_if_needed(); shot('s31-ja-apostada.png')
    opn(0).locator('[data-act=impforce]').click(); assert txt('[data-act=impall]') == 'Apostar a que está pronta' and txt('#imptotal') == 'R$ 100,00', txt('.impall')
    opn(0).locator('[data-act=impforce]').click(); assert pg.locator('[data-act=impall]').count() == 0
    # a picture read wrong can be corrected as text
    opn(0).locator('.impraw summary').click(); opn(0).locator('[data-act=impfixtext]').click()
    assert pg.locator('.impop').count() == 2 and 'Kessler' in pg.input_value('#imptext') and [t.lower() for t in pg.locator('.impop .oph .label').all_inner_texts()] == ['foto 2', 'foto 3']
    pg.click('[data-act=impread]'); pg.wait_for_function('document.querySelectorAll(".impop").length === 3')
    assert pg.locator('.impop .oph .label').first.inner_text().lower() == 'texto' and 'Dario Kessler vence' in ot(0, '.impres')
    pg.click('[data-act=impclear]'); assert pg.input_value('#impfrom') == '', 'clearing forgets who it was from too'
    pg.click('[data-act=impclose]')
    # back to the bankroll and the lines from before this detour, so the rest of the walk-through keeps its numbers
    ESPN['f2b'] = 170; pg.evaluate('s => localStorage.setItem("oitolados.v1", s)', kept)
    cov.reload(pg); pg.wait_for_function('window.__OL && window.__OL.S'); sync()
    assert pg.evaluate('window.__OL.S.bets.length') == had and bal().replace('\xa0', ' ') == 'R$ 1.000,00' and pg.inner_text('[data-fid="f2"][data-key="ml:b"] .ov') == '2.70', bal()
    pg.click('[data-act=imp]')
    # appearance: automatic follows the device; light and dark hold whatever the device says
    pg.click('[data-act=impclose]'); pg.click('.tabbar [data-tab=carteira]')
    DARK, LIGHT = 'rgb(14, 18, 24)', 'rgb(242, 243, 245)'
    paper = lambda: pg.evaluate('getComputedStyle(document.body).backgroundColor')
    bars = lambda: pg.evaluate('[...document.querySelectorAll("meta[name=theme-color]")].map(m => m.content)')
    device = DARK if (sys.argv[1] if len(sys.argv) > 1 else 'dark') == 'dark' else LIGHT
    assert paper() == device and bars() == ['#0e1218', '#f2f3f5'], (paper(), bars())
    pg.click('[data-act=theme][data-m=dark]'); assert paper() == DARK and bars() == ['#0e1218', '#0e1218'], (paper(), bars())
    # the buttons of the filter by country take the colours of the theme chosen here, whatever the device asks for
    landcol = lambda: pg.evaluate('(() => { const x = getComputedStyle(document.querySelector("#lands button:not(.on)")); return [x.backgroundColor, x.color]; })()')
    pg.click('.tabbar [data-tab=lutas]'); assert landcol() == ['rgb(23, 28, 37)', 'rgb(238, 241, 246)'] and pg.locator('#view select').count() == 0, landcol(); pg.click('.tabbar [data-tab=carteira]')
    pg.click('[data-act=theme][data-m=light]'); assert paper() == LIGHT and bars() == ['#f2f3f5', '#f2f3f5'], (paper(), bars())
    pg.click('.tabbar [data-tab=lutas]'); assert landcol() == ['rgb(255, 255, 255)', 'rgb(20, 25, 34)'], landcol(); pg.click('.tabbar [data-tab=carteira]')
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
    for text, expect in [('Fulano x Beltrano\nFulano para vencer a luta', 'Não achei nenhuma luta'), ('', 'Cola um texto'), ('Almeida x Dunne', 'não entendi qual é a aposta')]:
        pg.fill('#imptext', text); pg.click('[data-act=impread]'); pg.wait_for_selector('#panel .msg')
        assert expect in pg.inner_text('#panel .msg'), (text, pg.inner_text('#panel .msg'))
    # a print pasted from the clipboard goes through the same reader
    png = base64.b64encode((SHOTS / 'print.png').read_bytes()).decode()
    pg.evaluate('''b64 => { const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const dt = new DataTransfer(); dt.items.add(new File([bytes], 'print.png', { type: 'image/png' }));
        document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }''', png)
    pg.wait_for_selector('#impres', timeout=120000); assert 'Connor Lee Dunne vence' in pg.inner_text('#impres')
    # and so does a print that was copied and never saved, through the "Colar" button (the clipboard of the test is a stand-in)
    pg.click('[data-act=impclear]'); assert pg.locator('#impres').count() == 0 and 'Toca em "Colar"' in txt('#panel .hint >> nth=0')
    pg.evaluate('''b64 => { const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); window.__clip = navigator.clipboard; window.__read = [{ types: ['text/html', 'image/png'], getType: async t => new Blob([bytes], { type: t }) }];
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { read: async () => { if (window.__read === 'deny') throw new Error('denied'); return window.__read; }, readText: async () => window.__text } }); }''', png)
    pg.click('[data-act=imppaste]'); pg.wait_for_selector('#impres', timeout=120000); assert 'Connor Lee Dunne vence' in pg.inner_text('#impres'), 'the image on the clipboard was read as a print'
    pg.click('[data-act=impclear]')
    pg.evaluate('window.__read = [{ types: ["text/plain"], getType: async () => new Blob(["Almeida x Dunne\\nDunne para vencer a luta\\n2u"]) }]')
    pg.click('[data-act=imppaste]'); pg.wait_for_selector('#impres'); assert 'Connor Lee Dunne vence' in txt('#impres') and '2u do print' in txt('#panel'), 'copied text comes in the same way'
    pg.click('[data-act=impclear]'); pg.evaluate('window.__read = [{ types: ["text/html"], getType: async () => new Blob(["<p></p>"]) }]')
    pg.click('[data-act=imppaste]'); pg.wait_for_selector('#imperr'); assert 'não tem texto nem imagem' in txt('#imperr'), txt('#imperr')
    pg.evaluate('window.__read = "deny"; window.__text = "Almeida x Dunne\\nAlmeida para vencer a luta"')          # a browser that refuses the full read still gives the text
    pg.click('[data-act=imppaste]'); pg.wait_for_selector('#impres'); assert 'Rafael Almeida vence' in txt('#impres'), txt('#panel')
    pg.evaluate('Object.defineProperty(navigator, "clipboard", { configurable: true, value: window.__clip })'); pg.click('[data-act=impclear]')
    pg.keyboard.press('Escape'); assert pg.evaluate('document.getElementById("sheet").hidden'), 'Escape closes the import sheet'
    pg.click('[data-act=imp]')
    pg.click('[data-act=impclose]'); assert pg.evaluate('document.getElementById("sheet").hidden')
    print('leitor de imagem: arquivos pedidos', sorted({u.rsplit('/', 1)[1] for u in cdn_calls}))
    # unit: 10% of the bankroll by default, adjustable; the slip can stake in units
    pg.click('.tabbar [data-tab=carteira]'); assert pg.inner_text('#unitnow').replace('\xa0', ' ') == '1u = R$ 100,00', pg.inner_text('#unitnow')
    pg.fill('#unitpct', '2,5'); pg.click('[data-act=unit]'); assert pg.inner_text('#unitnow').replace('\xa0', ' ') == '1u = R$ 25,00', pg.inner_text('#unitnow')
    pg.fill('#unitpct', '10'); pg.keyboard.press('Enter'); assert pg.inner_text('#unitnow').replace('\xa0', ' ') == '1u = R$ 100,00', pg.inner_text('#unitnow')
    pg.click('.tabbar [data-tab=lutas]')
    # five selections in one multiple (two of the fights with a combination) is a long shot: the slip suggests a fraction of a unit
    for fid, key in (('f1', 'ml:a'), ('f2', 'ml:a'), ('f2', 'dist:yes'), ('f3', 'ml:a'), ('f3', 'tot:o:3.5')): pick(fid, key)
    pg.click('#slipbtn'); pg.wait_for_selector('#stake'); pg.click('[data-act=mode][data-m=multi]')
    assert pg.locator('#slipsug button').all_inner_texts() == ['0,2u', '0,3u', '0,4u'] and 'de 5 seleções: stake sugerida de 0,2u a 0,4u' in txt('#panel'), txt('#panel')
    pg.click('#slipsug [data-u="0.3"]'); assert pg.input_value('#stake') == '30' and 'R$ 30,00 · 0,3u' in txt('#slipsum'), (pg.input_value('#stake'), txt('#slipsum'))
    pg.click('[data-act=mode][data-m=single]'); assert pg.locator('#slipsug').count() == 0, 'five singles are five bets, not a long shot'
    pg.click('[data-act=mode][data-m=multi]'); pg.click('#panel [data-act=unpick] >> nth=4'); assert pg.locator('#slipsug').count() == 0, 'four selections get no suggestion'
    pg.fill('#stake', '')
    while pg.evaluate('window.__OL.slip.sels.length'): pg.click('#panel [data-act=unpick] >> nth=0')            # the last one closes the slip
    pick('f1', 'ml:a'); pg.click('#slipbtn')
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
    # the arrows of the units field go half a unit up and down, to the next half
    pg.click('[data-act=ustep][data-d="1"]'); assert pg.input_value('#stakeu') == '1' and 'R$ 100,00 · 1u' in txt('#slipsum'), txt('#slipsum')
    pg.fill('#stakeu', '1,2'); pg.click('[data-act=ustep][data-d="1"]'); assert pg.input_value('#stakeu') == '1,5' and 'R$ 150,00 · 1,5u' in txt('#slipsum')
    pg.click('[data-act=ustep][data-d="-1"]'); pg.click('[data-act=ustep][data-d="-1"]'); assert pg.input_value('#stakeu') == '0,5'
    pg.click('[data-act=ustep][data-d="-1"]'); assert pg.input_value('#stakeu') == '' and 'Aposta mínima' in txt('[data-act=place]'), 'down from half a unit is nothing'
    pg.click('[data-act=ustep][data-d="1"]'); assert pg.input_value('#stakeu') == '0,5'
    assert pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') == 0; shot('s35-setinhas.png')
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
    assert pg.locator('#since').count() == 0, 'nothing has closed by itself yet'
    PHASE['n'] = 1; sync(); pg.click('.tabbar [data-tab=apostas]'); pg.wait_for_timeout(200); shot('s4-live.png')
    # with the first fight on, every selection says in words where it stands, and each multiple counts its own
    tags = [t.lower() for t in pg.locator('.leg .ls').all_inner_texts()]
    assert pg.locator('.leg').count() == len(tags) and set(tags) == {'ao vivo', 'não começou'} and pg.locator('.leg.s-live').count() == tags.count('ao vivo') > 0, tags
    m3 = pg.locator('.bet', has=pg.locator('.tally')).first
    assert m3.locator('.tally').inner_text() == '1 ao vivo · 2 não começaram' and [t.lower() for t in m3.locator('.ls').all_inner_texts()] == ['ao vivo', 'não começou', 'não começou'], m3.inner_text()
    # a fight in progress is not a lost bet: its colour is a blue, never the red of a loss
    rgb = lambda sel, prop='color': [int(v) for v in re.findall(r'\d+', pg.evaluate('([s, p]) => getComputedStyle(document.querySelector(s))[p]', [sel, prop]))[:3]]
    for sel in ('.ls.live', '.pill.live', '.leg .lv', '.tally .live'): assert rgb(sel)[2] > rgb(sel)[0] + 60, (sel, rgb(sel))
    assert rgb('.leg.s-live', 'borderLeftColor')[2] > rgb('.leg.s-live', 'borderLeftColor')[0] + 60, rgb('.leg.s-live', 'borderLeftColor')
    assert pg.locator('.bet:not(:has(.tally))').count() == pg.evaluate('window.__OL.S.bets.filter(b => b.status === "open" && b.legs.length === 1).length'), 'a single has nothing to count'
    assert pg.evaluate('[...document.querySelectorAll(".leg .t b .ou")].every(e => e.getBoundingClientRect().width < 30 && e.getBoundingClientRect().height < 30)'), 'the arrow of an over stays in front of its name'
    frozen = pg.locator('.hint.co', has_text='Cashout congelado').count(); still = pg.locator('[data-act=cash]').count()
    print('fase 1: cashout congelado em', frozen, 'apostas, disponível em', still)
    assert frozen == 7 and still == 6, (frozen, still)       # 7 bets touch the live fight; the other 6 are on fights still to start
    print('phase1 statuses', pg.evaluate('window.__OL.S.bets.map(b=>b.status)'), 'td', pg.evaluate('JSON.stringify(window.__OL.D.td)'))
    PHASE['n'] = 2; sync(); sync(); pg.wait_for_timeout(200)
    opened = pg.evaluate('window.__OL.S.bets.filter(b => b.status === "open").length')
    offers = pg.locator('[data-cash=market]').count(); frozen = pg.locator('.hint.co', has_text='Cashout congelado').count(); still = pg.locator('[data-act=cash]').count()
    print('fase 2:', opened, 'abertas | oferta de mercado', offers, '| congelado', frozen, '| disponível', still)
    assert (opened, offers, frozen, still) == (10, 2, 4, 6), (opened, offers, frozen, still)   # offers: the two parlays whose first fight has won; frozen: bets touching the live fight; still: offers plus bets entirely on the main event
    # what closed by itself since the person last looked is summed up on every tab, until it is acknowledged
    newly = lambda: pg.evaluate('(() => { const S = window.__OL.S, c = S.bets.filter(b => ["won", "lost", "void"].includes(b.status) && b.settledAt > S.seen); return [c.length, c.filter(b => b.from).length]; })()')
    said = lambda n: f'Desde a última vez: {n} ' + ('apostas fecharam' if n > 1 else 'aposta fechou')
    n2 = newly(); assert n2[0] >= 1 and said(n2[0]) in txt('#since') and 'Canal do Zé' not in txt('#since'), (n2, txt('#since'))
    sinceu = pg.evaluate('(() => { const S = window.__OL.S; return S.bets.filter(b => ["won", "lost", "void"].includes(b.status) && b.settledAt > S.seen).reduce((a, b) => a + (b.payout - b.stake) / b.unit, 0); })()')
    assert ' · ' in txt('#since b span') and abs(unum(txt('#since b span').split(' · ')[1]) - sinceu) < 0.006, (txt('#since b span'), sinceu)          # the result of what closed, in units too
    pg.click('.tabbar [data-tab=lutas]'); assert said(n2[0]) in txt('#since'); shot('s32-desde-a-ultima-vez.png'); pg.click('.tabbar [data-tab=apostas]')
    pg.click('[data-act=sinceok]'); assert pg.locator('#since').count() == 0 and newly() == [0, 0]
    pg.evaluate(f'window.__OL.S.bets.filter(b => b.status === "open" && b.id !== "{mid}").slice(0, 3).forEach(b => {{ b.from = "Canal do Zé"; }})')     # as if three of the open bets had been copied from a channel
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
    n3 = newly(); assert n3[0] >= 3 and n3[1] == 3 and said(n3[0]) in txt('#since') and 'Canal do Zé: 3, ' in txt('#since') and f'Minhas: {n3[0] - 3}, ' in txt('#since'), (n3, txt('#since'))
    # copies that came with no name are just the tipster's
    pg.evaluate('(() => { window.__named = window.__OL.S.bets.filter(b => b.from === "Canal do Zé"); window.__named.forEach(b => { b.__c = b.copied; delete b.from; b.copied = true; }); })()'); pg.click('.tabbar [data-tab=carteira]')
    assert 'Tipster: 3, ' in txt('#since') and 'sem nome' not in txt('#since'), txt('#since')
    pg.evaluate('window.__named.forEach(b => { b.from = "Canal do Zé"; if (b.__c) b.copied = true; else delete b.copied; delete b.__c; })')
    pg.click('.tabbar [data-tab=lutas]'); pg.click('[data-act=sinceview]')
    assert pg.locator('#since').count() == 0 and pg.evaluate('[window.__OL.ui.tab, window.__OL.ui.filter]') == ['apostas', 'done'], '"Ver" goes to what closed, and that counts as seen'
    assert pg.locator('#byorigin button').all_inner_texts() == ['Todas', 'Minhas', 'Tipster', 'Canal do Zé']
    pg.click('#byorigin button >> nth=1'); assert pg.locator('.bet').count() == 12 and pg.locator('.bet .owner.tipster').count() == 0 and pg.locator('.bet .owner.own').count() == 12
    pg.click('#byorigin button >> nth=2'); assert pg.locator('.bet').count() == 3 and pg.locator('.bet .owner.own').count() == 0; pg.click('#byorigin button >> nth=3'); assert pg.locator('.bet').count() == 3
    pg.click('#byorigin button >> nth=0'); assert pg.locator('.bet').count() == 15
    pg.click('[data-act=filter][data-f=done]'); shot('s5-done.png', True)
    # closed, every selection still says what became of it; the ones a bet did not need are told apart
    tags = [t.lower() for t in pg.locator('.leg .ls').all_inner_texts()]; outs = pg.evaluate('window.__OL.S.bets.filter(b => b.status !== "open").sort((a, b) => b.settledAt - a.settledAt).flatMap(b => b.legs.map(l => l.out || "unused"))')
    assert tags == [{'won': 'bateu', 'lost': 'perdeu', 'void': 'anulada', 'unused': 'não contou'}[o] for o in outs] and 'bateu' in tags and 'perdeu' in tags and 'não contou' in tags, (tags, outs)
    assert rgb('.ls.lost', 'backgroundColor')[0] > rgb('.ls.lost', 'backgroundColor')[2] + 60 and rgb('.pill.lost')[0] > rgb('.pill.lost')[2] + 60, 'and the red stays for what was lost'
    assert pg.locator('.leg.s-won .g').first.inner_text() == '✓' and pg.locator('.leg.s-lost .g').first.inner_text() == '✕' and pg.locator('.leg.s-unused').count() == tags.count('não contou')
    assert pg.evaluate('[...document.querySelectorAll(".leg .t b .ou")].every(e => e.getBoundingClientRect().width < 30 && e.getBoundingClientRect().height < 30)') and pg.locator('.leg .t b .ou').count() > 0, 'the arrow of an over stays in front of its name'
    # a closed bet says its result in units too, by the unit it was placed with, and nothing about a gain still to come
    resu = [unum(t) for t in pg.locator('.bet .un.res').all_inner_texts()]
    assert len(resu) == 15 and abs(sum(resu) - 6.1) < 0.08 and resu == [round(x * 100) / 100 for x in pg.evaluate('window.__OL.S.bets.filter(b => b.status !== "open").sort((a, b) => b.settledAt - a.settledAt).map(b => Math.round((b.payout - b.stake) / b.unit * 100) / 100)')], resu
    assert pg.locator('.bet .gain').count() == 0 and pg.locator('.tot').count() == 0
    pg.click('.tabbar [data-tab=carteira]'); pg.wait_for_timeout(200); shot('s6-carteira.png')
    units = pg.inner_text('#pnlu'); print('em unidades:', units)
    pg.locator('#chart svg').scroll_into_view_if_needed()                # the mouse can only hover what is on screen
    box = pg.locator('#chart svg').bounding_box(); pg.mouse.move(box['x'] + box['width'] * 0.5, box['y'] + box['height'] * 0.5)
    tipText = pg.inner_text('#tip'); assert 'aposta' in tipText and 'acumulado' in tipText, tipText        # hovering the chart explains the point
    pg.mouse.move(box['x'] + box['width'] * 0.5, box['y'] + box['height'] + 60); pg.wait_for_function('document.getElementById("tip").hidden')
    assert units.startswith('+6,1u'), units                   # R$ 609,59 of profit with every bet placed at a R$ 100,00 unit
    # the table by market says the result in units as well, and adds up to the whole; the events are in the statement, further up
    bym = [unum(t) for t in pg.locator('.tbl[data-by=mercado] .inu').all_inner_texts()]
    assert len(bym) == pg.locator('.tbl[data-by=mercado] tbody tr').count() > 2 and abs(sum(bym) - 6.1) < 0.05 and pg.locator('.tbl[data-by=evento]').count() == 0, bym
    # the statement in units is there whatever the period: the last 7, 15 and 30 days and everything, all the bets, the person's own and the tipster's
    srow = lambda tbl, k: [re.sub(r'\s*\n\s*', ' | ', td.inner_text().replace('\xa0', ' ').strip()) for td in pg.locator(f'#{tbl} tr[data-k="{k}"] td').all()]
    fmtu = lambda v: ('+' if v > 0.004 else '−' if v < -0.004 else '') + (f'{abs(round(v * 100) / 100):.2f}'.rstrip('0').rstrip('.')).replace('.', ',') + 'u'
    stj = pg.evaluate('(() => { const { Core, S } = window.__OL, st = Core.statement(S.bets.filter(b => b.status !== "open"), Date.now()); return st.spans.concat(st.events).map(r => [r.k, r.ahead].concat(["all", "mine", "tip"].map(x => [r[x].n, r[x].units, r[x].won, r[x].dec, r[x].roi, r[x].pnl]))); })()')
    side = lambda x: f'{fmtu(x[1])} | {x[2]}V {x[3] - x[2]}D | {spct(x[4])}'
    spct = lambda d: (lambda v: ('+' if v > 0 else '−' if v < 0 else '') + f'{abs(v):.1f}'.replace('.', ',') + '%')(round(d * 1000) / 10)
    assert [t.lower() for t in pg.locator('#stmtspans thead th').all_inner_texts()] == ['período', 'tudo', 'minhas', 'tipster'] and [tr.get_attribute('data-k') for tr in pg.locator('#stmtspans tbody tr').all()] == ['7d', '15d', '30d', 'all']
    for r, name in zip(stj[:4], ['7 dias', '15 dias', '30 dias', 'Geral']):
        assert r[1] == 'mine' and [r[2][0], r[3][0], r[4][0]] == [15, 12, 3] and srow('stmtspans', r[0]) == [f'{name} | 15 apostas | +R$ 609,59', side(r[2]), side(r[3]), side(r[4])], (r, srow('stmtspans', r[0]))          # every bet here closed today
    assert srow('stmtspans', 'all')[1].startswith('+6,1u | ') and abs(stj[3][3][1] + stj[3][4][1] - stj[3][2][1]) < 1e-3, 'the two sides add up to the whole'
    assert pg.locator('#stmtspans td.lead').count() == 4 and all('lead' in (pg.locator(f'#stmtspans tr[data-k="{k}"] td').nth(2).get_attribute('class') or '') for k in ('7d', '15d', '30d', 'all')) and pg.locator('#stmtspans td.lead .ldot').first.is_visible(), 'the dot marks who is ahead, the person here'
    assert pg.evaluate('(() => { const c = s => getComputedStyle(document.querySelector(s)).color; return c("#stmtspans td.pos b") !== c("#stmtspans td small"); })()') and 'ponto dourado' in txt('#stmthow') and 'Unidades de' not in txt('#stmthow')
    evk = stj[4][0]; assert len(stj) == 5 and pg.locator('#stmtevents tbody tr').count() == 1 and re.fullmatch(r'.+ \| \d\d/\d\d · 15 apostas \| \+R\$ 609,59', srow('stmtevents', evk)[0]) and srow('stmtevents', evk)[1:] == srow('stmtspans', 'all')[1:] and pg.locator('[data-act=stmtall]').count() == 0, srow('stmtevents', evk)
    assert pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') == 0; pg.locator('#stmt').scroll_into_view_if_needed(); shot('s46-extrato-em-unidades.png')
    assert pg.locator('#ifwin').count() == 0 and pg.locator('#iflose').count() == 0 and txt('#atrisk .un') == 'nenhuma aposta' and txt('#atrisk b') == 'R$ 0,00' and txt('#bankv') == txt('.hero .n'), 'nothing is open any more: the bankroll is the balance'
    # the figures can cover a period; every bet here closed today, on one event, so the numbers are the same in all three
    whole = txt('.pnl'); assert pg.locator('#periodev').count() == 0 and [cells(tr)[0].split(' | ')[0] for tr in pg.locator('#origins tbody tr').all()] == ['Minhas', 'Canal do Zé']
    # the person against the tipster: who is ahead by return on what was staked, said in words above the table
    bm = pg.evaluate('(() => { const { Core, S } = window.__OL, r = Core.benchmark(S.bets.filter(b => b.status !== "open")); return [r.ahead, r.mine.roi, r.tip.roi, r.mine.n, r.tip.n]; })()')
    spct = lambda d: (lambda v: ('+' if v > 0 else '−' if v < 0 else '') + f'{abs(v):.1f}'.replace('.', ',') + '%')(round(d * 1000) / 10)
    assert bm[0] == 'mine' and bm[3:] == [12, 3] and txt('#bench') == f'Você está na frente: retorno de {spct(bm[1])} nas suas apostas e de {spct(bm[2])} nas do tipster.' and 'own' in pg.get_attribute('#bench', 'class'), (bm, txt('#bench'))
    assert [cells(tr)[2] for tr in pg.locator('#origins tbody tr').all()] == [spct(bm[1]), spct(bm[2])], 'the same returns are in the table'
    # the two face to face, in units first: the record, the return and the money of each, and who is ahead
    duel = lambda cls: [t.replace('\xa0', ' ') for t in pg.locator(f'#duel > div.{cls}').inner_text().split('\n') if t.strip()]
    assert [d.lower() for d in duel('own')[:1]] == ['você na frente'] and duel('own')[1:] == [fmtu(stj[3][3][1]), f'{stj[3][3][2]}V {stj[3][3][3] - stj[3][3][2]}D · ROI {spct(bm[1])}', pg.locator('#origins tr.own td').nth(1).inner_text().split('\n')[0].replace('\xa0', ' ')], duel('own')
    assert duel('tipster')[0].lower() == 'tipster' and duel('tipster')[1] == fmtu(stj[3][4][1]) and 'lead' in pg.get_attribute('#duel > div.own', 'class') and 'lead' not in pg.get_attribute('#duel > div.tipster', 'class'), duel('tipster')
    assert pg.evaluate('(() => { const b = s => getComputedStyle(document.querySelector(s)).borderTopColor; return b("#duel > div.own") !== b("#duel > div.tipster"); })()') and all(e.is_visible() for e in pg.locator('#duel > div').all())
    pg.locator('#duel').scroll_into_view_if_needed(); shot('s47-voce-x-tipster.png')
    # with more than one tipster there is a line for all of them together, between the person's and each one's
    other = pg.evaluate('(() => { const b = window.__OL.S.bets.find(x => x.from === "Canal do Zé"); b.from = "Outro Canal"; return b.id; })()'); pg.click('.tabbar [data-tab=apostas]'); pg.click('.tabbar [data-tab=carteira]')
    names = [cells(tr)[0].split(' | ')[0] for tr in pg.locator('#origins tbody tr').all()]
    assert names[:2] == ['Minhas', 'Tipster · todos'] and sorted(names[2:]) == ['Canal do Zé', 'Outro Canal'] and cells(pg.locator('#origins tr.tipall'))[0].startswith('Tipster · todos | 3 apostas') and cells(pg.locator('#origins tr.tipall'))[2] == spct(bm[2]), names
    each = [unum(t) for t in pg.locator('#origins tr.tipster .inu').all_inner_texts()]; assert abs(sum(each) - unum(pg.locator('#origins tr.tipall .inu').inner_text())) < 0.011, each
    pg.evaluate(f'window.__OL.S.bets.find(b => b.id === "{other}").from = "Canal do Zé"'); pg.click('.tabbar [data-tab=apostas]'); pg.click('.tabbar [data-tab=carteira]'); assert pg.locator('#origins tr.tipall').count() == 0
    # each origin also has its result in units, every bet by the unit it was placed with: the two add up to the whole
    inu = [float(t.replace('u', '').replace('−', '-').replace('+', '').replace(',', '.')) for t in pg.locator('#origins .inu').all_inner_texts()]
    byjs = pg.evaluate('["", "Canal do Zé"].map(k => window.__OL.S.bets.filter(b => (b.from || "") === k).reduce((a, b) => a + (b.payout - b.stake) / b.unit, 0))')
    assert len(inu) == 2 and all(abs(a - b) < 0.006 for a, b in zip(inu, byjs)) and abs(sum(inu) - 6.1) < 0.02 and inu[1] != 0, (inu, byjs)
    assert [x.get_attribute('data-m') for x in pg.locator('#period button').all()] == ['all', '7d', '15d', '30d', 'event'] and len({round(x.bounding_box()['y']) for x in pg.locator('#period button').all()}) == 2, 'five periods, in two rows'
    for d in (7, 15):
        pg.click(f'[data-act=period][data-m="{d}d"]'); assert f'últimos {d} dias' in txt('#periodev') and txt('.pnl') == whole and pg.get_attribute(f'[data-act=period][data-m="{d}d"]', 'aria-pressed') == 'true'
    pg.click('[data-act=period][data-m="30d"]'); assert 'últimos 30 dias' in txt('#periodev') and txt('.pnl') == whole and pg.locator('#chart svg').count() == 1
    pg.click('[data-act=period][data-m=event]'); assert 'o evento da aposta que fechou por último' in txt('#periodev') and txt('.pnl') == whole, txt('#periodev')
    pg.click('[data-act=period][data-m=all]'); assert pg.locator('#periodev').count() == 0
    # the tipster's bets closed ten days ago: the week is the person's alone, the fortnight has both, and the period of the figures follows
    repaint = lambda: (pg.click('.tabbar [data-tab=apostas]'), pg.click('.tabbar [data-tab=carteira]'))
    pg.evaluate('(() => { const S = window.__OL.S; window.__was = S.bets.map(b => b.settledAt); S.bets.filter(b => b.from === "Canal do Zé").forEach(b => { b.settledAt = Date.now() - 10 * 864e5; }); })()'); repaint()
    wk, fn = srow('stmtspans', '7d'), srow('stmtspans', '15d')
    assert wk[0].startswith('7 dias | 12 apostas | ') and wk[3] == '—' and wk[1] == wk[2] == side(stj[3][3]) and pg.locator('#stmtspans tr[data-k="7d"] td.lead').count() == 0 and pg.locator('#stmtspans tr[data-k="7d"] td.none').count() == 1, wk
    assert fn[0].startswith('15 dias | 15 apostas | ') and fn[1:] == srow('stmtspans', 'all')[1:] == [side(stj[3][2]), side(stj[3][3]), side(stj[3][4])], fn
    pg.click('[data-act=period][data-m="7d"]'); assert txt('.pnl') != whole and txt('.pnl') == wk[0].split(' | ')[2] and 'Ainda não dá pra comparar: falta aposta encerrada de tipster' in txt('#bench') and 'nenhuma aposta encerrada' in pg.locator('#duel > div.tipster').inner_text() and pg.locator('#duel > div.lead').count() == 0, (txt('.pnl'), txt('#bench'))
    assert srow('stmtspans', '15d')[3] != '—', 'the statement does not follow the period of the figures'
    pg.click('[data-act=period][data-m="15d"]'); assert txt('.pnl') == whole and pg.locator('#duel > div.own.lead').count() == 1; pg.click('[data-act=period][data-m=all]')
    pg.evaluate('window.__OL.S.bets.forEach((b, i) => { b.settledAt = window.__was[i]; })')
    # bets placed before bets kept their unit are in the record and in the money; the statement says how many the units are of, and a side with none shows no units
    pg.evaluate('(() => { const t = window.__OL.S.bets.filter(x => x.from === "Canal do Zé"); window.__unit = t.map(b => [b.id, b.unit]); t.forEach(b => { delete b.unit; }); })()'); repaint()
    nou = srow('stmtspans', 'all')
    assert 'Unidades de 12 de 15 apostas' in txt('#stmthow') and nou[0] == 'Geral | 15 apostas | +R$ 609,59' and nou[3] == '— | ' + side(stj[3][4]).split(' | ', 1)[1] and nou[1].split(' | ')[0] == nou[2].split(' | ')[0] == fmtu(stj[3][3][1]) and nou[1].split(' | ')[1:] == side(stj[3][2]).split(' | ')[1:], (txt('#stmthow'), nou)
    assert duel('tipster')[1] == duel('tipster')[3] == pg.locator('#origins tr.tipster td').nth(1).inner_text().split('\n')[0].replace('\xa0', ' ') and duel('own')[1] == fmtu(stj[3][3][1]), duel('tipster')          # with no units to show, the money comes first
    pg.evaluate('window.__unit.forEach(([id, u]) => { window.__OL.S.bets.find(x => x.id === id).unit = u; })')
    # each event has its row, the latest first, and a multiple across events a row of its own; past the first five the rest waits for a touch
    pg.evaluate('''(() => { const S = window.__OL.S; window.__legs = JSON.stringify(S.bets.map(b => b.legs));
        S.bets.filter(b => b.legs.length === 1).slice(0, 5).forEach((b, i) => { const l = b.legs[0]; l.eid = "old" + i; l.event = "UFC " + (300 + i) + ": Antigo vs. Outro " + i; l.date -= (i + 1) * 7 * 864e5; });
        const m = S.bets.find(b => b.legs.length > 1 && b.legs.every(l => l.eid === b.legs[0].eid)).legs[0]; m.eid = "old0"; m.event = "UFC 300: Antigo vs. Outro 0"; m.date -= 7 * 864e5; })()'''); repaint()
    evrows = [tr.get_attribute('data-k') for tr in pg.locator('#stmtevents tbody tr').all()]
    assert sorted(evrows[:2]) == sorted([evk, '*']) and evrows[2:] == ['old0', 'old1', 'old2'] and txt('[data-act=stmtall]') == 'Ver os 7 eventos', evrows
    assert srow('stmtevents', 'old0')[0].startswith('Antigo vs. Outro 0 | ') and ' · 1 aposta | ' in srow('stmtevents', 'old0')[0] and re.match(r'Vários eventos \| \d\d/\d\d · 1 aposta \| ', srow('stmtevents', '*')[0]) and srow('stmtevents', evk)[0].split(' | ')[1].endswith('· 9 apostas'), (srow('stmtevents', 'old0'), srow('stmtevents', '*'), srow('stmtevents', evk))
    pg.click('[data-act=stmtall]'); assert [tr.get_attribute('data-k') for tr in pg.locator('#stmtevents tbody tr').all()] == evrows + ['old3', 'old4'] and txt('[data-act=stmtall]') == 'Mostrar só os 5 últimos'
    assert pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') == 0; pg.click('[data-act=stmtall]'); assert pg.locator('#stmtevents tbody tr').count() == 5
    pg.evaluate('(() => { const L = JSON.parse(window.__legs); window.__OL.S.bets.forEach((b, i) => { b.legs = L[i]; }); })()'); repaint(); assert pg.locator('#stmtevents tbody tr').count() == 1 and srow('stmtspans', 'all')[1] == side(stj[3][2])
    pg.click('.tabbar [data-tab=apostas]'); assert pg.locator('[data-act=again]').count() == 0, 'nothing can be repeated once every fight is over'
    # a card the source marks as over leaves the fights screen at once: with no other event on the board, there is none to show
    pg.click('.tabbar [data-tab=lutas]')
    assert pg.locator('.events .ev').count() == 0 and pg.locator('.fight').count() == 0 and 'Nenhum evento do UFC nos próximos dias.' in txt('#view'), ('the card that is over is not on screen any more', txt('#view')[:300])
    # between the last fight and the source marking the event as over, the card is still there, with the result of every fight
    ESPN['notover'] = True; sync(); pg.wait_for_selector('.fight'); shot('s7-final.png', True)
    # the fight that ended in a submission says which one, on the card and on the bets that rode on it
    assert 'Almeida venceu por Submission (Rear Naked Choke) · R4 2:00' in txt('#list') and 'Teles venceu por KO/TKO · R2 3:12' in txt('#list') and pg.evaluate('window.__OL.S.bets.flatMap(b => b.legs).filter(l => l.fid === "f3" && l.res).every(l => l.res.includes("venceu por Submission (Rear Naked Choke) · R4 2:00"))'), txt('#list')[:900]
    pg.click('[data-act=event]'); pg.wait_for_selector('.fight')                                       # picking the event again keeps the card on screen
    ESPN['notover'] = False; sync(); assert pg.locator('.fight').count() == 0, 'and it leaves when the source marks it as over'
    ow = pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
    # the person's data: backup, restore and reset
    pg.click('.tabbar [data-tab=carteira]'); pg.click('[data-act=corners][data-g=women][data-m=green-pink]'); pg.click('[data-act=copydrop][data-m="3"]')
    final = bal(); saved = pg.evaluate('JSON.stringify(window.__OL.S)')
    settings = lambda: pg.evaluate('(() => { const S = window.__OL.S; return [S.unitPct, S.stakeIn || "money", S.theme || "auto", S.corners, S.cur, S.copyDrop || 0]; })()')
    kept = settings(); assert kept[3] == {'women': 'green-pink'} and kept[5] == 3, kept
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
    # the backup as a file: where a page cannot hand a file to the share sheet it is downloaded, with the day and the hour in its name
    import tempfile
    tmp = pathlib.Path(tempfile.mkdtemp())
    with pg.expect_download() as dl: pg.click('[data-act=bksave]')
    assert re.fullmatch(r'oito-lados-backup-\d{4}-\d\d-\d\d-\d{4}\.json', dl.value.suggested_filename), dl.value.suggested_filename
    bkfile = tmp / dl.value.suggested_filename; dl.value.save_as(str(bkfile)); held = json.loads(bkfile.read_text())
    assert held['app'] == 'oito-lados' and held['savedAt'] > 0 and len(held['bets']) == 15 and held['deposits'] == pg.evaluate('window.__OL.S.deposits') and 'Backup baixado' in pg.inner_text('#toast'), sorted(held)
    # on a phone the file goes to the share sheet (a chat, the files of the device); giving up there does nothing, and a share that fails falls back to the download
    pg.evaluate('''() => { window.__shared = []; window.__share = 'ok'; navigator.canShare = d => !!(d && d.files && d.files.length);
        navigator.share = async d => { if (window.__share === 'abort') { const e = new Error('closed'); e.name = 'AbortError'; throw e; } if (window.__share === 'fail') throw new Error('no'); window.__shared.push([d.files[0].name, d.files[0].type, await d.files[0].text()]); }; }''')
    pg.click('[data-act=bksave]'); pg.wait_for_function('window.__shared.length === 1')
    sent = pg.evaluate('window.__shared[0]'); assert sent[0].endswith('.json') and sent[1] == 'application/json' and len(json.loads(sent[2])['bets']) == 15 and 'Backup salvo em arquivo' in pg.inner_text('#toast'), sent[:2]
    pg.evaluate('window.__share = "abort"; document.getElementById("toast").textContent = ""'); pg.click('[data-act=bksave]'); pg.wait_for_timeout(300); assert pg.inner_text('#toast') == '' and pg.evaluate('window.__shared.length') == 1, 'closing the share sheet is not an error and downloads nothing'
    pg.evaluate('window.__share = "fail"')
    with pg.expect_download() as dl2: pg.click('[data-act=bksave]')
    assert dl2.value.suggested_filename.endswith('.json'); pg.evaluate('delete navigator.canShare; delete navigator.share')
    # restoring from a file: what the file holds is shown first, and nothing is replaced before the person says so
    pg.click('[data-act=reset]'); pg.click('[data-act=doreset]'); assert bal().replace('\xa0', ' ') == 'R$ 0,00'
    bad = tmp / 'outra-coisa.json'; bad.write_text('{"deposits": "nada"}'); pg.set_input_files('#bkfile', str(bad)); pg.wait_for_function('document.getElementById("toast").textContent.includes("não é um backup")')
    assert pg.locator('#bkpeek').count() == 0 and bal().replace('\xa0', ' ') == 'R$ 0,00', 'a file that is not a backup changes nothing'
    pg.set_input_files('#bkfile', str(bkfile)); pg.wait_for_selector('#bkpeek')
    peek = txt('#bkpeek'); assert bkfile.name in peek and 'Salvo em' in peek and '15 apostas e R$ 1.000,00 depositados' in peek and bal().replace('\xa0', ' ') == 'R$ 0,00', peek
    assert pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') == 0; pg.locator('#bkpeek').scroll_into_view_if_needed(); shot('s45-backup-arquivo.png')
    pg.click('[data-act=bkcancel]'); assert pg.locator('#bkpeek').count() == 0 and bal().replace('\xa0', ' ') == 'R$ 0,00', 'backing out keeps what is on the device'
    pg.set_input_files('#bkfile', str(bkfile)); pg.wait_for_selector('#bkpeek'); pg.click('[data-act=bkapply]'); pg.wait_for_timeout(400)
    assert bal() == final and pg.evaluate('window.__OL.S.bets.length') == 15 and settings() == kept and pg.locator('#bkpeek').count() == 0 and 'app' not in pg.evaluate('Object.keys(window.__OL.S)'), (bal(), final)
    # the text is still there for who wants it, and reads a backup taken either way
    pg.click('[data-act=reset]'); pg.click('[data-act=doreset]'); pg.click('[data-act=restore]'); pg.fill('#rs', bkfile.read_text()); pg.click('[data-act=dorestore]'); pg.wait_for_timeout(400); assert bal() == final
    # converting a bankroll with a whole history: every amount follows, and the result in units stays the same
    assert len(pg.evaluate('window.__OL.S.conv')) == 3, 'the conversion log comes back with the backup'
    pg.click('[data-act=depcur][data-c=USD]'); pg.wait_for_selector('#fxinfo b'); pg.fill('#dep', '100'); pg.click('[data-act=deposit]'); pg.wait_for_function('window.__OL.S.cur === "USD"')
    usd = pg.evaluate('(() => { const S = window.__OL.S; return [S.bets.length, S.bets[0].stake, S.bets[0].payout, S.bets[0].unit, S.conv.length]; })()')
    print('banca convertida para dólar: saldo', bal(), '|', pg.inner_text('#pnlu'))
    assert bal().replace('\xa0', ' ') == 'US$ 421,92' and usd == [15, 20, 33.4, 20, 4] and pg.inner_text('#pnlu').startswith('+6,1u'), (bal(), usd)   # 1.609,59 x 0,20 = 321,92, plus the 100 deposited
    # the calls to ESPN are counted on the device: the card on the wallet screen, starting the count over, and handing the counts over
    from collections import Counter
    def kind_of(u):          # what a call is for, told from its address alone, without asking the app
        if 'espn.com' not in u: return None
        if '/scoreboard' in u: return 'board'
        if '/eventlog' in u or re.search(r'/competitions/p\w+', u): return 'form'
        if re.search(r'/competitions/\w+/odds', u): return 'odds'
        if '/competitors/' in u: return 'td'
        if re.search(r'/competitions/\w+/status', u): return 'result'
        return 'astats' if re.search(r'/athletes/\w+/statistics', u) else 'other'
    asked = lambda since: dict(Counter(k for k in map(kind_of, calls[since:]) if k))
    def usage_rows(page):
        rows = {tr.get_attribute('data-k'): tr.locator('td').all_inner_texts() for tr in page.locator('#usagetbl tbody tr').all()}
        return {k: [c.split('\n')[0].replace('.', '') for c in v] for k, v in rows.items()}, {k: ' | '.join(v) for k, v in rows.items()}
    counted = lambda page, col=1: {k: int(v[col]) for k, v in usage_rows(page)[0].items() if k != 'all' and v[col] != '—'}
    KINDS = ['board', 'odds', 'result', 'td', 'astats', 'form']
    pg.click('.tabbar [data-tab=carteira]'); pg.locator('#usage').scroll_into_view_if_needed(); shot('s53-uso-da-espn.png')
    rows, full = usage_rows(pg)
    assert list(rows) == KINDS + ['all'] and [r[0] for r in rows.values()] == ['Placar', 'Odds', 'Resultado', 'Quedas da luta', 'Média de quedas', 'Últimas lutas', 'Tudo'], rows
    seen = counted(pg); assert sorted(seen) == sorted(KINDS) and all(n > 0 for n in seen.values()) and int(rows['all'][1]) == sum(seen.values()) == int(rows['all'][2]), ('over this walk-through every kind of call was made and counted, and the total is their sum', seen, rows['all'])
    assert 'falh' in full['board'] and ' cada' in full['board'] and 'máx. ' in full['board'] and re.search(r'Hoje: \d[\d.]* chamadas · [\d.,]+ (kB|MB) · \d+ falh\w+ · no máximo \d+ num minuto\. Desde que o app abriu \(\d+ min\): \d[\d.]* chamadas\.', txt('#usagenow')), (full['board'], txt('#usagenow'))
    assert pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') == 0, 'the card fits the width of a phone'
    pg.click('[data-act=usagereset]'); rows, full = usage_rows(pg)
    assert 'Contagem zerada' in pg.inner_text('#toast') and all(r[1:] == ['—', '—', '—'] for r in rows.values()) and 'nenhuma chamada contada ainda' in txt('#usagenow') and pg.evaluate('JSON.parse(localStorage.getItem("oitolados.usage.v1")).days') == {}, ('starting over leaves nothing counted, on screen or saved', rows)
    since = len(calls); sync(); pg.wait_for_timeout(500)
    assert counted(pg) == asked(since) and asked(since).get('board') == 1, ('what is counted from then on is what was asked of the source, kind by kind', counted(pg), asked(since))
    ESPN['down'] = True; sync(); ESPN['down'] = False; pg.wait_for_timeout(300); rows, full = usage_rows(pg)
    assert counted(pg) == asked(since) and counted(pg)['board'] == 2 and '1 falhou' in full['board'] and '1 falhou' in full['all'] and '· 1 falhou ·' in txt('#usagenow'), ('a call that fails is counted, and counted as failed', full['board'], txt('#usagenow'))
    # hour by hour, behind a button: the last 24 hours that have calls, with the kinds of each
    assert pg.locator('#usagehours').count() == 0; pg.click('[data-act=usagehours]')
    hrs = [[c.split('\n') for c in tr.locator('td').all_inner_texts()] for tr in pg.locator('#usagehours tbody tr').all()]
    assert 1 <= len(hrs) <= 2 and sum(int(h[1][0]) for h in hrs) == sum(asked(since).values()) and re.fullmatch(r'(ontem )?\d{1,2}h', hrs[0][0][0]) and any('placar ' in h[0][1] for h in hrs) and sum(int(n) for h in hrs for n in re.findall(r'placar (\d+)', h[0][1])) == 2 and any('1 falhou' in h[1] for h in hrs) and re.fullmatch(r'\d+/min', hrs[0][2][0]) and re.fullmatch(r'[\d.,]+ (B|kB|MB)', hrs[0][3][0]), ('the hours with calls, the latest first: how many, of what, how many failed, the peak and the size', hrs)
    assert pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') == 0; pg.locator('#usagehours').scroll_into_view_if_needed(); shot('s54-uso-hora-a-hora.png')
    pg.click('[data-act=usagehours]'); assert pg.locator('#usagehours').count() == 0 and txt('[data-act=usagehours]') == 'Ver hora a hora'
    with pg.expect_download() as du: pg.click('[data-act=usagesave]')
    assert re.fullmatch(r'oito-lados-uso-espn-\d{4}-\d\d-\d\d-\d{4}\.json', du.value.suggested_filename), du.value.suggested_filename
    ufile = tmp / du.value.suggested_filename; du.value.save_as(str(ufile)); took = json.loads(ufile.read_text()); day = took['days'][took['today']]
    assert took['app'] == 'oito-lados' and took['what'] == 'espn-usage' and took['savedAt'] > 0 and {k: c['n'] for k, c in day['k'].items()} == asked(since) and day['k']['board']['err'] == 1 and day['peak'] >= 1 and took['session']['total']['n'] == sum(asked(since).values()) and 'Uso da ESPN baixado' in pg.inner_text('#toast'), took
    assert dict(sum((Counter(h['k']) for h in day['h'].values()), Counter())) == asked(since) and sum(h['n'] for h in day['h'].values()) == sum(asked(since).values()) and sum(h['err'] for h in day['h'].values()) == 1, ('the file has the same hours, kind by kind', day['h'], asked(since))
    assert sorted(took) == ['app', 'days', 'fields', 'savedAt', 'session', 'today', 'version', 'what'] and 'stake' not in ufile.read_text() and 'deposits' not in ufile.read_text(), ('the file holds counts of calls and nothing about the bets', sorted(took))
    # on a phone the counts go to the share sheet, like the backup
    pg.evaluate("() => { window.__shared = []; navigator.canShare = d => !!(d && d.files && d.files.length); navigator.share = async d => { window.__shared.push([d.files[0].name, await d.files[0].text()]); }; }")
    pg.click('[data-act=usagesave]'); pg.wait_for_function('window.__shared.length === 1')
    sent = pg.evaluate('window.__shared[0]'); assert sent[0].startswith('oito-lados-uso-espn-') and json.loads(sent[1])['what'] == 'espn-usage' and 'Uso da ESPN salvo em arquivo' in pg.inner_text('#toast'), sent[0]
    pg.evaluate('delete navigator.canShare; delete navigator.share')
    # as a text too: copied where the page can copy, shown to be copied by hand where it cannot
    pg.evaluate("() => { window.__clip = 'fail'; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => window.__clip === 'fail' ? Promise.reject(new Error('no')) : (window.__copied = t, Promise.resolve()) } }); }")
    pg.click('[data-act=usagecopy]'); pg.wait_for_selector('#usagetext'); assert json.loads(pg.input_value('#usagetext'))['what'] == 'espn-usage'
    pg.evaluate("window.__clip = 'ok'"); pg.click('[data-act=usagecopy]'); pg.wait_for_function('document.getElementById("toast").textContent.includes("Uso da ESPN copiado")')
    assert pg.locator('#usagetext').count() == 0 and json.loads(pg.evaluate('window.__copied'))['days'][took['today']]['k']['board']['n'] == 2
    # the counts are written down a moment after the last call, and are not part of the backup
    pg.wait_for_timeout(2300); assert pg.evaluate('JSON.parse(localStorage.getItem("oitolados.usage.v1")).days')[took['today']]['k']['board'] == day['k']['board'] and 'usage' not in held and 'days' not in held
    print('h-overflow px', ow, '| requests', len(calls), '| errors', errs)
    cov.stop(pg, 'e2e-' + (sys.argv[1] if len(sys.argv) > 1 else 'dark'))
    # the cards on screen: the next three that are not over. A card the source marks as over leaves, and the three after it are what
    # is there; the board is read a month ahead, so that the third one is. Five cards and a Contender Series night are on the board
    import datetime
    was_phase = PHASE['n']; ESPN['next'] = True; ESPN['later'] = True
    def cards_on(phase, state=None, notover=False):
        PHASE['n'] = phase; ESPN['notover'] = notover; first = len(calls)
        c4 = b.new_context(viewport=dict(width=393, height=852), device_scale_factor=2, color_scheme='dark', locale='pt-BR', timezone_id='America/Sao_Paulo', has_touch=True, is_mobile=True)
        c4.route('**/*', lambda r: handle(r) if r.request.url.startswith('http') else r.continue_()); c4.route('https://cdn.jsdelivr.net/**', local_cdn)
        p4 = c4.new_page()
        if state: p4.add_init_script('localStorage.setItem("oitolados.v1", %s)' % json.dumps(json.dumps(state)))
        p4.goto((ROOT / 'dist' / 'index.html').as_uri()); p4.wait_for_selector('.events .ev'); p4.wait_for_timeout(700)
        names = [t.upper() for t in p4.locator('.events .ev b').all_inner_texts()]
        on = p4.locator('.events .ev.on b').inner_text().upper(); row = p4.locator('.events').inner_text().upper()
        if state is None and phase == 3 and not notover: p4.screenshot(path=str(SHOTS / 's52-tres-proximos-cards.png'))
        asked = re.search(r'dates=\d{8}-(\d{8})', [u for u in calls[first:] if '/scoreboard' in u][0]).group(1)
        ahead = (datetime.datetime.strptime(asked, '%Y%m%d').date() - datetime.datetime.now(datetime.timezone.utc).date()).days
        c4.close(); ESPN['notover'] = False; return names, on, row, ahead
    CARD, NEXT3 = 'ALMEIDA VS. DUNNE <B>X</B>', ['TELES VS. FARIAS', 'LOBO VS. ARANTES', 'FURTADO VS. MAIA']
    names, on, row, ahead = cards_on(0)
    assert names == [CARD] + NEXT3[:2] and on == CARD and ahead in (30, 31), ('before it ends, the card of the week is one of the three to come', names, on, ahead)
    names, on, row, ahead = cards_on(3, notover=True)
    assert names == [CARD] + NEXT3[:2] and on == CARD, ('with every fight over and the event not yet marked as over, it is still one of the three', names, on)
    names, on, row, ahead = cards_on(3)
    assert names == NEXT3 and on == NEXT3[0] and 'ENCERRADO' not in row and 'ALMEIDA' not in row, ('marked as over, the card is gone and the next three are what is there, the first of them on screen', names, on, row)
    assert not any('CONTENDER' in n or 'NOGUEIRA' in n for n in names), 'a Contender Series night is never offered, nor a fourth card to come'
    now_ms = int(datetime.datetime.now().timestamp() * 1000)
    far = dict(v=1, cur='BRL', deposits=[dict(t=now_ms, v=100)], seen=now_ms, bets=[dict(id='far1', t=now_ms, type='single', stake=10, unit=10, odd=2, sgp={}, status='open', payout=0,
        legs=[dict(fid='j1', eid='600000005', key='ml:a', market='Vencedor', sel='Nogueira vence', cat='Vencedor', weight='Lightweight', fight='Nogueira x Pires', event='UFC Fight Night: Nogueira vs. Pires', date=now_ms + 28 * 86400000, odd=2, src='real')])])
    names, on, row, ahead = cards_on(3, far)
    assert names == NEXT3 + ['NOGUEIRA VS. PIRES'], ('a card further ahead with a bet still open on it is shown too', names)
    ESPN['next'] = False; ESPN['later'] = False; PHASE['n'] = was_phase
    # Pages that are reloaded, or closed and opened again, are served over http from here on. Opened from the disk, the
    # browser of the tests sometimes hands the reloaded page an empty localStorage: in 20 tries of the same steps, 2 to 8
    # lost what was stored depending on the timing, and 0 of 20 over http. The service worker is kept out (tests/pwa.py covers it).
    import http.server, threading, functools
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    site = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT / 'dist')))
    threading.Thread(target=site.serve_forever, daemon=True).start()
    SITE = f'http://127.0.0.1:{site.server_address[1]}/index.html'
    # The page served here can have the project of src/core/cloud.ts swapped for the simulated server (cloud=True), or
    # for nothing, as before a project existed (cloud='none'); those two constants are the only change made to it.
    # The build writes them into the Core object (`CLOUD_URL: "..."`) or keeps them as `var CLOUD_URL = "..."`.
    PAGE = (ROOT / 'dist' / 'index.html').read_text()
    def swap(url, key):
        out = PAGE
        for name, to in (('CLOUD_URL', url), ('CLOUD_KEY', key)):
            assert len(re.findall(name + r'(?:: | = )"[^"]*"', PAGE)) == 1, ('the page has the constant once', name)
            out = re.sub(name + r'(: | = )"[^"]*"', lambda m: f'{name}{m.group(1)}"{to}"', out)
        return out
    PAGES = {True: swap('https://testetestetest.supabase.co', 'sb_publishable_teste_teste_teste'), 'none': swap('', '')}
    def served(cloud=False, **kw):
        c = b.new_context(viewport=dict(width=393, height=852), locale='pt-BR', timezone_id='America/Sao_Paulo', service_workers='block', **kw)
        def own(r):
            if cloud and r.request.url.split('?')[0] == SITE: r.fulfill(status=200, content_type='text/html; charset=utf-8', body=PAGES[cloud])
            else: r.continue_()
        c.route('**/*', lambda r: own(r) if r.request.url.startswith(SITE.rsplit('/', 1)[0]) or not r.request.url.startswith('http') else handle(r)); c.route('https://cdn.jsdelivr.net/**', local_cdn)
        return c
    # the count against the source, call by call, on a page of its own: a fight over, one under way with a bet on its takedowns, one
    # to come, and a second event. What the app says it asked for is what the source saw being asked, kind by kind; a page loaded again
    # keeps what was counted before, and starts the count of the session over
    was_phase = PHASE['n']; PHASE['n'] = 2; ESPN['next'] = True
    now_ms = int(datetime.datetime.now().timestamp() * 1000)
    tdbet = dict(v=1, cur='BRL', deposits=[dict(t=now_ms, v=100)], seen=now_ms, bets=[dict(id='td1', t=now_ms, type='single', stake=10, unit=10, odd=2, sgp={}, status='open', payout=0,
        legs=[dict(fid='f2', eid='600000001', key='td:o:2.5', market='Total de quedas', sel='+2.5 quedas', cat='Quedas', weight='Lightweight', fight='Brandt x Kessler', event='UFC Fight Night: Almeida vs. Dunne', date=now_ms - 7 * 3600000, odd=2, src='est')])])
    c5 = served(device_scale_factor=2, color_scheme='dark', has_touch=True, is_mobile=True)
    p5 = c5.new_page(); p5.add_init_script('if (!localStorage.getItem("oitolados.v1")) localStorage.setItem("oitolados.v1", %s)' % json.dumps(json.dumps(tdbet)))
    since = len(calls); p5.goto(SITE); p5.wait_for_selector('.fight'); p5.wait_for_timeout(2500)
    p5.click('.tabbar [data-tab=carteira]'); first = counted(p5)
    assert first == asked(since) and sorted(first) == sorted(KINDS), ('every kind of call is counted under its own name, as many times as the source was asked', first, asked(since))
    said = re.search(r'Hoje: ([\d.]+) chamadas .* Desde que o app abriu \(\d+ min\): ([\d.]+) chamadas', p5.locator('#usagenow').inner_text()); assert said and said.group(1) == said.group(2) == str(sum(first.values())), p5.locator('#usagenow').inner_text()
    p5.evaluate('window.__OL.sync(true)'); p5.wait_for_timeout(500)          # calls made a moment before leaving: only leaving the page writes them down
    mid = len(calls); p5.reload(); p5.wait_for_selector('.fight'); p5.wait_for_timeout(2500); p5.click('.tabbar [data-tab=carteira]'); again = counted(p5)
    said = re.search(r'Hoje: ([\d.]+) chamadas .* Desde que o app abriu \(\d+ min\): ([\d.]+) chamadas', p5.locator('#usagenow').inner_text())
    assert again == asked(since) and sum(again.values()) > sum(first.values()) and int(said.group(1)) == sum(again.values()) and int(said.group(2)) == sum(asked(mid).values()) < sum(again.values()), ('loaded again, the page keeps what was counted, the calls made just before leaving too, and counts the session from nothing', first, again, asked(mid), said.groups())
    c5.close(); ESPN['next'] = False; PHASE['n'] = was_phase
    # a result is asked for only where it is used. A card that is over is not on screen, so the result of its fights is asked for only
    # to close a bet; while the card is on screen, every fight that is over has its result asked for
    was_phase = PHASE['n']; PHASE['n'] = 3; ESPN['next'] = True
    def results_on(state=None, notover=False):
        ESPN['notover'] = notover; since = len(calls)
        c6 = b.new_context(viewport=dict(width=393, height=852), locale='pt-BR', timezone_id='America/Sao_Paulo')
        c6.route('**/*', lambda r: handle(r) if r.request.url.startswith('http') else r.continue_()); c6.route('https://cdn.jsdelivr.net/**', local_cdn)
        p6 = c6.new_page()
        if state: p6.add_init_script('if (!localStorage.getItem("oitolados.v1")) localStorage.setItem("oitolados.v1", %s)' % json.dumps(json.dumps(state)))
        p6.goto((ROOT / 'dist' / 'index.html').as_uri()); p6.wait_for_selector('.fight'); p6.wait_for_timeout(1500); p6.evaluate('window.__OL.sync(true)'); p6.wait_for_timeout(600)
        got = sorted(re.search(r'/competitions/(\w+)/status', u).group(1) for u in calls[since:] if kind_of(u) == 'result'); open_left = p6.evaluate('window.__OL.S.bets.filter(b => b.status === "open").length')
        c6.close(); ESPN['notover'] = False; return got, open_left
    got, _ = results_on()
    assert got == [], ('with the card over and no bet on it, no result is asked for', got)
    onf3 = dict(v=1, cur='BRL', deposits=[dict(t=now_ms, v=100)], seen=now_ms, bets=[dict(id='r1', t=now_ms, type='single', stake=10, unit=10, odd=2, sgp={}, status='open', payout=0,
        legs=[dict(fid='f3', eid='600000001', key='fm:sub', market='Como a luta termina', sel='Luta termina por Submission', cat='Método', weight='Featherweight', fight='Almeida x Dunne', event='UFC Fight Night: Almeida vs. Dunne', date=now_ms - 4 * 3600000, odd=2, src='real')])])
    got, open_left = results_on(onf3)
    assert got == ['f3'] and open_left == 0, ('with a bet on one fight of that card, the result of that fight alone is asked for, once, and the bet closes', got, open_left)
    got, _ = results_on(notover=True)
    assert got == ['f1', 'f2', 'f3'], ('while the card is still on screen, the result of every fight that is over is asked for, once each', got)
    # when the source cannot be reached the app asks less often: the wait doubles with each round that fails, up to five minutes, the
    # screen says when the next try is, and the pace is the usual one again as soon as a round goes through
    PHASE['n'] = 0; ESPN['next'] = False
    c7 = b.new_context(viewport=dict(width=393, height=852), locale='pt-BR', timezone_id='America/Sao_Paulo')
    c7.route('**/*', lambda r: handle(r) if r.request.url.startswith('http') else r.continue_()); c7.route('https://cdn.jsdelivr.net/**', local_cdn)
    p7 = c7.new_page(); p7.add_init_script('window.__waits = []; const st = window.setTimeout; window.setTimeout = (f, ms, ...a) => { if (ms >= 8000) window.__waits.push(ms); return st(f, ms, ...a); };')
    p7.goto((ROOT / 'dist' / 'index.html').as_uri()); p7.wait_for_selector('.fight'); p7.wait_for_timeout(1500)
    def round_(down):
        ESPN['down'] = down; p7.evaluate('window.__OL.sync(true)'); p7.wait_for_timeout(500); ESPN['down'] = False
        return p7.evaluate('window.__waits[window.__waits.length - 1]'), p7.locator('.sync span').inner_text()
    usual, said = round_(False); assert usual == 30000 and 'nova tentativa' not in said, ('on the night of a card the board is asked for every 30 s', usual, said)
    waits = [round_(True) for _ in range(5)]
    assert [w for w, _ in waits] == [60000, 120000, 240000, 300000, 300000], ('each round that fails doubles the wait, up to five minutes', [w for w, _ in waits])
    assert all('Sem conexão com a ESPN' in t for _, t in waits) and [re.search(r'nova tentativa em (\d+ \w+)', t).group(1) for _, t in waits] == ['1 min', '2 min', '4 min', '5 min', '5 min'], ('and the screen says when the next try is', [t for _, t in waits])
    back, said = round_(False); assert back == 30000 and 'Sem conexão' not in said and 'nova tentativa' not in said, ('one round that goes through and the pace is the usual one again', back, said)
    c7.close(); PHASE['n'] = was_phase
    # the same bankroll on two devices, through a simulated server: login with e-mail and password, the first meeting of two
    # histories, changes going both ways, the server out of reach, a reset that does not come back, a token renewed, leaving
    was_phase = PHASE['n']; PHASE['n'] = 0
    now_ms = int(datetime.datetime.now().timestamp() * 1000)
    # with no project set: no card and no call
    CLOUD.update(log=[]); c0 = served('none'); p0 = c0.new_page(); p0.goto(SITE); p0.wait_for_function('window.__OL && window.__OL.S'); p0.click('.tabbar [data-tab=carteira]'); p0.wait_for_timeout(800)
    assert p0.locator('#cloud').count() == 0 and 'só neste aparelho' in p0.inner_text('#view') and CLOUD['log'] == [], ('no server set: the card does not show and nothing is called', CLOUD['log'])
    c0.close()
    def device(state):
        c = served(cloud=True)
        pg_ = c.new_page(); errs_ = []; pg_.on('pageerror', lambda e: errs_.append(str(e)))
        if state is not None: pg_.add_init_script('if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("oitolados.v1", %s); }' % json.dumps(json.dumps(state)))
        pg_.goto(SITE); pg_.wait_for_function('window.__OL && window.__OL.S'); pg_.click('.tabbar [data-tab=carteira]'); pg_.wait_for_selector('#cloud')
        return c, pg_, errs_
    S_ = lambda pg_: pg_.evaluate('window.__OL.S')
    money = lambda pg_: pg_.inner_text('#bal').replace('\xa0', ' ')
    # "#cloudstatus" shows up while the sync is still running ("Sincronizando…"): what was joined is only there once it says when
    def synced(pg_):
        pg_.wait_for_function('() => { const e = document.getElementById("cloudstatus"); return e && e.textContent.includes("Sincronizado às"); }')
    def said(pg_, text):
        pg_.wait_for_function('t => document.getElementById("cloudmsg") && document.getElementById("cloudmsg").textContent.includes(t)', arg=text)
    def login(pg_, email, pw='senha-boa-123', how='cloudin'):
        pg_.fill('#cloudemail', email); pg_.fill('#cloudpass', pw); pg_.click(f'[data-act={how}]')
    bet = lambda id_, t, stake: dict(id=id_, t=t, type='single', stake=stake, unit=10, odd=2, sgp={}, status='open', payout=0, settledAt=None,
        legs=[dict(fid='f1', eid='600000001', key='ml:a', market='Vencedor', sel='Lima vence', cat='Vencedor', weight='Lightweight', fight='Lima x Rocha', event='UFC Fight Night', date=now_ms + 86400000, odd=2, src='real')])
    phone_state = dict(v=1, cur='BRL', seen=now_ms, deposits=[dict(t=now_ms - 5000, v=1000)], bets=[bet('ph1', now_ms - 4000, 100)])
    pc_state = dict(v=1, cur='BRL', seen=now_ms, deposits=[dict(t=now_ms - 3000, v=500)], bets=[])
    CLOUD.update(down=False, log=[], users={}, passwords={}, confirm=False, tokens={}, refresh={}, rows={}, seq=0)
    cph, phone, ph_errs = device(phone_state)
    assert phone.locator('#cloudemail').count() == 1 and phone.locator('#cloudstatus').count() == 0, 'not logged in: the card asks for an e-mail'
    assert phone.get_attribute('#cloudpass', 'type') == 'password' and phone.get_attribute('#cloudpass', 'autocomplete') == 'current-password'
    login(phone, 'não é e-mail'); said(phone, 'e-mail válido')
    login(phone, 'lucas@exemplo.com', 'curta'); said(phone, 'pelo menos 8 caracteres'); assert CLOUD['log'] == [], 'nothing goes to the server before the form is right'
    login(phone, 'lucas@exemplo.com'); said(phone, 'Se ainda não tem conta')                       # no account yet: "Entrar" says to create one
    assert phone.input_value('#cloudpass') == 'senha-boa-123', 'a failed try keeps what was typed'
    CLOUD['confirm'] = True; login(phone, 'lucas@exemplo.com', how='cloudup'); said(phone, 'desliga "Confirm email"')
    CLOUD.update(confirm=False, users={}, passwords={})
    login(phone, 'Lucas@Exemplo.com', how='cloudup'); synced(phone)
    assert 'senha-boa-123' not in json.dumps(phone.evaluate('({...localStorage})')), 'the password is not stored on the device'
    assert 'Entrou como' in phone.inner_text('#cloudstatus') and 'Sincronizado às' in phone.inner_text('#cloudstatus'), phone.inner_text('#cloud')
    assert CLOUD['rows']['u1']['bets'][0]['id'] == 'ph1' and CLOUD['rows']['u1']['deposits'] == [dict(t=now_ms - 5000, v=1000)], 'the first device sends its history to an empty server'
    assert all(':' not in m for m, _ in CLOUD['log']), CLOUD['log']
    phone.locator('#cloud').scroll_into_view_if_needed(); phone.screenshot(path=str(SHOTS / 's56-sincronizar.png'))
    assert 'numa cópia no servidor' in phone.inner_text('#view') and 'só neste aparelho' not in phone.inner_text('#view'), 'signed in, the data card says a copy is on the server'
    # the computer has a history of its own: the person chooses, and here joins both
    cpc, pc, pc_errs = device(pc_state)
    login(pc, 'lucas@exemplo.com', how='cloudup'); said(pc, 'já tem conta')
    login(pc, 'lucas@exemplo.com', 'senha-errada-1'); said(pc, 'E-mail ou senha errados')
    login(pc, 'lucas@exemplo.com'); pc.wait_for_selector('#cloudask')
    assert 'Aqui: 0 apostas e 1 depósito. No servidor: 1 aposta e 1 depósito.' in pc.inner_text('#cloudask') and len(S_(pc)['deposits']) == 1, pc.inner_text('#cloud')
    pc.locator('#cloud').scroll_into_view_if_needed(); pc.screenshot(path=str(SHOTS / 's57-primeira-vez.png'))
    pc.click('[data-act=cloudfirst][data-c=join]'); synced(pc)
    assert sorted(d['v'] for d in S_(pc)['deposits']) == [500, 1000] and [x['id'] for x in S_(pc)['bets']] == ['ph1'] and money(pc) == 'R$ 1.400,00', (money(pc), S_(pc))
    assert sorted(d['v'] for d in CLOUD['rows']['u1']['deposits']) == [500, 1000], 'and the server has both'
    phone.click('[data-act=cloudsync]'); phone.wait_for_function('window.__OL.S.deposits.length === 2')
    assert money(phone) == 'R$ 1.400,00', 'the phone gets what the computer had'
    # a deposit on the computer reaches the phone; the copy goes a moment after the save, by itself
    pc.fill('#dep', '250'); pc.click('[data-act=deposit]'); assert money(pc) == 'R$ 1.650,00'
    pc.wait_for_function('() => true'); pc.wait_for_timeout(2600)
    assert sorted(d['v'] for d in CLOUD['rows']['u1']['deposits']) == [250, 500, 1000], 'sent by itself, without a tap'
    phone.evaluate('document.dispatchEvent(new Event("visibilitychange"))'); phone.wait_for_function('window.__OL.S.deposits.length === 3')
    assert money(phone) == 'R$ 1.650,00', 'coming back to the app brings it'
    before = len(CLOUD['log']); phone.click('[data-act=cloudsync]'); synced(phone)
    assert [m for m, _ in CLOUD['log'][before:]] == ['GET'], ('a sync with nothing new reads and sends nothing back', CLOUD['log'][before:])
    # the server out of reach: the phone keeps working, says so, and catches up when it is back
    CLOUD['down'] = True
    phone.fill('#dep', '50'); phone.click('[data-act=deposit]'); assert money(phone) == 'R$ 1.700,00'
    phone.wait_for_selector('#clouderr', timeout=8000); assert 'Sem conexão com o servidor' in phone.inner_text('#clouderr') and 'continua salvo' in phone.inner_text('#clouderr')
    assert sorted(d['v'] for d in CLOUD['rows']['u1']['deposits']) == [250, 500, 1000]
    CLOUD['down'] = False; phone.click('[data-act=cloudsync]'); phone.wait_for_function('!document.getElementById("clouderr")')
    assert sorted(d['v'] for d in CLOUD['rows']['u1']['deposits']) == [50, 250, 500, 1000], 'back: what was done meanwhile goes up'
    # a token about to expire is renewed, with the refresh token used once
    phone.evaluate('(() => { const a = JSON.parse(localStorage.getItem("oitolados.auth.v1")); a.exp = Date.now(); localStorage.setItem("oitolados.auth.v1", JSON.stringify(a)); })()')
    phone.reload(); phone.wait_for_function('window.__OL && window.__OL.S'); phone.click('.tabbar [data-tab=carteira]'); phone.wait_for_selector('#cloudstatus')
    phone.wait_for_function('document.getElementById("cloudstatus").textContent.includes("Sincronizado às")')
    assert ('POST', '/auth/v1/token') in CLOUD['log'], 'renewed'
    # a reset on the phone does not come back from the computer
    phone.click('[data-act=reset]'); phone.click('[data-act=doreset]'); assert money(phone) == 'R$ 0,00'
    phone.click('[data-act=cloudsync]'); phone.wait_for_timeout(500)
    assert CLOUD['rows']['u1']['deposits'] == [] and CLOUD['rows']['u1']['epoch'] > now_ms, CLOUD['rows']['u1']
    pc.click('[data-act=cloudsync]'); pc.wait_for_function('window.__OL.S.deposits.length === 0')
    assert money(pc) == 'R$ 0,00' and CLOUD['rows']['u1']['deposits'] == [], 'the reset reached the computer, and nothing came back'
    # leaving keeps what is on the device, and stops the syncing
    pc.fill('#dep', '10'); pc.click('[data-act=deposit]'); pc.wait_for_timeout(2600); assert money(pc) == 'R$ 10,00'
    phone.click('[data-act=cloudout]'); assert phone.locator('#cloudemail').count() == 1 and 'continua aqui' in phone.inner_text('#toast')
    before = len(CLOUD['log']); phone.fill('#dep', '5'); phone.click('[data-act=deposit]'); phone.wait_for_timeout(2600)
    assert money(phone) == 'R$ 5,00' and len(CLOUD['log']) == before, 'logged out: nothing is sent'
    # coming back to the same account on a device already joined with it: no question again, the two are simply joined
    login(phone, 'lucas@exemplo.com'); synced(phone)
    assert phone.locator('#cloudask').count() == 0 and money(phone) == 'R$ 15,00' and sorted(d['v'] for d in CLOUD['rows']['u1']['deposits']) == [5, 10], (money(phone), CLOUD['rows']['u1'])
    # a device reset before it ever logged in takes the server history, and never wipes it (found in the review of PR #35)
    c3d, third, t_errs = device(dict(v=1, cur='BRL', seen=now_ms, deposits=[dict(t=now_ms - 9000, v=77)], bets=[]))
    third.click('[data-act=reset]'); third.click('[data-act=doreset]'); assert money(third) == 'R$ 0,00' and S_(third)['epoch'] > now_ms
    login(third, 'lucas@exemplo.com'); synced(third)
    assert third.locator('#cloudask').count() == 0 and money(third) == 'R$ 15,00' and sorted(d['v'] for d in CLOUD['rows']['u1']['deposits']) == [5, 10], ('the reset device takes the history; the server keeps it', money(third), CLOUD['rows']['u1'])
    # another history in another currency cannot be summed: only "keep one" is offered
    c4d, fourth, f_errs = device(dict(v=1, cur='USD', seen=now_ms, deposits=[dict(t=now_ms - 8000, v=40)], bets=[]))
    login(fourth, 'lucas@exemplo.com'); fourth.wait_for_selector('#cloudask')
    assert fourth.locator('[data-act=cloudfirst][data-c=join]').count() == 0 and 'aqui USD, no servidor BRL' in fourth.inner_text('#cloudcur'), fourth.inner_text('#cloud')
    fourth.click('[data-act=cloudfirst][data-c=there]'); synced(fourth)
    assert money(fourth) == 'R$ 15,00' and S_(fourth)['cur'] == 'BRL', ('kept the server history, in its currency', money(fourth))
    assert not t_errs and not f_errs, (t_errs, f_errs)
    for c in (c3d, c4d): c.close()
    # another person never sees this row
    cx, other, ox = device(dict(v=1, deposits=[], bets=[])); login(other, 'outra@pessoa.com', 'outra-senha-9', 'cloudup'); synced(other)
    assert S_(other)['deposits'] == [] and set(CLOUD['rows']) == {'u1', 'u2'}, 'a new person gets an empty history of their own'
    assert not ph_errs and not pc_errs and not ox, (ph_errs, pc_errs, ox)
    for c in (cph, cpc, cx): c.close()
    PHASE['n'] = was_phase
    # the rows of events and of countries, by what the device points with: a finger swipes them sideways, a mouse cannot, so there
    # they break into lines. Five fights and two events, to have more buttons than fit in the width of a phone
    was_phase = PHASE['n']; PHASE['n'] = 0; ESPN['extra'] = True; ESPN['next'] = True          # the card of the walk-through, before any fight, is the one on screen
    ROWS = '''() => ['.events', '#lands'].map(sel => { const b = document.querySelector(sel), r = b.getBoundingClientRect(), xs = [...b.children].map(e => e.getBoundingClientRect());
        const col = document.querySelector('.field.search').getBoundingClientRect();          // the column the rest of the screen is in
        return [getComputedStyle(b).flexWrap, b.scrollWidth > b.clientWidth, xs.every(x => x.left >= r.left - 0.5 && x.right <= r.right + 0.5), new Set(xs.map(x => Math.round(x.top))).size, xs.length, Math.abs(r.left - col.left) < 1 && Math.abs(r.right - col.right) < 1]; })
        .concat([document.documentElement.scrollWidth - document.documentElement.clientWidth])'''
    def rows_on(width, **kw):
        c3 = b.new_context(viewport=dict(width=width, height=852), device_scale_factor=2, color_scheme='dark', locale='pt-BR', timezone_id='America/Sao_Paulo', **kw)
        c3.route('**/*', lambda r: handle(r) if r.request.url.startswith('http') else r.continue_()); c3.route('https://cdn.jsdelivr.net/**', local_cdn)
        p3 = c3.new_page(); p3.goto((ROOT / 'dist' / 'index.html').as_uri()); p3.wait_for_selector('#lands button'); p3.wait_for_function('document.querySelectorAll(".events .ev").length === 2 && document.querySelectorAll("#lands button").length === 4')
        got = p3.evaluate(ROWS)
        if kw: got.append(p3.evaluate('(() => { const b = document.querySelector("#lands"); b.scrollLeft = 9999; const r = b.lastElementChild.getBoundingClientRect(); return b.scrollLeft > 0 && r.right <= innerWidth + 0.5; })()'))          # swiped to its end, the last button is whole
        else: p3.screenshot(path=str(SHOTS / f's51-fileiras-com-mouse-{width}.png'))
        c3.close(); return got
    finger = rows_on(393, has_touch=True, is_mobile=True)
    assert finger == [['nowrap', True, False, 1, 2, False], ['nowrap', True, False, 1, 4, False], 0, True], ('under a finger each row is one line that scrolls sideways from edge to edge of the screen, and the page itself does not', finger)
    mouse = rows_on(393)
    assert mouse == [['wrap', False, True, 2, 2, True], ['wrap', False, True, 2, 4, True], 0], ('with a mouse, at the width of a phone, nothing is cut: the rows break into lines, inside the column', mouse)
    wide = rows_on(1280)
    assert [m[:3] + m[5:] for m in wide[:2]] == [['wrap', False, True, True], ['wrap', False, True, True]] and wide[2] == 0, ('and on a wide window too', wide)
    ESPN['extra'] = False; ESPN['next'] = False; PHASE['n'] = was_phase
    b.close()
    # a computer with no flag emoji of its own (Windows) draws the two letters of the country where the flag should be. There the
    # flags come from a font fetched for them, and a system that has flags never asks for it. Chromium is started again, with the
    # emoji font of this machine left out, to stand in for such a computer.
    import os, subprocess
    conf = pathlib.Path(tempfile.mkdtemp()) / 'no-emoji.conf'
    conf.write_text('<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><include ignore_missing="yes">/etc/fonts/fonts.conf</include>'
                    '<selectfont><rejectfont><pattern><patelt name="family"><string>Noto Color Emoji</string></patelt></pattern></rejectfont></selectfont></fontconfig>')
    # how much of a flag is drawn in colour, with the fonts the page gives it: letters and empty boxes have none
    COLOUR = '''async () => { const el = document.querySelector('.fight .flag'), fam = getComputedStyle(el).fontFamily, t = el.textContent;
        try { await document.fonts.load('40px ' + fam, t); } catch (e) {}
        const c = document.createElement('canvas'); c.width = 80; c.height = 60; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 80, 60); x.fillStyle = '#000'; x.font = '40px ' + fam; x.textBaseline = 'top'; x.fillText(t, 4, 8);
        const d = x.getImageData(0, 0, 80, 60).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 60) n++;
        return n; }'''
    def flags_on(env, cdn_down, shot_as=None):
        b2 = p.chromium.launch(env={**os.environ, **env}); CDN_DOWN['on'] = cdn_down; del cdn_calls[:]
        try:
            c2 = b2.new_context(viewport=dict(width=393, height=852), device_scale_factor=2, color_scheme='dark', locale='pt-BR', timezone_id='America/Sao_Paulo')
            c2.route('**/*', lambda r: handle(r) if r.request.url.startswith('http') else r.continue_()); c2.route('https://cdn.jsdelivr.net/**', local_cdn)
            p2 = c2.new_page(); p2.goto((ROOT / 'dist' / 'index.html').as_uri()); p2.wait_for_selector('.fight .flag'); p2.wait_for_timeout(1200)
            asked = [u.split('/npm/')[1] for u in cdn_calls if 'country-flag' in u]          # what the page asked for by itself, before the measuring asks too
            if shot_as: p2.locator('#lands').scroll_into_view_if_needed(); p2.screenshot(path=str(SHOTS / shot_as))
            return asked, p2.evaluate(COLOUR)
        finally:
            CDN_DOWN['on'] = False; b2.close()
    PHASE['n'] = 0                                                                              # the card before any fight: once it is over it is not on screen
    bare = {'FONTCONFIG_FILE': str(conf)}
    asked, colour = flags_on(bare, False, 's50-bandeiras-sem-emoji-no-sistema.png')
    assert asked == ['country-flag-emoji-polyfill@0.1.10/dist/TwemojiCountryFlags.woff2'] and colour > 300, ('with no flag emoji in the system, the font of the flags is fetched and the flag is drawn in colour', asked, colour)
    asked, colour = flags_on(bare, True)
    assert colour == 0, ('and without that font there is no flag, only letters: it is the font that draws them', asked, colour)
    if 'Noto Color Emoji' in subprocess.run(['fc-list'], capture_output=True, text=True).stdout:
        asked, colour = flags_on({}, False)
        assert asked == [] and colour > 300, ('a system that has flags draws its own and never asks for the font', asked, colour)
        print('bandeiras: desenhadas pelo sistema quando ele tem, e pela fonte das bandeiras quando não tem')
    else: print('bandeiras: esta máquina não tem emoji de bandeira; só o caminho da fonte das bandeiras foi conferido')
assert ow == 0, f'page is {ow}px wider than the phone screen'
assert not [e for e in errs if 'PAGEERROR' in e], errs
print('e2e ok: 15 apostas encerradas (3 por cashout: 1 repetida e 1 a valor de mercado), saldo final R$ 1.609,59, banca convertida quatro vezes (duas sem depositar), sem estouro de largura e sem erro de script')
