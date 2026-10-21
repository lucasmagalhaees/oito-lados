"""Settling bets as the fights end, through the page: a win and a loss, a result that is late, and a result published
under a name the app does not know.

Usage: python3 tests/settle.py   (needs dist/ built: npm run build)
ESPN is the mock (tests/mock_espn.py), with invented fighters. The walk-through in tests/e2e.py settles bets with every
answer arriving at once and in full; this one holds answers back, the way a real night can.
"""
import pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from mock_espn import PHASE, ESPN, handle, calls
import cov
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
n = 0
def check(name, cond, detail=''):
    global n
    n += 1
    assert cond, f'{name}: {detail}'

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport=dict(width=393, height=852), locale='pt-BR', timezone_id='America/Sao_Paulo')
    ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith('file:') else handle(r))
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    cov.start(pg)
    pg.goto((ROOT / 'dist' / 'index.html').as_uri()); pg.wait_for_function('window.__OL && window.__OL.S'); pg.wait_for_selector('.fight .opt.ml')
    sync = lambda: (pg.evaluate('window.__OL.sync(true)'), pg.wait_for_timeout(400))
    bet_of = lambda i: pg.evaluate(f'(b => [b.status, b.payout, b.legs.map(l => l.out || null), b.legs.map(l => l.res || "")])(window.__OL.S.bets.find(b => b.id === "{i}"))')
    boards = lambda: sum(1 for u in calls if '/scoreboard' in u)
    txt = lambda sel: pg.inner_text(sel).replace('\xa0', ' ')
    pg.click('.tabbar [data-tab=carteira]'); pg.fill('#dep', '1000'); pg.click('[data-act=deposit]'); pg.click('.tabbar [data-tab=lutas]')
    pg.click('[data-act=more][data-fid="f1"]')
    def bet(sels, stake, multi=False):
        for fid, key in sels: pg.click(f'[data-act=pick][data-fid="{fid}"][data-key="{key}"]')
        pg.click('#slipbtn'); pg.wait_for_selector('#stake')
        assert ('Múltipla' in pg.inner_text('#slipkind')) == multi, pg.inner_text('#slipkind')         # the kind follows the selections (D104)
        k = pg.evaluate('window.__OL.S.bets.length')
        pg.fill('#stake', stake); pg.click('[data-act=place]'); pg.wait_for_function(f'window.__OL.S.bets.length === {k + 1}')
        pg.click('.tabbar [data-tab=lutas]')
        return pg.evaluate('window.__OL.S.bets.slice(-1)[0].id')
    # the first fight (f1) will end with Marina Teles (a) winning by KO/TKO; the main event (f3) with Rafael Almeida (a)
    win = bet([('f1', 'ml:a')], '100'); loss = bet([('f1', 'ml:b')], '50'); how = bet([('f1', 'mov:a:ko')], '20'); tds = bet([('f1', 'td:o:1.5')], '10')
    multi = bet([('f1', 'ml:a'), ('f3', 'ml:b')], '30', True)
    check('five bets open, nothing waiting on a finished fight', pg.evaluate('window.__OL.S.bets.filter(b => b.status === "open").length') == 5 and pg.evaluate('window.__OL.settling(Date.now())') is False)

    # 1. the fight is over and the scoreboard marks the winner, but the official result is not published yet
    ESPN['noresult'] = True; PHASE['n'] = 2; sync()
    check('the winner pick is settled by the mark on the scoreboard, without the method', bet_of(win)[:3] == ['won', 167, ['won']], bet_of(win))
    check('and so is the pick on the loser', bet_of(loss)[:3] == ['lost', 0, ['lost']], bet_of(loss))
    check('what was settled says who won and that the method is still to come', bet_of(win)[3] == ['Teles venceu · método ainda não publicado'], bet_of(win)[3])
    check('the bets on the method and on the takedowns wait for the result', bet_of(how)[0] == 'open' and bet_of(tds)[0] == 'open' and pg.evaluate('window.__OL.D.results.f1 === undefined'))
    check('the multiple stays open for its other fight, with this one already won', bet_of(multi)[0] == 'open' and pg.evaluate(f'window.__OL.S.bets.find(b => b.id === "{multi}").legs.length') == 2)
    pg.click('.tabbar [data-tab=apostas]')
    check('each selection of the multiple says in words where it stands, and the multiple counts them', [t.lower() for t in pg.locator('.bet', has=pg.locator('.tally')).first.locator('.ls').all_inner_texts()] == ['bateu', 'não começou'] and txt('.tally') == '1 bateu · 1 não começou' and pg.locator('.leg.s-won').count() == 1 and pg.locator('.leg.s-pending').count() == 1, (txt('.tally'), pg.locator('.ls').all_inner_texts()))
    check('a selection whose fight is over and still has no result says it is waiting', [t.lower() for t in pg.locator('.leg.s-waiting .ls').all_inner_texts()] == ['aguardando', 'aguardando'], pg.locator('.ls').all_inner_texts())
    check('an open bet says what it is waiting for', txt('#view').count('Teles venceu · método ainda não publicado') >= 2 and 'esperando as quedas' not in txt('#view'), txt('#view')[-900:])
    # the mock's fights are hours old, so their takedown count is taken as final at once; a count still moving says so
    pg.evaluate('window.__OL.D.td.f1.final = false'); pg.click('.tabbar [data-tab=apostas]')
    check('a bet on takedowns says it waits for the count to stop moving', txt('#view').count('esperando as quedas fecharem (até 2 min)') == 1, txt('#view')[-900:])
    pg.evaluate('window.__OL.D.td.f1.final = true')
    check('the strip sums up the two that closed', 'Desde a última vez: 2 apostas fecharam' in txt('#since'), txt('#since'))
    sinceu = pg.evaluate('(() => { const S = window.__OL.S; return S.bets.filter(b => ["won", "lost"].includes(b.status) && b.settledAt > S.seen).reduce((a, b) => a + (b.payout - b.stake) / b.unit, 0); })()')
    shown = txt('#since b span').split(' · ')[-1]
    check('and says the result in units too', shown.endswith('u') and abs(float(shown.replace('u', '').replace('−', '-').replace('+', '').replace(',', '.')) - sinceu) < 0.006, (txt('#since b span'), sinceu))
    # while a bet waits on a finished fight the source is asked again sooner than with a fight merely in progress (15 s)
    check('a bet is waiting on a finished fight', pg.evaluate('window.__OL.settling(Date.now())') is True)
    before = boards(); pg.wait_for_timeout(9500)
    check('the source was asked again within ten seconds', boards() > before, (before, boards()))

    # 2. the result arrives under a name the app does not know: nothing is voided, the name is shown, and it is asked for again
    ESPN['noresult'] = False; ESPN['resname'] = dict(name='weird-finish', displayName='Weird Finish'); sync()
    check('an unknown result name voids nothing while it is fresh', bet_of(how)[0] == 'open' and bet_of(tds)[0] == 'open' and pg.evaluate('window.__OL.D.results.f1 === undefined'), (bet_of(how), bet_of(tds)))
    check('the name is on screen', 'resultado "Weird Finish" ainda não reconhecido pelo app' in txt('#view'), txt('#view')[:400])

    # 3. the result as the app knows it: the method and the takedowns settle
    ESPN['resname'] = None; sync()
    check('the bet on the method is won', bet_of(how)[0] == 'won' and bet_of(how)[1] > 20 and 'Teles venceu por KO/TKO · R2 3:12' in bet_of(how)[3][0], bet_of(how))
    check('the bet on the takedowns is won (2 + 1 against a line of 1.5)', bet_of(tds)[0] == 'won' and 'quedas 2–1' in bet_of(tds)[3][0], bet_of(tds))
    check('nothing is waiting on a finished fight any more', pg.evaluate('window.__OL.settling(Date.now())') is False and pg.evaluate('"f1" in window.__OL.D.unread') is False)

    # 4. coming back to the app: a page restored from memory or a connection that returns asks the source at once, unless it just did
    before = boards(); pg.evaluate('window.dispatchEvent(new Event("online"))'); pg.wait_for_timeout(300)
    check('the source was asked a moment ago: no need to ask again', boards() == before, (before, boards()))
    pg.evaluate('window.__OL.D.lastSync = Date.now() - 60000; window.dispatchEvent(new Event("pageshow"))'); pg.wait_for_function(f'true', timeout=1000); pg.wait_for_timeout(600)
    check('back after a while: asked at once', boards() > before, (before, boards()))

    # 5. the rest of the card: the multiple loses on its second fight
    PHASE['n'] = 3; sync(); sync()
    check('the multiple is lost on the main event', bet_of(multi)[:3] == ['lost', 0, ['won', 'lost']], bet_of(multi))
    paid = pg.evaluate('window.__OL.S.bets.reduce((a, b) => a + b.payout, 0)')
    check('the balance is what was deposited, less the stakes, plus what was paid', txt('#bal') == pg.evaluate('new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(1000 - 210 + ' + str(paid) + ')').replace('\xa0', ' ') and paid > 167, (txt('#bal'), paid))
    pg.click('.tabbar [data-tab=apostas]'); pg.click('[data-act=filter][data-f=done]')
    lost = pg.locator('.bet', has=pg.locator('.tally')).first
    check('the lost multiple shows which selection hit and which one lost it', [t.lower() for t in lost.locator('.ls').all_inner_texts()] == ['bateu', 'perdeu'] and lost.locator('.tally').inner_text() == '1 bateu · 1 perdeu' and lost.locator('.leg.s-lost .g').inner_text() == '✕', lost.inner_text())
    check('no script error', not errs, errs)
    PHASE['n'] = 0
    cov.stop(pg, 'settle')
    ctx.close()

    # 6. a draw: the pick on the winner is voided. A single is given back; a multiple goes on without that fight and pays less
    ctx = b.new_context(viewport=dict(width=393, height=852), locale='pt-BR', timezone_id='America/Sao_Paulo')
    ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith('file:') else handle(r))
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    cov.start(pg)
    pg.goto((ROOT / 'dist' / 'index.html').as_uri()); pg.wait_for_function('window.__OL && window.__OL.S'); pg.wait_for_selector('.fight .opt.ml')
    pg.click('.tabbar [data-tab=carteira]'); pg.fill('#dep', '1000'); pg.click('[data-act=deposit]'); pg.click('.tabbar [data-tab=lutas]')
    multi = bet([('f1', 'ml:b'), ('f3', 'ml:a')], '100', True); single = bet([('f1', 'ml:a')], '50')          # 2.25 x 1.80 = 4.05
    check('the multiple is placed at the odd of its two fights', pg.evaluate(f'window.__OL.S.bets.find(b => b.id === "{multi}").odd') == 4.05)
    ESPN['draw'] = 'f1'; PHASE['n'] = 2; sync()
    check('a draw gives the single on the winner back', bet_of(single)[:3] == ['void', 50, ['void']] and 'Empate' in bet_of(single)[3][0], bet_of(single))
    check('and leaves the multiple open', bet_of(multi)[0] == 'open', bet_of(multi))
    pg.click('.tabbar [data-tab=apostas]')
    leg = pg.locator('.leg.s-void')
    check('the voided selection says so, and what that does to the multiple', leg.count() == 1 and leg.locator('.ls').inner_text().lower() == 'anulada' and 'Empate' in leg.inner_text() and 'Sai da múltipla: esta luta passa a valer odd 1.00.' in leg.inner_text() and leg.locator('.lo').inner_text() == '2.25 1.00' and leg.locator('.lo s').inner_text() == '2.25', leg.inner_text())
    check('the multiple counts it', txt('.tally') == '1 anulada · 1 não começou', txt('.tally'))
    check('the odd, the return and the gain are the ones the bet pays now', txt('.bf .odd') == '1.80' and txt('.bf .was') == 'era 4.05' and txt('.bf .ret') == 'R$ 180,00' and txt('.bet .gain b') == '+R$ 80,00 · +0,8u', (txt('.bf'), txt('.bet .gain b')))
    check('and so are the totals of the event', [txt(f'.grpsum .{c}') for c in ('st', 'rt', 'gn', 'gnu')] == ['R$ 100,00', 'R$ 180,00', '+R$ 80,00', '+0,8u'], txt('.grpsum'))
    check('nothing gets wider than the phone', pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') == 0)
    (ROOT / 'tests' / 'shots').mkdir(exist_ok=True); pg.screenshot(path=str(ROOT / 'tests' / 'shots' / 's42-anulada-na-multipla.png'))
    pg.click('.tabbar [data-tab=carteira]')
    check('and of the wallet, where a single bet is said in the singular', [txt('#ifwin small').lower(), txt('#ifwin b'), txt('#ifwin span'), txt('#iflose small').lower(), txt('#iflose b'), txt('#iflose span')] == ['se bater', '+R$ 80,00 · +0,8u', 'retorno de R$ 180,00 · banca vai a R$ 1.080,00', 'se perder', '−R$ 100,00 · −1u', 'banca vai a R$ 900,00'] and txt('#atrisk .un') == '1u · 1 aposta', txt('#bank'))
    # a fight the source has in the cage with no round yet is about to start, not in its round zero
    pg.evaluate('(() => { const f = window.__OL.D.fights.get("f3"); f.state = "in"; f.period = 0; f.clock = "-"; })()')
    pg.click('.tabbar [data-tab=lutas]'); pg.click('.tabbar [data-tab=apostas]')
    check('about to start is said as such on the bet', pg.locator('.leg.s-starting .ls').inner_text().lower() == 'vai começar' and 'VAI COMEÇAR' in pg.locator('.leg.s-starting .lv').inner_text() and 'R0' not in txt('#view') and '1 anulada · 1 vai começar' == txt('.tally'), txt('#view')[:600])
    pg.click('.tabbar [data-tab=lutas]')
    check('and on the card of the fight', any('VAI COMEÇAR' in t for t in pg.locator('.fight .chip.live').all_inner_texts()), pg.locator('.fight .chip.live').all_inner_texts())
    PHASE['n'] = 3; sync(); sync()
    check('the multiple wins on the fight that was left, paid at the odd of that fight', bet_of(multi)[:3] == ['won', 180, ['void', 'won']], bet_of(multi))
    pg.click('.tabbar [data-tab=apostas]'); pg.click('[data-act=filter][data-f=done]')
    won = pg.locator('.bet', has=pg.locator('.tally')).first
    check('closed, it still says what happened to each selection and what it paid', [t.lower() for t in won.locator('.ls').all_inner_texts()] == ['anulada', 'bateu'] and won.locator('.tally').inner_text() == '1 bateu · 1 anulada' and won.locator('.bf .odd').inner_text() == '1.80' and won.locator('.bf .was').inner_text() == 'era 4.05' and '+R$ 80,00' in won.locator('.bf').inner_text().replace('\xa0', ' '), won.inner_text())
    # nobody was copied here: the statement in units has the person's column alone, and the voided bet is in the money and out of the record
    pg.click('.tabbar [data-tab=carteira]')
    srow = lambda k: [re.sub(r'\s*\n\s*', ' | ', td.inner_text().replace('\xa0', ' ').strip()) for td in pg.locator(f'#stmtspans tr[data-k="{k}"] td').all()]
    check('with no tipster the statement has one column: the units, the record and the return of the person', [t.lower() for t in pg.locator('#stmtspans thead th').all_inner_texts()] == ['período', 'unidades'] and srow('all') == ['Geral | 2 apostas | +R$ 80,00', '+0,8u | 1V 0D | +53,3%'] and srow('7d') == ['7 dias | 2 apostas | +R$ 80,00', '+0,8u | 1V 0D | +53,3%'], (srow('all'), srow('7d')))
    check('and nothing about who is ahead', pg.locator('#stmt .ldot').count() == 0 and 'ponto dourado' not in txt('#stmthow') and pg.locator('#duel').count() == 0 and pg.locator('#stmtevents tbody tr').count() == 1, txt('#stmthow'))
    check('the statement fits the phone', pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') == 0)
    check('no script error in the draw', not errs, errs)
    PHASE['n'] = 0; ESPN['draw'] = None
    cov.stop(pg, 'settle-draw')
    ctx.close()

    # 7. the app opened in the middle of the card: the latest fights are read ahead only for who still has a fight to come
    PHASE['n'] = 2; logs = lambda: [re.search(r'/athletes/(\w+)/eventlog', u).group(1) for u in calls if '/eventlog' in u]; before = len(logs())
    ctx = b.new_context(viewport=dict(width=393, height=852), locale='pt-BR', timezone_id='America/Sao_Paulo')
    ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith('file:') else handle(r))
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    cov.start(pg)
    pg.goto((ROOT / 'dist' / 'index.html').as_uri()); pg.wait_for_function('window.__OL && window.__OL.S'); pg.wait_for_selector('.fight')
    pg.wait_for_function('Object.keys(window.__OL.D.form).length >= 2'); pg.wait_for_timeout(500)
    check('with the card half way, only the two of the fight still to come are read ahead', sorted(pg.evaluate('Object.keys(window.__OL.D.form)')) == ['301', '302'] and sorted(logs()[before:]) == ['301', '302'], (pg.evaluate('Object.keys(window.__OL.D.form)'), logs()[before:]))
    pg.evaluate('window.__OL.sync(true)'); pg.wait_for_timeout(500)
    check('and what was read is not asked for again at the next round', len(logs()) == before + 2, logs()[before:])
    check('no script error half way through the card', not errs, errs)
    PHASE['n'] = 0
    cov.stop(pg, 'settle-form')
    b.close()
print(f'{n}/{n} settlement checks passed')
