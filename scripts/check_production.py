#!/usr/bin/env python3
"""Is production serving the index.html of this commit?

Usage: python3 scripts/check_production.py            strict: wait for production to match index.html and to stay matched
       python3 scripts/check_production.py --report   only say which commit of this branch production is serving
       python3 scripts/check_production.py --selftest check this script against a local server (no internet)

Why this exists: on 09/10/2026 four pull requests were merged within a minute. The host built one deployment per merge
and the oldest one finished last, so the production address went back to the oldest version while every check was green.
Strict mode therefore does not stop at the first match: it keeps looking for a while, because the wrong deployment can
arrive after the right one.

Exit codes: 0 production matches (or --report); 1 it does not; 3 inconclusive (production could not be reached).
Environment: OL_PROD_URL, OL_PROD_WAIT (seconds to wait for the first match), OL_PROD_HOLD (seconds it must stay matched).
"""
import hashlib, os, pathlib, subprocess, sys, time, urllib.error, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = os.environ.get('OL_PROD_URL', 'https://oito-lados.vercel.app/')
AGENT = 'oito-lados-production-check/1.0 (+https://github.com/lucasmagalhaees/oito-lados)'
sha = lambda data: hashlib.sha256(data).hexdigest()


def fetch(url):
    """sha256 of what the address serves, or None when it cannot be read."""
    req = urllib.request.Request(url, headers={'User-Agent': AGENT, 'Cache-Control': 'no-cache', 'Accept': 'text/html'})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return sha(r.read())
    except (urllib.error.URLError, OSError, ValueError):
        return None


def annotate(level, text):
    if os.environ.get('GITHUB_ACTIONS') == 'true':
        print(f'::{level} title=Produção::' + ' '.join(str(text).split()))


def history(limit=40):
    """(commit, sha256 of its index.html) for the latest commits that touched the file, newest first."""
    try:
        commits = subprocess.run(['git', 'log', f'-n{limit}', '--format=%H', '--', 'index.html'], cwd=ROOT, capture_output=True, text=True, check=True).stdout.split()
    except (subprocess.CalledProcessError, OSError):
        return []
    out = []
    for c in commits:
        blob = subprocess.run(['git', 'show', f'{c}:index.html'], cwd=ROOT, capture_output=True)
        if blob.returncode == 0:
            out.append((c, sha(blob.stdout)))
    return out


def which_commit(served):
    for n, (c, h) in enumerate(history()):
        if h == served:
            return f'commit {c[:7]}' + (' (o mais recente que mexeu no index.html)' if n == 0 else f', {n} versão(ões) do index.html atrás')
    return 'uma versão que não está entre as 40 últimas deste branch'


def strict(url, want, wait, hold, step, say=print):
    """0 when production matches `want` and stays so for `hold` seconds; 1 when it never does or goes back; 3 unreachable."""
    start, seen = time.time(), False
    while time.time() - start < wait:
        got = fetch(url)
        seen = seen or got is not None
        if got == want:
            break
        time.sleep(step)
    else:
        if not seen:
            say(f'inconclusivo: não consegui ler {url}')
            return 3
        say(f'produção não chegou à versão deste commit em {int(wait)} s. Está servindo {which_commit(fetch(url))}.')
        return 1
    say(f'produção bate com o index.html deste commit ({want[:12]}). Conferindo se continua assim por {int(hold)} s.')
    end = time.time() + hold
    while time.time() < end:
        time.sleep(min(step, max(0.0, end - time.time())))
        got = fetch(url)
        if got is not None and got != want:
            say(f'produção VOLTOU para outra versão: {which_commit(got)}. Um deploy mais antigo terminou depois do mais novo.')
            return 1
    say('produção continua na versão deste commit.')
    return 0


def selftest():
    import http.server, threading
    state = {'body': b'v1', 'down': False}

    class H(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            if state['down']:
                self.send_response(503); self.end_headers(); return
            self.send_response(200); self.send_header('Content-Length', str(len(state['body']))); self.end_headers(); self.wfile.write(state['body'])
        def log_message(self, *a):
            pass

    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url, quiet, fails, n = f'http://127.0.0.1:{srv.server_address[1]}/', (lambda *_: None), [], 0

    def check(name, got, want):
        nonlocal n
        n += 1
        if got != want:
            fails.append(f'{name}: got {got}, want {want}')

    def later(delay, **change):
        threading.Timer(delay, lambda: state.update(change)).start()

    state.update(body=b'new', down=False)
    check('matches and stays', strict(url, sha(b'new'), 1, 0.4, 0.05, quiet), 0)
    state.update(body=b'old'); later(0.2, body=b'new')
    check('the new version arrives a little later', strict(url, sha(b'new'), 2, 0.3, 0.05, quiet), 0)
    state.update(body=b'new'); later(0.3, body=b'old')
    check('an older deployment takes over after the match', strict(url, sha(b'new'), 1, 1.0, 0.05, quiet), 1)
    state.update(body=b'old')
    check('never reaches the new version', strict(url, sha(b'new'), 0.3, 0.3, 0.05, quiet), 1)
    state.update(down=True)
    check('unreachable is inconclusive, not a failure', strict(url, sha(b'new'), 0.3, 0.3, 0.05, quiet), 3)
    check('unreachable address reads as None', fetch(url), None)
    state.update(down=False, body=b'new'); later(0.15, down=True); later(0.35, down=False)
    check('a blip while holding does not fail the check', strict(url, sha(b'new'), 1, 0.6, 0.05, quiet), 0)
    hist = history()
    check('the history of index.html is a list of commits and hashes', all(len(c) == 40 and len(h) == 64 for c, h in hist), True)
    srv.shutdown()
    for f in fails:
        print('FAIL', f)
    print(f'{n - len(fails)}/{n} production-check cases behave')
    return 1 if fails else 0


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        sys.exit(selftest())
    want = sha((ROOT / 'index.html').read_bytes())
    if '--report' in sys.argv:
        got = fetch(URL)
        if got is None:
            msg = f'inconclusivo: não consegui ler {URL}'
        elif got == want:
            msg = 'produção já serve o index.html deste commit.'
        else:
            msg = f'produção serve {which_commit(got)}. Este commit ainda não está no ar (normal num PR).'
        print(msg); annotate('notice', msg)
        sys.exit(0)

    def say(text):
        print(text, flush=True)
    code = strict(URL, want, float(os.environ.get('OL_PROD_WAIT', 420)), float(os.environ.get('OL_PROD_HOLD', 300)), 20, say)
    if code == 1:
        annotate('error', 'A produção não está servindo o index.html da main. Na Vercel, promova o deploy do commit mais recente da main (ou faça um novo merge). Veja "Publicação" no CLAUDE.md.')
    elif code == 3:
        annotate('warning', f'Inconclusivo: não consegui ler {URL} daqui.')
    sys.exit(code)
