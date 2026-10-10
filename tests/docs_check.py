"""Docs-versus-code check: what the documentation states must be true of the repository.

Usage: python3 tests/docs_check.py
Documentation written from memory drifts. This script pins the claims that can be checked mechanically: links, listed
files, constants, selection keys, storage keys, API hosts and the expected test balance. No browser, no network.
"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
read = lambda rel: (ROOT / rel).read_text(encoding='utf-8')
fails, n = [], 0

def check(name, cond, detail=''):
    global n
    n += 1
    if not cond:
        fails.append(f'{name}{": " + str(detail) if detail else ""}')

SRC = sorted((ROOT / 'src').rglob('*.ts'))
src_of = lambda rel: (ROOT / 'src' / rel).read_text(encoding='utf-8')
# the code the documentation talks about: every TypeScript module, in a stable order, plus the page skeleton
html = '\n'.join(p.read_text(encoding='utf-8') for p in SRC) + '\n' + read('index.html')
spec, readme = read('CLAUDE.md'), read('README.md')
MD = [p for p in ROOT.rglob('*.md') if '.git/' not in p.as_posix() and 'node_modules' not in p.as_posix()]

# 1. every relative link in every markdown file points at something that exists
for md in MD:
    for target in re.findall(r'\]\(([^)\s]+)\)', md.read_text(encoding='utf-8')):
        if re.match(r'^(https?:|mailto:|#)', target):
            continue
        path = (md.parent / target.split('#')[0]).resolve()
        check(f'link in {md.relative_to(ROOT)}', path.exists(), target)

# 2. every path in the README "Estrutura" block exists
block = re.search(r'## Estrutura\s+```\n(.*?)```', readme, re.S)
check('README has an "Estrutura" block', bool(block))
for line in (block.group(1).splitlines() if block else []):
    rel = line.split()[0] if line.strip() else ''
    if rel:
        check('README lists a path that exists', (ROOT / rel).exists(), rel)

# 3. files the spec names in backticks exist
for rel in set(re.findall(r'`((?:tests|docs|scripts|\.github|\.claude)/[\w./-]+)`', spec + readme + read('CONTRIBUTING.md'))):
    if rel.endswith('...') or rel.startswith('tests/shots') or rel.startswith('tests/.build'):
        continue                      # branch-name patterns such as docs/..., and output that only exists after a test run
    check('documented path exists', (ROOT / rel).exists(), rel)

# 4. numbers quoted in the spec are the numbers in the code: (regex over src/, text that must be in CLAUDE.md)
CONSTANTS = [
    (r'const MARGIN = 1\.07;', 'Margens: 7%'),
    (r'const COMBO_MARGIN = 1\.10;', '10% nas combinadas'),
    (r'clamp\(r2\(1 / \(p \* MARGIN\)\), 1\.02, 51\)', 'limites 1,02 a 51'),
    (r'COMBO_MARGIN\)\), 1\.02, 301\)', 'limite 301'),
    (r'p > 0\.97 \* Math\.min', 'acima de 97%'),
    (r'let g = 0\.7;', 'padrão 0,7'),
    (r'b\[2\] \* 0\.88', 'decisão ×0,88'),
    (r'nbPmf\(ra \* mins / 15, 1\.6, K\)', 'dispersão 1,6'),
    (r'clamp\(x\.tdAvg, 0\.15, 5\) : \(x && x\.tdAvg === 0\) \? 0\.5 : 0\.9', '[0,15; 5]; 0 vira 0,5; ausente vira 0,9'),
    (r'live \? 15e3 : night \? 30e3 : 120e3', '15 s com luta ao vivo, 30 s em noite de evento, 120 s no resto'),
    (r'D\.oddsAt\[eid\] \|\| 0\) < 5 \* 60e3', 'no máximo a cada 5 min'),
    (r'now - 4 \* DAY', 'placar de 4 dias atrás'),
    (r'now \+ 16 \* DAY', 'até 16 dias à frente'),
    (r'export const TD_FREEZE = 120e3;', '2 min depois de a luta aparecer como encerrada (ou 6 h depois do horário)'),
    (r'D\.finalSeen\[f\.id\] > TD_FREEZE \|\| now - f\.date > 6 \* H', '2 min depois de a luta aparecer como encerrada (ou 6 h depois do horário)'),
    (r'settling\(now\) \? 8e3 : live', '8 s enquanto uma aposta aberta espera por uma luta que já acabou'),
    (r'D\.finalSeen\[f\.id\] \|\| now\) > 30 \* 60e3', 'por até 30 min'),
    (r'export const UNKNOWN_AFTER = DAY;', 'Por 1 dia'),
    (r'Date\.now\(\) - D\.lastSync > 5e3', 'há mais de 5 s'),
    (r'now - f\.date > 2 \* DAY && D\.results\[f\.id\]\) D\.results\[f\.id\]\.tdUnavailable = true', 'Sem estatística por 2 dias: anula'),
    (r'Date\.now\(\) > l\.date \+ 36 \* H', 'anula 36 h depois do horário'),
    (r'end\.time === 150\) return \'void\'', 'exatamente 2:30 anula'),
    (r'const UNIT_PCT_DEFAULT = 10;', 'O padrão é 10% da banca'),
    (r'clamp\(r2\(n\), 0\.1, 100\)', 'de 0,1% a 100%'),
    (r'\[0\.5, 1, 2, 3\]\.map\(u =>', 'atalhos de 0,5u, 1u, 2u e 3u'),
    (r"const CUR: Record<Currency, string> = \{ BRL: 'Real', USD: 'Dólar', EUR: 'Euro' \};", 'BRL, USD ou EUR'),
    (r'\.slice\(0, 2\);\n\}\nexport function parseMoney', 'no máximo duas casas'),
    (r'const CASHOUT_MARGIN = 0\.05;', 'margem de 5%'),
    (r'\[10, 50, 100\]\.map\(v => `<button data-act="stq"', '+10, +50, +100,'),
    (r'\[10000, 100000, 1000000\]\.map\(v => `<button data-act="stq"', '+10.000, +100.000 e +1.000.000'),
    (r'\[100, 500, 1000, 5000\]\.map\(v => `<button data-act="depq"', '100, 500, 1.000 e 5.000'),
    (r'\[10000, 100000, 1000000\]\.map\(v => `<button data-act="depq"', '10.000, 100.000 e 1.000.000 na segunda'),
    (r'v > 1e9', 'máximo de 1 bilhão por depósito'),
    (r'FX_TTL = 12 \* 3600e3;', 'depois de 12 h'),
    (r"\.slice\(-20\);\n    setStakeMoney\(0\);", 'as 20 últimas'),
]
for pattern, text in CONSTANTS:
    check('code still has the documented constant', re.search(pattern, html), pattern)
    check('spec still states the constant', text in spec, text)

# 5. selection keys: the table in the spec, the settlement switch and the combo predicates name the same families
doc_keys = set(re.findall(r'^\| `(\w+):', spec, re.M))
settlement = src_of('core/settlement.ts')
settle = set(re.findall(r"case '(\w+)':", settlement[settlement.index('function legOutcome'):settlement.index('function betResult')]))
pricing = src_of('core/pricing.ts')
preds = set(re.findall(r"case '(\w+)':", pricing[pricing.index('function pred('):pricing.index('const tdOk')])) | {'td', 'tda'}
priced = set(re.findall(r"id: '(\w+)', cat:", pricing))
check('spec key table matches settlement', doc_keys == settle, f'{sorted(doc_keys)} vs {sorted(settle)}')
check('settlement matches combo predicates', settle == preds, f'{sorted(settle)} vs {sorted(preds)}')
check('every priced market can be settled', priced == settle, f'{sorted(priced)} vs {sorted(settle)}')

# 5b. bet statuses and cashout reasons: spec and code name the same ones
spec_status = set(re.search(r"status: ((?:'\w+'\|?)+), payout", spec).group(1).replace("'", '').split('|'))
code_status = set(re.findall(r"status(?: ===|:) '(\w+)'", html)) | {'open'}
check('bet statuses in the spec match the code', spec_status == code_status, f'{sorted(spec_status)} vs {sorted(code_status)}')
cash_fn = src_of('core/cashout.ts')
code_why = set(re.findall(r"why: '(\w+)'", cash_fn))
spec_why = set(re.findall(r'^\| `(\w+)` \| ', spec[spec.index('## Cashout'):spec.index('## Sincronização')], re.M))
spec_why.discard('why')                       # the table header
check('cashout reasons in the spec match the code', code_why == spec_why, f'{sorted(code_why)} vs {sorted(spec_why)}')
check('every cashout reason the user can hit has a message', all(f'{w}:' in src_of('app/cashout.ts')[src_of('app/cashout.ts').index('const CASH_WHY'):src_of('app/cashout.ts').index('const cashoutOf')] for w in code_why - {'closed'}))
check('with nothing decided the cashout is the stake', "if (!won) return { ok: true, kind: 'refund', value: bet.stake };" in cash_fn)
check('a market cashout never pays more than the bet could', 'Math.min(full, r2(full * prob * (1 - CASHOUT_MARGIN)))' in cash_fn)
check('spec documents both cashout kinds', "`kind: 'refund'`" in spec and "`kind: 'market'`" in spec)

# 5c. the image reader: versions pinned in the app match the local copies the tests use, and the integrity hash is the real one
import base64, hashlib
ocr = re.search(r"const OCR = \{ lib: '([\d.]+)', core: '([\d.]+)', data: '([\d.]+)' \};", html)
deps = json.loads(read('tests/package.json'))['dependencies']
check('app pins the OCR versions', bool(ocr))
if ocr:
    check('OCR versions in the app match tests/package.json', list(ocr.groups()) == [deps['tesseract.js'], deps['tesseract.js-core'], deps['@tesseract.js-data/por']], f'{ocr.groups()} vs {deps}')
    check('spec states the OCR version', f'Tesseract.js {ocr.group(1)}' in spec, ocr.group(1))
lib = ROOT / 'tests' / 'node_modules' / 'tesseract.js' / 'dist' / 'tesseract.min.js'
sri = re.search(r"const OCR_SRI = '(sha384-[^']+)';", html)
check('app carries an integrity hash for the OCR script', bool(sri))
if lib.exists() and sri:
    real = 'sha384-' + base64.b64encode(hashlib.sha384(lib.read_bytes()).digest()).decode()
    check('integrity hash matches the pinned OCR file', real == sri.group(1), f'{real} vs {sri.group(1)}')
# 5d. copied bets follow the one setting for stakes; nothing asks what a unit is worth to whoever made the print
check('the stake of a copied bet is decided by the money-or-units setting', "Core.tipStake(st, S.stakeIn, w.unit)" in html and "mode === 'units'" in html and '`Core.tipStake(stake, S.stakeIn, unidade)`' in spec)
check('the unit of whoever made the print is not asked for or stored', not re.search(r'srcUnit|tipCfg|TIP_MODES|tipsrc', html) and 'não é perguntado' in spec)
# 5d1. copying bets: what the reader calls a multiple, what it reports as unread, and the care the batch takes
legs = re.search(r"const LEGS[^=]*= \{([^}]*)\}", html)
legs = dict((k, int(v)) for k, v in re.findall(r"(\w+): (\d)", legs.group(1))) if legs else {}
check('the words for a multiple of N are the ones the spec lists', legs == {'dupla': 2, 'tripla': 3, 'quadrupla': 4, 'quintupla': 5, 'sextupla': 6} and '"Dupla", "tripla", "quádrupla", "quíntupla" e "sêxtupla" são múltiplas de 2 a 6' in spec, legs)
why = re.search(r"const TIP_WHY[^\n]*= \{\n(.*?)\n\};", html, re.S)
why_codes = re.findall(r"^  (\w+): ", why.group(1), re.M) if why else []
spec_codes = re.findall(r'`(\w+)`', spec[spec.index('**O que não foi lido**'):spec.index('**Cupom de múltipla costuma')])
check('the reasons a tip was not read are the same in the code, the types and the spec', why_codes == ['empty', 'nofight', 'ambiguous', 'nomarket', 'short'] and spec_codes[1:] == why_codes and "code: 'empty' | 'nofight' | 'ambiguous' | 'nomarket' | 'short'" in html, (why_codes, spec_codes))
imp_src = read('src/app/import.ts'); batch = imp_src[imp_src.index('export async function placeAll'):imp_src.index('export function dropOp')]
check('several pictures can be chosen at once', 'id="impfile" accept="image/*" multiple' in imp_src)
check('the batch re-reads the source before writing, and writes nothing if it cannot or if something moved', batch.index('await recheck(') < batch.index('writeBets(') and batch.index("stamp(now) !== stamp(before)") < batch.index('writeBets(') and 'Sem conexão com a ESPN' in batch)
check('the batch prices each bet with the arithmetic of the slip', 'slipCalc()' in batch and '`slipCalc`' in spec)
check('the slip and the batch write bets through the same function', read('src/app/render.ts').count('writeBets(') == 2 and batch.count('writeBets(') == 1)

# 5d1b. completing, editing, origin and the printed odd
check('a bet goes in the batch only with a value the original states or the person typed', "ts.value >= 1 && ts.how !== 'default'" in imp_src and 'veio do original ou foi digitado' in spec)
check('only a list that says neither value nor kind fills in other bets by itself', "o.res.stake.kind === 'default' && o.res.kind === null && !o.stake" in imp_src and 'não diz valor nem tipo de aposta' in spec)
check('lists that disagree fill in nothing', 'size !== 1) continue;' in imp_src and 'Se duas listas discordam, nada é preenchido sozinho' in spec)
check('pictures are numbered, not named after their files', '`Foto ${++photoSeq}`' in imp_src and '"Foto 1"' in spec)
check('a copied bet keeps its origin and the printed odds', "{ from: copy.from }" in html and "{ printed: copy!.bet }" in html and "{ printed: p }" in html and all(w in spec for w in ('`from`', '`printed`', '`slip.copy`')))
check('the odd of the whole bet is only kept for the same selections', 'sameBet && copy!.bet' in html and 'ainda são exatamente as do original' in spec)
check('a slip started by hand, emptied or repeated is not a copy', html.count('slip.copy = null') >= 6)
check('the printed odd is compared in the core, with tests', 'export function printedEdge' in html and 'export function edgeSummary' in html and 'export function completeTip' in html and 'Core.printedEdge' in read('tests/unit.cases.mjs') and 'Core.completeTip' in read('tests/unit.cases.mjs'))
check('the wallet breaks results down by origin', "'Sem origem'" in html and 'por origem' in spec)

# 5d1c. warnings before the batch, corrections, origins, period and what closed since last time
hist = read('src/core/history.ts'); rnd = read('src/app/render.ts'); unit_src = read('tests/unit.cases.mjs')
check('a warning keeps a bet out of the batch until the person says so', "const held = (dups.length > 0 || !!twin || low) && !o.force;" in imp_src and "&& !held;" in imp_src and 'sem aviso pendente' in spec and '"Apostar mesmo assim"' in spec)
check('the odd floor offers what the spec says, and is off until chosen', '[0, 3, 5, 10].map(' in rnd and 'x === 3 || x === 5 || x === 10' in html and 'entre desligada, 3%, 5% e 10%' in spec and "copyDrop?: 3 | 5 | 10" in html)
check('the odd floor is a setting: kept by a reset and by a backup', "isDrop(o.copyDrop) ? { copyDrop: o.copyDrop }" in html and '`unitPct`, `stakeIn`, `theme`, `corners` e `copyDrop`' in spec)
check('only open bets make a bet "already placed"', "const open = bets.filter(b => b.status === 'open');" in hist and 'Aposta encerrada não conta' in spec)
check('the period of 30 days goes by when the bet closed', "(b.settledAt || 0) > now - 30 * 24 * 3600e3" in hist and '30 dias conta pela data em que a aposta fechou' in spec)
check('the three periods are the ones the spec names', "{ all: 'Tudo', '30d': '30 dias', event: 'Último evento' }" in rnd and all(w in spec for w in ('"Tudo"', '"30 dias"', '"Último evento"')))
check('a cashout is not in "since last time"', "(b.status === 'won' || b.status === 'lost' || b.status === 'void') && (b.settledAt || 0) > t" in hist and 'Cashout fica de fora' in spec)
check('what closed is acknowledged by saving the moment', rnd.count('data-act="sinceok"') == 1 and "S.seen = Date.now(); saveS();" in read('src/app/events.ts') and '`S.seen`' in spec)
check('an old state does not announce its whole history', "if (!(Number(S.seen) > 0)) S.seen = Date.now();" in html and 'recebe o instante da carga' in spec)
check('without a new name an origin is not renamed', "if (!from || !name || name === from) return { bets, n: 0 };" in hist and 'sem nome novo nada muda' in spec)
check('an odd with a colon needs one digit before it, the end of the line and no date', r"oddColon: /(?:^|\s)(\d)[:;](\d{2,3})\s*$/" in html and 'TIP.date.test(line) ? null' in html and 'com um dígito antes dos dois-pontos' in spec)
check('the questions asked of the history have tests', all(('Core.' + f) in unit_src for f in ('selSig', 'dupBets', 'exposure', 'copyDrop', 'byOrigin', 'renameOrigin', 'periodBets', 'sinceSummary')))
check('a bet against an open one is told by the joint model', 'p.J.prob([...mine, ...h.keys]) < 1e-9' in html and 'não têm desfecho em comum' in spec)

# 5d1d. the core tested without a browser, the folded list, open bets by event, units by origin
core_run = read('tests/core.mjs'); verify_sh = read('scripts/verify.sh')
check('the two runners of the core read the same cases', "'unit.cases.mjs'" in read('tests/unit.py') and "from './unit.cases.mjs'" in core_run and '`tests/unit.cases.mjs`' in spec)
check('the core is run without a browser on every verify, quick or full', 'run core     node tests/core.mjs' in verify_sh and verify_sh.index('run core     node tests/core.mjs') < verify_sh.index('run e2e-dark') and 'node tests/core.mjs' in spec)
check('the Node runner traps what only a page has, as the spec says', "for (const name of ['window', 'document', 'localStorage', 'fetch'])" in core_run and '`window`, `document`, `localStorage` e `fetch`' in spec)
check('the Node runner builds the core by itself with the tool that builds the app', "entry: path.join(root, 'src', 'core', 'index.ts')" in core_run and "from 'vite'" in core_run and 'tests/.build/' in read('.gitignore'))
check('an item of the copy list starts folded when it is ready or a reference', "if (o.open == null) o.open = !(r.whole || r.ref);" in imp_src and 'o que está pronto, ou é só referência, vem recolhido' in spec)
check('open bets by event and the units of an origin have tests', 'Core.openByEvent' in unit_src and 'r.units' in unit_src and '`Core.openByEvent`' in spec)
check('units by origin use the unit each bet was placed with', "r.units += (b.payout - b.stake) / b.unit" in hist)

# 5d1e. settling: a winner pick by the mark on the scoreboard, an unknown result name kept pending, the real names seen
settle_src = read('src/core/settlement.ts'); api_src = read('src/app/api.ts')
check('a winner pick is settled by the scoreboard mark, and a no contest that was read still voids it', "if (m === 'ml' && f.state === 'post' && f.winner && !(end && end.method === 'nc')) return f.winner === p1 ? 'won' : 'lost';" in settle_src and 'sem esperar o método' in spec)
check('a result under an unknown name is not taken as final while it is fresh', "if (r && (r.method !== 'unknown' || now - f.date > UNKNOWN_AFTER))" in api_src and 'não anula nada' in spec)
check('the settlement test holds answers back, and is part of the full verify', "ESPN['noresult'] = True" in read('tests/settle.py') and "ESPN['resname'] = dict(" in read('tests/settle.py') and 'run settle    python3 tests/settle.py' in read('scripts/verify.sh') and '`tests/settle.py`' in spec)
check('the live check sweeps the result names of finished fights', 'every result name seen in ${swept} finished fights is one the app classifies' in read('tests/contract_live.py') and 'tko---doctors-stoppage' in spec)
check('the result names the spec lists as seen are ones the reader classifies', all(re.search(pat, nm) for nm, pat in (('kotko', 'ko'), ('decision---unanimous', 'dec'), ('decision---split', 'dec'), ('submission', 'sub'), ('dq', 'dq'), ('tko---doctors-stoppage', 'ko|stoppage'))) and "/ko|dq|disq|stoppage|retire/" in html)

# 5d1f. copying follows the setting to the letter; the suggestion for long multiples; the steps of the units field; the paste button
tip_src = read('src/core/tip.ts'); money_src = read('src/core/money.ts')
check('in units an original that states no units is one unit, and its money is not copied', "if (mode === 'units') return { how: 'one', units: 1, value: r2(u) };" in tip_src and 'aposta **1u**: o dinheiro do print não é copiado' in spec)
check('the one unit the setting gives counts as a stated value for the batch; the presumed one does not', "ts.how !== 'default' && !held;" in imp_src and 'conta como valor dito' in spec)
check('a long multiple is five selections or more, and what is suggested for it is 0.2u to 0.4u', 'export const LONG_MULTI = 5;' in money_src and 'export const LONG_STAKES = [0.2, 0.3, 0.4];' in money_src and 'cinco seleções ou mais' in spec and '0,2u, 0,3u e 0,4u' in spec)
check('the suggestion is offered in the slip and in the copy list, and fills nothing in by itself', 'id="slipsug"' in rnd and 'impsug' in imp_src and 'nada é preenchido sozinho' in spec)
check('the units field steps by half a unit, in the slip and in the copy list', 'next * 0.5' in money_src and 'data-act="ustep"' in rnd and 'data-act="impstep"' in imp_src and 'meia unidade seguinte ou anterior' in spec)
check('the paste button reads text only, and says so when it cannot', 'navigator.clipboard.readText()' in imp_src and 'data-act="imppaste"' in imp_src and '`navigator.clipboard.readText`' in spec)
check('the stake rule, the suggestion and the steps have tests', all(w in unit_src for w in ("how: 'one'", 'Core.suggestedUnits', 'Core.stepUnits')))

# 5d1g. return and gain: what comes back and what is won, said in money and in units wherever money at stake is shown
rend_src = read('src/app/render.ts'); help_src = read('src/app/helpers.ts')
check('the totals of open bets have tests and are in the spec', 'Core.openTotals' in unit_src and '`Core.openTotals`' in spec and 'openTotals' in read('src/core/index.ts'))
check('the gain is the return less the stake, each bet by the unit it was placed with', "t.gainUnits += (ret - b.stake) / b.unit" in hist and "t.gain = r2(t.ret - t.stake)" in hist and 'ganho é o retorno menos a stake' in spec)
check('every event and everything open get the same totals, and an open bet says its gain', rend_src.count('totalsHtml(') == 3 and "totalsHtml(Core.openTotals(open), 'opentot')" in rend_src and '<small>Ganho se bater</small>' in rend_src and '"Tudo em aberto"' in spec and '"Ganho se bater"' in spec)
check('the slip and the copy list say the gain too, priced the way the slip prices', 'id="slipgain"' in rend_src and 'id="impgain"' in imp_src and 'class="impgain"' in imp_src and 'export function payoutOf' in help_src and 'payoutOf(' in imp_src and '`payoutOf`' in spec)
check('the wallet and the fight card say the units at stake', 'id="heropot"' in rend_src and "ex.unitBets ? ' · ' + fu(ex.units) : ''" in rend_src and '"N apostas · R$ X · Yu"' in spec)

# 5d2. corner colours: the pairs the settings offer are the ones the stylesheet draws and the spec names
css_all = (ROOT / 'src' / 'styles.css').read_text(encoding='utf-8')
pairs = re.findall(r"\{ id: '([a-z-]+)', a: '(\w+)', b: '(\w+)' \}", html)
check('three corner pairs, red and blue first', [p[0] for p in pairs] == ['red-blue', 'green-pink', 'purple-orange'], pairs)
for pid, a, b in pairs:
    short = ''.join(w[0] for w in pid.split('-'))
    check('corner pair has its colours in both themes and its swatches', css_all.count(f'--{short}-a:') == 3 and css_all.count(f'--{short}-b:') == 3 and f'.sw.{pid}.a' in css_all and f'.sw.{pid}.b' in css_all, pid)
    check('corner pair is drawn when chosen', pid == 'red-blue' or f'[data-corners="{pid}"]{{--ca:var(--{short}-a);--cb:var(--{short}-b)}}' in css_all, pid)
    check('corner pair is named in the spec', f'`{pid}`' in spec and f'{a} e {b}' in spec, (pid, a, b))
check('red and blue is the pair in use until another is chosen', '--ca:var(--rb-a); --cb:var(--rb-b);' in css_all)
check("women's fights are told by the weight class", "/^W /.test(" in html and 'começando com "W "' in spec)
check('settings are listed once, for reset and restore', html.count('...settingsOf(') == 2 and '`settingsOf`' in spec)
check('units field limits are the documented ones', ".slice(0, 4);" in html and 'no máximo 9999,99' in spec)
side_fn = re.search(r"const sideOf = [^\[]*\[([^\]]+)\]\.includes", html)
check('fighter-side families in the code are the ones the spec names', bool(side_fn) and [x.strip(" '") for x in side_fn.group(1).split(',')] == ['ml', 'mov', 'wr', 'tda'] and '(`ml`, `mov`, `wr` e `tda`;' in spec)
check('production check waits and then holds for the documented time', "os.environ.get('OL_PROD_HOLD', 300)" in read('scripts/check_production.py') and 'continua olhando por 5 min' in spec)
check('production check reads the stamp the build writes', 'name="ol-commit"' in read('scripts/check_production.py'))
check('production workflow runs the check on pushes to main', 'scripts/check_production.py' in read('.github/workflows/producao.yml') and 'branches: [main]' in read('.github/workflows/producao.yml'))
check('verify.sh self-tests the production check', 'check_production.py --selftest' in read('scripts/verify.sh'))
fxs = sorted(p.name for p in (ROOT / 'tests' / 'fixtures' / 'fx').glob('*.json'))
check('every recorded exchange-rate sample is listed in its README', bool(fxs) and all(f'`{n}`' in read('tests/fixtures/fx/README.md') for n in fxs), fxs)
check('verify.sh enforces the coverage minimums the spec states', '--min-functions 95 --min-chars 90' in read('scripts/verify.sh') and '95% das funções' in spec and '90% do código' in spec)

# 5e. the build: one self-contained page, exact versions, strict types, and a host that builds the same way
pkg = json.loads(read('package.json'))
check('build tools are pinned to exact versions', all(re.fullmatch(r'\d+\.\d+\.\d+', v) for v in pkg['devDependencies'].values()), pkg['devDependencies'])
check('spec states the versions of the build tools', all(f'{name} {v}' in spec for name, v in (('Vite', pkg['devDependencies']['vite']), ('TypeScript', pkg['devDependencies']['typescript']))), pkg['devDependencies'])
check('there is a lockfile for the build tools', (ROOT / 'package-lock.json').exists())
tsconfig = json.loads(read('tsconfig.json'))
check('TypeScript runs in strict mode', tsconfig['compilerOptions'].get('strict') is True and tsconfig['compilerOptions'].get('noUnusedLocals') is True, tsconfig['compilerOptions'])
check('no module opts out of type checking', not any(re.search(r'@ts-(nocheck|ignore|expect-error)', p.read_text(encoding='utf-8')) for p in SRC))
check('the core never touches the page, the network or storage', not any(re.search(r'\b(document|window|localStorage|fetch)\b', p.read_text(encoding='utf-8')) for p in SRC if '/core/' in p.as_posix()), [p.name for p in SRC if '/core/' in p.as_posix() and re.search(r'\b(document|window|localStorage|fetch)\b', p.read_text(encoding='utf-8'))])
vite = read('vite.config.js')
check('the build ships unminified, as the spec says', 'minify: false' in vite and 'sem minificar' in spec)
check('the page carries the commit it was built from', '<meta name="ol-commit" content="__OL_COMMIT__">' in read('index.html') and 'VERCEL_GIT_COMMIT_SHA' in vite and '`<meta name="ol-commit">`' in spec)
check('dist/ is built, not committed', 'dist/' in read('.gitignore').split())
check('every documented source module exists', all((ROOT / 'src' / m).exists() for m in re.findall(r'`src/([\w/.-]+\.ts)`', spec)), [m for m in re.findall(r'`src/([\w/.-]+\.ts)`', spec) if not (ROOT / 'src' / m).exists()])
check('every source module is documented', all(f'`src/{p.relative_to(ROOT / "src").as_posix()}`' in spec for p in SRC), [p.relative_to(ROOT / 'src').as_posix() for p in SRC if f'`src/{p.relative_to(ROOT / "src").as_posix()}`' not in spec])

# 5f. themes: the dark palette is written twice in the stylesheet (device asks for it / person chose it) and must not drift
css = (ROOT / 'src' / 'styles.css').read_text(encoding='utf-8')
auto_dark = re.search(r'@media \(prefers-color-scheme: dark\)\{\s*:root:not\(\[data-theme="light"\]\)\{(.*?)\}\s*\}', css, re.S)
forced_dark = re.search(r':root\[data-theme="dark"\]\{(.*?)\}', css, re.S)
norm = lambda m: sorted(x.strip() for x in m.group(1).replace('\n', ' ').split(';') if x.strip()) if m else None
check('the dark palette is the same whether the device or the person asks for it', norm(auto_dark) is not None and norm(auto_dark) == norm(forced_dark), (norm(auto_dark), norm(forced_dark)))
light_vars = set(re.findall(r'(--[\w-]+):', re.search(r':root\{(.*?)\}', css, re.S).group(1)))
dark_vars = set(re.findall(r'(--[\w-]+):', forced_dark.group(1))) if forced_dark else set()
check('every colour of the dark theme exists in the light one', dark_vars <= light_vars, sorted(dark_vars - light_vars))
check('the colours the page sets on the browser bars are the theme backgrounds', "'#0e1218'" in html and "'#f2f3f5'" in html and '--bg:#0e1218' in css and '--bg:#f2f3f5' in css)

# 5g. the service worker: what it keeps, what it never keeps, and how the page learns about a new version
sw = read('src/sw.js')
kept = re.search(r"const ASSET_HOSTS = \[([^\]]*)\]", sw)
kept = re.findall(r"'([^']+)'", kept.group(1)) if kept else []
check('the hosts the worker keeps files from are the ones the spec lists', kept == ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'] and all(f'`{h}`' in spec for h in kept), kept)
check('the worker never names ESPN or the exchange-rate service as something to keep', not re.search(r"'[^']*(espn|frankfurter)[^']*'", sw))
check('every file the page loads from another address comes from a kept host', set(re.findall(r'(?:href|src)="https://([^/"]+)/', read('index.html'))) <= set(kept) and 'https://cdn.jsdelivr.net/' in html)
check('the cache names in the spec are the ones in the worker', "'oito-lados-page-' + VERSION" in sw and "'oito-lados-assets-v1'" in sw and '`oito-lados-page-<versão>`' in spec and '`oito-lados-assets-v1`' in spec)
check('the build stamps the worker with a version and emits it next to the page', sw.count("'__OL_APP_VERSION__'") == 1 and "replace('__OL_APP_VERSION__', version)" in vite and "fileName: 'sw.js'" in vite)
check('the worker version leaves the commit stamp out', "replace(/<meta name=\"ol-commit\"[^>]*>/, '')" in vite and 'sem o carimbo de commit' in spec)
check('a new version waits for the person', 'skipWaiting' in sw and sw.count('skipWaiting') == 1 and "event.data === 'activate'" in sw and "postMessage('activate')" in html)
check('how often the page looks for a new version', 'const CHECK_EVERY = 30 * 60e3;' in html and 'a cada 30 min' in spec)
check('the worker is only registered on the published page', "import.meta.env.PROD" in read('src/app/update.ts') and "register('./sw.js')" in html)
check('the host publishes the worker too', 'src' not in read('.vercelignore').split() and json.loads(read('vercel.json'))['outputDirectory'] == 'dist')
check('verify.sh runs the offline test', 'python3 tests/pwa.py' in read('scripts/verify.sh'))

# 6. storage keys and API hosts
for key in ('oitolados.v1', 'oitolados.cache.v1', 'oitolados.fx.v1'):
    check('storage key in code and spec', f"'{key}'" in html and f'`{key}`' in spec, key)
for base in re.findall(r'`(?:SITE|CORE) = (https://[^`]+)`', spec):
    check('API base in code', base in html, base)
check('spec documents both API bases', len(re.findall(r'`(?:SITE|CORE) = https://', spec)) == 2)
fx_url = re.search(r"const FX_URL = '(https://[^']+)'", html)
check('exchange-rate address is the same in the app, the spec and the live check', bool(fx_url) and f'`{fx_url.group(1)}`' in spec and fx_url.group(1) in read('tests/contract_live.py'), fx_url and fx_url.group(1))

# 7. the expected end-to-end balance is the same everywhere it is quoted
balances = {rel: set(re.findall(r'R\$ 1\.\d{3},\d{2}', read(rel))) for rel in ('CLAUDE.md', 'tests/e2e.py', 'docs/verificacao.md')}
end = re.search(r"print\('final balance', bal\(\)\)\n\s*assert bal\(\)\.replace\([^)]*\) == '(R\$ [\d.,]+)'", read('tests/e2e.py'))
check('e2e asserts the balance at the end of the card', bool(end))
final = end.group(1) if end else None
for rel, found in balances.items():
    check(f'{rel} quotes the asserted balance', final in found, f'{final} not in {found}')

# 8. recorded API samples: listed in their README, valid JSON, and their real names never leak into the invented fixture
fx = ROOT / 'tests' / 'fixtures' / 'espn'
fx_readme = (fx / 'README.md').read_text(encoding='utf-8')
real_names = set()
for p in sorted(fx.glob('*.json')):
    check('recorded sample is listed in its README', f'`{p.name}`' in fx_readme, p.name)
    try:
        data = json.loads(p.read_text(encoding='utf-8'))
        real_names |= set(re.findall(r'"displayName": "([^"]+ [^"]+)"', json.dumps(data, ensure_ascii=False))) - {'KO/TKO'}
    except ValueError as e:
        check('recorded sample is valid JSON', False, f'{p.name}: {e}')
for name in re.findall(r'`(\w+\.json)`', fx_readme):
    check('README lists a sample that exists', (fx / name).exists(), name)
mock = read('tests/mock_espn.py')
people = {x for x in real_names if not re.search(r'Decision|Takedown|Accuracy|Slams', x)}
check('found the real names in the samples', len(people) >= 4, people)
for name in people:
    check('invented fixture does not use a real fighter', name not in mock and name.split()[-1] not in mock, name)

# 9. the verification register keeps both halves, and the harness files it relies on are in place
ver = read('docs/verificacao.md')
check('verification register has "Verificado"', '## Verificado' in ver)
check('verification register has "Não verificado"', '## Não verificado' in ver)
settings = json.loads(read('.claude/settings.json'))
cmds = [h.get('command', '') for g in settings.get('hooks', {}).get('Stop', []) for h in g.get('hooks', [])]
check('Stop hook is configured', any('verify-on-stop.sh' in c for c in cmds), cmds)
check('Stop hook script exists', (ROOT / '.claude/hooks/verify-on-stop.sh').exists())
check('CI runs the quick verification', 'scripts/verify.sh --quick' in read('.github/workflows/ci.yml'))
vercel = json.loads(read('vercel.json'))
check('vercel.json builds with the same commands as everywhere else', vercel.get('framework') == 'vite' and vercel.get('installCommand') == 'npm ci' and vercel.get('buildCommand') == 'npm run build' and vercel.get('outputDirectory') == 'dist', vercel)
check('deployment ships no test code', 'tests' in read('.vercelignore').split())
check('weekly live contract workflow exists', 'contract_live.py' in read('.github/workflows/espn-contract.yml'))

for f in fails:
    print('FAIL', f)
print(f'{n - len(fails)}/{n} documentation claims hold')
sys.exit(1 if fails else 0)
