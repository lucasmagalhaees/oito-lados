// The daily routine (api/keepalive.ts), run in Node with the network replaced: who may call it, what it asks of the
// database, and what it answers when the database does not.
//   node tests/keepalive.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { build } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'tests', '.build', 'api');
await build({ root, configFile: false, logLevel: 'silent', build: { outDir, emptyOutDir: true, minify: false, target: 'node22', lib: { entry: path.join(root, 'api', 'keepalive.ts'), formats: ['es'], fileName: () => 'keepalive.mjs' } } });
const mod = await import(pathToFileURL(path.join(outDir, 'keepalive.mjs')).href);

const fails = []; let n = 0;
const eq = (name, got, want) => { n++; if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); };
const URL = 'https://abcdefghijkl.supabase.co', KEY = 'sb_publishable_abcdefghijklmnop';
const req = auth => new Request('https://oito-lados.vercel.app/api/keepalive', { headers: auth ? { authorization: auth } : {} });
const env = { CRON_SECRET: 'segredo-de-teste-123456' };
let asked = [];
const db = status => async (url, init) => { asked.push([url, init.method, init.headers.apikey, init.headers.Authorization || null]); if (status === 'down') throw new TypeError('fetch failed'); return new Response('1', { status }); };
const run = async (auth, e, call, url = URL, key = KEY) => { asked = []; const r = await mod.keepalive(req(auth), e, call, url, key); return [r.status, await r.json(), asked]; };

eq('without the secret, nobody is let in and the database is not asked', await run(null, env, db(200)), [401, { ok: false }, []]);
eq('with a wrong secret, neither', await run('Bearer outro', env, db(200)), [401, { ok: false }, []]);
eq('with no secret configured, nobody is let in', await run('Bearer ', {}, db(200)), [401, { ok: false }, []]);
eq('the cron: one call to the routine of the database, with the publishable key and no token', await run('Bearer segredo-de-teste-123456', env, db(200)), [200, { ok: true, status: 200 }, [[URL + '/rest/v1/rpc/keepalive', 'POST', KEY, null]]]);
eq('the database answering with an error: the run says so', (await run('Bearer segredo-de-teste-123456', env, db(503))).slice(0, 2), [502, { ok: false, status: 503 }]);
eq('the database out of reach: the run says so, without breaking', (await run('Bearer segredo-de-teste-123456', env, db('down'))).slice(0, 2), [502, { ok: false, why: 'sem resposta do banco' }]);
eq('a project not configured yet: nothing is asked', await run('Bearer segredo-de-teste-123456', env, db(200), 'https://PROJETO.supabase.co', 'sb_publishable_PROJETO'), [503, { ok: false, why: 'projeto não configurado' }, []]);
const shipped = (await import('node:fs')).readFileSync(path.join(root, 'src', 'core', 'cloud.ts'), 'utf8');
const [pUrl, pKey] = ['CLOUD_URL', 'CLOUD_KEY'].map(n => shipped.match(new RegExp(`export const ${n} = '([^']*)';`))[1]);
eq('as it ships: the project of src/core/cloud.ts is the one asked, with its publishable key', await (async () => { asked = []; const r = await mod.keepalive(req('Bearer segredo-de-teste-123456'), env, db(200)); return [r.status, asked]; })(),
  pUrl ? [200, [[pUrl + '/rest/v1/rpc/keepalive', 'POST', pKey, null]]] : [503, []]);
eq('the handler Vercel calls', typeof mod.default.fetch, 'function');
for (const f of fails) console.log('FAIL', f);
console.log(`${n - fails.length}/${n} keep-alive checks passed`);
process.exit(fails.length ? 1 : 0);
