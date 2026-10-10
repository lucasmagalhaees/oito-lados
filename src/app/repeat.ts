import { loadBoard, loadOdds, loadResults } from './api';
import { CASH_WHY, cashoutOf } from './cashout';
import { money, signed } from './format';
import { canBet, priceOf, setStakeMoney } from './helpers';
import { render, renderSheet, toast } from './render';
import { legOut, resultText, settle } from './settle';
import { D, S, saveCache, saveS, slip, ui } from './state';
import type { Bet } from '../core';

/* ================= repeat a bet ================= */
// A bet can be repeated while every one of its selections is still open for betting at some price.
export const repeatable = (b: Bet): boolean => b.legs.length > 0 && b.legs.every(l => { const f = D.fights.get(l.fid), p = f && canBet(f) ? priceOf(f) : null; return !!(p && p.map[l.key]); });
// Repeating only fills the slip (same selections, same kind, same stake) and opens it: the bet is still placed by the
// usual button, at today's odds, after the usual check with the source.
export function repeatBet(id: string | undefined): void {
  const b = S.bets.find(x => x.id === id);
  if (!b || !repeatable(b)) { render(); return; }
  slip.sels = b.legs.map(l => ({ fid: l.fid, key: l.key }));
  slip.mode = b.type === 'multi' ? 'multi' : 'single';
  setStakeMoney(b.stake);
  ui.msg = ''; ui.cash = null; ui.sheet = true;
  renderSheet(); render();
}
export async function doCashout(id: string | undefined): Promise<void> {
  if (ui.cashing) return;
  const b = S.bets.find(x => x.id === id && x.status === 'open');
  const before = b ? cashoutOf(b) : null;
  if (!b || !before || !before.ok) { ui.cash = null; render(); return; }
  ui.cashing = true; ui.cashMsg = ''; render();
  // same rule as placing a bet: ask the source right now whether a fight has started, and for today's prices of what is left
  try {
    await loadBoard();
    const byEv = new Map<string, string[]>();
    for (const l of b.legs) { const f = D.fights.get(l.fid); if (f && f.state === 'pre') byEv.set(f.eventId, [...new Set([...(byEv.get(f.eventId) || []), f.id])]); }
    if (before.kind === 'market') for (const [eid, fids] of byEv) await loadOdds(eid, true, fids);
    await loadResults();
    D.lastSync = Date.now(); D.err = null;
  } catch (e) { ui.cashing = false; ui.cashMsg = 'Sem conexão com a ESPN. Não deu pra confirmar o cashout, tenta de novo.'; render(); return; }
  ui.cashing = false;
  settle();                                    // a result may have come in while we were asking
  if (b.status !== 'open') { ui.cash = null; render(); return; }
  const c = cashoutOf(b);
  if (!c.ok) { ui.cash = null; render(); toast(CASH_WHY[c.why] || 'Cashout indisponível.'); return; }
  if (Math.abs(c.value - before.value) > 0.004) { ui.cashMsg = `O valor mudou para ${money(c.value)}. Confere e confirma de novo.`; render(); return; }
  const outs = b.legs.map(l => legOut(l, false));
  b.status = 'cashed'; b.payout = c.value; b.settledAt = Date.now(); b.cash = c.kind === 'market' ? { kind: c.kind, full: c.full || null, chance: c.chance || null } : { kind: c.kind, full: null, chance: null };
  b.legs.forEach((l, i) => { l.out = outs[i]; const f = D.fights.get(l.fid); if (f && f.state === 'post') l.res = resultText(f, D.results[l.fid]); });
  saveS(); saveCache(); ui.cash = null; render();
  toast(c.kind === 'market' ? `Aposta encerrada por ${money(c.value)} (${signed(c.value - b.stake)}).` : `Cashout feito: ${money(c.value)} de volta no saldo.`);
}
