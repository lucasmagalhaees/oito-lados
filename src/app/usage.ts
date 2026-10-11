import { Core } from '../core';
import { fileStamp, handFile } from './backup';
import { DAY, esc } from './format';
import { render, toast } from './render';
import { U, saveUsage, session, ui } from './state';
import { builtFrom } from './update';
import type { UsageKind } from '../core';

/* ================= the calls to ESPN, counted on this device ================= */
/** The day a call is counted on, as the device tells the date. */
export function dayKey(t: number): string {
  const d = new Date(t), p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** How long after the last call the counts are written down: a card being read makes many calls in a row. */
export const USAGE_SAVE = 2000;
let timer: ReturnType<typeof setTimeout> | undefined;
/** Counts one call: in the log that is kept, and in the counts of this session. */
export function record(kind: UsageKind, ms: number, bytes: number, ok: boolean): void {
  const t = Date.now(), call = { t, kind, ms: Math.round(ms), bytes, ok };
  Core.usageAdd(U, { ...call, day: dayKey(t) });
  Core.usageAdd(session.log, { ...call, day: 'session' });
  clearTimeout(timer); timer = setTimeout(saveUsage, USAGE_SAVE);
}
/** Leaving the page writes the counts down at once. */
export function initUsage(): void { window.addEventListener('pagehide', () => { saveUsage(); }); }
/** The counts as a text, to be handed over: only numbers about the calls, nothing about the person's bets. */
export function usageText(now: number): string {
  return JSON.stringify({
    app: 'oito-lados', what: 'espn-usage', savedAt: now, version: builtFrom() || 'dev', today: dayKey(now),
    fields: 'n = calls, err = calls that failed, ms = time of all calls, max = slowest call in ms, bytes = size of the answers as text, peak = most calls within one minute',
    session: { since: session.since, ...Core.usageSum(session.log, '') }, days: U.days
  }, null, 1);
}
export const usageName = (now: number): string => `oito-lados-uso-espn-${fileStamp(now)}.json`;
export async function saveUsageFile(): Promise<void> {
  const now = Date.now(), name = usageName(now), how = await handFile(name, usageText(now), 'Uso da ESPN no Oito Lados');
  if (how === 'shared') toast('Uso da ESPN salvo em arquivo.'); else if (how === 'saved') toast(`Uso da ESPN baixado: ${name}`);
}
/** Starts the counting over, on this device. */
export function resetUsage(): void {
  for (const k of Object.keys(U.days)) delete U.days[k];
  delete U.min; session.log = Core.usageEmpty(); session.since = Date.now();
  ui.usage = null; saveUsage(); render(); toast('Contagem zerada.');
}

/* ---- the card on the wallet screen ---- */
/** The kinds of call, as the card names them. */
export const USAGE_NAMES: Record<UsageKind, string> = { board: 'Placar', odds: 'Odds', result: 'Resultado', td: 'Quedas da luta', astats: 'Média de quedas', form: 'Últimas lutas' };
const whole = new Intl.NumberFormat('pt-BR'), tenth = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
export const sizeText = (b: number): string => (b >= 1e6 ? `${tenth.format(b / 1e6)} MB` : b >= 1000 ? `${whole.format(Math.round(b / 1000))} kB` : `${Math.round(b)} B`);
export const spanText = (ms: number): string => (ms >= 1000 ? `${tenth.format(ms / 1000)} s` : `${Math.round(ms)} ms`);
const calls = (n: number): string => `${whole.format(n)} ${n === 1 ? 'chamada' : 'chamadas'}`;
const failed = (n: number): string => (n === 1 ? '1 falhou' : `${whole.format(n)} falharam`);
/** The card: what was asked of ESPN today and in the last seven days, by kind, and the way to hand the counts over. */
export function usageHtml(now: number): string {
  const today = Core.usageSum(U, dayKey(now)), week = Core.usageSum(U, dayKey(now - 6 * DAY)), ses = Core.usageSum(session.log, '');
  const count = (n: number, err: number): string => `${n ? whole.format(n) : '—'}${err ? `<small class="neg">${failed(err)}</small>` : ''}`;
  const row = (id: string, name: string, t: { n: number; err: number }, w: { n: number; err: number; ms: number; bytes: number; max: number }): string =>
    `<tr data-k="${id}"><td>${name}${w.n ? `<small>${sizeText(w.bytes / w.n)} cada</small>` : ''}</td><td>${count(t.n, t.err)}</td><td>${count(w.n, w.err)}</td><td>${w.n ? `${spanText(w.ms / w.n)}<small>máx. ${spanText(w.max)}</small>` : '—'}</td></tr>`;
  const mins = Math.max(1, Math.round((now - session.since) / 60e3));
  const said = today.total.n
    ? `Hoje: <b>${calls(today.total.n)}</b> · ${sizeText(today.total.bytes)}${today.total.err ? ` · ${failed(today.total.err)}` : ''} · no máximo ${whole.format(today.peak)} num minuto.`
    : 'Hoje: nenhuma chamada contada ainda.';
  let h = `<section class="card" id="usage"><span class="label">Uso da ESPN</span><p class="hint" id="usagenow">${said} Desde que o app abriu (${whole.format(mins)} min): ${calls(ses.total.n)}.</p>`;
  h += `<div class="tbl"><table id="usagetbl"><thead><tr><th>Tipo</th><th>Hoje</th><th>7 dias</th><th>Tempo</th></tr></thead><tbody>${Core.USAGE_KINDS.map(k => row(k, USAGE_NAMES[k], today.k[k], week.k[k])).join('')}${row('all', 'Tudo', today.total, week.total)}</tbody></table></div>`;
  h += `<div class="rowbtns"><button class="btn" data-act="usagesave">Exportar em arquivo</button><button class="btn ghost" data-act="usagecopy">Copiar como texto</button></div>`;
  if (ui.usage) h += `<textarea id="usagetext" readonly aria-label="Uso da ESPN">${esc(ui.usage)}</textarea><p class="hint">Não deu pra copiar sozinho. Seleciona o texto acima e copia.</p>`;
  h += `<p class="hint">Contado neste aparelho e guardado por ${Core.USAGE_DAYS} dias. O que sai daqui são só essas contagens, nada das suas apostas. O tamanho é o do texto da resposta, não o que trafegou comprimido.</p><button class="btn ghost block" data-act="usagereset">Zerar contagem</button>`;
  return h + '</section>';
}
/** Copies the counts as a text; where the page cannot copy, the text is shown to be copied by hand. */
export function copyUsage(): void {
  const txt = usageText(Date.now()), fail = (): void => { ui.usage = txt; render(); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => { ui.usage = null; render(); toast('Uso da ESPN copiado.'); }, fail); else fail();
}
