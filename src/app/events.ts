import { Core } from '../core';
import { loadOdds } from './api';
import { $, CUR, blurField, fmtOf, isCurrency, money, parseMoney, pctText, valOf } from './format';
import { loadFx } from './fx';
import { inUnits, setStakeMoney, setStakeUnits, showStake, wallet } from './helpers';
import { closeImport, importImage, importToSlip, renderImport, runImport } from './import';
import { place, render, renderSheet, slipSummary, toast } from './render';
import { doCashout, repeatBet } from './repeat';
import { S, applyTheme, bankEmpty, cleanCorners, curNow, imp, saveCache, saveS, setCurrency, setS, settingsOf, slip, ui, validState } from './state';
import { sync } from './sync';
import { applyUpdate, checkNow } from './update';
import type { Currency } from '../core';
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
  const b = t.closest<HTMLElement>('[data-act]'); if (!b) { if (t.id === 'sheet' && !imp.busy) { ui.sheet = false; imp.open = false; renderSheet(); render(); } return; }
  const a = b.dataset.act, d = b.dataset;
  if (a === 'tab') { ui.tab = d.tab as Ui['tab']; ui.sheet = false; ui.reset = false; ui.cash = null; renderSheet(); blurField(); render(); window.scrollTo(0, 0); }
  else if (a === 'event') { ui.eventId = d.id ?? null; render(); loadOdds(ui.eventId, false).then(() => { saveCache(); render(); }); }
  else if (a === 'refresh') { sync(true); render(); }
  else if (a === 'more') { const id = d.fid as string; if (ui.open.has(id)) ui.open.delete(id); else ui.open.add(id); render(); }
  else if (a === 'pick') {
    const fid = d.fid as string, key = d.key as string, g = key.split(':')[0];
    const i = slip.sels.findIndex(s => s.fid === fid && s.key === key);
    if (i >= 0) slip.sels.splice(i, 1);
    else { slip.sels = slip.sels.filter(s => !(s.fid === fid && s.key.split(':')[0] === g)); slip.sels.push({ fid, key }); }
    ui.msg = ''; render();
  }
  else if (a === 'unpick') { slip.sels = slip.sels.filter(s => !(s.fid === d.fid && s.key === d.key)); ui.msg = ''; if (!slip.sels.length) ui.sheet = false; renderSheet(); render(); }
  else if (a === 'sheet') { ui.sheet = !ui.sheet; ui.msg = ''; renderSheet(); }
  else if (a === 'imp') { imp.open = true; imp.res = null; imp.err = ''; ui.sheet = false; renderImport(); }
  else if (a === 'impclose') { if (!imp.busy) closeImport(); }
  else if (a === 'impread') { if (!imp.busy) runImport(valOf('#imptext') || ''); }
  else if (a === 'impgo') importToSlip();
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
  else if (a === 'backup') {
    const txt = JSON.stringify(S);
    const fail = (): void => { ui.backup = txt; render(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => toast('Backup copiado. Cola nas Notas pra guardar.'), fail); else fail();
  }
  else if (a === 'restore') { ui.restore = !ui.restore; render(); }
  else if (a === 'dorestore') {
    let s: unknown = null; try { s = JSON.parse(valOf('#rs') || ''); } catch (err) { /* handled below */ }
    if (!validState(s)) { toast('Esse texto não é um backup válido.'); return; }
    setS({ v: 1, deposits: s.deposits.filter(x => x && x.v > 0 && x.t), bets: s.bets.filter(x => x && Array.isArray(x.legs) && x.stake > 0), ...settingsOf(s) });
    if (Array.isArray(s.conv)) S.conv = s.conv.filter(c => c && isCurrency(c.from) && isCurrency(c.to) && c.rate > 0 && c.t && typeof c.date === 'string').slice(-20); setCurrency(s.cur); applyTheme(); saveS(); ui.restore = false; blurField(); render(); toast('Backup restaurado.'); sync(true);
  }
  else if (a === 'reset') { ui.reset = !ui.reset; render(); }
  else if (a === 'doreset') { setS({ v: 1, deposits: [], bets: [], cur: S.cur, ...settingsOf(S) }); saveS(); slip.sels = []; ui.reset = false; render(); toast('Simulação zerada.'); }
});
document.addEventListener('input', e => {
  const t = e.target as HTMLInputElement, typed = (e as InputEvent).data;
  if (t.id === 'stake') { setStakeMoney(parseMoney(applyMask(t, typed))); slip.stake = t.value; ui.msg = ''; slipSummary(); }
  else if (t.id === 'stakeu') { const u = Core.maskUnits(t.value); if (t.value !== u) t.value = u; setStakeUnits(Core.parseUnits(u)); slip.units = u; ui.msg = ''; slipSummary(); }
  else if (t.id === 'dep') ui.dep = applyMask(t, typed);
  else if (t.id === 'imptext') imp.text = t.value;
});
document.addEventListener('change', e => { const t = e.target as HTMLInputElement; if (t.id === 'impfile') importImage(t.files && t.files[0]); });
document.addEventListener('paste', e => {
  if (!imp.open || imp.busy) return;
  const f = [...((e.clipboardData && e.clipboardData.files) || [])].find(x => /^image\//.test(x.type));
  if (f) { e.preventDefault(); importImage(f); }
});
document.addEventListener('keydown', e => {
  const id = (e.target as HTMLElement).id, press = (act: string): void => { const b = document.querySelector<HTMLElement>(`[data-act="${act}"]`); if (b) b.click(); };
  if (e.key === 'Escape' && (ui.sheet || imp.open) && !imp.busy) { ui.sheet = false; imp.open = false; renderSheet(); render(); }
  if (e.key === 'Enter' && id === 'unitpct') press('unit');
  if (e.key === 'Enter' && id === 'dep') press('deposit');
});
}
