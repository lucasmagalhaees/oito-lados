"""Live check of the Supabase project in src/core/cloud.ts: is it up, does it take e-mail logins, was supabase/schema.sql
run, and do its rules hold for someone not logged in?

Usage: python3 tests/cloud_live.py          (calls the real project; needs a network that reaches it)
       python3 tests/cloud_live.py --mock   (self-test of this script against a local imitation)

Only reads, and one write that must be refused. It never creates an account or logs in. Every call
carries the production site as Origin, and the answers are checked for the CORS header the page needs.

Exit codes: 0 all hold, 1 a check failed, 3 inconclusive (this machine could not reach the project at all).
"""
import http.server, json, pathlib, re, sys, threading, urllib.error, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
ORIGIN = 'https://oito-lados.vercel.app'
src = (ROOT / 'src' / 'core' / 'cloud.ts').read_text(encoding='utf-8')
URL, KEY = (re.search(rf"export const {n} = '([^']*)';", src).group(1) for n in ('CLOUD_URL', 'CLOUD_KEY'))


def call(base, path, method='GET', body=None, extra=None):
    h = {'apikey': KEY, 'Origin': ORIGIN, 'User-Agent': 'oito-lados-cloud-check (+https://github.com/lucasmagalhaees/oito-lados)'}
    if body is not None: h['Content-Type'] = 'application/json'
    h.update(extra or {})
    req = urllib.request.Request(base + path, method=method, headers=h, data=None if body is None else json.dumps(body).encode())
    try:
        with urllib.request.urlopen(req, timeout=20) as r: status, hdr, text = r.status, r.headers, r.read().decode()
    except urllib.error.HTTPError as e: status, hdr, text = e.code, e.headers, e.read().decode()
    try: j = json.loads(text) if text else None
    except ValueError: j = None
    return status, (hdr.get('access-control-allow-origin') or ''), j, text[:300]


def run(base):
    checks = []
    ok = lambda name, cond, detail='': checks.append((name, bool(cond), str(detail)[:300]))
    cors = lambda acao: acao in ('*', ORIGIN)
    try: st, acao, j, raw = call(base, '/auth/v1/settings')
    except (urllib.error.URLError, OSError) as e: return None, f'sem resposta do projeto: {e}'
    ok('the project answers, and accepts calls from the production site', st == 200 and cors(acao), f'HTTP {st}, CORS {acao!r}: {raw}')
    ok('login by e-mail is on', isinstance(j, dict) and (j.get('external') or {}).get('email') is True, raw)
    # sign-ups may be on (the accounts are being made) or off (they exist): either is right, so this is only told
    if isinstance(j, dict): print('info: contas novas ' + ('aceitas' if j.get('disable_signup') is False else 'recusadas') + ' ("Allow new users to sign up")')
    ok('no e-mail confirmation is asked ("Confirm email" off): an account works as soon as it is created', isinstance(j, dict) and j.get('mailer_autoconfirm') is True, raw)
    st, acao, j, raw = call(base, '/auth/v1/token?grant_type=password', 'OPTIONS', extra={'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'apikey,content-type'})
    ok('the browser may log in from the page (CORS preflight)', st in (200, 204) and cors(acao), f'HTTP {st}, CORS {acao!r}')
    st, acao, j, raw = call(base, '/rest/v1/states?select=user_id&limit=1')
    schema = not (st == 404 or (isinstance(j, dict) and j.get('code') in ('PGRST205', '42P01')))
    ok('the table exists (supabase/schema.sql was run)', schema, f'HTTP {st}: {raw}')
    ok('not logged in, no row is seen', st == 200 and j == [] and cors(acao), f'HTTP {st}: {raw}')
    st, acao, j, raw = call(base, '/rest/v1/states', 'POST', {'user_id': '00000000-0000-0000-0000-000000000000', 'data': {}}, {'Prefer': 'return=minimal'})
    ok('not logged in, nothing is written', st in (401, 403), f'HTTP {st}: {raw}')
    # the latest fights each person keeps (D103): not logged in, the table refuses both reading and writing
    st, acao, j, raw = call(base, '/rest/v1/form_cache?select=athlete&limit=1')
    ok('the table of the latest fights exists (the form_cache part of supabase/schema.sql was run)', not (st == 404 or (isinstance(j, dict) and j.get('code') in ('PGRST205', '42P01'))), f'HTTP {st}: {raw}')
    ok('not logged in, no latest fights are seen', st in (401, 403) or (st == 200 and j == []), f'HTTP {st}: {raw}')
    st, acao, j, raw = call(base, '/rest/v1/form_cache', 'POST', {'user_id': '00000000-0000-0000-0000-000000000000', 'athlete': '1', 'data': {}, 'fetched_at': '2026-01-01T00:00:00Z'}, {'Prefer': 'return=minimal'})
    ok('not logged in, no latest fights are written', st in (401, 403), f'HTTP {st}: {raw}')
    st, acao, j, raw = call(base, '/rest/v1/rpc/keepalive', 'POST', {})
    ok('the routine of the daily cron answers, and as anon it counts no row', st == 200 and j == 0, f'HTTP {st}: {raw}')
    return checks, None


class Imitation(http.server.BaseHTTPRequestHandler):
    """What a project with the schema run answers, for --mock."""
    def log_message(self, *a): pass
    def send(self, status, body=None):
        self.send_response(status); self.send_header('Access-Control-Allow-Origin', '*'); self.send_header('Content-Type', 'application/json'); self.end_headers()
        if body is not None: self.wfile.write(json.dumps(body).encode())
    def do_GET(self):
        if self.headers.get('apikey') != KEY: return self.send(401, {'message': 'no key'})
        if self.path == '/auth/v1/settings': return self.send(200, {'external': {'email': True}, 'disable_signup': False, 'mailer_autoconfirm': True})
        if self.path.startswith('/rest/v1/states'): return self.send(200, [])
        if self.path.startswith('/rest/v1/form_cache'): return self.send(401, {'code': '42501', 'message': 'permission denied'})
        self.send(404, {})
    def do_OPTIONS(self): self.send(204)
    def do_POST(self):
        self.rfile.read(int(self.headers.get('Content-Length') or 0))
        if self.path in ('/rest/v1/states', '/rest/v1/form_cache'): return self.send(401, {'code': '42501', 'message': 'permission denied'})
        if self.path == '/rest/v1/rpc/keepalive': return self.send(200, 0)
        self.send(404, {})


def main():
    if '--mock' in sys.argv:
        srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Imitation); threading.Thread(target=srv.serve_forever, daemon=True).start()
        checks, _ = run(f'http://127.0.0.1:{srv.server_address[1]}')
        Imitation.do_GET_real = Imitation.do_GET
        Imitation.do_GET = lambda self: self.send(404, {'code': 'PGRST205', 'message': 'no table'}) if self.path.startswith('/rest/v1/states') or self.path.startswith('/rest/v1/form_cache') else Imitation.do_GET_real(self)
        before, _ = run(f'http://127.0.0.1:{srv.server_address[1]}')
        bad = [c for c in checks if not c[1]]
        caught = [c[0] for c in before if not c[1]]
        ok = not bad and 'the table exists (supabase/schema.sql was run)' in caught and any('form_cache' in c for c in caught)
        _, unreachable = run('http://127.0.0.1:9')
        ok = ok and unreachable is not None
        print(f"self-test: {len(checks) - len(bad)}/{len(checks)} against the imitation, a missing table caught ({', '.join(caught)}), an unreachable project inconclusive")
        sys.exit(0 if ok else 1)
    if not URL or not KEY:
        print('cloud: nenhum projeto em src/core/cloud.ts'); sys.exit(3)
    checks, unreachable = run(URL)
    if unreachable:
        print(f'::warning title=cloud::{unreachable}'); print(unreachable); sys.exit(3)
    for name, good, detail in checks:
        print(('ok    ' if good else 'FALHA ') + name + ('' if good else f' — {detail}'))
        if not good: print(f'::error title=cloud::{name}: {detail}')
    bad = sum(1 for c in checks if not c[1])
    print(f'{len(checks) - bad}/{len(checks)} checagens do projeto {URL}')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
