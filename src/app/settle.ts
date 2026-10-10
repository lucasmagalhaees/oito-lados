import { Core } from '../core';
import { openBets } from './api';
import { DAY, H, money, signed } from './format';
import { toast } from './render';
import { D, saveS } from './state';
import type { Bet, Fight, Leg, Outcome, Result } from '../core';

/* ================= settlement ================= */
const DEC: Record<string, string> = { 'Decision - Unanimous': 'unânime', 'Decision - Split': 'dividida', 'Decision - Majority': 'majoritária' };
export function resultText(f: Fight, res: Result | null | undefined): string {
  if (f.canceled) return 'Luta cancelada';
  if (!res) return 'Encerrada · aguardando resultado oficial';
  const td = D.td[f.id], tds = td ? ` · quedas ${td.a}–${td.b}` : '';
  if (res.method === 'nc') return 'No contest' + tds;
  if (res.method === 'draw') return 'Empate' + tds;
  const w = f.winner ? f[f.winner].last : '—';
  const how = res.method === 'unknown' ? (res.label || 'resultado sem método') : Core.ML[res.method];
  const when = res.method === 'dec' ? `${res.round} rounds` : `R${res.round} ${res.clock}`;
  return `${w} venceu por ${how}${res.method === 'dec' && DEC[res.label] ? ' ' + DEC[res.label] : ''} · ${when}${tds}`;
}
export function legOut(l: Leg, early: boolean): Outcome | null {
  const f = D.fights.get(l.fid);
  if (!f) return (D.lastSync && D.from <= l.date - DAY && Date.now() > l.date + 36 * H) ? 'void' : null;   // bout dropped from the card
  return Core.legOutcome(l.key, f, D.results[l.fid], D.td[l.fid], early);
}
export function settle(): void {
  let n = 0, last: Bet | null = null;
  for (const b of openBets()) {
    const outs = b.legs.map(l => legOut(l, false));
    const r = Core.betResult(b, outs);
    if (!r) continue;
    b.status = r.status; b.payout = r.payout; b.settledAt = Date.now();
    b.legs.forEach((l, i) => { l.out = outs[i]; const f = D.fights.get(l.fid); if (f) l.res = resultText(f, D.results[l.fid]); });
    n++; last = b;
  }
  if (n && last) {
    saveS();
    toast(n > 1 ? `${n} apostas encerradas. Confere em Apostas.` : last.status === 'won' ? `Aposta ganha: ${signed(last.payout - last.stake)}` : last.status === 'lost' ? `Aposta perdida: ${signed(-last.stake)}` : `Aposta anulada: ${money(last.stake)} devolvidos`);
  }
}
