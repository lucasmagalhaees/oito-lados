import { Core } from '../core';
import { blurField, dTime, esc } from './format';
import { render, toast } from './render';
import { LS, S, adoptS, onSave, saveS } from './state';
import type { AppState, Json } from '../core';

/* ================= the same bankroll on two devices =================
   A copy of the state goes to the server (Supabase: login by a code sent by e-mail, and one row per person, which only
   that person can read or write). This device stays the source of what it shows: everything keeps working with the
   server out of reach, only the syncing stops, and it catches up when the server is back. The two copies are joined
   by `Core.mergeStates`. Calls go straight from the page to the server; the server function of this project only keeps
   the database awake (api/keepalive.ts). */
const URL = Core.CLOUD_URL, KEY = Core.CLOUD_KEY;
export const cloudOn = (): boolean => Core.cloudSet(URL, KEY);
/** How long a call to the server may take, and how long after a save the copy is sent (saves come in bursts). */
export const CLOUD_TIMEOUT = 15000, SYNC_AFTER = 2000;

/** The session on this device: who, the tokens, and whether this device has already been joined with the server copy. */
interface Session { email: string; uid: string; access: string; refresh: string; exp: number; linked?: boolean }
// read at the first use, not while the modules load: src/app/state.ts imports this module, so LS is not ready yet here
let loaded = false, session: Session | null = null;
function sess(): Session | null {
  if (!loaded) { loaded = true; const s = LS.get('oitolados.auth.v1'); session = s && s.access && s.refresh && s.uid ? s as Session : null; }
  return session;
}
const keep = (): void => { LS.set('oitolados.auth.v1', session); };
export const signedIn = (): boolean => !!sess();

/** What the card shows: the step of the login, the e-mail being used, the last sync, and a message. */
export const cloud: { step: 'email' | 'code'; email: string; busy: boolean; msg: string; at: number; err: string; ask: { here: { bets: number; deposits: number }; there: { bets: number; deposits: number } } | null; remote: AppState | null } =
  { step: 'email', email: '', busy: false, msg: '', at: 0, err: '', ask: null, remote: null };

class CloudError extends Error { constructor(public status: number, message: string) { super(message); } }
async function call(path: string, init: { method?: string; body?: unknown; token?: string | null; prefer?: string }): Promise<Json> {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), CLOUD_TIMEOUT);
  const headers = Core.cloudHeaders(KEY, init.token || null);
  if (init.prefer) headers.Prefer = init.prefer;
  try {
    const r = await fetch(URL + path, { method: init.method || 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body), signal: ctl.signal, cache: 'no-store' });
    const text = await r.text();
    let j: Json = null; try { j = text ? JSON.parse(text) : null; } catch (e) { /* an answer that is not JSON */ }
    if (!r.ok) throw new CloudError(r.status, (j && (j.msg || j.message || j.error_description || j.error)) || `HTTP ${r.status}`);
    return j;
  } finally { clearTimeout(t); }
}
function takeSession(j: Json, email: string): void {
  if (!j || !j.access_token || !j.refresh_token || !j.user || !j.user.id) throw new CloudError(0, 'resposta sem sessão');
  const exp = Number(j.expires_at) > 0 ? Number(j.expires_at) * 1000 : Date.now() + (Number(j.expires_in) || 3600) * 1000;
  session = { email: j.user.email || email, uid: String(j.user.id), access: j.access_token, refresh: j.refresh_token, exp, linked: session && session.uid === String(j.user.id) ? session.linked : false };
  keep();
}
/** A token that is still good, renewed when it is about to expire. Null, and the session is dropped, when the server
 *  no longer accepts it: the data on this device stays, only the syncing stops until the person logs in again. */
async function token(): Promise<string | null> {
  if (!sess() || !session) return null;
  if (Date.now() < session.exp - Core.TOKEN_MARGIN) return session.access;
  try { takeSession(await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh } }), session.email); return session.access; }
  catch (e) { if (e instanceof CloudError && (e.status === 400 || e.status === 401 || e.status === 403)) { session = null; keep(); cloud.err = 'A sessão expirou. Entra de novo para voltar a sincronizar.'; } throw e; }
}

/* ---- login: a code sent by e-mail, typed in the app ---- */
export async function sendCode(email: string): Promise<void> {
  email = email.trim();
  if (!Core.isEmail(email)) { cloud.msg = 'Digita um e-mail válido.'; render(); return; }
  cloud.busy = true; cloud.msg = ''; cloud.err = ''; blurField(); render();
  try {
    await call('/auth/v1/otp', { method: 'POST', body: { email, create_user: true } });
    cloud.step = 'code'; cloud.email = email; cloud.msg = `Mandei um código para ${email}. Pode levar um minuto para chegar.`;
  } catch (e) { cloud.msg = e instanceof CloudError && e.status === 429 ? 'Muitos pedidos de código. Espera um pouco e tenta de novo.' : 'Não deu para mandar o código agora. Confere a internet e tenta de novo.'; }
  finally { cloud.busy = false; render(); }
}
export async function checkCode(code: string): Promise<void> {
  if (!Core.isCode(code)) { cloud.msg = 'O código tem 6 números.'; render(); return; }
  cloud.busy = true; cloud.msg = ''; blurField(); render();
  try {
    takeSession(await call('/auth/v1/verify', { method: 'POST', body: { type: 'email', email: cloud.email, token: Core.cleanCode(code) } }), cloud.email);
    cloud.step = 'email'; cloud.msg = '';
    cloud.busy = false; await syncNow();
    return;
  } catch (e) { cloud.msg = e instanceof CloudError && (e.status === 400 || e.status === 401 || e.status === 403) ? 'Código errado ou vencido. Confere ou pede outro.' : 'Não deu para conferir o código agora. Tenta de novo.'; }
  cloud.busy = false; render();
}
export function backToEmail(): void { cloud.step = 'email'; cloud.msg = ''; render(); }
/** Leaves the server: the tokens go, the data on this device stays as it is. */
export async function signOut(): Promise<void> {
  const cur = sess(), t = cur && Date.now() < cur.exp ? cur.access : null;
  session = null; keep(); cloud.ask = null; cloud.remote = null; cloud.at = 0; cloud.err = ''; cloud.msg = ''; render(); toast('Saiu. O que está neste aparelho continua aqui.');
  if (t) call('/auth/v1/logout?scope=local', { method: 'POST', token: t }).catch(() => { /* the token expires by itself */ });
}

/* ---- the copy on the server ---- */
async function pull(t: string): Promise<AppState | null> {
  const rows = await call(`/rest/v1/states?select=data&user_id=eq.${encodeURIComponent(session!.uid)}`, { token: t });
  const d = Array.isArray(rows) && rows[0] ? rows[0].data : null;
  return d && Array.isArray(d.bets) && Array.isArray(d.deposits) ? d as AppState : null;
}
async function push(t: string, state: AppState): Promise<void> {
  await call('/rest/v1/states?on_conflict=user_id', { method: 'POST', token: t, prefer: 'resolution=merge-duplicates,return=minimal', body: { user_id: session!.uid, data: state, updated_at: new Date().toISOString() } });
}
const isEmpty = (s: AppState): boolean => !s.bets.length && !s.deposits.length;

let timer: ReturnType<typeof setTimeout> | undefined, running: Promise<void> | null = null, again = false, quiet = false;
/** A save happened: the copy goes to the server a moment later, once the burst of saves is over. */
export function queueSync(): void {
  if (!cloudOn() || !sess()) return;
  clearTimeout(timer); timer = setTimeout(() => { syncNow(); }, SYNC_AFTER);
}
/** Joins this device with the server copy and sends the result back. One at a time: a sync asked for during another
 *  runs once that one is done. Out of reach, nothing changes here, and the message says so. */
export function syncNow(): Promise<void> {
  if (!cloudOn() || !sess()) return Promise.resolve();
  if (running) { again = true; return running; }
  running = (async () => {
    try {
      cloud.busy = true; render();
      const t = await token(); if (!t) return;
      const remote = await pull(t);
      if (!remote) { await push(t, S); session!.linked = true; keep(); }
      else if (!session!.linked && !isEmpty(S) && !isEmpty(remote) && !Core.sameState(S, remote)) {
        // the first time this device meets a copy that has a history of its own: the person chooses
        cloud.ask = { here: Core.stateSize(S), there: Core.stateSize(remote) }; cloud.remote = remote;
        return;
      } else {
        const j = Core.mergeStates(S, remote);
        if (!Core.sameState(j.state, S)) adoptS(j.state);
        if (!Core.sameState(j.state, remote)) await push(t, j.state);
        if (!session!.linked) { session!.linked = true; keep(); }
        if (j.dropped && !quiet) toast(`${j.dropped} ${j.dropped === 1 ? 'item ficou' : 'itens ficaram'} de fora: o outro aparelho zerou, restaurou ou trocou a moeda depois.`);
      }
      cloud.at = Date.now(); cloud.err = '';
    } catch (e) {
      if (!cloud.err || session) cloud.err = 'Sem conexão com o servidor. O que está aqui continua salvo, e sincroniza quando ele voltar.';
    } finally {
      cloud.busy = false; running = null; quiet = false; render();
      if (again) { again = false; queueSync(); }
    }
  })();
  return running;
}
/** The first meeting of this device with a server copy that has its own history: join both, keep this one, or keep that one. */
export async function resolveFirst(choice: 'join' | 'here' | 'there'): Promise<void> {
  const remote = cloud.remote; if (!sess() || !session || !remote) return;
  cloud.ask = null; cloud.remote = null;
  if (choice === 'there') adoptS(remote);
  else if (choice === 'here') { S.epoch = Date.now(); saveS(); clearTimeout(timer); quiet = true; }        // a rewrite: this history wins as a whole, here and on the other device
  session.linked = true; keep();
  await syncNow();
}

/** Syncs when the app comes back to the front, and once when it opens. */
export function initCloud(): void {
  if (!cloudOn()) return;
  onSave(queueSync);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
  syncNow();
}

/* ---- the card on the wallet screen ---- */
export function cloudHtml(): string {
  if (!cloudOn()) return '';
  let h = '<section class="card" id="cloud"><span class="label">Sincronizar aparelhos</span>';
  if (!sess() || !session) {
    h += '<p class="hint">Entra com o seu e-mail para ter a mesma banca e as mesmas apostas no celular e no computador. O que está neste aparelho continua aqui, com ou sem conexão.</p>';
    h += cloud.step === 'email'
      ? `<div class="field"><span>E-mail</span><input id="cloudemail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" maxlength="120" placeholder="voce@email.com" value="${esc(cloud.email)}" aria-label="Seu e-mail"></div><button class="btn block" data-act="cloudsend" ${cloud.busy ? 'disabled' : ''}>${cloud.busy ? 'Mandando…' : 'Mandar código'}</button>`
      : `<div class="field"><span>Código</span><input id="cloudcode" inputmode="numeric" autocomplete="one-time-code" maxlength="12" placeholder="6 números" aria-label="Código que chegou por e-mail"></div><div class="rowbtns"><button class="btn" data-act="cloudcheck" ${cloud.busy ? 'disabled' : ''}>${cloud.busy ? 'Conferindo…' : 'Entrar'}</button><button class="btn ghost" data-act="cloudback">Outro e-mail</button></div>`;
  } else if (cloud.ask) {
    const n = (x: { bets: number; deposits: number }): string => `${x.bets} ${x.bets === 1 ? 'aposta' : 'apostas'} e ${x.deposits} ${x.deposits === 1 ? 'depósito' : 'depósitos'}`;
    h += `<p id="cloudask"><b>Este aparelho e o servidor têm históricos diferentes.</b> Aqui: ${n(cloud.ask.here)}. No servidor: ${n(cloud.ask.there)}.</p>
      <button class="btn block" data-act="cloudfirst" data-c="join">Juntar os dois</button>
      <div class="rowbtns"><button class="btn ghost" data-act="cloudfirst" data-c="here">Ficar com o deste aparelho</button><button class="btn ghost" data-act="cloudfirst" data-c="there">Ficar com o do servidor</button></div>
      <p class="hint">Juntar soma as apostas e os depósitos dos dois. Ficar com um apaga o outro, aqui e no servidor; antes, vale salvar um backup.</p>`;
  } else {
    h += `<p class="hint" id="cloudstatus">Entrou como <b>${esc(session.email)}</b>. ${cloud.busy ? 'Sincronizando…' : cloud.at ? `Sincronizado às ${dTime.format(cloud.at)}.` : 'Ainda não sincronizou nesta abertura.'}</p>`;
    h += `<div class="rowbtns"><button class="btn ghost" data-act="cloudsync" ${cloud.busy ? 'disabled' : ''}>Sincronizar agora</button><button class="btn ghost" data-act="cloudout">Sair</button></div>`;
  }
  if (cloud.err) h += `<p class="msg" id="clouderr">${esc(cloud.err)}</p>`;
  if (cloud.msg) h += `<p class="hint" id="cloudmsg">${esc(cloud.msg)}</p>`;
  return h + '</section>';
}
/** Keeps the e-mail typed, so a repaint does not lose it. */
export function typedEmail(v: string): void { cloud.email = v; }
