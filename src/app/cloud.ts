import { Core } from '../core';
import { blurField, dTime, esc } from './format';
import { render, toast } from './render';
import { LS, S, adoptS, onSave, saveS, settingsOf, validState } from './state';
import { isCurrency } from './format';
import type { AppState, Json } from '../core';

/* ================= the same bankroll on two devices =================
   A copy of the state goes to the server (Supabase: an account with e-mail and password, and one row per person, which only
   that person can read or write). This device stays the source of what it shows: everything keeps working with the
   server out of reach, only the syncing stops, and it catches up when the server is back. The two copies are joined
   by `Core.mergeStates`. Calls go straight from the page to the server; the server function of this project only keeps
   the database awake (api/keepalive.ts). */
const URL = Core.CLOUD_URL, KEY = Core.CLOUD_KEY;
export const cloudOn = (): boolean => Core.cloudSet(URL, KEY);
/** How long a call to the server may take, and how long after a save the copy is sent (saves come in bursts). */
export const CLOUD_TIMEOUT = 15000, SYNC_AFTER = 2000;

/** The session on this device: who, the tokens, and whether this device has already been joined with the server copy. */
interface Session { email: string; uid: string; access: string; refresh: string; exp: number }
// read at the first use, not while the modules load: src/app/state.ts imports this module, so LS is not ready yet here
let loaded = false, session: Session | null = null;
function sess(): Session | null {
  if (!loaded) { loaded = true; const s = LS.get('oitolados.auth.v1'); session = s && s.access && s.refresh && s.uid ? s as Session : null; }
  return session;
}
const keep = (): void => { LS.set('oitolados.auth.v1', session); };
export const signedIn = (): boolean => !!sess();
/* Which account this device's history was last joined with. Kept apart from the session, so leaving and coming back
   (or a session that expired) does not make the device meet the server "for the first time" again. */
const LINK = 'oitolados.link.v1';
const linked = (): boolean => !!session && LS.get(LINK) === session.uid;
const link = (): void => { if (session) LS.set(LINK, session.uid); };

/** What the card shows: the e-mail being typed, the last sync, and a message. */
export const cloud: { email: string; busy: boolean; msg: string; at: number; err: string; ask: { here: { bets: number; deposits: number }; there: { bets: number; deposits: number }; canJoin: boolean; curHere: string; curThere: string } | null; remote: AppState | null } =
  { email: '', busy: false, msg: '', at: 0, err: '', ask: null, remote: null };
// the password typed, kept only in memory while a login is tried, so a repaint does not empty the field; never stored
let pass = '';

class CloudError extends Error { constructor(public status: number, message: string, public code = '') { super(message); } }
async function call(path: string, init: { method?: string; body?: unknown; token?: string | null; prefer?: string }): Promise<Json> {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), CLOUD_TIMEOUT);
  const headers = Core.cloudHeaders(KEY, init.token || null);
  if (init.prefer) headers.Prefer = init.prefer;
  try {
    const r = await fetch(URL + path, { method: init.method || 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body), signal: ctl.signal, cache: 'no-store' });
    const text = await r.text();
    let j: Json = null; try { j = text ? JSON.parse(text) : null; } catch (e) { /* an answer that is not JSON */ }
    if (!r.ok) throw new CloudError(r.status, (j && (j.msg || j.message || j.error_description || j.error)) || `HTTP ${r.status}`, (j && (j.error_code || j.code)) || '');
    return j;
  } finally { clearTimeout(t); }
}
function takeSession(j: Json, email: string): void {
  if (!j || !j.access_token || !j.refresh_token || !j.user || !j.user.id) throw new CloudError(0, 'resposta sem sessão');
  const exp = Number(j.expires_at) > 0 ? Number(j.expires_at) * 1000 : Date.now() + (Number(j.expires_in) || 3600) * 1000;
  session = { email: j.user.email || email, uid: String(j.user.id), access: j.access_token, refresh: j.refresh_token, exp };
  keep();
}
/** A token that is still good, renewed when it is about to expire. Null, and the session is dropped, when the server
 *  no longer accepts it: the data on this device stays, only the syncing stops until the person logs in again. */
async function token(renew = false): Promise<string | null> {
  if (!sess() || !session) return null;
  if (!renew && Date.now() < session.exp - Core.TOKEN_MARGIN) return session.access;
  try { takeSession(await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh } }), session.email); return session.access; }
  catch (e) { if (e instanceof CloudError && (e.status === 400 || e.status === 401 || e.status === 403)) { session = null; keep(); cloud.err = 'A sessão expirou. Entra de novo para voltar a sincronizar.'; } throw e; }
}

/* ---- login: e-mail and password ----
   The free plan of Supabase keeps the e-mails it sends on its default text, which carries a link and no code (D100),
   and a link opened from the e-mail does not reach the app installed on the home screen of the iPhone. So: an account
   with e-mail and password, created in the app, and no e-mail sent at all ("Confirm email" off in the project). */
const LOGIN_WHY: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha errados. Se ainda não tem conta, toca em "Criar conta".',
  user_already_exists: 'Esse e-mail já tem conta. Toca em "Entrar", com a senha dela.',
  weak_password: `Senha fraca: usa pelo menos ${Core.MIN_PASSWORD} caracteres.`,
  email_not_confirmed: 'O servidor ainda pede confirmação por e-mail: no Supabase, desliga "Confirm email".',
  signup_disabled: 'O servidor não está aceitando contas novas.',
  over_request_rate_limit: 'Muitas tentativas. Espera um pouco e tenta de novo.'
};
/** Enters with an account (`in`) or creates one (`up`). The password is checked here first and only travels to the server. */
export async function signIn(mode: 'in' | 'up', email: string, password: string): Promise<void> {
  email = email.trim(); cloud.email = email; pass = password;
  if (!Core.isEmail(email)) { cloud.msg = 'Digita um e-mail válido.'; render(); return; }
  if (!Core.isPassword(password)) { cloud.msg = password.length < Core.MIN_PASSWORD ? `A senha tem pelo menos ${Core.MIN_PASSWORD} caracteres.` : 'Senha longa demais.'; render(); return; }
  cloud.busy = true; cloud.msg = ''; cloud.err = ''; blurField(); render();
  try {
    const j = await call(mode === 'up' ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
    // with confirmation on, a sign-up answers with the user and no session
    if (mode === 'up' && j && !j.access_token) throw new CloudError(200, 'no session', 'email_not_confirmed');
    takeSession(j, email);
    pass = ''; cloud.msg = ''; cloud.busy = false;
    await syncNow();
    return;
  } catch (e) {
    const code = e instanceof CloudError ? e.code : '';
    cloud.msg = LOGIN_WHY[code] || (e instanceof CloudError && e.status === 429 ? LOGIN_WHY.over_request_rate_limit : e instanceof CloudError && e.status ? `Não deu para ${mode === 'up' ? 'criar a conta' : 'entrar'} agora (${e.message}).` : 'Sem conexão com o servidor. Confere a internet e tenta de novo.');
  }
  cloud.busy = false; render();
}
/** Leaves the server: the tokens go, the data on this device stays as it is. */
export async function signOut(): Promise<void> {
  const cur = sess(), t = cur && Date.now() < cur.exp ? cur.access : null;
  session = null; keep(); pass = ''; cloud.ask = null; cloud.remote = null; cloud.at = 0; cloud.err = ''; cloud.msg = ''; render(); toast('Saiu. O que está neste aparelho continua aqui.');
  if (t) call('/auth/v1/logout?scope=local', { method: 'POST', token: t }).catch(() => { /* the token expires by itself */ });
}

/* ---- the copy on the server ---- */
/** A call with the person's token. A 401 from the database (a token it no longer takes, a device clock running late)
 *  renews the token once and tries again. */
async function authed(path: string, init: { method?: string; body?: unknown; prefer?: string } = {}): Promise<Json> {
  const t = await token(); if (!t) throw new CloudError(401, 'sem sessão');
  try { return await call(path, { ...init, token: t }); }
  catch (e) {
    if (!(e instanceof CloudError) || e.status !== 401) throw e;
    const again = await token(true); if (!again) throw e;
    return call(path, { ...init, token: again });
  }
}
/** The server copy, taken in with the same care as a backup: what is not a bet, a deposit or a conversion is dropped,
 *  so a damaged row never breaks the screen. Null when there is no row yet (or it is not a state at all). */
function cleanRemote(d: unknown): AppState | null {
  if (!validState(d)) return null;
  const n = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
  // only what the row has: a default filled in here would make the copy differ from the joined state, and be sent back on every sync
  const set = settingsOf(d); if (d.unitPct === undefined) delete set.unitPct;
  const out: AppState = {
    v: 1, ...set, ...(isCurrency(d.cur) ? { cur: d.cur } : {}),
    deposits: d.deposits.filter(x => x && n(x.v) > 0 && n(x.t) > 0),
    bets: d.bets.filter(x => x && typeof x.id === 'string' && Array.isArray(x.legs) && n(x.stake) > 0 && n(x.t) > 0)
  };
  if (Array.isArray(d.conv)) { const conv = d.conv.filter(c => c && isCurrency(c.from) && isCurrency(c.to) && n(c.rate) > 0 && n(c.t) > 0); if (conv.length) out.conv = conv.slice(-20); }
  for (const k of ['seen', 'epoch', 'setAt'] as const) if (n(d[k]) > 0) out[k] = n(d[k]);
  return out;
}
async function pull(): Promise<AppState | null> {
  const rows = await authed(`/rest/v1/states?select=data&user_id=eq.${encodeURIComponent(session!.uid)}`);
  return Array.isArray(rows) && rows[0] ? cleanRemote(rows[0].data) : null;
}
async function push(state: AppState): Promise<void> {
  await authed('/rest/v1/states?on_conflict=user_id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: { user_id: session!.uid, data: state, updated_at: new Date().toISOString() } });
}
/** Takes a joined state here when it differs, and sends it up when the server's differs. */
async function settle(j: AppState, remote: AppState | null): Promise<void> {
  if (!Core.sameState(j, S)) { adoptS(j); render(); }
  if (!remote || !Core.sameState(j, remote)) await push(j);
}

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
      if (!(await token())) return;
      const remote = await pull();
      if (!linked()) {
        // the first time this device meets this account's copy: a reset or a change of currency made here before
        // logging in never wipes the server (Core.firstMeet); when each side has something of its own, the person chooses
        const m = Core.firstMeet(S, remote);
        if (m.how === 'ask') { cloud.ask = { here: Core.stateSize(S), there: Core.stateSize(remote!), canJoin: m.canJoin, curHere: S.cur || 'BRL', curThere: remote!.cur || 'BRL' }; cloud.remote = remote; return; }
        await settle(m.how === 'push' ? S : m.how === 'adopt' ? remote! : Core.joinBoth(S, remote!).state, remote);
        link();
      } else if (!remote) await push(S);
      else {
        const j = Core.mergeStates(S, remote);
        await settle(j.state, remote);
        if (j.dropped && !quiet) toast(`${j.dropped} ${j.dropped === 1 ? 'item ficou' : 'itens ficaram'} de fora: um dos aparelhos zerou, restaurou ou trocou a moeda depois ${j.dropped === 1 ? 'dele' : 'deles'}.`);
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
  const canJoin = !!cloud.ask && cloud.ask.canJoin;
  cloud.ask = null; cloud.remote = null;
  if (choice === 'there') adoptS(remote);
  else if (choice === 'join' && canJoin) adoptS(Core.joinBoth(S, remote).state);
  // a rewrite past the server's: this history wins as a whole, here and on the other device
  else { S.epoch = Math.max(Date.now(), (remote.epoch || 0) + 1); saveS(); clearTimeout(timer); quiet = true; }
  link();
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
    h += `<div class="field"><span>E-mail</span><input id="cloudemail" type="email" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="120" placeholder="voce@email.com" value="${esc(cloud.email)}" aria-label="Seu e-mail"></div>
      <div class="field"><span>Senha</span><input id="cloudpass" type="password" autocomplete="current-password" maxlength="${Core.MAX_PASSWORD}" placeholder="pelo menos ${Core.MIN_PASSWORD} caracteres" value="${esc(pass)}" aria-label="Sua senha"></div>
      <div class="rowbtns"><button class="btn" data-act="cloudin" ${cloud.busy ? 'disabled' : ''}>${cloud.busy ? 'Entrando…' : 'Entrar'}</button><button class="btn ghost" data-act="cloudup" ${cloud.busy ? 'disabled' : ''}>Criar conta</button></div>
      <p class="hint">Na primeira vez, "Criar conta". No outro aparelho, "Entrar" com o mesmo e-mail e a mesma senha. Nenhum e-mail é mandado.</p>`;
  } else if (cloud.ask) {
    const n = (x: { bets: number; deposits: number }): string => `${x.bets} ${x.bets === 1 ? 'aposta' : 'apostas'} e ${x.deposits} ${x.deposits === 1 ? 'depósito' : 'depósitos'}`;
    h += `<p id="cloudask"><b>Este aparelho e o servidor têm históricos diferentes.</b> Aqui: ${n(cloud.ask.here)}. No servidor: ${n(cloud.ask.there)}.</p>
      ${cloud.ask.canJoin ? '<button class="btn block" data-act="cloudfirst" data-c="join">Juntar os dois</button>' : `<p class="hint" id="cloudcur">As moedas são diferentes (aqui ${esc(cloud.ask.curHere)}, no servidor ${esc(cloud.ask.curThere)}), então não dá para juntar: fica com um dos dois.</p>`}
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
/** Keeps the password typed in memory, for the same reason; it is never stored. */
export function typedPass(v: string): void { pass = v; }
