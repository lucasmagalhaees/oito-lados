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

html, spec, readme = read('index.html'), read('CLAUDE.md'), read('README.md')
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
    if rel.endswith('...'):
        continue                      # branch-name patterns such as docs/...
    check('documented path exists', (ROOT / rel).exists(), rel)

# 4. numbers quoted in the spec are the numbers in the code: (regex over index.html, text that must be in CLAUDE.md)
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
    (r'D\.finalSeen\[f\.id\] > 120e3 \|\| now - f\.date > 6 \* H', '2 min depois de a luta aparecer como encerrada (ou 6 h depois do horário)'),
    (r'now - f\.date > 2 \* DAY && D\.results\[f\.id\]\) D\.results\[f\.id\]\.tdUnavailable = true', 'Sem estatística por 2 dias: anula'),
    (r'Date\.now\(\) > l\.date \+ 36 \* H', 'anula 36 h depois do horário'),
    (r'res\.time === 150\) return \'void\'', 'exatamente 2:30 anula'),
]
for pattern, text in CONSTANTS:
    check('code still has the documented constant', re.search(pattern, html), pattern)
    check('spec still states the constant', text in spec, text)

# 5. selection keys: the table in the spec, the settlement switch and the combo predicates name the same families
doc_keys = set(re.findall(r'^\| `(\w+):', spec, re.M))
settle = set(re.findall(r"case '(\w+)':", html[html.index('function legOutcome'):html.index('function betResult')]))
preds = set(re.findall(r"case '(\w+)':", html[html.index('function pred(q)'):html.index('const tdOk')])) | {'td', 'tda'}
priced = set(re.findall(r"id: '(\w+)', cat:", html))
check('spec key table matches settlement', doc_keys == settle, f'{sorted(doc_keys)} vs {sorted(settle)}')
check('settlement matches combo predicates', settle == preds, f'{sorted(settle)} vs {sorted(preds)}')
check('every priced market can be settled', priced == settle, f'{sorted(priced)} vs {sorted(settle)}')

# 6. storage keys and API hosts
for key in ('oitolados.v1', 'oitolados.cache.v1'):
    check('storage key in code and spec', f"'{key}'" in html and f'`{key}`' in spec, key)
for base in re.findall(r'`(?:SITE|CORE) = (https://[^`]+)`', spec):
    check('API base in code', base in html, base)
check('spec documents both API bases', len(re.findall(r'`(?:SITE|CORE) = https://', spec)) == 2)

# 7. the expected end-to-end balance is the same everywhere it is quoted
balances = {rel: set(re.findall(r'R\$ 1\.\d{3},\d{2}', read(rel))) for rel in ('CLAUDE.md', 'tests/e2e.py', 'docs/verificacao.md')}
asserts = re.findall(r"== '(R\$ [\d.,]+)', bal\(\)", read('tests/e2e.py'))
check('e2e asserts a final balance', bool(asserts))
final = asserts[-1] if asserts else None      # the last balance assertion is the end-of-card one
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
check('vercel.json pins a static deployment', vercel.get('framework', 0) is None and vercel.get('installCommand') == '', vercel)
check('deployment ships no test code', 'tests' in read('.vercelignore').split())
check('weekly live contract workflow exists', 'contract_live.py' in read('.github/workflows/espn-contract.yml'))

for f in fails:
    print('FAIL', f)
print(f'{n - len(fails)}/{n} documentation claims hold')
sys.exit(1 if fails else 0)
