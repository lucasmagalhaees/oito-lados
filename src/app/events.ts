import { Core } from '../core';
import { loadForm, loadOdds } from './api';
import { backupText, pickBackupFile, restoreFrom, saveBackupFile } from './backup';
import { $, CUR, blurField, fmtOf, isCurrency, money, parseMoney, pctText, valOf } from './format';
import { loadFx } from './fx';
import { inUnits, setStakeMoney, setStakeUnits, showStake, wallet } from './helpers';
import { clearImport, closeImport, dropOp, editFor, fixText, forceFor, importImages, importToSlip, modeFor, openFor, pasteClip, pickFor, pickOpen, placeAll, renderImport, runImport, setFrom, stakeFor, stepFor, swapFor, uneditFor, unitsFor, unpickFor } from './import';
import { paintList, place, render, renderSheet, slipSummary, toast } from './render';
import { doCashout, repeatBet } from './repeat';
import { D, S, applyTheme, bankEmpty, cleanCorners, curNow, imp, isDrop, saveCache, saveS, setCurrency, setS, settingsOf, slip, ui } from './state';
import { sync } from './sync';
import { applyUpdate, checkNow } from './update';
import { copyUsage, resetUsage, saveUsageFile } from './usage';
import type { Currency, Period } from '../core';
import type { Slip, Ui } from './state';

/* ================= events ================= */
// The currency is chosen where the money comes in. Picking another one only shows what the deposit will do;
// nothing changes until the deposit is made.
async function pickDepCur(code: string | undefined): Promise<void> {
  if (ui.fxBusy || !isCurrency(code)) return;
  ui.depCur = code; ui.fxMsg = ''; ui.fxRate = null;
  blurField();          // on iOS a tapped button does not take focus away from the field
  if (code !== S.cur && !bankEmpty()) {
    ui.fxBusy = true; render();
    try { ui.fxRate = Core.fxRate(await loadFx(), curNow(), code); } catch (e) { ui.fxMsg = 'Sem cotação agora: não deu pra falar com o serviço de câmbio. Tenta de novo com internet.'; }
    ui.fxBusy = false;
  }
  render();
}
// Moves the bankroll to another currency. With nothing in it there is nothing to convert and only the currency changes.
// Returns true when the bankroll is now in `to`; false when it stopped to show a message (no rate, or a rate nobody saw yet).
async function switchCurrency(to: Currency): Promise<boolean> {
  if (to === S.cur) return true;
  if (!bankEmpty()) {
    let fx: Awaited<ReturnType<typeof loadFx>> | null = null;
    ui.fxBusy = true; try { fx = await loadFx(); } catch (e) { /* handled below */ } ui.fxBusy = false;
    const rate = Core.fxRate(fx, curNow(), to);
    if (!rate || !fx) { ui.fxMsg = 'Sem cotação agora: não deu pra falar com o serviço de câmbio. Tenta de novo com internet.'; render(); return false; }
    if (ui.fxRate !== rate) { ui.fxRate = rate; ui.fxMsg = 'A cotação mudou. Confere o valor novo e confirma de novo.'; blurField(); render(); return false; }
    const from = curNow();
    setS(Core.convertState(S, to, rate));
    S.conv = [...(S.conv || []), { t: Date.now(), from, to, rate, date: fx.date }].slice(-20);
    setStakeMoney(0);
  }
  setCurrency(to);
  return true;
}
const depDone = (): void => { ui.depCur = null; ui.fxMsg = ''; ui.fxRate = null; blurField(); renderSheet(); render(); };
async function deposit(): Promise<void> {
  if (ui.fxBusy) return;
  const to = isCurrency(ui.depCur) ? ui.depCur : curNow(), v = parseMoney(valOf('#dep') || ui.dep), f = fmtOf(to);
  if (!v) { toast('Digita um valor pra depositar.'); return; }
  if (v > 1e9) { toast(`Calma, bilionário. Máximo de ${f.format(1e9)} por depósito.`); return; }
  const converted = to !== S.cur && !bankEmpty();
  if (!await switchCurrency(to)) return;
  S.deposits.push({ t: Date.now(), v }); saveS();
  ui.dep = ''; depDone(); toast(`${money(v)} fictícios na conta.${converted ? ` Banca convertida para ${CUR[to]}.` : ''}`);
}
// the same change of currency, without putting any money in
async function convertOnly(): Promise<void> {
  if (ui.fxBusy) return;
  const to = isCurrency(ui.depCur) ? ui.depCur : curNow();
  if (to === S.cur) return;
  const converted = !bankEmpty();
  if (!await switchCurrency(to)) return;
  saveS(); depDone(); toast(converted ? `Banca convertida para ${CUR[to]}: ${money(wallet().balance)} de saldo.` : `A banca agora é em ${CUR[to]}.`);
}
function applyMask(el: HTMLInputElement, typed: string | null): string {
  let v = el.value; const pos = el.selectionStart == null ? v.length : el.selectionStart;
  if (typed === '.' && !v.includes(',') && pos > 0) v = v.slice(0, pos - 1) + ',' + v.slice(pos);   // keypads without a comma key
  const before = v.slice(0, pos).replace(/[^\d,]/g, '').length;        // digits and comma to the left of the caret
  const m = Core.maskMoney(v);
  el.value = m;
  let k = 0, seen = 0;
  while (k < m.length && seen < before) { if (/[\d,]/.test(m[k])) seen++; k++; }
  try { el.setSelectionRange(k, k); } catch (err) { /* some input types have no caret API */ }
  return m;
}
/** One delegated listener per kind of event: every control on the page says what it does in `data-act`. */
export function initEvents(): void {
document.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  const b = t.closest<HTMLElement>('[data-act]'); if (!b) { if (t.id === 'sheet' && !imp.busy) { ui.sheet = false; if (imp.open) closeImport(); else { renderSheet(); render(); } } return; }
  const a = b.dataset.act, d = b.dataset;
  // on iOS a tapped button does not take the focus from the search field, and a focused field holds the screen as it
  // is: what is tapped in the list under the field repaints that list; anything else lets go of the field first
  const q = $<HTMLInputElement>('#q');
  if (q && document.activeElement === q && a !== 'qclear' && !b.closest('#list')) q.blur();
  if (a === 'tab') { ui.tab = d.tab as Ui['tab']; ui.sheet = false; ui.reset = false; ui.cash = null; renderSheet(); blurField(); render(); window.scrollTo(0, 0); }
  else if (a === 'event') { ui.eventId = d.id ?? null; if (!d.keep) ui.q = ''; blurField(); render(); loadOdds(ui.eventId, false).then(() => { saveCache(); render(); }); }
  else if (a === 'land') { ui.land = ui.land === d.c ? null : d.c || null; render(); }          // a country of the card on screen: a second tap lets go of it
  else if (a === 'part') { ui.part = d.p === 'main' || d.p === 'prelims' || d.p === 'early' ? d.p : null; render(); }
  else if (a === 'qclear') { ui.q = ''; if (q) { q.value = ''; q.focus(); } paintList(); }
  else if (a === 'refresh') { sync(true); render(); }
  else if (a === 'more') {
    const id = d.fid as string, f = D.fights.get(id);
    if (ui.open.has(id)) ui.open.delete(id); else { ui.open.add(id); if (f) loadForm([f.a.id, f.b.id]).then(() => { saveCache(); render(); }); }      // the latest fights of the two come with the details
    render();
  }
  else if (a === 'pick') {
    const fid = d.fid as string, key = d.key as string, g = key.split(':')[0];
    const i = slip.sels.findIndex(s => s.fid === fid && s.key === key);
    if (!slip.sels.length) slip.copy = null;                     // a slip started by hand is not a copy of anything
    if (i >= 0) slip.sels.splice(i, 1);
    else { slip.sels = slip.sels.filter(s => !(s.fid === fid && s.key.split(':')[0] === g)); slip.sels.push({ fid, key }); }
    if (!slip.sels.length) slip.copy = null;
    ui.msg = ''; render();
  }
  else if (a === 'unpick') { slip.sels = slip.sels.filter(s => !(s.fid === d.fid && s.key === d.key)); ui.msg = ''; if (!slip.sels.length) { ui.sheet = false; slip.copy = null; } renderSheet(); render(); }
  else if (a === 'sheet') { ui.sheet = !ui.sheet; ui.msg = ''; renderSheet(); }
  else if (a === 'imp') { imp.open = true; imp.err = ''; imp.msg = ''; ui.sheet = false; renderImport(); }
  else if (a === 'impclose') { if (!imp.busy) closeImport(); }
  else if (a === 'impread') { if (!imp.busy) runImport(valOf('#imptext') || ''); }
  else if (a === 'impgo') importToSlip(Number(d.op));
  else if (a === 'impall') placeAll();
  else if (a === 'impdrop') { if (!imp.busy && !imp.placing) dropOp(Number(d.op)); }
  else if (a === 'impclear') { if (!imp.busy && !imp.placing) clearImport(); }
  else if (a === 'impuse') pickFor(Number(d.op), d.fid as string, d.key as string, Number(d.from));
  else if (a === 'impunpick') unpickFor(Number(d.op), d.fid as string);
  else if (a === 'impmode') modeFor(Number(d.op), d.m);
  else if (a === 'impswap') swapFor(Number(d.op), Number(d.i));
  else if (a === 'impeditkey') editFor(Number(d.op), Number(d.i), d.key as string);
  else if (a === 'imppickopen') pickOpen(Number(d.op), d.fid as string);
  else if (a === 'imppickkey') pickFor(Number(d.op), d.fid as string, d.key as string);
  else if (a === 'impopen') openFor(Number(d.op));
  else if (a === 'impstep') stepFor(Number(d.op), Number(d.d));
  else if (a === 'impstu') unitsFor(Number(d.op), Number(d.u));
  else if (a === 'imppaste') pasteClip();
  else if (a === 'ustep') { if (wallet().unit > 0) { setStakeUnits(Core.stepUnits(slip.unitsN, Number(d.d))); showStake(); ui.msg = ''; slipSummary(); } }
  else if (a === 'impunedit') uneditFor(Number(d.op), Number(d.i));
  else if (a === 'impforce') forceFor(Number(d.op));
  else if (a === 'impfixtext') { if (!imp.busy && !imp.placing) fixText(Number(d.op)); }
  else if (a === 'impfromq') setFrom(d.v || '');
  else if (a === 'mode') { slip.mode = d.m as Slip['mode']; renderSheet(); }
  else if (a === 'stq') { const bal = wallet().balance, n = slip.mode === 'multi' ? 1 : Math.max(1, slip.sels.length); const v = d.v === 'max' ? Math.floor(bal / n * 100) / 100 : parseMoney(slip.stake) + Number(d.v); setStakeMoney(v); showStake(); ui.msg = ''; slipSummary(); }
  else if (a === 'stu') { if (wallet().unit > 0) { setStakeUnits(Number(d.u)); showStake(); ui.msg = ''; slipSummary(); } }
  else if (a === 'stakein') { S.stakeIn = d.m === 'units' ? 'units' : 'money'; saveS(); if (inUnits()) setStakeUnits(Core.parseUnits(slip.units)); ui.msg = ''; blurField(); renderSheet(); render(); toast(S.stakeIn === 'units' ? 'O cupom passa a pedir o valor em unidades.' : 'O cupom passa a pedir o valor em dinheiro.'); }
  else if (a === 'unit') {
    const raw = valOf('#unitpct'), n = parseFloat(String(raw).replace(',', '.'));
    if (!(n > 0)) { toast('Digita a porcentagem da banca que vale uma unidade.'); return; }
    S.unitPct = Core.unitPct(raw); saveS(); blurField(); render();
    toast(`Unidade: ${pctText(S.unitPct)}% da banca.`);
  }
  else if (a === 'place') place();
  else if (a === 'filter') { ui.filter = d.f as Ui['filter']; ui.cash = null; render(); }
  else if (a === 'origin') { ui.origin = d.v == null ? null : d.v; ui.cash = null; render(); }
  else if (a === 'period') { const m = d.m || ''; ui.period = m === 'event' || Object.prototype.hasOwnProperty.call(Core.PERIOD_DAYS, m) ? m as Period : 'all'; render(); }
  else if (a === 'stmtall') { ui.stmtAll = !ui.stmtAll; render(); }
  else if (a === 'sinceok' || a === 'sinceview') { S.seen = Date.now(); saveS(); if (a === 'sinceview') { ui.tab = 'apostas'; ui.filter = 'done'; ui.origin = null; ui.sheet = false; renderSheet(); window.scrollTo(0, 0); } render(); }
  else if (a === 'copydrop') { const v = Number(d.m); if (isDrop(v)) S.copyDrop = v; else delete S.copyDrop; saveS(); render(); }
  else if (a === 'orgpick') {
    // marked on the spot: with the name being typed, the field holds the screen as it is and nothing is repainted
    ui.orgFrom = d.k || '';
    for (const x of document.querySelectorAll<HTMLElement>('#orgfrom button')) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); }
  }
  else if (a === 'orgrename') {
    const on = $<HTMLElement>('#orgfrom button.on'), from = (on && on.dataset.k) || '', r = Core.renameOrigin(S.bets, from, valOf('#orgto'));
    if (!r.n) { toast('Escolhe a origem e escreve o nome novo.'); return; }
    S.bets = r.bets; ui.orgFrom = null; saveS(); blurField(); render(); toast(`${r.n} ${r.n > 1 ? 'apostas mudaram' : 'aposta mudou'} de origem.`);
  }
  else if (a === 'cash') { ui.cash = d.id || null; ui.cashMsg = ''; render(); }
  else if (a === 'docash') doCashout(d.id);
  else if (a === 'again') repeatBet(d.id);
  else if (a === 'depq') { ui.dep = Core.moneyText(parseMoney(ui.dep) + Number(d.v)); const el = $<HTMLInputElement>('#dep'); if (el) el.value = ui.dep; }
  else if (a === 'theme') { if (d.m === 'light' || d.m === 'dark') S.theme = d.m; else delete S.theme; saveS(); applyTheme(); render(); }
  else if (a === 'corners') { const c = cleanCorners({ ...S.corners, [d.g === 'women' ? 'women' : 'men']: d.m }); if (c) S.corners = c; else delete S.corners; saveS(); render(); }
  else if (a === 'update') applyUpdate();
  else if (a === 'checkupdate') checkNow();
  else if (a === 'depcur') pickDepCur(d.c);
  else if (a === 'deposit') deposit();
  else if (a === 'convonly') convertOnly();
  else if (a === 'bksave') saveBackupFile();
  else if (a === 'usagesave') saveUsageFile();
  else if (a === 'usagecopy') copyUsage();
  else if (a === 'usagereset') resetUsage();
  else if (a === 'usagehours') { ui.usageHours = !ui.usageHours; render(); }
  else if (a === 'bkapply') { if (!ui.restoreFile || !restoreFrom(ui.restoreFile.text)) toast('Esse arquivo não é um backup do Oito Lados.'); }
  else if (a === 'bkcancel') { ui.restoreFile = null; render(); }
  else if (a === 'backup') {
    const txt = backupText(Date.now());
    const fail = (): void => { ui.backup = txt; render(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => toast('Backup copiado. Cola nas Notas pra guardar.'), fail); else fail();
  }
  else if (a === 'restore') { ui.restore = !ui.restore; ui.restoreFile = null; render(); }
  else if (a === 'dorestore') { if (!restoreFrom(valOf('#rs') || '')) toast('Esse texto não é um backup válido.'); }

  else if (a === 'reset') { ui.reset = !ui.reset; render(); }
  else if (a === 'doreset') { setS({ v: 1, deposits: [], bets: [], cur: S.cur, ...settingsOf(S), seen: Date.now() }); saveS(); slip.sels = []; slip.copy = null; ui.reset = false; render(); toast('Simulação zerada.'); }
});
document.addEventListener('input', e => {
  const t = e.target as HTMLInputElement, typed = (e as InputEvent).data;
  if (t.id === 'stake') { setStakeMoney(parseMoney(applyMask(t, typed))); slip.stake = t.value; ui.msg = ''; slipSummary(); }
  else if (t.id === 'stakeu') { const u = Core.maskUnits(t.value); if (t.value !== u) t.value = u; setStakeUnits(Core.parseUnits(u)); slip.units = u; ui.msg = ''; slipSummary(); }
  else if (t.id === 'dep') ui.dep = applyMask(t, typed);
  else if (t.id === 'q') { ui.q = t.value; paintList(); }
  else if (t.id === 'imptext') imp.text = t.value;
  else if (t.id === 'impfrom') imp.from = t.value;
  else if (t.classList.contains('opstake')) { const v = S.stakeIn === 'units' && wallet().unit > 0 ? Core.maskUnits(t.value) : Core.maskMoney(t.value); if (t.value !== v) t.value = v; }
});
document.addEventListener('change', e => {
  const t = e.target as HTMLInputElement;
  if (t.id === 'impfile') importImages([...(t.files || [])]);
  else if (t.id === 'bkfile') pickBackupFile((t.files || [])[0]);
  else if (t.classList.contains('opstake')) stakeFor(Number(t.dataset.op), t.value);
});
document.addEventListener('paste', e => {
  if (!imp.open || imp.busy) return;
  const f = [...((e.clipboardData && e.clipboardData.files) || [])].find(x => /^image\//.test(x.type));
  if (f) { e.preventDefault(); importImages([f]); }
});
document.addEventListener('keydown', e => {
  const id = (e.target as HTMLElement).id, press = (act: string): void => { const b = document.querySelector<HTMLElement>(`[data-act="${act}"]`); if (b) b.click(); };
  if (e.key === 'Escape' && (ui.sheet || imp.open) && !imp.busy) { ui.sheet = false; if (imp.open) closeImport(); else { renderSheet(); render(); } }
  if (e.key === 'Enter' && id === 'unitpct') press('unit');
  if (e.key === 'Enter' && id === 'dep') press('deposit');
  if (e.key === 'Enter' && id === 'q') { blurField(); render(); }          // "buscar" on the keyboard puts it away; the list is already there
});
}
