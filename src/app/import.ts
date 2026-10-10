import { Core } from '../core';
import { loadOdds } from './api';
import { $, esc, fo, fu, money, part } from './format';
import { canBet, priceOf, setStakeMoney, setStakeUnits, slipCalc, sum, wallet } from './helpers';
import { recheck, render, renderSheet, sideDot, toast, writeBets } from './render';
import { D, S, imp, saveCache, saveS, slip, ui } from './state';
import type { Fight, Priced, Tip, TipItem, TipProblem, TipStake } from '../core';
import type { SlipCalc } from './helpers';
import type { ImportOp, Slip } from './state';

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
const impStatus = (): string => imp.busy ? (imp.of > 1 ? `Lendo a foto ${imp.at} de ${imp.of}…${imp.pct ? ' ' + imp.pct + '%' : ''}` : imp.pct ? `Lendo a imagem… ${imp.pct}%` : 'Preparando o leitor de imagem…')
  : 'As fotos são lidas aqui no aparelho e não são enviadas pra lugar nenhum. Na primeira vez o leitor baixa uns 5 MB.';
const TIP_WHY: Record<TipProblem['code'], (f?: Fight, p?: TipProblem) => string> = {
  empty: () => 'Cola um texto ou escolhe uma imagem.',
  nofight: () => 'Não achei nenhuma luta do card que ainda não começou. Confere se os nomes dos lutadores estão no texto.',
  ambiguous: () => 'Esse nome serve pra mais de um lutador do card. Inclui o nome completo ou o do adversário.',
  nomarket: (f?: Fight) => `Achei ${f ? f.a.last + ' x ' + f.b.last : 'a luta'}, mas não entendi qual é a aposta.`,
  short: (_f?: Fight, p?: TipProblem) => `O original é uma múltipla de ${p && p.want} seleções e só achei ${p && p.got}. Confere antes de apostar.`
};
// what the parser understood, checked against what can be bet on right now
interface Resolved { ok: { it: TipItem; f: Fight; x: Priced }[]; notes: string[]; value: number; how: TipStake['how']; units: number | null; unit: number; also: string; mode: Slip['mode']; whole: boolean }
function impResolve(res: Tip): Resolved {
  const w = wallet(), ok: Resolved['ok'] = [], notes = res.problems.map(p => (TIP_WHY[p.code] || TIP_WHY.nofight)(p.fid ? D.fights.get(p.fid) : undefined, p));
  // a slip of a multiple often prints its events and the market of the first one only
  if (res.kind === 'multi' && res.problems.some(p => p.code === 'nomarket')) notes.push('Cupom de múltipla costuma mostrar só a primeira seleção: as outras não estão nessa imagem.');
  for (const it of res.items) {
    const f = D.fights.get(it.fid), p = f && canBet(f) ? priceOf(f) : null, x = p && p.map[it.key];
    if (f && x) ok.push({ it, f, x }); else notes.push(`${f ? f.a.last + ' x ' + f.b.last : 'Uma luta'}: essa aposta não tem odd agora.`);
  }
  const st = res.stake, ts = Core.tipStake(st, S.stakeIn, w.unit);
  // an original that states both units and money: say which one was left out, so the choice the setting made is visible
  const also = st.kind === 'units' && st.money ? (ts.how === 'same' ? `o original também fala em ${fu(st.units)}` : `o original também traz ${money(st.money)}`) : '';
  // several selections are one multiple, unless the original says they are singles: then each is a bet of its own
  const mode: Slip['mode'] = ok.length > 1 && res.kind !== 'single' ? 'multi' : 'single';
  // whole: everything the original states was read and can be bet on right now, with a value; only these go in a batch
  const whole = ok.length > 0 && ok.length === res.items.length && !res.problems.length && ts.value >= 1;
  return { ok, notes, value: ts.value, how: ts.how, units: ts.units, unit: w.unit, also, mode, whole };
}
// what is copied from the original follows the one setting for stakes (money: the same amount; units: the same stake)
export const TIP_HINT = { money: 'o valor é o mesmo do print.', units: 'a stake é a mesma do print, na sua unidade.' };
let opSeq = 0;
/** Reads a text into a bet, fetching the odds it needs (they are only kept for the event on screen). */
function parse(text: string): { res: Tip; need: Map<string, string[]> } {
  const res = Core.parseTip(text, [...D.fights.values()].filter(f => f.state === 'pre' && !f.canceled)), need = new Map<string, string[]>();
  for (const it of res.items) { const f = D.fights.get(it.fid); if (f && !D.odds[f.id]) need.set(f.eventId, [...(need.get(f.eventId) || []), f.id]); }
  return { res, need };
}
async function fetchOdds(need: Map<string, string[]>): Promise<void> { for (const [eid, fids] of need) { try { await loadOdds(eid, true, fids); } catch (e) { /* shown as "no odd now" */ } } }
/** The text field: one bet, which replaces the one read from the text before. Pictures already in the list stay. */
export async function runImport(text: string): Promise<void> {
  imp.text = text; imp.err = ''; imp.msg = ''; imp.ops = imp.ops.filter(o => o.src !== 'text');
  const { res, need } = parse(text);
  if (need.size) { imp.busy = true; renderImport(); await fetchOdds(need); imp.busy = false; }
  imp.ops.unshift({ id: ++opSeq, src: 'text', name: '', res }); renderImport();
}
/** Pictures: each one is a bet of its own. A single picture with nothing else in the list goes through the text field,
 *  so what the reader got can be seen and corrected by hand. */
export async function importImages(files: File[]): Promise<void> {
  if (!files.length || imp.busy) return;
  const alone = files.length === 1 && !imp.ops.some(o => o.src === 'image'), blank: string[] = [];
  imp.busy = true; imp.err = ''; imp.msg = ''; imp.of = files.length;
  for (let i = 0; i < files.length; i++) {
    imp.at = i + 1; imp.pct = 0; renderImport();
    let text = '';
    try { text = (await readImage(files[i])).trim(); }
    catch (e) { imp.err = 'Não consegui ler a imagem. Confere a internet (o leitor é baixado na primeira vez) ou cola o texto da aposta.'; break; }       // the others would fail the same way
    if (!text) { blank.push(files[i].name || `foto ${i + 1}`); continue; }
    if (alone) { imp.busy = false; imp.of = 0; imp.at = 0; await runImport(text); return; }
    const { res, need } = parse(text); await fetchOdds(need);
    imp.ops.push({ id: ++opSeq, src: 'image', name: files[i].name || '', res });
  }
  imp.busy = false; imp.of = 0; imp.at = 0;
  if (blank.length && !imp.err) imp.err = files.length === 1 ? 'Não achei texto nessa imagem.' : `Não achei texto em: ${blank.join(', ')}.`;
  renderImport();
}
/** The bets of the list that can be made as they stand, each with what it resolves to right now. */
const readyOps = (): { o: ImportOp; r: Resolved }[] => imp.ops.map(o => ({ o, r: impResolve(o.res) })).filter(x => x.r.whole);
const KIND = (res: Tip, r: Resolved): string => r.mode === 'multi' ? `Múltipla de ${r.ok.length} seleções` : r.ok.length > 1 ? `${r.ok.length} apostas simples` : res.kind === 'multi' ? 'Múltipla (só uma seleção lida)' : 'Simples';
function opBlock(o: ImportOp, i: number, many: boolean): string {
  const r = impResolve(o.res);
  let h = `<div class="impop" data-op="${o.id}">`;
  if (many) h += `<div class="oph"><span class="label">${o.src === 'image' ? `Foto${o.name ? ' · ' + esc(o.name) : ''}` : 'Texto'}</span><button class="x" data-act="impdrop" data-op="${o.id}" aria-label="Tirar da lista">×</button></div>`;
  if (r.ok.length) {
    h += `<div class="impres"${i ? '' : ' id="impres"'}>`;
    for (const { it, f, x } of r.ok)
      h += `<div class="sel"><div class="t"><b>${sideDot(it.key, f.weight)}${esc(x.sel)}</b><span>${esc(x.market)} · ${esc(f.a.last)} x ${esc(f.b.last)}${it.assumed ? ' · o texto não diz o mercado, considerei vencedor' : ''}</span><span>${it.printedOdd ? `Odd do print ${fo(it.printedOdd)} · ` : ''}odd agora ${x.src === 'est' ? '≈' : ''}${fo(x.odd)}</span></div></div>`;
    const how = { units: `${fu(r.units || 0)} do print`, same: 'mesmo valor do print', default: 'o print não diz o valor, considerei 1u' }[r.how];
    // the odd the original gives for the whole multiple, next to what the same selections pay now (different fights multiply)
    const fights = new Set(r.ok.map(k => k.f.id)), all = r.ok.length === o.res.items.length && !o.res.problems.length && fights.size === r.ok.length;
    const betOdd = o.res.odd ? `<dt>Odd do print (aposta inteira)</dt><dd class="impodd">${fo(o.res.odd)}${all && r.mode === 'multi' ? ` · agora ${r.ok.some(k => k.x.src === 'est') ? '≈' : ''}${fo(Core.r2(r.ok.reduce((p, k) => p * k.x.odd, 1)))}` : ''}</dd>` : '';
    h += `</div><dl class="sum" style="margin-top:10px"><dt>Tipo</dt><dd class="impkind">${KIND(o.res, r)}</dd><dt>${r.mode === 'single' && r.ok.length > 1 ? 'Valor de cada uma' : 'Valor'}</dt><dd class="impvalue"${i ? '' : ' id="impvalue"'}>${r.value > 0 ? money(r.value) + (r.unit > 0 ? ' · ' + fu(r.value / r.unit) : '') : '—'}</dd><dt>De onde veio</dt><dd>${how}${r.also ? ` · ${r.also}` : ''}</dd>${betOdd}</dl>`;
    if (!(r.value > 0)) h += '<p class="msg">Sem banca não dá pra calcular a unidade. Deposita primeiro; as seleções vão pro cupom sem valor.</p>';
  }
  for (const n of r.notes) h += `<p class="msg">${esc(n)}</p>`;
  if (r.ok.length) h += `<button class="btn ${many ? 'ghost ' : ''}block" data-act="impgo" data-op="${o.id}">${many ? 'Levar só esta pro cupom' : 'Levar pro cupom'}</button>`;
  return h + '</div>';
}
export function renderImport(): void {
  part('sheet').hidden = false; part('slipbar').hidden = true;
  const something = !!(imp.text || imp.ops.length || imp.err);
  let h = `<div class="ph"><h3>Copiar aposta</h3><button class="x" data-act="impclose" aria-label="Fechar">×</button></div>
    <p class="hint">Cola o texto de uma aposta ou escolhe os prints: cada foto é uma aposta. Vale pra luta que ainda não começou. A odd é a de agora; ${TIP_HINT[S.stakeIn === 'units' ? 'units' : 'money']}</p>
    <textarea id="imptext" placeholder="Ex.: Fulano vs. Beltrano · Fulano para vencer a luta · Stake 1 unidade" aria-label="Texto da aposta">${esc(imp.text)}</textarea>
    <div class="rowbtns three"><button class="btn" data-act="impread" ${imp.busy ? 'disabled' : ''}>Ler texto</button><label class="btn ghost" for="impfile">Escolher fotos</label><input type="file" id="impfile" accept="image/*" multiple hidden ${imp.busy ? 'disabled' : ''}><button class="btn ghost" data-act="impclear" ${imp.busy || !something ? 'disabled' : ''}>Limpar</button></div>
    <p class="hint" id="impstatus">${esc(impStatus())}</p>`;
  if (imp.err) h += `<p class="msg" id="imperr">${esc(imp.err)}</p>`;
  if (!imp.busy) {
    const many = imp.ops.length > 1;
    imp.ops.forEach((o, i) => { h += opBlock(o, i, many); });
    if (many) {
      const ready = readyOps(), total = Core.r2(sum(ready, x => x.r.mode === 'single' ? x.r.value * x.r.ok.length : x.r.value)), bal = wallet().balance, out = imp.ops.length - ready.length;
      const bets = sum(ready, x => x.r.mode === 'single' ? x.r.ok.length : 1);
      h += '<div class="impall">';
      if (out) h += `<p class="hint" id="impout">${out === 1 ? '1 da lista fica de fora' : `${out} da lista ficam de fora`} do "apostar todas": falta alguma seleção, odd ou valor. Dá pra levar pro cupom uma a uma.</p>`;
      if (ready.length) {
        h += `<dl class="sum"><dt>${bets} ${bets > 1 ? 'apostas' : 'aposta'}</dt><dd class="big" id="imptotal">${money(total)}</dd></dl>`;
        if (total > bal + 0.004) h += `<p class="msg" id="impshort">Saldo insuficiente: você tem ${money(bal)}.</p>`;
        if (imp.msg) h += `<p class="msg" id="impmsg">${esc(imp.msg)}</p>`;
        h += `<button class="btn block" data-act="impall" ${imp.placing || total > bal + 0.004 ? 'disabled' : ''}>${imp.placing ? 'Conferindo odds…' : ready.length > 1 ? `Apostar as ${ready.length} de uma vez` : 'Apostar a que está pronta'}</button>`;
      }
      h += '</div>';
    }
  }
  part('panel').innerHTML = h;
}
/** Puts one bet of the list into the slip as the slip would hold it: selections, single or multiple, and the value. */
function loadSlip(r: Resolved): void {
  slip.sels = r.ok.map(o => ({ fid: o.f.id, key: o.it.key }));
  slip.mode = r.mode;
  if (r.how !== 'same' && r.units && r.unit > 0) setStakeUnits(r.units); else setStakeMoney(r.value);      // units stay exact units
}
/** One bet of the list goes to the slip, where it is made by the usual button. The rest of the list stays for later. */
export function importToSlip(id?: number): void {
  const o = imp.ops.find(x => x.id === id) || imp.ops[0]; if (!o) return;
  const r = impResolve(o.res); if (!r.ok.length) return;
  loadSlip(r);
  imp.ops = imp.ops.filter(x => x !== o); if (o.src === 'text') imp.text = '';
  imp.open = false; imp.msg = ''; ui.msg = ''; ui.sheet = true;
  renderSheet(); render();
}
/** Every bet of the list that is ready, made at once. The same care as the slip: the card and the odds are read again
 *  first, and if anything moved nothing is written and the person is asked to look and confirm again. Each bet goes
 *  through the slip's own arithmetic, so a multiple or a same-fight combo is priced exactly as it would be there. */
export async function placeAll(): Promise<void> {
  if (imp.placing || imp.busy) return;
  const before = readyOps(); if (!before.length) return;
  const stamp = (xs: { o: ImportOp; r: Resolved }[]): string => JSON.stringify(xs.map(x => [x.o.id, x.r.mode, x.r.value, x.r.ok.map(k => [k.f.id, k.it.key, k.x.odd])]));
  imp.placing = true; imp.msg = ''; renderImport();
  const reached = await recheck([...new Set(before.flatMap(x => x.r.ok.map(k => k.f.id)))]);
  imp.placing = false;
  if (!reached) { imp.msg = 'Sem conexão com a ESPN. Não deu pra confirmar as odds, tenta de novo.'; renderImport(); return; }
  const now = readyOps();
  if (stamp(now) !== stamp(before)) { imp.msg = 'Alguma coisa mudou: uma odd, ou uma luta que começou. Confere a lista e confirma de novo.'; renderImport(); render(); return; }
  const keep = { sels: slip.sels, mode: slip.mode, stake: slip.stake, units: slip.units, unitsN: slip.unitsN };
  const restore = (): void => { Object.assign(slip, keep); };
  // first every bet is priced, and only if all of them stand is anything written
  const priced: { c: SlipCalc; mode: Slip['mode'] }[] = []; let spent = 0;
  for (const x of now) {
    loadSlip(x.r); const c = slipCalc();
    if (!c.ok || slip.mode !== x.r.mode || c.stake < 1) { restore(); imp.msg = 'Uma das apostas não fecha mais do jeito que estava (combinação ou odd). Confere a lista.'; renderImport(); return; }
    spent += c.total; priced.push({ c, mode: slip.mode });
  }
  if (spent > wallet().balance + 0.004) { restore(); imp.msg = 'Saldo insuficiente pra todas.'; renderImport(); return; }
  const t = Date.now(); let made = 0;
  priced.forEach((p, i) => { made += writeBets(p.c, p.mode, t, i.toString(36) + '.'); });
  saveS(); saveCache();
  const done = new Set(now.map(x => x.o)); imp.ops = imp.ops.filter(o => !done.has(o)); if (now.some(x => x.o.src === 'text')) imp.text = '';
  slip.sels = []; setStakeMoney(0); slip.mode = 'single';
  imp.msg = ''; ui.msg = ''; ui.sheet = false;
  if (!imp.ops.length) { imp.open = false; ui.tab = 'apostas'; ui.filter = 'open'; renderSheet(); render(); window.scrollTo(0, 0); }
  else { render(); renderImport(); }                 // what was left out stays on the screen; the balance behind it is the new one
  toast(made > 1 ? `${made} apostas feitas. Boa sorte.` : 'Aposta feita. Boa sorte.');
}
export function dropOp(id: number): void { imp.ops = imp.ops.filter(o => o.id !== id); imp.msg = ''; renderImport(); }
/** Empties the copy screen: the text, the list and any message. */
export function clearImport(): void { imp.text = ''; imp.ops = []; imp.err = ''; imp.msg = ''; renderImport(); }
/** Closing keeps the text and the list: they are the person's work, and "Limpar" is there to throw them away. */
export function closeImport(): void { imp.open = false; imp.err = ''; imp.msg = ''; renderSheet(); render(); }
