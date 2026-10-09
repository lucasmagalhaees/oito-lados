"""End-to-end run of index.html against a mocked ESPN API.

Usage: python3 tests/e2e.py [dark|light]   (needs: pip install -r tests/requirements.txt && playwright install chromium)
Walks one fictional card through pre-fight -> live -> final, places singles, parlays and same-fight combos through the UI,
and prints prices, settlements and the final balance (expected: R$ 1.584,30).
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
assert ow == 0, f'page is {ow}px wider than the phone screen'
assert not [e for e in errs if 'PAGEERROR' in e], errs
print('e2e ok: 11 apostas liquidadas, saldo final R$ 1.584,30, sem estouro de largura e sem erro de script')
