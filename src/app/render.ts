import { Core } from '../core';
import { loadBoard, loadOdds, openBets } from './api';
import { CASH_WHY, cashoutOf } from './cashout';
import { $, CUR, WEIGHT, dDay, dTime, dWhen, dateBR, esc, fmtOf, fo, fu, isCurrency, money, part, pctText, rateText, signed, signedU, sym, symbolOf } from './format';
import { FX } from './fx';
import { canBet, inUnits, priceOf, setStakeMoney, slipCalc, wallet } from './helpers';
import { TIP_MODE, renderImport } from './import';
import { repeatable } from './repeat';
import { legOut, resultText } from './settle';
import { D, S, bankEmpty, imp, saveCache, saveS, slip, ui } from './state';
import { busy, shownEvents } from './sync';
import { builtFrom, canUpdate } from './update';
import type { Bet, Currency, Fight, FightEvent, Leg, Option, Outcome, Side } from '../core';
import type { Resolved, Wallet } from './helpers';

/* ================= rendering ================= */
let toastT: ReturnType<typeof setTimeout> | undefined;
export function toast(t: string): void { const el = part('toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 4200); }

export function render(): void {
  const w = wallet();
  part('bal').textContent = money(w.balance);
  const nOpen = w.open.length;
  const ico: Record<string, string> = {
    lutas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3z"/></svg>',
    apostas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/><path d="M10 8v8" stroke-dasharray="2 2.5"/></svg>',
    carteira: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-5 4 3 8-8"/><path d="M15 7h5v5"/></svg>'
  };
  part('tabs').innerHTML = [['lutas', 'Lutas'], ['apostas', 'Apostas'], ['carteira', 'Carteira']].map(([k, t]) =>
    `<button class="tab ${ui.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}" ${ui.tab === k ? 'aria-current="page"' : ''}>${ico[k]}${t}${k === 'apostas' && nOpen ? `<span class="badge">${nOpen}</span>` : ''}</button>`).join('');
  const v = part('view'), ae = document.activeElement;
  if (!(ae && v.contains(ae) && /^(INPUT|TEXTAREA)$/.test(ae.tagName))) {       // never yank a field the person is typing in
    v.innerHTML = ui.tab === 'lutas' ? vLutas() : ui.tab === 'apostas' ? vApostas() : vCarteira(w);
    if (ui.tab === 'carteira') bindChart();
  }
  renderSlipBar();
}
export function renderSlipBar(): void {
  const n = slip.sels.length, bar = part('slipbar');
  bar.hidden = !n || ui.sheet || imp.open;
  if (!n) return;
  const c = slipCalc();
  part('slipbtn').innerHTML = `<span>Cupom · ${n} ${n > 1 ? 'seleções' : 'seleção'}</span><span>${c.ok && c.multiOk ? (c.sameFight ? 'Combinada ' : 'Múltipla ') + fo(c.odd) : c.ok && n === 1 ? fo(c.odd) : 'Abrir'} ›</span>`;
}

export function evLabel(e: Pick<FightEvent, 'name'>): { top: string; main: string } {
  const i = e.name.indexOf(':');
  const pre = (i > 0 ? e.name.slice(0, i) : e.name).replace(/^Dana White's /, ''), post = i > 0 ? e.name.slice(i + 1).trim() : '';
  return { top: post ? pre : 'UFC', main: post || pre };
}
function vLutas(): string {
  const evs = shownEvents();
  if (!evs.length) return D.err
    ? `<div class="warn">Não consegui falar com a ESPN (${esc(D.err)}). Confere a internet e tenta de novo.</div><p class="empty"><button class="btn" data-act="refresh">Tentar de novo</button></p>`
    : `<p class="empty">${D.lastSync ? 'Nenhum evento do UFC nos próximos dias.' : 'Buscando o card na ESPN…'}</p>`;
  const ev = evs.find(e => e.id === ui.eventId) || evs[0];
  const chips = evs.map(e => { const l = evLabel(e); return `<button class="ev ${e.id === ev.id ? 'on' : ''}" data-act="event" data-id="${esc(e.id)}"><small>${esc(l.top)}</small><b>${esc(l.main)}</b><small>${esc(dDay.format(e.date))}${e.completed ? ' · encerrado' : ''}</small></button>`; }).join('');
  const priced = ev.fights.map(f => D.odds[f.id]).find(Boolean), book = priced ? priced.book : undefined;
  const info = D.err ? `Sem conexão com a ESPN · dados de ${D.lastSync ? dTime.format(D.lastSync) : '—'}` : `${book ? 'Odds ' + esc(book) + ' via ESPN' : 'Dados ESPN'} · atualizado às ${dTime.format(D.lastSync || Date.now())}`;
  let h = `<div class="events">${chips}</div><div class="sync"><span>${info}</span><button data-act="refresh">${busy ? 'Atualizando…' : 'Atualizar'}</button></div>`;
  h += `<button class="btn ghost block" data-act="imp" style="margin-top:10px">Copiar aposta de um print ou texto</button>`;
  if (!S.deposits.length) h += `<div class="cta"><p><b>Saldo fictício zerado.</b> Coloca quanto quiser pra começar a simular.</p><button class="btn" data-act="tab" data-tab="carteira">Depositar</button></div>`;
  const times = [...new Set(ev.fights.map(f => f.date))].sort((a, b) => b - a);
  const main = Math.max(...ev.fights.map(f => f.idx));
  times.forEach((t, i) => {
    h += `<div class="seg label">${i === 0 ? 'Card principal' : i === times.length - 1 && times.length > 2 ? 'Primeiras preliminares' : 'Preliminares'} · ${esc(dWhen.format(t))}</div>`;
    ev.fights.filter(f => f.date === t).sort((a, b) => b.idx - a.idx).forEach(f => { h += fightCard(f, f.idx === main); });
  });
  return h;
}
// the mark in front of a selection's name: the corner colour for a fighter's, the arrow for an over or an under
export const sideDot = (key: string): string => { const sd = Core.sideOf(key), ou = Core.overUnder(key); return sd ? `<i class="sd ${sd}"></i>` : ou ? `<i class="ou ${ou}"></i>` : ''; };
function optBtn(f: Fight, x: Option, cls?: string): string {
  const on = slip.sels.some(s => s.fid === f.id && s.key === x.key);
  const side = cls === 'ml' ? null : Core.sideOf(x.key);        // the winner buttons already sit on the fighter's own row
  const whose = side ? ` title="${esc(f[side].name)} · canto ${side === 'a' ? 'vermelho' : 'azul'}"` : '';
  const ou = Core.overUnder(x.key);
  return `<button class="opt ${cls || ''} ${side ? 's' + side : ''} ${ou ? 'x' + ou : ''} ${on ? 'on' : ''}" data-act="pick" data-fid="${esc(f.id)}" data-key="${esc(x.key)}" aria-pressed="${on}"${whose}>${cls === 'ml' ? '' : `<span class="ol">${esc(x.label)}</span>`}<span class="ov">${x.src === 'est' ? '<i class="est" title="odd estimada">≈</i>' : ''}${fo(x.odd)}</span></button>`;
}
function fightCard(f: Fight, isMain: boolean): string {
  const p = priceOf(f), can = canBet(f), res = D.results[f.id];
  const state = f.canceled ? '<span class="chip">Cancelada</span>'
    : f.state === 'in' ? `<span class="chip live"><i class="dot"></i>AO VIVO · R${f.period} ${esc(f.clock)}</span>`
    : f.state === 'post' ? '<span class="chip">Encerrada</span>' : '';
  const side = (k: Side): string => {
    const x = f[k], ml = p && p.groups[0].opts.find(o => o.key === 'ml:' + k);
    const first = x.name.endsWith(x.last) ? x.name.slice(0, x.name.length - x.last.length).trim() : x.name;
    const right = can && ml ? optBtn(f, ml, 'ml') : ml ? `<button class="opt ml" disabled><span class="ov">${fo(ml.odd)}</span></button>` : f.state === 'pre' ? '<span class="noodds">sem odds ainda</span>' : '';
    return `<div class="row ${k}"><i class="corner"></i><div class="who"><b>${esc(x.last)}</b><span>${esc(first)}${x.record ? ' · ' + esc(x.record) : ''}${f.state === 'post' && f.winner === k ? ' · <span class="w">venceu</span>' : ''}</span></div>${right}</div>`;
  };
  let h = `<article class="fight"><div class="fh">${isMain ? '<span class="tag">Luta principal</span>' : ''}<span>${esc(WEIGHT[f.weight] || f.weight)} · ${f.rounds} rounds</span>${state}</div>${side('a')}${side('b')}`;
  if (f.state === 'post') h += `<div class="result">${esc(resultText(f, res))}</div>`;
  else if (f.state === 'in' && D.td[f.id]) h += `<div class="result">Quedas até agora: ${esc(f.a.last)} ${D.td[f.id].a} · ${esc(f.b.last)} ${D.td[f.id].b}</div>`;
  if (can && p) {
    const open = ui.open.has(f.id), extra = p.groups.length - 1;
    h += `<button class="more" data-act="more" data-fid="${esc(f.id)}" aria-expanded="${open}"><span>${open ? 'Fechar mercados' : `Método, rounds e quedas (+${extra} mercados)`}</span><span>${open ? '−' : '+'}</span></button>`;
    if (open) {
      // stays in view while the markets scroll, so the corner colours can be read without going back up to the names
      h += `<div class="mk"><div class="corners" aria-label="Cores dos cantos"><span class="a"><i></i>${esc(f.a.last)}</span><span class="b"><i></i>${esc(f.b.last)}</span></div>`;
      for (const g of p.groups.slice(1)) {
        h += `<h4><span class="label">${esc(g.title)}</span>${g.note ? `<em>${esc(g.note)}</em>` : ''}</h4><div class="grid g${g.cols}">`;
        if (g.heads) h += `<div class="colh"><i></i>${esc(f.a.last)}</div><div class="colh b"><i></i>${esc(f.b.last)}</div>`;
        h += g.opts.map(x => optBtn(f, x)).join('') + '</div>';
      }
      h += `<p class="legend">≈ odd estimada pelo modelo do app a partir das linhas reais e do histórico dos lutadores. Sem o símbolo, é a odd publicada pela ${esc(D.odds[f.id].book)}.</p><p class="legend">Dá pra combinar seleções desta luta no mesmo cupom, tipo KO/TKO com +1.5 rounds.</p></div>`;
    }
  }
  return h + '</article>';
}

const isCombo = (b: Bet): boolean => b.type === 'multi' && new Set(b.legs.map(l => l.fid)).size === 1;
const GLY: Record<Outcome, string> = { won: '✓', lost: '✕', void: '↺' };
const PILL: Record<Bet['status'], string> = { open: 'Aberta', won: 'Ganhou', lost: 'Perdeu', void: 'Anulada', cashed: 'Cashout' };
function vApostas(): string {
  const open = openBets().sort((a, b) => b.t - a.t), done = S.bets.filter(b => b.status !== 'open').sort((a, b) => (b.settledAt || 0) - (a.settledAt || 0));
  const list = ui.filter === 'open' ? open : done;
  let h = `<div class="filter"><button class="${ui.filter === 'open' ? 'on' : ''}" data-act="filter" data-f="open">Abertas (${open.length})</button><button class="${ui.filter === 'done' ? 'on' : ''}" data-act="filter" data-f="done">Encerradas (${done.length})</button></div>`;
  if (!list.length) return h + `<p class="empty">${ui.filter === 'open' ? 'Nenhuma aposta aberta. Escolhe uma odd em Lutas pra montar o cupom.' : 'Nada encerrado ainda. As apostas fecham sozinhas quando sai o resultado oficial.'}</p>`;
  for (const b of list) {
    const isOpen = b.status === 'open';
    const anyLive = isOpen && b.legs.some(l => { const f = D.fights.get(l.fid); return f && f.state === 'in'; });
    const odd = b.odd || Core.r2(b.legs.reduce((p, l) => p * l.odd, 1)), same = isCombo(b);
    h += `<article class="bet"><div class="bh"><b>${b.type === 'multi' ? `${same ? 'Combinada' : 'Múltipla'} · ${b.legs.length} seleções` : 'Simples'}</b><span class="pill ${anyLive ? 'live' : b.status}">${anyLive ? 'Ao vivo' : PILL[b.status]}</span></div>`;
    for (const l of b.legs) {
      const f = D.fights.get(l.fid), out = isOpen ? legOut(l, true) : l.out;
      let cls: string = out || '', g = out ? GLY[out] : '', line2: string;
      if (isOpen && f && f.state === 'in') {
        const td = D.td[l.fid];
        if (!out) { cls = 'live'; g = '●'; }
        line2 = `<span class="lv">AO VIVO · R${f.period} ${esc(f.clock)}${td && /^td/.test(l.key) ? ` · quedas ${td.a}–${td.b}` : ''}${out === 'won' ? ' · já bateu' : out === 'lost' ? ' · já perdeu' : ''}</span>`;
      } else if (f && f.state === 'post') line2 = `<span>${esc(resultText(f, D.results[l.fid]))}</span>`;
      else if (!isOpen && l.res) line2 = `<span>${esc(l.res)}</span>`;
      else line2 = `<span>${esc(dWhen.format(l.date))}</span>`;
      h += `<div class="leg"><i class="g ${cls}" aria-label="${out ? PILL[out] : 'pendente'}">${g}</i><div class="t"><b>${sideDot(l.key)}${esc(l.sel)}</b><span>${esc(l.market)} · ${esc(l.fight)}</span>${line2}</div><span class="o">${l.src === 'est' ? '≈' : ''}${fo(l.odd)}</span></div>`;
    }
    const profit = b.payout - b.stake;
    h += `<div class="bf"><div><small>Apostado</small><b>${money(b.stake)}</b>${b.unit && b.unit > 0 ? `<span class="un">${fu(b.stake / b.unit)}</span>` : ''}</div><div><small>Odd</small><b>${fo(odd)}</b></div>` +
      (isOpen ? `<div><small>Retorno</small><b>${money(Core.r2(b.stake * odd))}</b></div>`
        : `<div><small>Resultado</small><b class="${profit > 0 ? 'pos' : profit < 0 ? 'neg' : ''}">${signed(profit)}</b></div>`) + '</div>';
    const again = repeatable(b) ? `<button class="btn ghost" data-act="again" data-id="${esc(b.id)}">Repetir aposta</button>` : '';
    if (isOpen) {
      const c = cashoutOf(b);
      if (c.ok && ui.cash === b.id) h += `<div class="rowbtns co"><button class="btn" data-act="docash" data-id="${esc(b.id)}" ${ui.cashing ? 'disabled' : ''}>${ui.cashing ? 'Conferindo na ESPN…' : (c.kind === 'market' ? 'Confirmar: encerrar por ' : 'Confirmar: devolver ') + money(c.value)}</button><button class="btn ghost" data-act="cash" data-id="" ${ui.cashing ? 'disabled' : ''}>Manter aposta</button></div>`;
      else {
        if (!c.ok && CASH_WHY[c.why]) h += `<p class="hint co">${CASH_WHY[c.why]}</p>`;
        if (c.ok && c.kind === 'market') h += `<p class="hint co" data-cash="market">Oferta de cashout: ${money(c.full)} de retorno possível × ${Math.round(c.chance * 100)}% de chance do que falta, pelas odds de agora, menos ${Math.round(Core.CASHOUT_MARGIN * 100)}% de margem.</p>`;
        if (c.ok || again) h += `<div class="rowbtns co">${c.ok ? `<button class="btn ghost" data-act="cash" data-id="${esc(b.id)}">${c.kind === 'market' ? 'Encerrar por ' : 'Cashout · devolve '}${money(c.value)}</button>` : ''}${again}</div>`;
      }
      if (ui.cash === b.id && ui.cashMsg) h += `<p class="msg co">${esc(ui.cashMsg)}</p>`;
    } else if (again) h += `<div class="rowbtns co">${again}</div>`;
    h += `<p class="when">Feita em ${esc(dWhen.format(b.t))}${b.settledAt ? ' · encerrada em ' + esc(dWhen.format(b.settledAt)) + (b.status === 'cashed' ? ' por cashout' : '') : ''}</p></article>`;
  }
  return h;
}

function series(done: Bet[]): { y: number; b: Bet }[] { let c = 0; return done.slice().sort((a, b) => (a.settledAt || 0) - (b.settledAt || 0)).map(b => { c = Core.r2(c + b.payout - b.stake); return { y: c, b }; }); }
function bindChart(): void {
  const box = $('#chart'); if (!box) return;
  const pts = series(wallet().done), n = pts.length; if (!n) return;
  const W = Math.max(280, box.clientWidth), Hh = 200, L = 6, R = 10, T = 26, B = 24;
  const ys = [0, ...pts.map(p => p.y)], lo = Math.min(...ys), hi = Math.max(...ys), span = (hi - lo) || 1;
  const X = (i: number): number => L + (W - L - R) * (i / n), Y = (v: number): number => T + (Hh - T - B) * (1 - (v - lo) / span);
  const path: (string | number)[] = ['M', X(0), Y(0).toFixed(1)]; pts.forEach((p, i) => path.push('L', X(i + 1).toFixed(1), Y(p.y).toFixed(1)));
  const end = pts[n - 1], prev = n > 1 ? pts[n - 2].y : 0;
  let endUp = prev <= end.y; if (endUp && Y(end.y) < T + 22) endUp = false; if (!endUp && Y(end.y) > Hh - B - 24) endUp = true;
  box.innerHTML = `<svg viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" role="img" aria-label="Resultado acumulado depois de cada aposta encerrada">
    <line x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--line)" stroke-width="1.5" stroke-dasharray="4 4"/>
    <path d="${path.join(' ')} L ${X(n).toFixed(1)} ${Y(0).toFixed(1)} Z" fill="var(--gold-bg)" fill-opacity=".16" stroke="none"/>
    <path d="${path.join(' ')}" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <line id="cx" y1="${T}" y2="${Hh - B}" stroke="var(--muted)" stroke-width="1" visibility="hidden"/>
    <circle cx="${X(n)}" cy="${Y(end.y)}" r="4.5" fill="var(--gold)" stroke="var(--surface)" stroke-width="2"/>
    <circle id="cd" r="4.5" fill="var(--fg)" stroke="var(--surface)" stroke-width="2" visibility="hidden"/>
    <text x="${W - R}" y="${endUp ? Y(end.y) - 10 : Y(end.y) + 20}" font-size="13" font-weight="700" fill="var(--fg)" text-anchor="end">${esc(signed(end.y))}</text>
    <text x="${L}" y="14" font-size="11" fill="var(--muted)">pico ${esc(signed(hi))} · fundo ${esc(signed(lo))}</text>
    <text x="${L}" y="${Hh - 6}" font-size="11" fill="var(--muted)">início</text>
    <text x="${W - R}" y="${Hh - 6}" font-size="11" fill="var(--muted)" text-anchor="end">${n}ª aposta encerrada</text>
  </svg><div class="tip" id="tip" hidden></div>`;
  const svg = box.querySelector('svg')!, tip = part('tip'), cx = svg.querySelector('#cx')!, cd = svg.querySelector('#cd')!;
  const move = (e: PointerEvent): void => {
    const r = svg.getBoundingClientRect(), i = Math.max(1, Math.min(n, Math.round(((e.clientX - r.left) / r.width * W - L) / (W - L - R) * n)));
    const p = pts[i - 1], px = X(i) / W * r.width;
    cx.setAttribute('x1', String(X(i))); cx.setAttribute('x2', String(X(i))); cx.setAttribute('visibility', 'visible');
    cd.setAttribute('cx', String(X(i))); cd.setAttribute('cy', String(Y(p.y))); cd.setAttribute('visibility', 'visible');
    tip.hidden = false; tip.textContent = `${i}ª aposta: ${signed(p.b.payout - p.b.stake)} · acumulado ${signed(p.y)}`;
    tip.style.left = Math.max(tip.offsetWidth / 2, Math.min(r.width - tip.offsetWidth / 2, px)) + 'px';
  };
  const out = (): void => { tip.hidden = true; cx.setAttribute('visibility', 'hidden'); cd.setAttribute('visibility', 'hidden'); };
  svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move); svg.addEventListener('pointerleave', out);
}
interface Row { k: string; n: number; st: number; ret: number }
function breakdown(done: Bet[], keyOf: (b: Bet) => string): Row[] {
  const m = new Map<string, Row>();
  for (const b of done) { const k = keyOf(b); const r = m.get(k) || { k, n: 0, st: 0, ret: 0 }; r.n++; r.st += b.stake; r.ret += b.payout; m.set(k, r); }
  return [...m.values()].sort((a, b) => b.st - a.st);
}
function tblHtml(title: string, rows: Row[]): string {
  return `<div class="tbl"><table><thead><tr><th>${title}</th><th>Apostas</th><th>Apostado</th><th>Resultado</th></tr></thead><tbody>${rows.map(r => { const p = r.ret - r.st; return `<tr><td>${esc(r.k)}</td><td>${r.n}</td><td>${money(r.st)}</td><td class="${p > 0.004 ? 'pos' : p < -0.004 ? 'neg' : ''}">${signed(p)}</td></tr>`; }).join('')}</tbody></table></div>`;
}
function vCarteira(w: Wallet): string {
  let h = `<section class="hero"><span class="label">Saldo fictício</span><div class="n">${money(w.balance)}</div><p>${w.open.length ? `${money(w.atRisk)} em jogo em ${w.open.length} ${w.open.length > 1 ? 'apostas abertas' : 'aposta aberta'} · ` : ''}${money(w.dep)} depositados no total</p></section>`;
  const cur = S.cur || 'BRL', dc = isCurrency(ui.depCur) ? ui.depCur : cur, other = dc !== cur, conv = other && !bankEmpty(), rate = conv ? Core.fxRate(FX, cur, dc) : null, df = fmtOf(dc);
  h += `<section class="card"><span class="label">Depositar dinheiro de mentira</span>
    <div class="segm cur" role="group" aria-label="Moeda do depósito">${(Object.keys(CUR) as Currency[]).map(c => `<button class="${dc === c ? 'on' : ''}" data-act="depcur" data-c="${c}" aria-pressed="${dc === c}" ${ui.fxBusy ? 'disabled' : ''}>${esc(symbolOf(c))} ${CUR[c]}</button>`).join('')}</div>
    <div class="field"><span>${esc(symbolOf(dc))}</span><input id="dep" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(ui.dep)}" aria-label="Valor do depósito"></div>
    <div class="quick">${[100, 500, 1000, 5000].map(v => `<button data-act="depq" data-v="${v}">${df.format(v).replace(',00', '')}</button>`).join('')}</div>`;
  if (conv && ui.fxBusy) h += '<p class="hint" id="fxinfo">Buscando a cotação…</p>';
  else if (conv && rate && FX) h += `<p class="hint" id="fxinfo">Passar para ${CUR[dc]} troca a moeda da banca e converte tudo (depósitos e apostas) por <b>${esc(rateText(cur, dc, rate))}</b>, cotação de ${esc(dateBR(FX.date))}. Seu saldo de ${money(w.balance)} vira ${df.format(Core.r2(w.balance * rate))}.</p>`;
  else if (other && !conv) h += `<p class="hint" id="fxinfo">A banca passa a ser em ${CUR[dc]}.</p>`;
  if (ui.fxMsg) h += `<p class="msg" id="fxmsg">${esc(ui.fxMsg)}</p>`;
  h += `<button class="btn block" data-act="deposit" ${ui.fxBusy || (conv && !rate) ? 'disabled' : ''}>${conv ? 'Converter a banca e depositar' : 'Depositar'}</button>`;
  if (other) h += `<button class="btn ghost block" data-act="convonly" ${ui.fxBusy || (conv && !rate) ? 'disabled' : ''}>${conv ? 'Só converter a banca, sem depositar' : `Só trocar a moeda para ${CUR[dc]}`}</button>`;
  h += '</section>';
  const roi = w.staked ? w.pnl / w.staked * 100 : null;
  h += `<section class="card"><span class="label">Ganhos e perdas · apostas encerradas</span>
    <div class="pnl ${w.pnl > 0 ? 'pos' : w.pnl < 0 ? 'neg' : ''}">${signed(w.pnl)}</div>
    ${w.unitBets ? `<p class="hint" id="pnlu">${signedU(w.units)} em unidades, cada aposta medida pela unidade do dia em que foi feita.</p>` : ''}
    <div class="kpis"><div><small>Apostado</small><b>${money(w.staked)}</b></div><div><small>Retornado</small><b>${money(w.ret)}</b></div><div><small>ROI</small><b>${roi == null ? '—' : (roi > 0 ? '+' : '') + roi.toFixed(1).replace('.', ',') + '%'}</b></div><div><small>Acerto</small><b>${w.decided ? `${w.won}/${w.decided} · ${Math.round(w.won / w.decided * 100)}%` : '—'}</b></div></div>`;
  if (w.done.length) {
    h += `<span class="label">Resultado acumulado, aposta a aposta</span><div class="chart" id="chart"></div>`;
    h += tblHtml('Mercado', breakdown(w.done, b => isCombo(b) ? 'Combinada' : b.type === 'multi' ? 'Múltipla' : b.legs[0].cat));
    h += tblHtml('Evento', breakdown(w.done, b => { const s = new Set(b.legs.map(l => l.event)); return s.size === 1 ? evLabel({ name: [...s][0] }).main : 'Vários eventos'; }));
  } else h += '<p class="hint">O gráfico e a quebra por mercado aparecem quando a primeira aposta for encerrada.</p>';
  h += '</section>';
  const lastConv = (S.conv || []).slice(-1)[0];
  if (S.deposits.length) h += `<section class="card"><span class="label">Depósitos</span><div>${S.deposits.slice().reverse().slice(0, 8).map(d => `<div class="dep"><span>${esc(dWhen.format(d.t))}</span><b>${money(d.v)}</b></div>`).join('')}</div>${lastConv ? `<p class="hint" id="convlog">Banca convertida de ${CUR[lastConv.from]} para ${CUR[lastConv.to]} em ${esc(dWhen.format(lastConv.t))}, por ${esc(rateText(lastConv.from, lastConv.to, lastConv.rate))} (cotação de ${esc(dateBR(lastConv.date))}).</p>` : ''}</section>`;
  h += `<div class="seg label" id="config">Configurações</div>`;
  h += `<section class="card"><span class="label">Unidade</span>
    <div class="unit" id="unitnow">1u = ${money(w.unit)}</div>
    <p class="hint">${pctText(w.unitPct)}% da banca de ${money(w.bank)} (saldo mais o que está em jogo). Muda sozinha quando a banca muda.</p>
    <div class="field"><input id="unitpct" inputmode="decimal" autocomplete="off" value="${esc(pctText(w.unitPct))}" aria-label="Porcentagem da banca que vale uma unidade"><span>% da banca</span></div>
    <button class="btn ghost block" data-act="unit">Aplicar</button></section>`;
  const th = S.theme === 'light' || S.theme === 'dark' ? S.theme : 'auto';
  h += `<section class="card" id="themecard"><span class="label">Aparência</span>
    <div class="segm cur" role="group" aria-label="Tema do app">${([['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']] as const).map(([k, t]) => `<button class="${th === k ? 'on' : ''}" data-act="theme" data-m="${k}" aria-pressed="${th === k}">${t}</button>`).join('')}</div>
    <p class="hint">${th === 'auto' ? 'Automático segue o modo claro ou escuro do aparelho.' : th === 'dark' ? 'Sempre escuro, mesmo com o aparelho no modo claro.' : 'Sempre claro, mesmo com o aparelho no modo escuro.'}</p></section>`;
  const su = S.stakeIn === 'units';
  h += `<section class="card" id="stakecard"><span class="label">Valor das apostas</span>
    <p class="hint">Vale pra todas as apostas: é assim que o cupom pede o valor.</p>
    <div class="segm" role="group" aria-label="Como informar o valor das apostas"><button class="${su ? '' : 'on'}" data-act="stakein" data-m="money" aria-pressed="${!su}">Em ${esc(sym())}</button><button class="${su ? 'on' : ''}" data-act="stakein" data-m="units" aria-pressed="${su}">Em unidades</button></div>
    <p class="hint" id="stakehow">${!su ? `Você digita o valor em ${esc(sym())}. Os atalhos de 0,5u a 3u continuam no cupom.`
      : w.unit > 0 ? `Você digita quantas unidades quer apostar. Hoje 1u = ${money(w.unit)}.`
      : 'Ainda não há unidade, porque a banca está vazia. Até o primeiro depósito, o cupom pede o valor em dinheiro.'}</p></section>`;
  const tc = Core.tipCfg(S.tip), ex = tc.srcUnit || 1750, exStake = Core.tipStake({ kind: 'money', money: ex }, tc, w.unit);
  h += `<section class="card" id="tipcard"><span class="label">Ao copiar um print</span>
    <p class="hint">Print ou texto que fala em unidades ("Stake 1 unidade") sempre entra com as mesmas unidades, na sua unidade. A escolha abaixo vale pra print que traz o valor em dinheiro.</p>
    <div class="segm" role="group" aria-label="O que copiar de um print em dinheiro">${Core.TIP_MODES.map(m => `<button class="${tc.mode === m ? 'on' : ''}" data-act="tipmode" data-m="${m}" aria-pressed="${tc.mode === m}">${TIP_MODE[m]}</button>`).join('')}</div>`;
  if (tc.mode === 'units') h += `<div class="field"><span>1u do print =</span><input id="tipsrc" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(tc.srcUnit ? Core.moneyText(tc.srcUnit) : '')}" aria-label="Quanto vale uma unidade de quem fez o print"></div><button class="btn ghost block" data-act="tipsave">Aplicar</button>`;
  h += `<p class="hint" id="tiphow">${tc.mode === 'same' ? `Um print de ${money(ex)} vira uma aposta de ${money(exStake.value)}.`
    : !tc.srcUnit ? 'Pra copiar a stake de um print em dinheiro, diz quanto quem fez o print aposta por unidade. Sem isso, a aposta copiada usa o mesmo valor do print.'
    : `Um print de ${money(ex)} é ${fu(exStake.units || 0)} de quem fez, então vira ${fu(exStake.units || 0)} sua: ${money(exStake.value)}.`}</p></section>`;
  h += `<section class="card"><span class="label">Seus dados</span><p class="hint">Saldo e apostas ficam salvos só neste aparelho. Guarda um backup de vez em quando: o Safari pode limpar dados de sites que você passa muito tempo sem abrir.</p>
    <div class="rowbtns"><button class="btn ghost" data-act="backup">Copiar backup</button><button class="btn ghost" data-act="restore">${ui.restore ? 'Cancelar' : 'Restaurar backup'}</button></div>`;
  if (ui.backup) h += `<textarea id="bk" readonly aria-label="Backup">${esc(ui.backup)}</textarea><p class="hint">Não deu pra copiar sozinho. Seleciona o texto acima e copia.</p>`;
  if (ui.restore) h += `<textarea id="rs" placeholder="Cola aqui o backup" aria-label="Backup para restaurar"></textarea><button class="btn block" data-act="dorestore">Restaurar e substituir tudo</button>`;
  h += ui.reset ? `<p class="msg">Isso apaga saldo, depósitos e todas as apostas deste aparelho.</p><div class="rowbtns"><button class="btn danger" data-act="doreset">Apagar tudo</button><button class="btn ghost" data-act="reset">Manter</button></div>`
    : `<button class="btn danger block" data-act="reset">Zerar simulação</button>`;
  h += '</section>';
  const built = builtFrom();
  h += `<section class="card" id="about"><span class="label">Versão do app</span><p class="hint" id="version">${built ? `Versão ${esc(built.slice(0, 7))}.` : 'Versão de desenvolvimento.'} ${canUpdate() ? 'O app fica guardado neste aparelho: abre na hora e também sem internet, com os últimos dados que carregou.' : 'Neste endereço o app não fica guardado no aparelho.'}</p>${canUpdate() ? '<button class="btn ghost block" data-act="checkupdate">Procurar versão nova</button>' : ''}`;
  return h + '</section>';
}

export function renderSheet(): void {
  if (imp.open) { renderImport(); return; }
  const sh = part('sheet'); sh.hidden = !ui.sheet;
  if (!ui.sheet) { renderSlipBar(); return; }
  const c = slipCalc();
  let h = `<div class="ph"><h3>Cupom</h3><button class="x" data-act="sheet" aria-label="Fechar cupom">×</button></div>`;
  if (!c.n) { part('panel').innerHTML = h + '<p class="empty">Cupom vazio.</p>'; return; }
  const mname = c.sameFight ? 'Combinada' : 'Múltipla';
  h += `<div class="segm"><button class="${slip.mode === 'single' ? 'on' : ''}" data-act="mode" data-m="single">${c.n > 1 ? `Simples (${c.n})` : 'Simples'}</button><button class="${slip.mode === 'multi' ? 'on' : ''}" data-act="mode" data-m="multi" ${c.multiOk ? '' : 'disabled'}>${mname}</button></div>`;
  h += '<div>';
  for (const g of c.groups) {
    const f = g.f, names = f ? `${f.a.last} x ${f.b.last}` : 'Luta fora do card';
    for (const r of g.rs)
      h += `<div class="sel"><div class="t">${r.x ? `<b>${sideDot(r.s.key)}${esc(r.x.sel)}</b><span>${esc(r.x.market)} · ${esc(names)}</span>` : `<b>${esc(names)}</b><span class="bad">Mercado fechado. Remove pra continuar.</span>`}</div>${r.x ? `<span class="o">${r.x.src === 'est' ? '≈' : ''}${fo(r.x.odd)}</span>` : ''}<button class="x" data-act="unpick" data-fid="${esc(r.s.fid)}" data-key="${esc(r.s.key)}" aria-label="Remover seleção">×</button></div>`;
    if (g.combo && !g.ok) h += `<div class="combo bad"><span>${g.why === 'impossible' ? `As seleções de ${esc(names)} não podem acontecer juntas. Tira uma pra combinar.` : `Em ${esc(names)}, uma seleção já garante a outra. Tira uma pra combinar.`}</span></div>`;
    else if (g.combo && slip.mode === 'multi') h += `<div class="combo"><span>Juntas em ${esc(names)}${g.same ? ` · mesmo que "${esc(g.same)}"` : ''}</span><b>${g.same ? '' : '≈'}${fo(g.odd)}</b></div>`;
  }
  h += '</div>';
  if (slip.mode === 'multi' && c.groups.some(g => g.combo)) h += '<p class="hint">Na mesma luta as odds não se multiplicam: o preço vem da chance de tudo acontecer junto.</p>';
  const iu = inUnits();
  h += `<label class="label" for="${iu ? 'stakeu' : 'stake'}">${slip.mode === 'multi' ? 'Valor da ' + mname.toLowerCase() : c.n > 1 ? 'Valor de cada aposta' : 'Valor da aposta'}</label>
    ${iu ? `<div class="field"><input id="stakeu" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(slip.units)}" aria-label="Valor em unidades"><span>unidades</span></div>`
      : `<div class="field"><span>${esc(sym())}</span><input id="stake" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(slip.stake)}"></div>
    <div class="quick">${[10, 50, 100].map(v => `<button data-act="stq" data-v="${v}">+${v}</button>`).join('')}<button data-act="stq" data-v="max">Tudo</button></div>
    <div class="quick">${[10000, 100000, 1000000].map(v => `<button data-act="stq" data-v="${v}">+${Core.moneyText(v)}</button>`).join('')}</div>`}
    <div class="quick units">${[0.5, 1, 2, 3].map(u => `<button data-act="stu" data-u="${u}" ${c.unit > 0 ? '' : 'disabled'}>${fu(u)}</button>`).join('')}${iu ? '<button data-act="stq" data-v="max">Tudo</button>' : ''}</div>
    <p class="hint">${c.unit > 0 ? `1u = ${money(c.unit)} (${pctText(c.unitPct)}% da banca)` : 'Deposite para ter uma unidade: ela é uma porcentagem da banca.'} · Valor em ${iu ? 'unidades' : 'dinheiro'}: <button data-act="tab" data-tab="carteira" style="text-decoration:underline">mudar nas configurações</button></p>
    <div id="slipsum"></div>`;
  part('panel').innerHTML = h;
  slipSummary();
}
export function slipSummary(): void {
  const c = slipCalc(), el = $('#slipsum'); if (!el) return;
  let why = '';
  if (!c.ok) why = 'Tem seleção com mercado fechado.';
  else if (c.stake < 1) why = `Aposta mínima de ${money(1)}.`;
  else if (c.total > c.balance + 0.004) why = 'Saldo insuficiente.';
  el.innerHTML = `<dl class="sum">${slip.mode === 'multi' ? `<dt>Odd da ${c.sameFight ? 'combinada' : 'múltipla'}</dt><dd>${c.ok ? fo(c.odd) : '—'}</dd>` : ''}<dt>Total apostado</dt><dd>${money(c.total)}${c.unit > 0 && c.total > 0 ? ' · ' + fu(c.total / c.unit) : ''}</dd><dt>Retorno possível</dt><dd class="big">${money(c.ret)}</dd><dt>Saldo disponível</dt><dd>${money(c.balance)}</dd></dl>
    ${ui.msg ? `<p class="msg" style="margin-top:10px">${esc(ui.msg)}</p>` : ''}
    ${why === 'Saldo insuficiente.' ? `<p class="msg" style="margin-top:10px">Saldo insuficiente. <button data-act="tab" data-tab="carteira" style="text-decoration:underline">Depositar</button></p>` : ''}
    <button class="btn block" style="margin-top:12px" data-act="place" ${why || ui.placing ? 'disabled' : ''}>${ui.placing ? 'Confirmando odds na ESPN…' : why && why !== 'Saldo insuficiente.' ? esc(why) : 'Apostar ' + money(c.total)}</button>`;
}

export async function place(): Promise<void> {
  if (ui.placing) return;
  const before = slipCalc();
  if (!before.ok || before.stake < 1 || before.total > before.balance + 0.004) return;
  const shown = new Map(before.rs.map(r => [r.s.fid + '|' + r.s.key, r.x!.odd] as const)), mode = slip.mode;
  ui.placing = true; ui.msg = ''; slipSummary();
  try {
    // re-check with the source right before taking the bet: the fight may have started or the line may have moved
    await loadBoard();
    const byEv = new Map<string, string[]>();
    for (const s of slip.sels) { const f = D.fights.get(s.fid); if (f) byEv.set(f.eventId, [...(byEv.get(f.eventId) || []), f.id]); }
    for (const [eid, fids] of byEv) await loadOdds(eid, true, fids);
    D.lastSync = Date.now(); D.err = null;
  } catch (e) {
    ui.placing = false; ui.msg = 'Sem conexão com a ESPN. Não deu pra confirmar as odds, tenta de novo.'; renderSheet(); return;
  }
  ui.placing = false;
  const c = slipCalc();
  if (!c.ok) { ui.msg = 'Uma das lutas já começou ou saiu do card.'; renderSheet(); render(); return; }
  if (slip.mode !== mode) { ui.msg = 'Essa combinação não está mais disponível com as odds novas.'; renderSheet(); render(); return; }
  if (c.rs.some(r => Math.abs(r.x!.odd - shown.get(r.s.fid + '|' + r.s.key)!) > 0.001) || (mode === 'multi' && Math.abs(c.odd - before.odd) > 0.001)) { ui.msg = 'As odds mudaram. Confere os valores novos e confirma de novo.'; renderSheet(); render(); return; }
  if (c.total > c.balance + 0.004) { renderSheet(); return; }
  const now = Date.now();
  // c.ok above means every selection has its fight and its price
  const leg = (r: Resolved): Leg => { const f = r.f!, x = r.x!; return { fid: f.id, eid: f.eventId, key: r.s.key, market: x.market, sel: x.sel, cat: x.cat, fight: `${f.a.last} x ${f.b.last}`, event: f.eventName, date: f.date, odd: x.odd, src: x.src, out: null }; };
  const unit = c.unit;                              // the unit in force when the bet is placed; the history is measured with it
  const mk = (type: Bet['type'], legs: Leg[], i: number, odd: number, sgp: Record<string, number> | null): Bet => ({ id: 'b' + now.toString(36) + i + Math.random().toString(36).slice(2, 6), t: now, type, stake: c.stake, unit, odd, sgp, legs, status: 'open', payout: 0, settledAt: null });
  if (slip.mode === 'multi') {
    const sgp: Record<string, number> = {}; for (const g of c.groups) if (g.combo) sgp[g.fid] = g.odd!;      // price of each same-fight combo, fixed at placement
    S.bets.push(mk('multi', c.rs.map(leg), 0, c.odd, sgp));
  } else c.rs.forEach((r, i) => S.bets.push(mk('single', [leg(r)], i, r.x!.odd, null)));
  saveS(); saveCache();
  const made = slip.mode === 'multi' ? 1 : c.n;
  slip.sels = []; setStakeMoney(0); slip.mode = 'single'; ui.sheet = false; ui.msg = ''; ui.tab = 'apostas'; ui.filter = 'open';
  renderSheet(); render(); window.scrollTo(0, 0);
  toast(made > 1 ? `${made} apostas feitas. Boa sorte.` : 'Aposta feita. Boa sorte.');
}
