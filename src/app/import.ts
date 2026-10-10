import { Core } from '../core';
import { loadOdds } from './api';
import { $, dWhen, esc, fo, fu, money, parseMoney, part, pctText, sym } from './format';
import { canBet, exposureNotes, priceOf, setStakeMoney, setStakeUnits, slipCalc, sum, wallet } from './helpers';
import { recheck, render, renderSheet, sideDot, toast, writeBets } from './render';
import { D, S, imp, saveCache, saveS, slip, ui } from './state';
import type { Bet, Fight, Priced, Pricing, Tip, TipItem, TipPick, TipProblem, TipStake } from '../core';
import type { SlipCalc } from './helpers';
import type { CopyMeta, ImportOp, Slip } from './state';

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
// What the parser understood of one item of the list, completed with what was chosen for it, and checked against what
// can be bet on right now. `via` says where each selection came from: the original itself, the person's choice, or
// another item of the list (its id).
type Via = 'read' | 'swap' | 'hand' | number;
interface Missing { f: Fight; pickable: boolean; hints: { o: ImportOp; it: TipItem; x: Priced }[] }
interface Resolved {
  /** `i` is where the selection sits in what was read (null for one that was added to it). */
  tip: Tip; ok: { it: TipItem; f: Fight; x: Priced; via: Via; i: number | null }[]; notes: string[]; missing: Missing[];
  /** Warnings that hold a bet back from the batch until the person says "bet it anyway": open bets that are this same
   *  bet, an earlier item of the list with the same selections, and an odd that fell past the limit set in the wallet. */
  dups: Bet[]; twin: ImportOp | null; drop: number | null; low: boolean; held: boolean;
  /** What is already at stake on the fights it touches. */
  expo: string[];
  value: number; how: TipStake['how']; units: number | null; unit: number; also: string; mode: Slip['mode'];
  /** A list of selections that says neither value nor kind and served to complete another item: it stays out of the batch. */
  ref: boolean;
  /** Whole: everything the original states is there, can be bet on now, and the value was stated or typed. Only these go in a batch. */
  whole: boolean;
}
const nomarket = (t: Tip): string[] => t.problems.filter(p => p.code === 'nomarket' && p.fid).map(p => p.fid as string);
// a list of selections that says neither how much nor what kind of bet: a reference more than a bet
const bareList = (o: ImportOp): boolean => o.res.stake.kind === 'default' && o.res.kind === null && !o.stake;
const priced = (it: TipItem): { f: Fight; x: Priced } | null => { const f = D.fights.get(it.fid), p = f && canBet(f) ? priceOf(f) : null, x = p && p.map[it.key]; return f && x ? { f, x } : null; };
/** The tip of one item with its gaps filled: first what the person chose, then, for each fight still open, what the bare
 *  lists among the other items say when they agree. Also the odds those lists print for selections this one has without. */
/** What was read from one item, with the corrections made to it: a selection swapped for another of the same fight
 *  (the odd printed for the one that was read does not carry over), or taken out. `at` is where each one sat. */
function baseOf(o: ImportOp): { tip: Tip; at: number[] } {
  const kept = o.res.items.map((it, i) => ({ it, i })).filter(x => o.edits[x.i] !== null);
  return { at: kept.map(x => x.i), tip: { ...o.res, items: kept.map(x => { const k = o.edits[x.i]; return typeof k === 'string' ? { ...x.it, key: k, printedOdd: null, assumed: false } : x.it; }) } };
}
function filled(o: ImportOp): { tip: Tip; via: Map<string, Via>; used: Set<number>; at: (number | null)[] } {
  const picks: TipPick[] = [], via = new Map<string, Via>(), used = new Set<number>(), base = baseOf(o);
  for (const p of o.picks) { picks.push(p); via.set(p.fid, p.src == null ? 'hand' : p.src); if (p.src != null) used.add(p.src); }
  const lists = imp.ops.filter(b => b !== o && bareList(b)).map(b => ({ b, items: baseOf(b).tip.items }));
  for (const fid of nomarket(Core.completeTip(base.tip, picks))) {
    if (o.noauto.includes(fid)) continue;
    const cands = lists.flatMap(l => l.items.filter(it => it.fid === fid).map(it => ({ b: l.b, it })));
    if (new Set(cands.map(c => c.it.key)).size !== 1) continue;            // nobody says, or they disagree: the person chooses
    picks.push({ fid, key: cands[0].it.key, printedOdd: cands[0].it.printedOdd }); via.set(fid, cands[0].b.id); used.add(cands[0].b.id);
  }
  const tip = Core.completeTip(base.tip, picks);
  if (!bareList(o)) tip.items = tip.items.map(it => { if (it.printedOdd) return it; const m = lists.flatMap(l => l.items).find(x => x.fid === it.fid && x.key === it.key && x.printedOdd); return m ? { ...it, printedOdd: m.printedOdd } : it; });
  return { tip, via, used, at: tip.items.map((_it, p) => p < base.at.length ? base.at[p] : null) };
}
function impResolve(o: ImportOp): Resolved {
  const w = wallet(), { tip, via, at } = filled(o), ok: Resolved['ok'] = [], missing: Missing[] = [];
  const ref = bareList(o) && imp.ops.some(a => a !== o && filled(a).used.has(o.id));
  const notes: string[] = [];
  for (const p of tip.problems) {
    const f = p.fid ? D.fights.get(p.fid) : undefined;
    if (p.code === 'nomarket' && f) {
      const hints = imp.ops.filter(b => b !== o).flatMap(b => baseOf(b).tip.items.filter(it => it.fid === f.id).map(it => ({ b, it, pr: priced(it) }))).filter(h => h.pr).map(h => ({ o: h.b, it: h.it, x: h.pr!.x }));
      missing.push({ f, pickable: canBet(f) && !!priceOf(f), hints });
    } else notes.push((TIP_WHY[p.code] || TIP_WHY.nofight)(f, p));
  }
  tip.items.forEach((it, p) => {
    const pr = priced(it), f = D.fights.get(it.fid), i = at[p];
    if (pr) ok.push({ it, f: pr.f, x: pr.x, i, via: i != null ? (typeof o.edits[i] === 'string' ? 'swap' : 'read') : via.get(it.fid) || 'hand' });
    else notes.push(`${f ? f.a.last + ' x ' + f.b.last : 'Uma luta'}: essa aposta não tem odd agora.`);
  });
  const st = o.stake || tip.stake, ts = Core.tipStake(st, S.stakeIn, w.unit);
  // an original that states both units and money: say which one was left out, so the choice the setting made is visible
  const also = !o.stake && st.kind === 'units' && st.money ? (ts.how === 'same' ? `o original também fala em ${fu(st.units)}` : `o original também traz ${money(st.money)}`) : '';
  // several selections are one multiple, unless the original says they are singles (or the person says otherwise)
  const mode: Slip['mode'] = ok.length > 1 && (o.mode || (tip.kind === 'single' ? 'single' : 'multi')) === 'multi' ? 'multi' : 'single';
  // what would make this bet a mistake to place without looking: it is already placed, it is in the list twice, or its odd fell
  const complete = !ref && ok.length > 0 && ok.length === tip.items.length && !tip.problems.length, sels = ok.map(k => ({ fid: k.f.id, key: k.it.key }));
  const dups = complete ? Core.dupBets(S.bets, sels, mode) : [], sig = Core.selSig(tip.items);
  const twin = complete && !bareList(o) ? imp.ops.slice(0, imp.ops.indexOf(o)).find(b => !bareList(b) && Core.selSig(filled(b).tip.items) === sig) || null : null;
  const legs = ok.map(k => ({ fid: k.f.id, printed: k.it.printedOdd, now: k.x.odd }));
  // singles are compared one by one; a multiple as a whole
  const drops = !complete ? [] : mode === 'multi' ? [Core.copyDrop(tip.odd, legs)] : legs.map(l => Core.copyDrop(null, [l]));
  const known = drops.filter((d): d is number => d != null), drop = known.length ? Math.min(...known) : null;
  const low = !!S.copyDrop && drop != null && drop < -S.copyDrop / 100 - 1e-9;
  const held = (dups.length > 0 || !!twin || low) && !o.force;
  const whole = complete && ts.value >= 1 && ts.how !== 'default' && !held;
  return { tip, ok, notes, missing, value: ts.value, how: ts.how, units: ts.units, unit: w.unit, also, mode, ref, whole, dups, twin, drop, low, held, expo: complete && !dups.length ? exposureNotes(sels) : [] };
}
// what is copied from the original follows the one setting for stakes (money: the same amount; units: the same stake)
export const TIP_HINT = { money: 'o valor é o mesmo do print.', units: 'a stake é a mesma do print, na sua unidade.' };
let opSeq = 0, photoSeq = 0;
const newOp = (src: ImportOp['src'], name: string, res: Tip, text: string): ImportOp => ({ id: ++opSeq, src, name, res, text, picks: [], noauto: [], stake: null, mode: null, edits: {}, swap: null, force: false, open: null });
const opOf = (id: number): ImportOp | undefined => imp.ops.find(o => o.id === id);
const label = (o: ImportOp): string => o.src === 'image' ? o.name : 'Texto';
/** Every market of a fight as the choices of a select, with the odd of now. */
const marketOptions = (pr: Pricing): string => pr.groups.map(g => `<optgroup label="${esc(g.title)}">${g.opts.map(x => `<option value="${esc(x.key)}">${esc(pr.map[x.key].sel)} · ${x.src === 'est' ? '≈' : ''}${fo(x.odd)}</option>`).join('')}</optgroup>`).join('');
/** Reads a text into a bet, with the odds it needs (they are only kept for the event on screen): of the selections it
 *  names, and of the fights it names without a selection, so that one can be chosen for them. */
function parse(text: string): { res: Tip; need: Map<string, string[]> } {
  const res = Core.parseTip(text, [...D.fights.values()].filter(f => f.state === 'pre' && !f.canceled)), need = new Map<string, string[]>();
  for (const fid of [...res.items.map(it => it.fid), ...nomarket(res)]) { const f = D.fights.get(fid); if (f && !D.odds[f.id]) need.set(f.eventId, [...(need.get(f.eventId) || []), f.id]); }
  return { res, need };
}
async function fetchOdds(need: Map<string, string[]>): Promise<void> { for (const [eid, fids] of need) { try { await loadOdds(eid, true, fids); } catch (e) { /* shown as "no odd now" */ } } }
/** The text field: one bet, which replaces the one read from the text before. Pictures already in the list stay. */
export async function runImport(text: string): Promise<void> {
  imp.text = text; imp.err = ''; imp.msg = ''; imp.ops = imp.ops.filter(o => o.src !== 'text');
  const { res, need } = parse(text);
  if (need.size) { imp.busy = true; renderImport(); await fetchOdds(need); imp.busy = false; }
  imp.ops.unshift(newOp('text', '', res, text)); renderImport();
}
/** Pictures: each one is a bet of its own. A single picture with nothing else in the list goes through the text field,
 *  so what the reader got can be seen and corrected by hand. */
export async function importImages(files: File[]): Promise<void> {
  if (!files.length || imp.busy) return;
  const alone = files.length === 1 && !imp.ops.some(o => o.src === 'image'), blank: string[] = [];
  imp.busy = true; imp.err = ''; imp.msg = ''; imp.of = files.length;
  if (!imp.ops.some(o => o.src === 'image')) photoSeq = 0;          // a list with no picture left starts counting again
  for (let i = 0; i < files.length; i++) {
    imp.at = i + 1; imp.pct = 0; renderImport();
    let text = '';
    try { text = (await readImage(files[i])).trim(); }
    catch (e) { imp.err = 'Não consegui ler a imagem. Confere a internet (o leitor é baixado na primeira vez) ou cola o texto da aposta.'; break; }       // the others would fail the same way
    if (!text) { blank.push(`a ${i + 1}ª`); continue; }
    if (alone) { imp.busy = false; imp.of = 0; imp.at = 0; await runImport(text); return; }
    const { res, need } = parse(text); await fetchOdds(need);
    imp.ops.push(newOp('image', `Foto ${++photoSeq}`, res, text));          // numbered: the file names a phone gives are of no use to a person
  }
  imp.busy = false; imp.of = 0; imp.at = 0;
  if (blank.length && !imp.err) imp.err = files.length === 1 ? 'Não achei texto nessa imagem.' : `Não achei texto em ${blank.length > 1 ? 'algumas fotos' : 'uma foto'}: ${blank.join(', ')}.`;
  renderImport();
}
/** The bets of the list that can be made as they stand, each with what it resolves to right now. */
const readyOps = (): { o: ImportOp; r: Resolved }[] => imp.ops.map(o => ({ o, r: impResolve(o) })).filter(x => x.r.whole);
const KIND = (r: Resolved): string => r.mode === 'multi' ? `Múltipla de ${r.ok.length} seleções` : r.ok.length > 1 ? `${r.ok.length} apostas simples` : r.tip.kind === 'multi' ? 'Múltipla (só uma seleção lida)' : 'Simples';
/** Where one item of the list stands, in a word or two: what its folded line says. */
function standing(r: Resolved): { text: string; cls: 'ok' | 'ref' | 'wait' } {
  if (r.ref) return { text: 'referência', cls: 'ref' };
  if (r.whole) return { text: 'pronta', cls: 'ok' };
  if (r.missing.length) return { text: 'falta seleção', cls: 'wait' };
  if (!r.ok.length || r.notes.length) return { text: 'conferir', cls: 'wait' };
  if (r.dups.length) return { text: 'já apostada', cls: 'wait' };
  if (r.twin) return { text: 'repetida', cls: 'wait' };
  if (r.low) return { text: 'odd caiu', cls: 'wait' };
  return { text: r.how === 'default' ? 'sem valor' : 'conferir', cls: 'wait' };
}
function opBlock(o: ImportOp, i: number, many: boolean): string {
  const r = impResolve(o), iu = S.stakeIn === 'units' && r.unit > 0;
  // in a list of several each item is one line that unfolds: what needs a look starts unfolded, the rest folded
  if (o.open == null) o.open = !(r.whole || r.ref);
  const open = !many || o.open, st = standing(r);
  let h = `<div class="impop${open ? '' : ' folded'}" data-op="${o.id}">`;
  if (many) h += `<div class="oph"><button class="fold" data-act="impopen" data-op="${o.id}" aria-expanded="${open}"><span class="label">${esc(label(o))}</span><span class="st ${st.cls}">${st.text}</span>${open ? '' : `<span class="brief">${esc(r.ok.map(k => k.x.sel).join(' + ') || 'nada lido')}</span>${r.ok.length && r.value > 0 && r.how !== 'default' ? `<span class="amt">${money(r.mode === 'single' ? r.value * r.ok.length : r.value)}</span>` : ''}`}</button><button class="x" data-act="impdrop" data-op="${o.id}" aria-label="Tirar da lista">×</button></div>`;
  if (!open) return h + '</div>';
  if (r.ok.length) {
    h += `<div class="impres"${i ? '' : ' id="impres"'}>`;
    for (const { it, f, x, via, i: at } of r.ok) {
      const src = typeof via === 'number' ? opOf(via) : undefined, mine = `data-op="${o.id}" data-i="${at}"`;
      // a selection that was read can be corrected: swapped for another of the same fight, or taken out
      const how = via === 'read' ? `<span class="fix"><button data-act="impswap" ${mine}>${o.swap === at ? 'cancelar' : 'trocar'}</button></span>`
        : via === 'swap' ? `<span class="fixed">Trocada por você · <button data-act="impunedit" ${mine}>desfazer</button></span>`
        : `<span class="via">${via === 'hand' ? 'Escolhida por você' : `Completada com a ${esc(src ? label(src).toLowerCase() : 'outra')}`} · <button data-act="impunpick" data-op="${o.id}" data-fid="${esc(f.id)}">desfazer</button></span>`;
      h += `<div class="sel"><div class="t"><b>${sideDot(it.key, f.weight)}${esc(x.sel)}</b><span>${esc(x.market)} · ${esc(f.a.last)} x ${esc(f.b.last)}${it.assumed ? ' · o texto não diz o mercado, considerei vencedor' : ''}</span><span>${it.printedOdd ? `Odd do print ${fo(it.printedOdd)} · ` : ''}odd agora ${x.src === 'est' ? '≈' : ''}${fo(x.odd)}</span>${how}</div></div>`;
      const pr = via === 'read' && o.swap === at ? priceOf(f) : null;
      if (pr) h += `<select class="impedit" ${mine} aria-label="Trocar a seleção em ${esc(f.a.last)} x ${esc(f.b.last)}"><option value="">Trocar por…</option>${marketOptions(pr)}<option value="__drop">Tirar esta seleção</option></select>`;
    }
    const src = { units: `${fu(r.units || 0)} do print`, same: 'mesmo valor do print', default: 'o print não diz o valor, considerei 1u' }[r.how];
    // the odd the original gives for the whole multiple, next to what the same selections pay now (different fights multiply)
    const fights = new Set(r.ok.map(k => k.f.id)), all = r.ok.length === r.tip.items.length && !r.tip.problems.length && fights.size === r.ok.length;
    const betOdd = r.tip.odd ? `<dt>Odd da aposta no print</dt><dd class="impodd">${fo(r.tip.odd)}${all && r.mode === 'multi' ? ` · agora ${r.ok.some(k => k.x.src === 'est') ? '≈' : ''}${fo(Core.r2(r.ok.reduce((p, k) => p * k.x.odd, 1)))}` : ''}</dd>` : '';
    // when the original gives the odd of the bet and every selection has its own, they should multiply to it
    const each = r.ok.map(k => k.it.printedOdd), prod = each.every(Boolean) ? Math.round(each.reduce((p: number, v) => p * (v as number), 1) * 1000) / 1000 : 0;
    const check = r.tip.odd && all && prod && r.ok.length > 1 ? `<p class="hint impcheck">Conferência: ${each.map(v => String(v)).join(' × ')} = ${prod}${Math.abs(prod / r.tip.odd - 1) <= 0.006 ? ', bate com o cupom.' : `, não bate com o cupom (${r.tip.odd}).`}</p>` : '';
    h += `</div><dl class="sum" style="margin-top:10px"><dt>Tipo</dt><dd class="impkind">${KIND(r)}</dd><dt>${r.mode === 'single' && r.ok.length > 1 ? 'Valor de cada uma' : 'Valor'}</dt><dd class="impvalue"${i ? '' : ' id="impvalue"'}>${r.value > 0 ? money(r.value) + (r.unit > 0 ? ' · ' + fu(r.value / r.unit) : '') : '—'}</dd><dt>De onde veio</dt><dd>${o.stake ? 'valor que você escreveu' : src}${r.also ? ` · ${r.also}` : ''}</dd>${betOdd}</dl>${check}`;
    if (!(r.value > 0)) h += '<p class="msg">Sem banca não dá pra calcular a unidade. Deposita primeiro; as seleções vão pro cupom sem valor.</p>';
    // what can be changed here, without going through the slip: the value, and single or multiple
    h += `<div class="opedit"><div class="field">${iu ? '' : `<span>${esc(sym())}</span>`}<input class="opstake" data-op="${o.id}" inputmode="decimal" autocomplete="off" value="${esc(r.value > 0 ? (iu ? Core.unitsText(r.units != null && r.how !== 'same' ? r.units : r.value / r.unit) : Core.moneyText(r.value)) : '')}" aria-label="Valor desta aposta${iu ? ', em unidades' : ''}">${iu ? '<span>unidades</span>' : ''}</div>` +
      (r.ok.length > 1 ? `<div class="segm" role="group" aria-label="Simples ou múltipla">${(['multi', 'single'] as const).map(m => `<button class="${r.mode === m ? 'on' : ''}" data-act="impmode" data-op="${o.id}" data-m="${m}" aria-pressed="${r.mode === m}">${m === 'multi' ? 'Múltipla' : 'Simples'}</button>`).join('')}</div>` : '') + '</div>';
  }
  for (const m of r.missing) {
    h += `<div class="impmiss" data-fid="${esc(m.f.id)}"><p class="msg">Achei ${esc(m.f.a.last)} x ${esc(m.f.b.last)}, mas ${r.tip.kind === 'multi' ? 'a aposta nela não está nessa imagem' : 'não entendi qual é a aposta'}.</p>`;
    for (const hnt of m.hints) h += `<button class="btn ghost block" data-act="impuse" data-op="${o.id}" data-from="${hnt.o.id}" data-fid="${esc(m.f.id)}" data-key="${esc(hnt.it.key)}">Usar da ${esc(label(hnt.o).toLowerCase())}: ${esc(hnt.x.sel)}${hnt.it.printedOdd ? ` · ${fo(hnt.it.printedOdd)}` : ''}</button>`;
    const pr = m.pickable ? priceOf(m.f) : null;
    if (pr) h += `<select class="imppick" data-op="${o.id}" data-fid="${esc(m.f.id)}" aria-label="Escolher a aposta em ${esc(m.f.a.last)} x ${esc(m.f.b.last)}"><option value="">Escolher a aposta nessa luta…</option>${marketOptions(pr)}</select>`;
    h += '</div>';
  }
  if (r.missing.length && r.tip.kind === 'multi') h += '<p class="hint">Cupom de múltipla costuma mostrar só a primeira seleção. Escolhe a que falta, ou manda junto a foto da lista de seleções.</p>';
  for (const n of r.notes) h += `<p class="msg">${esc(n)}</p>`;
  for (const [i, k] of Object.entries(o.edits)) if (k === null) { const it = o.res.items[+i], pr = it && priced(it); h += `<p class="hint impgone">Tirada por você: ${esc(pr ? pr.x.sel : 'uma seleção')} · <button data-act="impunedit" data-op="${o.id}" data-i="${i}">desfazer</button></p>`; }
  if (r.dups.length) h += `<p class="msg impdup">${r.dups.length > 1 ? `Você já tem ${r.dups.length} apostas abertas iguais a esta.` : `Você já tem esta aposta aberta: ${money(r.dups[0].stake)}, feita em ${esc(dWhen.format(r.dups[0].t))}.`}</p>`;
  if (r.twin) h += `<p class="msg impdup">Igual ${r.twin.src === 'image' ? 'à ' + esc(label(r.twin).toLowerCase()) : 'ao texto'}, que já está na lista.</p>`;
  if (r.low) h += `<p class="msg implow">A odd caiu ${pctText((Math.round(-(r.drop as number) * 1000) / 10).toFixed(1))}% em relação ao print. Seu limite é ${S.copyDrop}%.</p>`;
  if (many && (r.dups.length || r.twin || r.low)) h += o.force ? `<p class="hint impforced">Vai no "apostar todas" mesmo assim · <button data-act="impforce" data-op="${o.id}">desfazer</button></p>` : `<button class="btn ghost block" data-act="impforce" data-op="${o.id}">Apostar mesmo assim</button>`;
  for (const n of r.expo) h += `<p class="hint impexpo">${esc(n)}</p>`;
  if (r.ref) h += '<p class="hint impref">Esta lista serviu pra completar outra aposta e fica de fora do "apostar todas".</p>';
  else if (many && r.ok.length && r.how === 'default' && !r.missing.length) h += '<p class="hint impnoval">O original não diz o valor. Escreve o valor acima pra ela entrar no "apostar todas".</p>';
  if (r.ok.length) h += `<button class="btn ${many ? 'ghost ' : ''}block" data-act="impgo" data-op="${o.id}">${many ? 'Levar só esta pro cupom' : 'Levar pro cupom'}</button>`;
  // what the reader got out of a picture, to see where a wrong reading came from and correct it as text
  if (o.src === 'image') h += `<details class="impraw"><summary>Ver o texto lido</summary><pre>${esc(o.text)}</pre><button class="btn ghost block" data-act="impfixtext" data-op="${o.id}">Corrigir no campo de texto</button></details>`;
  return h + '</div>';
}
export function renderImport(): void {
  part('sheet').hidden = false; part('slipbar').hidden = true;
  const something = !!(imp.text || imp.ops.length || imp.err || imp.from);
  const known = [...new Set(S.bets.map(b => b.from).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  let h = `<div class="ph"><h3>Copiar aposta</h3><button class="x" data-act="impclose" aria-label="Fechar">×</button></div>
    <p class="hint">Cola o texto de uma aposta ou escolhe os prints: cada foto é uma aposta. Vale pra luta que ainda não começou. A odd é a de agora; ${TIP_HINT[S.stakeIn === 'units' ? 'units' : 'money']}</p>
    <textarea id="imptext" placeholder="Ex.: Fulano vs. Beltrano · Fulano para vencer a luta · Stake 1 unidade" aria-label="Texto da aposta">${esc(imp.text)}</textarea>
    <div class="field"><span>De quem é</span><input id="impfrom" maxlength="40" autocomplete="off" placeholder="canal ou tipster (opcional)" value="${esc(imp.from)}" aria-label="De quem é a aposta: canal ou tipster"></div>
    ${known.length ? `<div class="quick froms" id="impfroms" role="group" aria-label="Origens já usadas">${known.map(k => `<button class="${imp.from.trim() === k ? 'on' : ''}" data-act="impfromq" data-v="${esc(k)}" aria-pressed="${imp.from.trim() === k}">${esc(k)}</button>`).join('')}</div>` : ''}
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
      if (out) h += `<p class="hint" id="impout">${out === 1 ? '1 da lista fica de fora' : `${out} da lista ficam de fora`} do "apostar todas": falta alguma seleção, odd ou valor, já está apostada, a odd caiu, ou é só uma lista de referência. Dá pra levar pro cupom uma a uma.</p>`;
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
/** What the bet written from this item keeps of its original: who it came from, and the odds it printed. */
const copyOf = (r: Resolved): CopyMeta => ({ from: imp.from.trim().slice(0, 40), bet: r.tip.odd, sig: r.ok.map(k => k.f.id + '|' + k.it.key).sort().join(','),
  legs: Object.fromEntries(r.ok.filter(k => k.it.printedOdd).map(k => [k.f.id + '|' + k.it.key, k.it.printedOdd as number])) });
/** Puts one bet of the list into the slip as the slip would hold it: selections, single or multiple, and the value. */
function loadSlip(r: Resolved): void {
  slip.sels = r.ok.map(o => ({ fid: o.f.id, key: o.it.key }));
  slip.mode = r.mode; slip.copy = copyOf(r);
  if (r.how !== 'same' && r.units && r.unit > 0) setStakeUnits(r.units); else setStakeMoney(r.value);      // units stay exact units
}
/** One bet of the list goes to the slip, where it is made by the usual button. The rest of the list stays for later. */
export function importToSlip(id?: number): void {
  const o = imp.ops.find(x => x.id === id) || imp.ops[0]; if (!o) return;
  const r = impResolve(o); if (!r.ok.length) return;
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
  const keep = { sels: slip.sels, mode: slip.mode, stake: slip.stake, units: slip.units, unitsN: slip.unitsN, copy: slip.copy };
  const restore = (): void => { Object.assign(slip, keep); };
  // first every bet is priced, and only if all of them stand is anything written
  const sure: { c: SlipCalc; mode: Slip['mode']; copy: CopyMeta }[] = []; let spent = 0;
  for (const x of now) {
    loadSlip(x.r); const c = slipCalc();
    if (!c.ok || slip.mode !== x.r.mode || c.stake < 1) { restore(); imp.msg = 'Uma das apostas não fecha mais do jeito que estava (combinação ou odd). Confere a lista.'; renderImport(); return; }
    spent += c.total; sure.push({ c, mode: slip.mode, copy: slip.copy as CopyMeta });
  }
  if (spent > wallet().balance + 0.004) { restore(); imp.msg = 'Saldo insuficiente pra todas.'; renderImport(); return; }
  const t = Date.now(); let made = 0;
  sure.forEach((p, i) => { made += writeBets(p.c, p.mode, t, i.toString(36) + '.', p.copy); });
  saveS(); saveCache();
  // what was bet leaves the list, and so do the lists that only served to complete it
  const done = new Set(now.map(x => x.o)), refs = new Set(imp.ops.filter(o => !done.has(o) && impResolve(o).ref));
  imp.ops = imp.ops.filter(o => !done.has(o) && !refs.has(o)); if (now.some(x => x.o.src === 'text')) imp.text = '';
  slip.sels = []; slip.copy = null; setStakeMoney(0); slip.mode = 'single';
  imp.msg = ''; ui.msg = ''; ui.sheet = false;
  if (!imp.ops.length) { imp.open = false; ui.tab = 'apostas'; ui.filter = 'open'; renderSheet(); render(); window.scrollTo(0, 0); }
  else { render(); renderImport(); }                 // what was left out stays on the screen; the balance behind it is the new one
  toast(made > 1 ? `${made} apostas feitas. Boa sorte.` : 'Aposta feita. Boa sorte.');
}
export function dropOp(id: number): void { imp.ops = imp.ops.filter(o => o.id !== id); imp.msg = ''; renderImport(); }
/** A selection for a fight the original names without a bet: chosen from the fight's markets, or taken from another item of the list. */
export function pickFor(id: number, fid: string, key: string, from?: number): void {
  const o = opOf(id), src = from == null ? undefined : opOf(from); if (!o || !key) return;
  const it = src && baseOf(src).tip.items.find(x => x.fid === fid && x.key === key);
  o.picks = o.picks.filter(p => p.fid !== fid).concat({ fid, key, ...(it ? { printedOdd: it.printedOdd, src: src!.id } : {}) });
  imp.msg = ''; renderImport();
}
/** Takes a filled-in selection out again. One that was filled in automatically is not filled in again. */
export function unpickFor(id: number, fid: string): void {
  const o = opOf(id); if (!o) return;
  if (o.picks.some(p => p.fid === fid)) o.picks = o.picks.filter(p => p.fid !== fid); else if (!o.noauto.includes(fid)) o.noauto.push(fid);
  imp.msg = ''; renderImport();
}
/** The value typed for one item, in money or in units as the setting says. Empty goes back to what the original says. */
export function stakeFor(id: number, typed: string): void {
  const o = opOf(id); if (!o) return;
  const iu = S.stakeIn === 'units' && wallet().unit > 0, n = iu ? Core.parseUnits(typed) : parseMoney(typed);
  o.stake = n > 0 ? (iu ? { kind: 'units', units: n } : { kind: 'money', money: n }) : null;
  imp.msg = ''; renderImport();
}
/** Opens or closes the choices for correcting one selection that was read. */
export function swapFor(id: number, i: number): void { const o = opOf(id); if (!o) return; o.swap = o.swap === i ? null : i; renderImport(); }
/** Corrects one selection that was read: another selection of the same fight, or out of the bet. One the bet already
 *  has is ignored. Whatever warning the person had waved through is asked again, since the bet is another one now. */
export function editFor(id: number, i: number, key: string): void {
  const o = opOf(id), it = o && o.res.items[i]; if (!o || !it || !key) return;
  if (key !== '__drop' && filled(o).tip.items.some(x => x.fid === it.fid && x.key === key)) { o.swap = null; renderImport(); return; }
  o.edits[i] = key === '__drop' ? null : key; o.swap = null; o.force = false; imp.msg = ''; renderImport();
}
export function uneditFor(id: number, i: number): void { const o = opOf(id); if (!o) return; delete o.edits[i]; o.force = false; imp.msg = ''; renderImport(); }
/** "Bet it anyway", and its undo. */
export function forceFor(id: number): void { const o = opOf(id); if (!o) return; o.force = !o.force; imp.msg = ''; renderImport(); }
/** The text of one picture goes to the text field to be corrected by hand; "Ler texto" then reads it as the text bet. */
export function fixText(id: number): void { const o = opOf(id); if (!o) return; imp.text = o.text; imp.ops = imp.ops.filter(x => x !== o); imp.msg = ''; renderImport(); const el = $<HTMLTextAreaElement>('#imptext'); if (el) el.focus(); }
/** An origin used before, chosen with a tap; a second tap takes it off. */
export function setFrom(v: string): void { imp.from = imp.from.trim() === v ? '' : v; renderImport(); }
/** Unfolds or folds one item of the list. */
export function openFor(id: number): void { const o = opOf(id); if (!o) return; o.open = !o.open; renderImport(); }
export function modeFor(id: number, mode: string | undefined): void { const o = opOf(id); if (!o) return; o.mode = mode === 'single' ? 'single' : 'multi'; imp.msg = ''; renderImport(); }
/** Empties the copy screen: the text, the list, who it is from and any message. */
export function clearImport(): void { imp.text = ''; imp.ops = []; imp.err = ''; imp.msg = ''; imp.from = ''; photoSeq = 0; renderImport(); }
/** Closing keeps the text and the list: they are the person's work, and "Limpar" is there to throw them away. */
export function closeImport(): void { imp.open = false; imp.err = ''; imp.msg = ''; renderSheet(); render(); }
