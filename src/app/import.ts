import { Core } from '../core';
import { loadOdds } from './api';
import { $, esc, fo, fu, money, part } from './format';
import { canBet, priceOf, setStakeMoney, setStakeUnits, wallet } from './helpers';
import { render, renderSheet, sideDot } from './render';
import { D, S, imp, slip, ui } from './state';
import type { Fight, Priced, Tip, TipItem, TipProblem, TipStake } from '../core';

/* ================= copy a bet from a print or a pasted text ================= */
// The image is read on the device: the OCR library is fetched from a CDN only when a picture is chosen, and the picture
// itself never leaves the phone. Versions are pinned here and mirrored in tests/package.json (checked by docs_check).
const OCR = { lib: '7.0.0', core: '7.0.0', data: '1.0.0' };
const OCR_URL = {
  lib: `https://cdn.jsdelivr.net/npm/tesseract.js@${OCR.lib}/dist/tesseract.min.js`,
  worker: `https://cdn.jsdelivr.net/npm/tesseract.js@${OCR.lib}/dist/worker.min.js`,
  core: `https://cdn.jsdelivr.net/npm/tesseract.js-core@${OCR.core}`,
  lang: `https://cdn.jsdelivr.net/npm/@tesseract.js-data/por@${OCR.data}/4.0.0_best_int`
};
const OCR_SRI = 'sha384-2BQ3U3OdKOb0Uczxqr41I9UvZkzr4V9Hv8uSzMMZAlmhsFClvdZX5wi5fDCzG+tM';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ocr = any;                 // Tesseract.js ships no types to a page that loads it from a CDN
let ocrLib: Promise<Ocr> | null = null;
function loadOcr(): Promise<Ocr> {
  return ocrLib || (ocrLib = new Promise<Ocr>((res, rej) => {
    const s = document.createElement('script');
    s.src = OCR_URL.lib; s.integrity = OCR_SRI; s.crossOrigin = 'anonymous';
    s.onload = () => (window.Tesseract ? res(window.Tesseract) : rej(new Error('ocr')));
    s.onerror = () => { ocrLib = null; rej(new Error('ocr')); };
    document.head.appendChild(s);
  }));
}
async function readImage(file: File): Promise<string> {
  const T = await loadOcr();
  const worker = await T.createWorker('por', 1, { workerPath: OCR_URL.worker, corePath: OCR_URL.core, langPath: OCR_URL.lang,
    logger: (m: { status: string; progress: number }) => { if (m.status === 'recognizing text') { imp.pct = Math.round(m.progress * 100); const el = $('#impstatus'); if (el) el.textContent = impStatus(); } } });
  try { return (await worker.recognize(file)).data.text; } finally { await worker.terminate(); }
}
const impStatus = (): string => imp.busy ? (imp.pct ? `Lendo a imagem… ${imp.pct}%` : 'Preparando o leitor de imagem…')
  : 'A imagem é lida aqui no aparelho e não é enviada pra lugar nenhum. Na primeira vez o leitor baixa uns 5 MB.';
const TIP_WHY: Record<TipProblem['code'], (f?: Fight) => string> = {
  empty: () => 'Cola um texto ou escolhe uma imagem.',
  nofight: () => 'Não achei nenhuma luta do card que ainda não começou. Confere se os nomes dos lutadores estão no texto.',
  ambiguous: () => 'Achei mais de uma luta possível com um lutador só de cada. Inclui o nome dos dois lutadores.',
  nomarket: (f?: Fight) => `Achei ${f ? f.a.last + ' x ' + f.b.last : 'a luta'}, mas não entendi qual é a aposta.`
};
// what the parser understood, checked against what can be bet on right now
interface Resolved { ok: { it: TipItem; f: Fight; x: Priced }[]; notes: string[]; value: number; how: TipStake['how']; units: number | null; unit: number; also: string }
function impResolve(res: Tip): Resolved {
  const w = wallet(), ok: Resolved['ok'] = [], notes = res.problems.map(p => (TIP_WHY[p.code] || TIP_WHY.nofight)(p.fid ? D.fights.get(p.fid) : undefined));
  for (const it of res.items) {
    const f = D.fights.get(it.fid), p = f && canBet(f) ? priceOf(f) : null, x = p && p.map[it.key];
    if (f && x) ok.push({ it, f, x }); else notes.push(`${f ? f.a.last + ' x ' + f.b.last : 'Uma luta'}: essa aposta não tem odd agora.`);
  }
  const st = res.stake, ts = Core.tipStake(st, S.stakeIn, w.unit);
  // an original that states both units and money: say which one was left out, so the choice the setting made is visible
  const also = st.kind === 'units' && st.money ? (ts.how === 'same' ? `o original também fala em ${fu(st.units)}` : `o original também traz ${money(st.money)}`) : '';
  return { ok, notes, value: ts.value, how: ts.how, units: ts.units, unit: w.unit, also };
}
// what is copied from the original follows the one setting for stakes (money: the same amount; units: the same stake)
export const TIP_HINT = { money: 'o valor é o mesmo do print.', units: 'a stake é a mesma do print, na sua unidade.' };
export async function runImport(text: string): Promise<void> {
  imp.text = text; imp.err = ''; imp.res = null;
  const pre = [...D.fights.values()].filter(f => f.state === 'pre' && !f.canceled);
  const res = Core.parseTip(text, pre);
  const need = new Map<string, string[]>();           // odds are only kept for the event on screen: fetch the ones this tip needs
  for (const it of res.items) { const f = D.fights.get(it.fid); if (f && !D.odds[f.id]) need.set(f.eventId, [...(need.get(f.eventId) || []), f.id]); }
  if (need.size) { imp.busy = true; renderImport(); for (const [eid, fids] of need) { try { await loadOdds(eid, true, fids); } catch (e) { /* shown as "no odd now" below */ } } imp.busy = false; }
  imp.res = res; renderImport();
}
export async function importImage(file: File | null | undefined): Promise<void> {
  if (!file || imp.busy) return;
  imp.busy = true; imp.pct = 0; imp.err = ''; imp.res = null; renderImport();
  let text: string | null = null;
  try { text = await readImage(file); }
  catch (e) { imp.err = 'Não consegui ler a imagem. Confere a internet (o leitor é baixado na primeira vez) ou cola o texto da aposta.'; }
  imp.busy = false;
  if (text == null) { renderImport(); return; }
  if (!text.trim()) { imp.err = 'Não achei texto nessa imagem.'; renderImport(); return; }
  await runImport(text.trim());
}
export function renderImport(): void {
  part('sheet').hidden = false; part('slipbar').hidden = true;
  let h = `<div class="ph"><h3>Copiar aposta</h3><button class="x" data-act="impclose" aria-label="Fechar">×</button></div>
    <p class="hint">Cola o texto de uma aposta ou escolhe o print. Vale pra luta que ainda não começou. A odd é a de agora; ${TIP_HINT[S.stakeIn === 'units' ? 'units' : 'money']}</p>
    <textarea id="imptext" placeholder="Ex.: Fulano vs. Beltrano · Fulano para vencer a luta · Stake 1 unidade" aria-label="Texto da aposta">${esc(imp.text)}</textarea>
    <div class="rowbtns"><button class="btn" data-act="impread" ${imp.busy ? 'disabled' : ''}>Ler texto</button><label class="btn ghost" for="impfile">Escolher imagem</label><input type="file" id="impfile" accept="image/*" hidden ${imp.busy ? 'disabled' : ''}></div>
    <p class="hint" id="impstatus">${esc(impStatus())}</p>`;
  if (imp.err) h += `<p class="msg">${esc(imp.err)}</p>`;
  if (imp.res && !imp.busy) {
    const r = impResolve(imp.res);
    if (r.ok.length) {
      h += '<div id="impres">';
      for (const { it, f, x } of r.ok)
        h += `<div class="sel"><div class="t"><b>${sideDot(it.key, f.weight)}${esc(x.sel)}</b><span>${esc(x.market)} · ${esc(f.a.last)} x ${esc(f.b.last)}${it.assumed ? ' · o texto não diz o mercado, considerei vencedor' : ''}</span><span>${it.printedOdd ? `Odd do print ${fo(it.printedOdd)} · ` : ''}odd agora ${x.src === 'est' ? '≈' : ''}${fo(x.odd)}</span></div></div>`;
      const how = { units: `${fu(r.units || 0)} do print`, same: 'mesmo valor do print', default: 'o print não diz o valor, considerei 1u' }[r.how];
      h += `</div><dl class="sum" style="margin-top:10px"><dt>Valor</dt><dd id="impvalue">${r.value > 0 ? money(r.value) + (r.unit > 0 ? ' · ' + fu(r.value / r.unit) : '') : '—'}</dd><dt>De onde veio</dt><dd>${how}${r.also ? ` · ${r.also}` : ''}</dd></dl>`;
      if (!(r.value > 0)) h += '<p class="msg">Sem banca não dá pra calcular a unidade. Deposita primeiro; as seleções vão pro cupom sem valor.</p>';
    }
    for (const n of r.notes) h += `<p class="msg">${esc(n)}</p>`;
    if (r.ok.length) h += `<button class="btn block" data-act="impgo">Levar pro cupom</button>`;
  }
  part('panel').innerHTML = h;
}
export function importToSlip(): void {
  if (!imp.res) return;
  const r = impResolve(imp.res); if (!r.ok.length) return;
  slip.sels = r.ok.map(o => ({ fid: o.f.id, key: o.it.key }));
  slip.mode = r.ok.length > 1 ? 'multi' : 'single';
  if (r.how !== 'same' && r.units && r.unit > 0) setStakeUnits(r.units); else setStakeMoney(r.value);      // units stay exact units
  imp.open = false; imp.res = null; imp.text = ''; ui.msg = ''; ui.sheet = true;
  renderSheet(); render();
}
export function closeImport(): void { imp.open = false; imp.res = null; imp.err = ''; renderSheet(); render(); }
