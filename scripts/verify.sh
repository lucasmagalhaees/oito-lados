#!/usr/bin/env bash
# One command that answers "is this still correct?".
#   scripts/verify.sh           types + build + docs + unit + contract + production-check self-test + end-to-end (both themes) + code coverage minimums
#   scripts/verify.sh --quick   types + build + docs + unit + contract + production-check self-test (a few seconds; what the Stop hook runs)
# Every test runs against dist/index.html, the page the build produces and the one that ships.
# Exit: 0 all passed, 1 something failed, 3 test dependencies missing.
set -u
cd "$(dirname "$0")/.."

if ! python3 - <<'PY' 2>/dev/null
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    p.chromium.launch().close()
PY
then
  echo "verify: Playwright ou o Chromium dele não estão instalados (pip install -r tests/requirements.txt && playwright install chromium)" >&2
  exit 3
fi

if [ ! -x node_modules/.bin/vite ] || [ ! -x node_modules/.bin/tsc ]; then
  echo "verify: faltam as dependências do build (npm ci)" >&2
  exit 3
fi

full=1; [ "${1:-}" = "--quick" ] && full=0
if [ "$full" -eq 1 ]; then
  if [ ! -f tests/node_modules/tesseract.js/dist/tesseract.min.js ]; then
    echo "verify: faltam os arquivos do leitor de imagem usados pelo teste ponta a ponta (npm ci --prefix tests)" >&2
    exit 3
  fi
  rm -rf tests/.coverage
  export OL_COVERAGE=1          # the browser records which code each suite executes
fi

fail=0
run() {
  local name="$1"; shift
  local out
  if out="$("$@" 2>&1)"; then
    printf 'ok     %-10s %s\n' "$name" "$(printf '%s\n' "$out" | tail -n 1)"
  else
    fail=1
    printf 'FALHA  %-10s\n' "$name"
    printf '%s\n' "$out" | tail -n 25 | sed 's/^/         /'
    # on GitHub Actions the tail of the failing output also becomes an annotation, readable without opening the log
    if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
      printf '::error title=verify %s::%s\n' "$name" "$(printf '%s\n' "$out" | tail -n 12 | tr '\n' '|' | cut -c1-1800)"
    fi
  fi
}

run types    npm run --silent typecheck
run build    npm run --silent build
if [ "$fail" -ne 0 ]; then echo "verify: HÁ FALHAS no código ou no build; os testes não rodaram. Não declare que funciona."; exit 1; fi
run docs     python3 tests/docs_check.py
run unit     python3 tests/unit.py
run contract python3 tests/contract.py
run prod     python3 scripts/check_production.py --selftest
if [ "$full" -eq 1 ]; then
  run e2e-dark  python3 tests/e2e.py dark
  run e2e-light python3 tests/e2e.py light
  run coverage  python3 tests/cov.py --min-functions 95 --min-chars 90
fi

if [ "$fail" -eq 0 ]; then echo "verify: tudo passou"; else echo "verify: HÁ FALHAS. Não declare que funciona."; fi
exit "$fail"
