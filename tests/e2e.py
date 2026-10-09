"""End-to-end run of index.html against a mocked ESPN API.

Usage: python3 tests/e2e.py [dark|light]   (needs: pip install -r tests/requirements.txt && playwright install chromium)
Walks one fictional card through pre-fight -> live -> final, places singles, parlays and same-fight combos through the UI,
and prints prices, settlements and the final balance (expected: R$ 1.604,40).
"""
import json, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from mock_espn import PHASE, handle, calls
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHOTS = ROOT / 'tests' / 'shots'; SHOTS.mkdir(exist_ok=True)

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
    # money fields: thousands mask while typing, and the display currency
    pg.click('[data-act=tab][data-tab=carteira]')
    pg.click('#dep'); pg.keyboard.type('1234567,891')
    assert pg.input_value('#dep') == '1.234.567,89', pg.input_value('#dep')
    for _ in range(5): pg.keyboard.press("Backspace")
    assert pg.input_value('#dep') == '12.345', pg.input_value('#dep')
    pg.keyboard.press('Home'); pg.keyboard.type('9')                   # editing at the start keeps the caret there
    assert pg.input_value('#dep') == '912.345', pg.input_value('#dep')
    pg.keyboard.type('8'); assert pg.input_value('#dep') == '9.812.345', pg.input_value('#dep')
    pg.fill('#dep', ''); pg.click('[data-act=depq][data-v="1000"]'); pg.click('[data-act=depq][data-v="500"]')
    assert pg.input_value('#dep') == '1.500', pg.input_value('#dep')
    pg.fill('#dep', '')
    assert bal().replace('\xa0', ' ') == 'R$ 0,00', bal()
    pg.click('[data-act=cur][data-c=USD]'); assert bal().replace('\xa0', ' ') == 'US$ 0,00', bal()
    assert pg.inner_text('.field span') == 'US$', pg.inner_text('.field span')
    pg.click('[data-act=cur][data-c=EUR]'); assert bal().replace('\xa0', ' ') == '€ 0,00', bal()
    pg.reload(); pg.wait_for_function('window.__OL && window.__OL.S'); assert bal().replace('\xa0', ' ') == '€ 0,00', 'the chosen currency must survive a reload: ' + bal()
    pg.click('[data-act=tab][data-tab=carteira]'); pg.click('[data-act=cur][data-c=BRL]'); assert bal().replace('\xa0', ' ') == 'R$ 0,00', bal()
    pg.fill('#dep', '1.000,00'); pg.click('[data-act=deposit]')
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
    # unit: 10% of the bankroll by default, adjustable; the slip can stake in units
    pg.click('.tabbar [data-tab=carteira]'); assert pg.inner_text('#unitnow').replace('\xa0', ' ') == '1u = R$ 100,00', pg.inner_text('#unitnow')
    pg.fill('#unitpct', '2,5'); pg.click('[data-act=unit]'); assert pg.inner_text('#unitnow').replace('\xa0', ' ') == '1u = R$ 25,00', pg.inner_text('#unitnow')
    pg.fill('#unitpct', '10'); pg.keyboard.press('Enter'); assert pg.inner_text('#unitnow').replace('\xa0', ' ') == '1u = R$ 100,00', pg.inner_text('#unitnow')
    pg.click('.tabbar [data-tab=lutas]'); pick('f1', 'ml:a'); pg.click('#slipbtn')
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
    assert bal() == before.replace('690', '730'), (before, bal())
    multi_again = pg.locator('.bet', has_text='Múltipla').first.locator('[data-act=again]')
    multi_again.click(); pg.wait_for_selector('#stake')
    kind = pg.evaluate('[window.__OL.slip.mode, window.__OL.slip.sels.length, window.__OL.slip.stake]')
    assert kind[0] == 'multi' and kind[1] >= 2, kind
    for _ in range(kind[1]): pg.click('#panel [data-act=unpick]')     # leave the slip empty again
    assert pg.locator('[data-act=cash]').count() == 12, 'every other open bet should still offer cashout before the card starts'
    pg.click('.tabbar [data-tab=lutas]')
    print('balance after bets', bal(), '| open', pg.evaluate('window.__OL.S.bets.length'))
    PHASE['n'] = 1; sync(); pg.click('.tabbar [data-tab=apostas]'); pg.wait_for_timeout(200); shot('s4-live.png')
    frozen = pg.locator('.hint.co', has_text='Cashout congelado').count(); still = pg.locator('[data-act=cash]').count()
    print('fase 1: cashout congelado em', frozen, 'apostas, disponível em', still)
    assert frozen == 6 and still == 6, (frozen, still)       # 6 bets touch the live fight; the other 6 are on fights still to start
    print('phase1 statuses', pg.evaluate('window.__OL.S.bets.map(b=>b.status)'), 'td', pg.evaluate('JSON.stringify(window.__OL.D.td)'))
    PHASE['n'] = 2; sync(); sync(); pg.wait_for_timeout(200)
    opened = pg.evaluate('window.__OL.S.bets.filter(b => b.status === "open").length')
    gone = pg.locator('.hint.co', has_text='Cashout encerrado').count(); frozen = pg.locator('.hint.co', has_text='Cashout congelado').count(); still = pg.locator('[data-act=cash]').count()
    print('fase 2:', opened, 'abertas | cashout encerrado', gone, '| congelado', frozen, '| disponível', still)
    assert (opened, gone, frozen, still) == (9, 1, 4, 4), (opened, gone, frozen, still)   # gone: parlay whose first fight is over; frozen: bets touching the live fight; still: bets entirely on the main event
    print('phase2 statuses', pg.evaluate('window.__OL.S.bets.map(b=>[b.type,b.legs.map(l=>l.key).join("+"),b.status,b.payout])'), bal())
    PHASE['n'] = 3; sync(); sync()
    st = pg.evaluate('window.__OL.S.bets.map(b=>[b.type,b.legs.map(l=>l.key+"@"+l.odd).join("+"),b.stake,b.status,b.payout])')
    for s in st: print('  ', s)
    print('final balance', bal())
    assert bal().replace('\xa0', ' ') == 'R$ 1.604,40', bal()
    pg.click('[data-act=filter][data-f=done]'); shot('s5-done.png', True)
    pg.click('.tabbar [data-tab=carteira]'); pg.wait_for_timeout(200); shot('s6-carteira.png')
    units = pg.inner_text('#pnlu'); print('em unidades:', units)
    assert units.startswith('+6,04u'), units                  # R$ 604,40 of profit with every bet placed at a R$ 100,00 unit
    pg.click('.tabbar [data-tab=apostas]'); assert pg.locator('[data-act=again]').count() == 0, 'nothing can be repeated once every fight is over'
    pg.click('.tabbar [data-tab=lutas]'); shot('s7-final.png', True)
    ow = pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
    print('h-overflow px', ow, '| requests', len(calls), '| errors', errs)
    b.close()
assert ow == 0, f'page is {ow}px wider than the phone screen'
assert not [e for e in errs if 'PAGEERROR' in e], errs
print('e2e ok: 14 apostas encerradas (2 por cashout, 1 delas repetida), saldo final R$ 1.604,40, sem estouro de largura e sem erro de script')
