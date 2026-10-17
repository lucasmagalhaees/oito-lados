// Runs once a day, called by the Vercel cron (vercel.json): one small query to the database, so the free Supabase
// project does not pause for lack of use. The app does not depend on it: with the project paused, the data stays on each
// device and only the syncing stops (D98). Only the cron may call it: Vercel sends CRON_SECRET in `Authorization`.
import { CLOUD_KEY, CLOUD_URL, cloudHeaders, cloudSet } from '../src/core/cloud';

declare const process: { env: Record<string, string | undefined> };

/** The answer of one run. Exported for tests/keepalive.mjs, which runs it with the network replaced. */
export async function keepalive(request: Request, env: Record<string, string | undefined>, call: typeof fetch, url = CLOUD_URL, key = CLOUD_KEY): Promise<Response> {
  const secret = env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false }, { status: 401 });
  if (!cloudSet(url, key)) return Response.json({ ok: false, why: 'projeto não configurado' }, { status: 503 });
  try {
    const r = await call(`${url}/rest/v1/rpc/keepalive`, { method: 'POST', headers: cloudHeaders(key, null), body: '{}' });
    return Response.json({ ok: r.ok, status: r.status }, { status: r.ok ? 200 : 502 });
  } catch (e) {
    return Response.json({ ok: false, why: 'sem resposta do banco' }, { status: 502 });
  }
}

export default {
  fetch(request: Request): Promise<Response> { return keepalive(request, process.env, fetch); }
};
