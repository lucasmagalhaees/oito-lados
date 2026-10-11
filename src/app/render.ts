import { Core } from '../core';
import { FORM_FIGHTS, formBusy, formFailed, loadBoard, loadOdds, openBets } from './api';
import { CASH_WHY, cashoutOf } from './cashout';
import { $, CUR, WEIGHT, dDate, dDay, dTime, dWhen, dateBR, esc, fmtOf, fo, fu, isCurrency, money, monthYear, part, pctText, rateText, signed, signedBoth, signedPct, signedU, sym, symbolOf } from './format';
import { FX } from './fx';
import { canBet, exposureNotes, inUnits, priceOf, setStakeMoney, slipCalc, statsOf, wallet } from './helpers';
import { renderImport } from './import';
import { repeatable } from './repeat';
import { legOut, resultText } from './settle';
import { CORNER_SETS, D, S, bankEmpty, cornerSet, cornerSetOf, cornersAttr, imp, saveCache, saveS, slip, ui } from './state';
import { busy, shownEvents } from './sync';
import { builtFrom, canUpdate } from './update';
import type { BenchSide, Bet, CardPart, Currency, Fight, FightEvent, Leg, LegState, OriginRow, OpenTotals, Option, Outcome, Period, Side, StatementRow } from '../core';
import type { Resolved, SlipCalc, Wallet } from './helpers';
import type { CopyMeta, Slip } from './state';

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
    v.innerHTML = sinceHtml() + (ui.tab === 'lutas' ? vLutas() : ui.tab === 'apostas' ? vApostas() : vCarteira(w));
    if (ui.tab === 'carteira') bindChart();
  } else if (ae.id === 'q') paintList();          // the search field stays as it is; the fights under it follow

  renderSlipBar();
}
// whose a bet is, in words: the person's own, or a tipster's (by name when the copy has one)
const whoName = (r: { k: string; tip: boolean }): string => r.tip ? (r.k || 'Tipster') : 'Minhas';
/** The filter of the bets list: everything, the person's own picks, every tipster's, or one tipster by name. */
export const MINE = '@minhas', TIPS = '@tipster';
/** What closed by itself since the person last looked: how many bets, the result, and the same by origin. It stays
 *  until it is acknowledged, whichever tab is open. */
function sinceHtml(): string {
  const s = Core.sinceSummary(S.bets, S.seen); if (!s.n) return '';
  const by = s.by.some(r => r.tip) ? `<span>${s.by.map(r => `${esc(whoName(r))}: ${r.n}, ${signed(r.pnl)}`).join(' · ')}</span>` : '';
  return `<div class="since" id="since"><div><b>Desde a última vez: ${s.n} ${s.n > 1 ? 'apostas fecharam' : 'aposta fechou'} · <span class="${s.pnl > 0.004 ? 'pos' : s.pnl < -0.004 ? 'neg' : ''}">${signedBoth(s.pnl, s.unitBets ? s.units : null)}</span></b>${by}</div><div class="rowbtns"><button class="btn ghost" data-act="sinceview">Ver</button><button class="btn ghost" data-act="sinceok">Ok</button></div></div>`;
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
  // finding a fight by a fighter's name, across the events on screen; the list under the field is repainted by itself
  h += `<div class="field search"><span aria-hidden="true">Buscar</span><input id="q" type="text" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="40" placeholder="nome do lutador" value="${esc(ui.q)}" aria-label="Buscar luta pelo nome do lutador"><button class="x" data-act="qclear" aria-label="Limpar a busca"${ui.q ? '' : ' hidden'}>×</button></div>`;
  return h + `<div id="list">${listHtml(ev, evs)}</div>`;
}
const PART: Record<CardPart, string> = { main: 'Card principal', prelims: 'Preliminares', early: 'Primeiras preliminares' };
const PART_SHORT: Record<CardPart, string> = { main: 'Principal', prelims: 'Preliminares', early: 'Primeiras' };
/** The fights of one event, part by part of the card (`only` leaves the ones found by the search). */
function sectionsHtml(e: FightEvent, part: CardPart | null, only?: Set<string>): string {
  const main = Math.max(...e.fights.map(f => f.idx));
  let h = '';
  for (const s of Core.cardSections(e.fights)) {
    const fs = s.fights.filter(f => !only || only.has(f.id)); if (!fs.length || (part && s.part !== part)) continue;
    h += `<div class="seg label sec" data-part="${s.part}">${PART[s.part]} · ${esc(dWhen.format(s.date))}</div>` + fs.map(f => fightCard(f, f.idx === main)).join('');
  }
  return h;
}
/** What goes under the search field: the fights found, event by event, or the card of the event on screen with the
 *  buttons that show one part of it. */
function listHtml(ev: FightEvent, evs: FightEvent[]): string {
  const q = ui.q.trim();
  if (q) {
    let n = 0, h = '';
    for (const e of [ev, ...evs.filter(x => x.id !== ev.id)]) {
      const hits = Core.findFights(e.fights, q); if (!hits.length) continue;
      n += hits.length;
      const name = `${esc(evLabel(e).main)} · ${esc(dDay.format(e.date))}`;
      h += (e.id === ev.id ? `<div class="seg label qev">${name}</div>` : `<button class="seg label qev" data-act="event" data-id="${esc(e.id)}" data-keep="1">${name} · abrir este card ›</button>`) + sectionsHtml(e, null, new Set(hits.map(f => f.id)));
    }
    return `<p class="hint" id="qinfo">${n ? `${n} ${n > 1 ? 'lutas' : 'luta'} com "${esc(q)}"${evs.length > 1 ? `, nos ${evs.length} eventos carregados` : ''}.` : `Nenhuma luta com "${esc(q)}" nos eventos carregados.`}</p>` + h;
  }
  const secs = Core.cardSections(ev.fights), parts = [...new Set(secs.map(s => s.part))];
  if (ui.part && !parts.includes(ui.part)) ui.part = null;
  const count = (p: CardPart): number => secs.filter(s => s.part === p).reduce((a, s) => a + s.fights.length, 0);
  const chips = parts.length > 1 ? `<div class="quick froms" id="parts" role="group" aria-label="Parte do card"><button class="${ui.part == null ? 'on' : ''}" data-act="part" aria-pressed="${ui.part == null}">Tudo (${ev.fights.length})</button>${parts.map(p => `<button class="${ui.part === p ? 'on' : ''}" data-act="part" data-p="${p}" aria-pressed="${ui.part === p}">${PART_SHORT[p]} (${count(p)})</button>`).join('')}</div>` : '';
  return chips + sectionsHtml(ev, ui.part);
}
/** Repaints only the list under the search field, so that typing keeps its field, its caret and its keyboard. */
export function paintList(): void {
  const box = $('#list'), evs = shownEvents(); if (!box || !evs.length) return;
  box.innerHTML = listHtml(evs.find(e => e.id === ui.eventId) || evs[0], evs);
  const x = $('[data-act=qclear]'); if (x) x.hidden = !ui.q;
}
// the mark in front of a selection's name: the corner colour for a fighter's, the arrow for an over or an under
export const sideDot = (key: string, weight?: string): string => { const sd = Core.sideOf(key), ou = Core.overUnder(key); return sd ? `<i class="sd ${sd}"${cornersAttr(weight)}></i>` : ou ? `<i class="ou ${ou}"></i>` : ''; };
function optBtn(f: Fight, x: Option, cls?: string): string {
  const on = slip.sels.some(s => s.fid === f.id && s.key === x.key);
  const side = cls === 'ml' ? null : Core.sideOf(x.key);        // the winner buttons already sit on the fighter's own row
  const whose = side ? ` title="${esc(f[side].name)} · canto ${cornerSet(f.weight)[side]}"` : '';
  const ou = Core.overUnder(x.key);
  return `<button class="opt ${cls || ''} ${side ? 's' + side : ''} ${ou ? 'x' + ou : ''} ${on ? 'on' : ''}" data-act="pick" data-fid="${esc(f.id)}" data-key="${esc(x.key)}" aria-pressed="${on}"${whose}>${cls === 'ml' ? '' : `<span class="ol">${esc(x.label)}</span>`}<span class="ov">${x.src === 'est' ? '<i class="est" title="odd estimada">≈</i>' : ''}${fo(x.odd)}</span></button>`;
}
/** The flag of a fighter's country, before the name; nothing when the country has no flag the app knows. */
const flagHtml = (country: string): string => { const f = Core.flagOf(country); return f ? `<span class="flag" role="img" aria-label="${esc(country)}" title="${esc(country)}">${f}</span>` : ''; };
/** The latest fights of the two athletes of a fight, side by side: won or lost, how and when each one ended. */
function formHtml(f: Fight): string {
  const col = (k: Side): string => {
    const x = f[k], got = D.form[x.id];
    let body: string;
    if (!got) body = `<p class="hint">${formBusy.has(x.id) ? 'Buscando na ESPN…' : formFailed.has(x.id) ? 'Não deu pra buscar agora. Fecha e abre de novo pra tentar.' : '—'}</p>`;
    else if (!got.fights.length) body = '<p class="hint">Nenhuma luta anterior na ESPN.</p>';
    else {
      const s = Core.formSummary(got.fights), ends = ([['ko', 'por KO/TKO'], ['sub', 'por submission'], ['dec', 'por decisão']] as const).filter(([m]) => s[m]).map(([m, t]) => `${s[m]} ${t}`);
      body = `<p class="fsum"><b>${s.won}V ${s.lost}D${s.other ? ` ${s.other}E` : ''}</b></p>${ends.length ? `<p class="fends">Como acabaram: ${ends.join(', ')}</p>` : ''}<ul>${got.fights.map(p => {
        const res = p.won === true ? ['w', 'V', 'Vitória'] : p.won === false ? ['l', 'D', 'Derrota'] : ['n', p.method === 'draw' ? 'E' : '–', p.method === 'draw' ? 'Empate' : p.method === 'nc' ? 'No contest' : 'Sem vencedor informado'];
        const how = p.method === 'unknown' ? (p.label || 'resultado não informado') : p.method === 'draw' ? 'Empate' : p.method === 'nc' ? 'No contest' : Core.ML[p.method];
        const when = p.method === 'dec' || p.method === 'draw' ? (p.round ? `${p.round} rounds` : '') : p.round ? `R${p.round} ${esc(p.clock)}` : '';
        const which = p.method === 'sub' && p.desc ? p.desc : '';      // which submission it was, as the source names it
        return `<li class="${res[0]}"><i aria-label="${res[2]}">${res[1]}</i><span><b>${esc(how)}</b>${when ? ` · ${when}` : ''}<small>${[which, p.date ? monthYear(p.date) : ''].filter(Boolean).map(esc).join(' · ')}</small></span></li>`;
      }).join('')}</ul>`;
    }
    return `<div class="fcol ${k}" data-athlete="${esc(x.id)}"><span class="fname"><i></i>${flagHtml(x.country)}${esc(x.last)}</span>${body}</div>`;
  };
  return `<div class="form" data-fid="${esc(f.id)}"><h4><span class="label">Últimas ${FORM_FIGHTS} lutas</span><em>de cada um, pela ESPN</em></h4><div class="fcols">${col('a')}${col('b')}</div></div>`;
}
function fightCard(f: Fight, isMain: boolean): string {
  const p = priceOf(f), can = canBet(f), res = D.results[f.id];
  const state = f.canceled ? '<span class="chip">Cancelada</span>'
    : f.state === 'in' ? `<span class="chip live"><i class="dot"></i>${liveText(f)}</span>`
    : f.state === 'post' ? '<span class="chip">Encerrada</span>' : '';
  const side = (k: Side): string => {
    const x = f[k], ml = p && p.groups[0].opts.find(o => o.key === 'ml:' + k);
    const first = x.name.endsWith(x.last) ? x.name.slice(0, x.name.length - x.last.length).trim() : x.name;
    const right = can && ml ? optBtn(f, ml, 'ml') : ml ? `<button class="opt ml" disabled><span class="ov">${fo(ml.odd)}</span></button>` : f.state === 'pre' ? '<span class="noodds">sem odds ainda</span>' : '';
    return `<div class="row ${k}"><i class="corner"></i><div class="who"><b>${flagHtml(x.country)}${esc(x.last)}</b><span>${esc(first)}${x.record ? ' · ' + esc(x.record) : ''}${f.state === 'post' && f.winner === k ? ' · <span class="w">venceu</span>' : ''}</span></div>${right}</div>`;
  };
  // what is already riding on this fight, a tap away from the bets themselves
  const ex = Core.exposure(S.bets, f.id), mine = ex.n ? `<button class="chip mine" data-act="tab" data-tab="apostas" data-fid="${esc(f.id)}" aria-label="Ver suas apostas nesta luta">${ex.n} ${ex.n > 1 ? 'apostas' : 'aposta'} · ${money(ex.stake)}${ex.unitBets ? ' · ' + fu(ex.units) : ''}</button>` : '';
  let h = `<article class="fight"${cornersAttr(f.weight)}><div class="fh">${isMain ? '<span class="tag">Luta principal</span>' : ''}<span>${esc(WEIGHT[f.weight] || f.weight)} · ${f.rounds} rounds</span>${state}${mine}</div>${side('a')}${side('b')}`;
  if (f.state === 'post') h += `<div class="result">${esc(resultText(f, res))}</div>`;
  else if (f.state === 'in' && D.td[f.id]) h += `<div class="result">Quedas até agora: ${esc(f.a.last)} ${D.td[f.id].a} · ${esc(f.b.last)} ${D.td[f.id].b}</div>`;
  if (can && p) {
    const open = ui.open.has(f.id), extra = p.groups.length - 1;
    h += `<button class="more" data-act="more" data-fid="${esc(f.id)}" aria-expanded="${open}"><span>${open ? 'Fechar mercados' : `Método, rounds e quedas (+${extra} mercados)`}</span><span>${open ? '−' : '+'}</span></button>`;
    if (open) {
      // stays in view while the markets scroll, so the corner colours can be read without going back up to the names
      h += `<div class="mk"><div class="corners" aria-label="Cores dos cantos"><span class="a"><i></i>${esc(f.a.last)}</span><span class="b"><i></i>${esc(f.b.last)}</span></div>${formHtml(f)}`;
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
// the words a selection's state is said in: on its tag, and in the count at the top of a multiple
const LEG: Record<LegState, { tag: string; one: string; many: string; g: string }> = {
  won: { tag: 'Bateu', one: 'bateu', many: 'bateram', g: '✓' },
  lost: { tag: 'Perdeu', one: 'perdeu', many: 'perderam', g: '✕' },
  void: { tag: 'Anulada', one: 'anulada', many: 'anuladas', g: '↺' },
  live: { tag: 'Ao vivo', one: 'ao vivo', many: 'ao vivo', g: '●' },
  starting: { tag: 'Vai começar', one: 'vai começar', many: 'vão começar', g: '●' },
  waiting: { tag: 'Aguardando', one: 'aguardando resultado', many: 'aguardando resultado', g: '…' },
  pending: { tag: 'Não começou', one: 'não começou', many: 'não começaram', g: '' },
  unused: { tag: 'Não contou', one: 'não contou', many: 'não contaram', g: '–' }
};
const LEG_ORDER: LegState[] = ['won', 'lost', 'void', 'live', 'starting', 'waiting', 'pending', 'unused'];
/** A fight in progress, as text: the round and the clock, or that it is about to start while the source has it in the
 *  cage with no round yet. */
export const liveText = (f: Fight): string => f.period > 0 ? `AO VIVO · R${f.period} ${esc(f.clock)}` : 'VAI COMEÇAR';
/** What each selection of an open bet has come to for sure (never what is only decided on paper with the fight on). */
const settledOut = (l: Leg): Outcome | null => legOut(l, false);
const PILL: Record<Bet['status'], string> = { open: 'Aberta', won: 'Ganhou', lost: 'Perdeu', void: 'Anulada', cashed: 'Cashout' };
/** What a set of open bets has at stake and what it can pay, in money and in units: the consolidated view of an event
 *  and of everything that is open. The units are of the bets that have one. */
/** Three figures side by side are what a phone holds while they are short; longer ones go two to a row instead of breaking. */
const wideIf = (...texts: string[]): string => texts.some(x => x.length > 12) ? ' wide' : '';
function totalsHtml(t: OpenTotals, cls: string): string {
  const u = t.unitBets > 0, all = t.n > 1;
  return `<div class="tot ${cls}${wideIf(money(t.stake), money(t.ret), signed(t.gain))}"><p class="hint">${t.n} ${all ? 'apostas' : 'aposta'} · retorno e ganho se ${all ? 'todas baterem' : 'bater'}${u && t.unitBets < t.n ? ` · unidades de ${t.unitBets} delas, as que guardam a unidade` : ''}</p>
    <div><small>Em jogo</small><b class="st">${money(t.stake)}</b>${u ? `<span class="un stu">${fu(t.units)}</span>` : ''}</div><div><small>Retorno</small><b class="rt">${money(t.ret)}</b></div><div><small>Ganho</small><b class="gn">${signed(t.gain)}</b>${u ? `<span class="un gnu">${signedU(t.gainUnits)}</span>` : ''}</div></div>`;
}
function vApostas(): string {
  // one origin at a time, when any bet has one ('' is the bets with none)
  // the person's own picks apart from the ones copied from a tipster, and one tipster at a time when they have names
  const anyTip = S.bets.some(Core.isTip), names = [...new Set(S.bets.map(b => b.from).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  if (ui.origin != null && !(anyTip && (ui.origin === MINE || ui.origin === TIPS || names.includes(ui.origin)))) ui.origin = null;
  const mine = (b: Bet): boolean => ui.origin == null ? true : ui.origin === MINE ? !Core.isTip(b) : ui.origin === TIPS ? Core.isTip(b) : b.from === ui.origin;
  const open = openBets().filter(mine).sort((a, b) => b.t - a.t), done = S.bets.filter(b => b.status !== 'open' && mine(b)).sort((a, b) => (b.settledAt || 0) - (a.settledAt || 0));
  const list = ui.filter === 'open' ? open : done;
  let h = `<div class="filter"><button class="${ui.filter === 'open' ? 'on' : ''}" data-act="filter" data-f="open">Abertas (${open.length})</button><button class="${ui.filter === 'done' ? 'on' : ''}" data-act="filter" data-f="done">Encerradas (${done.length})</button></div>`;
  const chip = (v: string | null, text: string): string => `<button class="${ui.origin === v ? 'on' : ''}" data-act="origin"${v == null ? '' : ` data-v="${esc(v)}"`} aria-pressed="${ui.origin === v}">${esc(text)}</button>`;
  if (anyTip) h += `<div class="quick froms" id="byorigin" role="group" aria-label="Mostrar as suas apostas ou as copiadas de um tipster">${chip(null, 'Todas')}${chip(MINE, 'Minhas')}${chip(TIPS, 'Tipster')}${names.map(k => chip(k, k)).join('')}</div>`;
  if (!list.length) return h + `<p class="empty">${ui.origin != null ? `Nenhuma aposta ${ui.filter === 'open' ? 'aberta' : 'encerrada'} ${ui.origin === MINE ? 'sua' : ui.origin === TIPS ? 'de tipster' : 'de ' + esc(ui.origin)}.` : ui.filter === 'open' ? 'Nenhuma aposta aberta. Escolhe uma odd em Lutas pra montar o cupom.' : 'Nada encerrado ainda. As apostas fecham sozinhas quando sai o resultado oficial.'}</p>`;
  // open bets go by event, in the order the fights happen, each event with what is at stake and what it can pay
  const groups = ui.filter === 'open' ? Core.openByEvent(open, fid => D.fights.get(fid)?.idx ?? 0, settledOut) : [];
  const head = new Map(groups.map(g => [g.bets[0].id, g] as const));
  if (groups.length > 1) h += `<div class="seg label" id="openall">Tudo em aberto</div>${totalsHtml(Core.openTotals(open, settledOut), 'opentot')}`;
  for (const b of ui.filter === 'open' ? groups.flatMap(g => g.bets) : list) {
    const isOpen = b.status === 'open', g = head.get(b.id);
    if (g) h += `<div class="seg label grp" data-eid="${esc(g.eid)}">${g.eid ? esc(evLabel({ name: g.event }).main) : 'Vários eventos'} · ${esc(dDay.format(g.date))}</div>${totalsHtml(g, 'grpsum')}`;
    const anyLive = isOpen && b.legs.some(l => { const f = D.fights.get(l.fid); return f && f.state === 'in'; });
    const odd = b.odd || Core.r2(b.legs.reduce((p, l) => p * l.odd, 1)), same = isCombo(b);
    const tip = Core.isTip(b);
    h += `<article class="bet">${anyTip ? `<span class="owner ${tip ? 'tipster' : 'own'}">${tip ? `Tipster${b.from ? ' · ' + esc(b.from) : ''}` : 'Minha'}</span>` : ''}<div class="bh"><b>${b.type === 'multi' ? `${same ? 'Combinada' : 'Múltipla'} · ${b.legs.length} seleções` : 'Simples'}</b><span class="pill ${anyLive ? 'live' : b.status}">${anyLive ? 'Ao vivo' : PILL[b.status]}</span></div>`;
    // every selection says in words where it stands, and a multiple counts them at the top
    const states = b.legs.map(l => Core.legState(isOpen ? legOut(l, true) : l.out, isOpen, D.fights.get(l.fid)));
    const several = new Set(b.legs.map(l => l.fid)).size > 1;
    if (b.legs.length > 1) h += `<p class="tally">${LEG_ORDER.filter(k => states.includes(k)).map(k => { const n = states.filter(x => x === k).length; return `<span class="tl ${k}">${n} ${n > 1 ? LEG[k].many : LEG[k].one}</span>`; }).join(' · ')}</p>`;
    b.legs.forEach((l, i) => {
      const f = D.fights.get(l.fid), st = states[i], out = st === 'won' || st === 'lost' || st === 'void' ? st : null;
      let line2: string;
      if (isOpen && f && f.state === 'in') {
        const td = D.td[l.fid];
        line2 = `<span class="lv">${liveText(f)}${td && /^td/.test(l.key) ? ` · quedas ${td.a}–${td.b}` : ''}${out === 'won' ? ' · já bateu' : out === 'lost' ? ' · já perdeu' : ''}</span>`;
      } else if (f && f.state === 'post') line2 = `<span>${esc(resultText(f, D.results[l.fid]))}${isOpen && !out && /^td/.test(l.key) && !(D.td[l.fid] && D.td[l.fid].final) ? ' · esperando as quedas fecharem (até 2 min)' : ''}</span>`;
      else if (!isOpen && l.res) line2 = `<span>${esc(l.res)}</span>`;
      else line2 = `<span>${esc(dWhen.format(l.date))}</span>`;
      // a void selection leaves a multiple: its fight counts as odd 1.00 from then on
      const gone = st === 'void' && several;
      if (gone) line2 += `<span class="why">Sai da múltipla: esta luta passa a valer odd 1.00.</span>`;
      h += `<div class="leg s-${st}"><i class="g ${st}" aria-hidden="true">${LEG[st].g}</i><div class="t"><b>${sideDot(l.key, l.weight || D.fights.get(l.fid)?.weight)}${esc(l.sel)}</b><span>${esc(l.market)} · ${esc(l.fight)}</span>${line2}</div><div class="o"><span class="lo">${gone ? `<s>${l.src === 'est' ? '≈' : ''}${fo(l.odd)}</s> 1.00` : `${l.src === 'est' ? '≈' : ''}${fo(l.odd)}`}</span><em class="ls ${st}">${LEG[st].tag}</em></div></div>`;
    });
    const profit = b.payout - b.stake, edge = Core.printedEdge(b);
    if (edge) h += `<p class="src">Odd do print ${fo(edge.printed)}, você pegou ${fo(edge.got)} (${signedPct(edge.diff)})</p>`;
    // with a selection voided the bet pays less than it was placed at: the odd, the return and the gain say what it pays now
    const outs = b.legs.map(l => isOpen ? settledOut(l) : l.out), cut = outs.includes('void') && (isOpen || b.status === 'won');
    const pays = cut ? Core.oddLeft(b, outs).odd : odd;
    const u = b.unit && b.unit > 0 ? b.unit : 0, ret = Core.r2(b.stake * pays);
    h += `<div class="bf"><div><small>Apostado</small><b>${money(b.stake)}</b>${u ? `<span class="un">${fu(b.stake / u)}</span>` : ''}</div><div><small>Odd</small><b class="odd">${fo(pays)}</b>${cut && pays !== odd ? `<span class="un was">era ${fo(odd)}</span>` : ''}</div>` +
      (isOpen ? `<div><small>Retorno</small><b class="ret">${money(ret)}</b></div>`
        : `<div><small>Resultado</small><b class="${profit > 0 ? 'pos' : profit < 0 ? 'neg' : ''}">${signed(profit)}</b>${u ? `<span class="un res">${signedU(profit / u)}</span>` : ''}</div>`) + '</div>';
    // what an open bet adds to the bankroll if it wins: the return less the stake, in money and in units
    if (isOpen) h += `<div class="gain"><small>Ganho se bater</small><b>${signedBoth(ret - b.stake, u ? (ret - b.stake) / u : null)}</b></div>`;
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
  const pts = series(Core.periodBets(wallet().done, ui.period, Date.now()).bets), n = pts.length; if (!n) return;
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
const PERIODS: Record<Period, string> = { all: 'Tudo', '7d': '7 dias', '15d': '15 dias', '30d': '30 dias', event: 'Último evento' };
interface Row { k: string; n: number; st: number; ret: number; units: number; unitBets: number }
function breakdown(done: Bet[], keyOf: (b: Bet) => string): Row[] {
  const m = new Map<string, Row>();
  for (const b of done) { const k = keyOf(b); const r = m.get(k) || { k, n: 0, st: 0, ret: 0, units: 0, unitBets: 0 }; r.n++; r.st += b.stake; r.ret += b.payout; if (b.unit && b.unit > 0) { r.unitBets++; r.units += (b.payout - b.stake) / b.unit; } m.set(k, r); }
  return [...m.values()].sort((a, b) => b.st - a.st);
}
function tblHtml(title: string, rows: Row[]): string {
  return `<div class="tbl" data-by="${title.toLowerCase()}"><table><thead><tr><th>${title}</th><th>Apostas</th><th>Apostado</th><th>Resultado</th></tr></thead><tbody>${rows.map(r => { const p = r.ret - r.st; return `<tr><td>${esc(r.k)}</td><td>${r.n}</td><td>${money(r.st)}</td><td class="${p > 0.004 ? 'pos' : p < -0.004 ? 'neg' : ''}">${signed(p)}${r.unitBets ? `<small class="inu">${signedU(r.units)}</small>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
}
/* ---- the statement in units: always there, whatever period the figures further down cover ---- */
const SPAN_NAMES: Record<string, string> = { '7d': '7 dias', '15d': '15 dias', '30d': '30 dias', all: 'Geral' };
/** How many events the statement shows before it is asked for all of them. */
export const STMT_EVENTS = 5;
const tone = (v: number): string => v > 0.004 ? 'pos' : v < -0.004 ? 'neg' : '';
// the record of a set of closed bets, the way a fighter's is written: won and lost; voided and cashed-out bets are neither
const record = (x: BenchSide): string => `${x.won}V ${x.dec - x.won}D`;
const roiText = (x: BenchSide): string => x.roi == null ? '—' : signedPct(x.roi);
function stmtHtml(done: Bet[]): string {
  const st = Core.statement(done, Date.now()), all = st.spans[st.spans.length - 1].all;
  // one cell for a side: the result in units, the record and the return on what was staked; a dot marks who is ahead of the two
  const cell = (x: BenchSide, lead: boolean): string => !x.n ? '<td class="none">—</td>'
    : `<td class="${x.unitBets ? tone(x.units) : ''}${lead ? ' lead' : ''}"><b>${lead ? '<i class="ldot" title="na frente"></i>' : ''}${x.unitBets ? signedU(x.units) : '—'}</b><small>${record(x)}</small><small>${roiText(x)}</small></td>`;
  const line = (r: StatementRow, name: string, sub: string): string => `<tr data-k="${esc(r.k)}"><td>${name}<small>${[sub, r.all.n ? `${r.all.n} ${r.all.n === 1 ? 'aposta' : 'apostas'}` : 'nenhuma aposta'].filter(Boolean).join(' · ')}</small>${r.all.n ? `<small class="${tone(r.all.pnl)}">${signed(r.all.pnl)}</small>` : ''}</td>`
    + (st.tips ? cell(r.all, false) + cell(r.mine, r.ahead === 'mine') + cell(r.tip, r.ahead === 'tip') : cell(r.all, false)) + '</tr>';
  const head = (first: string): string => `<thead><tr><th>${first}</th>${st.tips ? '<th>Tudo</th><th>Minhas</th><th>Tipster</th>' : '<th>Unidades</th>'}</tr></thead>`;
  const evs = ui.stmtAll ? st.events : st.events.slice(0, STMT_EVENTS);
  const solo = st.tips ? '' : ' class="solo"';
  return `<section class="card stmt" id="stmt"><span class="label">Extrato em unidades · apostas encerradas</span>
    <div class="tbl"><table id="stmtspans"${solo}>${head('Período')}<tbody>${st.spans.map(r => line(r, SPAN_NAMES[r.k], '')).join('')}</tbody></table></div>
    <span class="label">Por evento</span>
    <div class="tbl"><table id="stmtevents"${solo}>${head('Evento')}<tbody>${evs.map(r => line(r, r.k === '*' ? 'Vários eventos' : esc(evLabel({ name: r.event }).main), r.date ? esc(dDate.format(r.date)) : '')).join('')}</tbody></table></div>
    ${st.events.length > STMT_EVENTS ? `<button class="btn ghost block" data-act="stmtall">${ui.stmtAll ? `Mostrar só os ${STMT_EVENTS} últimos` : `Ver os ${st.events.length} eventos`}</button>` : ''}
    <p class="hint" id="stmthow">V e D são apostas ganhas e perdidas; anulada e cashout ficam fora do cartel, mas entram nas unidades. A porcentagem é o retorno sobre o apostado (ROI). Cada aposta é medida pela unidade do dia em que foi feita.${st.tips ? ' O ponto dourado marca quem está na frente, você ou o tipster, pelo ROI.' : ''}${all.unitBets < all.n ? ` Unidades de ${all.unitBets} de ${all.n} apostas: as outras são de antes de o app guardar a unidade.` : ''}</p></section>`;
}
// the person against the tipsters: staked, result, return on what was staked and hit rate of each side (voided and
// cashed-out bets are not hits or misses), and who is ahead
function benchHtml(done: Bet[]): string {
  const rows = Core.byOrigin(done, S.bets), bm = Core.benchmark(done), tips = rows.filter(r => r.tip);
  const none = { n: 0, avg: 0, ahead: 0 };
  // one line for the person, one for all the tipsters together when there is more than one, and one for each of them
  const lines: (Pick<OriginRow, 'n' | 'st' | 'ret' | 'won' | 'dec' | 'units' | 'unitBets' | 'edge'> & { name: string; cls: string })[] = [
    { ...bm.mine, edge: none, name: 'Minhas', cls: 'own' },
    ...(tips.length > 1 ? [{ ...bm.tip, edge: Core.edgeSummary(S.bets.filter(Core.isTip)), name: 'Tipster · todos', cls: 'tipall' }] : []),
    ...tips.map(r => ({ ...r, name: r.k || 'Tipster', cls: 'tipster' }))];
  const roi = (v: number | null): string => v == null ? '—' : signedPct(v);
  const said = bm.ahead == null ? `Ainda não dá pra comparar: falta aposta encerrada ${bm.mine.st > 0 ? 'de tipster' : 'sua'} nesse período.`
    : `${bm.ahead === 'mine' ? 'Você está na frente' : bm.ahead === 'tip' ? 'O tipster está na frente' : 'Empate'}: retorno de ${roi(bm.mine.roi)} nas suas apostas e de ${roi(bm.tip.roi)} nas do tipster.`;
  // the two sides face to face, in units first: the record, the return on what was staked, and the money under them
  const face = (x: BenchSide, name: string, cls: string, lead: boolean): string => `<div class="${cls}${lead ? ' lead' : ''}"><small>${name}${lead ? ' <em>na frente</em>' : ''}</small><b class="${x.n ? tone(x.unitBets ? x.units : x.pnl) : ''}">${x.n ? (x.unitBets ? signedU(x.units) : signed(x.pnl)) : '—'}</b>${x.n ? `<span>${record(x)} · ROI ${roiText(x)}</span><span>${signed(x.pnl)}</span>` : '<span>nenhuma aposta encerrada</span>'}</div>`;
  const faces = `<div class="duel" id="duel">${face(bm.mine, 'Você', 'own', bm.ahead === 'mine')}${face(bm.tip, 'Tipster', 'tipster', bm.ahead === 'tip')}</div>`;
  // four columns are what a phone holds: how many bets, how much was staked and the odd against the print go under the name
  return `<span class="label">Você × tipster</span>${faces}<p class="hint bench ${bm.ahead === 'mine' ? 'own' : bm.ahead === 'tip' ? 'tipster' : 'even'}" id="bench">${said}</p><div class="tbl" id="origins"><table><thead><tr><th>Quem</th><th>Resultado</th><th>ROI</th><th>Acerto</th></tr></thead><tbody>${lines.map(r => { const p = r.ret - r.st; return `<tr class="${r.cls}"><td>${esc(r.name)}<small>${r.n} ${r.n === 1 ? 'aposta' : 'apostas'} · ${money(r.st)}${r.edge.n ? ` · odd ${signedPct(r.edge.avg)} contra o print` : ''}</small></td><td class="${p > 0.004 ? 'pos' : p < -0.004 ? 'neg' : ''}">${signed(p)}${r.unitBets ? `<small class="inu">${signedU(r.units)}</small>` : ''}</td><td>${r.st ? signedPct(p / r.st) : '—'}</td><td>${r.dec ? `${r.won}/${r.dec}` : '—'}</td></tr>`; }).join('')}</tbody></table></div>`;
}
function vCarteira(w: Wallet): string {
  const ot = Core.openTotals(w.open, settledOut);
  let h = `<section class="hero"><span class="label">Saldo fictício</span><div class="n">${money(w.balance)}</div></section>`;
  // the bankroll at a glance: what it is, what is at stake, what a unit is worth, and where it goes if the open bets all win or all lose
  const all = ot.n > 1, uOf = (v: number): number | null => ot.unitBets ? v : null;
  h += `<section class="card bank" id="bank"><span class="label">Gestão da banca</span>
    <div class="kp3${wideIf(money(w.bank), money(ot.stake), money(w.unit))}"><div><small>Banca</small><b id="bankv">${money(w.bank)}</b><span class="un">saldo + em jogo</span></div><div id="atrisk"><small>Em jogo</small><b>${money(ot.stake)}</b><span class="un">${ot.n ? `${ot.unitBets ? fu(ot.units) + ' · ' : ''}${ot.n} ${all ? 'apostas' : 'aposta'}` : 'nenhuma aposta'}</span></div><div><small>1 unidade</small><b id="unitv">${w.unit > 0 ? money(w.unit) : '—'}</b><span class="un">${pctText(w.unitPct)}% da banca</span></div></div>
    ${ot.n ? `<div class="scn up" id="ifwin"><small>Se ${all ? 'todas baterem' : 'bater'}</small><b>${signedBoth(ot.gain, uOf(ot.gainUnits))}</b><span>retorno de ${money(ot.ret)} · banca vai a ${money(Core.r2(w.balance + ot.ret))}</span></div>
    <div class="scn down" id="iflose"><small>Se ${all ? 'todas perderem' : 'perder'}</small><b>${signedBoth(-ot.stake, uOf(-ot.units))}</b><span>banca vai a ${money(w.balance)}</span></div>` : ''}
    <p class="hint" id="deptotal">${money(w.dep)} depositados no total</p></section>`;
  if (w.done.length) h += stmtHtml(w.done);
  const cur = S.cur || 'BRL', dc = isCurrency(ui.depCur) ? ui.depCur : cur, other = dc !== cur, conv = other && !bankEmpty(), rate = conv ? Core.fxRate(FX, cur, dc) : null, df = fmtOf(dc);
  h += `<section class="card"><span class="label">Depositar dinheiro de mentira</span>
    <div class="segm cur" role="group" aria-label="Moeda do depósito">${(Object.keys(CUR) as Currency[]).map(c => `<button class="${dc === c ? 'on' : ''}" data-act="depcur" data-c="${c}" aria-pressed="${dc === c}" ${ui.fxBusy ? 'disabled' : ''}>${esc(symbolOf(c))} ${CUR[c]}</button>`).join('')}</div>
    <div class="field"><span>${esc(symbolOf(dc))}</span><input id="dep" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(ui.dep)}" aria-label="Valor do depósito"></div>
    <div class="quick">${[100, 500, 1000, 5000].map(v => `<button data-act="depq" data-v="${v}">${df.format(v).replace(',00', '')}</button>`).join('')}</div>
    <div class="quick">${[10000, 100000, 1000000].map(v => `<button data-act="depq" data-v="${v}">${df.format(v).replace(',00', '')}</button>`).join('')}</div>`;
  if (conv && ui.fxBusy) h += '<p class="hint" id="fxinfo">Buscando a cotação…</p>';
  else if (conv && rate && FX) h += `<p class="hint" id="fxinfo">Passar para ${CUR[dc]} troca a moeda da banca e converte tudo (depósitos e apostas) por <b>${esc(rateText(cur, dc, rate))}</b>, cotação de ${esc(dateBR(FX.date))}. Seu saldo de ${money(w.balance)} vira ${df.format(Core.r2(w.balance * rate))}.</p>`;
  else if (other && !conv) h += `<p class="hint" id="fxinfo">A banca passa a ser em ${CUR[dc]}.</p>`;
  if (ui.fxMsg) h += `<p class="msg" id="fxmsg">${esc(ui.fxMsg)}</p>`;
  h += `<button class="btn block" data-act="deposit" ${ui.fxBusy || (conv && !rate) ? 'disabled' : ''}>${conv ? 'Converter a banca e depositar' : 'Depositar'}</button>`;
  if (other) h += `<button class="btn ghost block" data-act="convonly" ${ui.fxBusy || (conv && !rate) ? 'disabled' : ''}>${conv ? 'Só converter a banca, sem depositar' : `Só trocar a moeda para ${CUR[dc]}`}</button>`;
  h += '</section>';
  // the figures cover a period of the closed bets; the balance above and the deposits below never do
  const per = Core.periodBets(w.done, ui.period, Date.now()), pd = per.bets, st = ui.period === 'all' ? w : statsOf(pd);
  const roi = st.staked ? st.pnl / st.staked * 100 : null;
  h += `<section class="card"><span class="label">Ganhos e perdas · apostas encerradas</span>
    ${w.done.length ? `<div class="segm per" id="period" role="group" aria-label="Período">${(Object.keys(PERIODS) as Period[]).map(k => `<button class="${ui.period === k ? 'on' : ''}" data-act="period" data-m="${k}" aria-pressed="${ui.period === k}">${PERIODS[k]}</button>`).join('')}</div>` : ''}
    ${ui.period === 'event' && per.event ? `<p class="hint" id="periodev">${esc(evLabel({ name: per.event }).main)}: o evento da aposta que fechou por último.</p>` : Core.PERIOD_DAYS[ui.period] ? `<p class="hint" id="periodev">Apostas que fecharam nos últimos ${Core.PERIOD_DAYS[ui.period]} dias.</p>` : ''}
    <div class="pnl ${st.pnl > 0 ? 'pos' : st.pnl < 0 ? 'neg' : ''}">${signed(st.pnl)}</div>
    ${st.unitBets ? `<p class="hint" id="pnlu"><b class="${tone(st.units)}">${signedU(st.units)}</b> em unidades, cada aposta medida pela unidade do dia em que foi feita.</p>` : ''}
    <div class="kpis"><div><small>Apostado</small><b>${money(st.staked)}</b></div><div><small>Retornado</small><b>${money(st.ret)}</b></div><div><small>ROI</small><b>${roi == null ? '—' : (roi > 0 ? '+' : '') + roi.toFixed(1).replace('.', ',') + '%'}</b></div><div><small>Acerto</small><b>${st.decided ? `${st.won}/${st.decided} · ${Math.round(st.won / st.decided * 100)}%` : '—'}</b></div></div>`;
  if (pd.length) {
    h += `<span class="label">Resultado acumulado, aposta a aposta</span><div class="chart" id="chart"></div>`;
    h += tblHtml('Mercado', breakdown(pd, b => isCombo(b) ? 'Combinada' : b.type === 'multi' ? 'Múltipla' : b.legs[0].cat));
    if (S.bets.some(Core.isTip)) h += benchHtml(pd);
  } else h += `<p class="hint">${w.done.length ? 'Nenhuma aposta fechou nesse período.' : 'O gráfico e a quebra por mercado aparecem quando a primeira aposta for encerrada.'}</p>`;
  const eg = Core.edgeSummary(S.bets);
  if (eg.n) h += `<p class="hint" id="edge">Odd contra o print: em ${eg.n} ${eg.n > 1 ? 'apostas copiadas' : 'aposta copiada'} com odd no original, você pegou em média ${signedPct(eg.avg)} em relação ao print (${eg.ahead} acima).</p>`;
  h += '</section>';
  const lastConv = (S.conv || []).slice(-1)[0];
  if (S.deposits.length) h += `<section class="card"><span class="label">Depósitos</span><div>${S.deposits.slice().reverse().slice(0, 8).map(d => `<div class="dep"><span>${esc(dWhen.format(d.t))}</span><b>${money(d.v)}</b></div>`).join('')}</div>${lastConv ? `<p class="hint" id="convlog">Banca convertida de ${CUR[lastConv.from]} para ${CUR[lastConv.to]} em ${esc(dWhen.format(lastConv.t))}, por ${esc(rateText(lastConv.from, lastConv.to, lastConv.rate))} (cotação de ${esc(dateBR(lastConv.date))}).</p>` : ''}</section>`;
  h += `<div class="seg label" id="config">Configurações</div>`;
  h += `<section class="card"><span class="label">Unidade</span>
    <div class="unit" id="unitnow">1u = ${money(w.unit)}</div>
    <p class="hint">${pctText(w.unitPct)}% da banca de ${money(w.bank)} (saldo mais o que está em jogo). Muda sozinha quando a banca muda.</p>
    <div class="field"><input id="unitpct" inputmode="decimal" autocomplete="off" value="${esc(pctText(w.unitPct))}" aria-label="Porcentagem da banca que vale uma unidade"><span>% da banca</span></div>
    <button class="btn ghost block" data-act="unit">Aplicar</button></section>`;
  const th = S.theme === 'light' || S.theme === 'dark' ? S.theme : 'auto', cm = cornerSetOf('men'), cw = cornerSetOf('women');
  h += `<section class="card" id="themecard"><span class="label">Aparência</span>
    <div class="segm cur" role="group" aria-label="Tema do app">${([['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']] as const).map(([k, t]) => `<button class="${th === k ? 'on' : ''}" data-act="theme" data-m="${k}" aria-pressed="${th === k}">${t}</button>`).join('')}</div>
    <p class="hint">${th === 'auto' ? 'Automático segue o modo claro ou escuro do aparelho.' : th === 'dark' ? 'Sempre escuro, mesmo com o aparelho no modo claro.' : 'Sempre claro, mesmo com o aparelho no modo escuro.'}</p>
    <span class="label">Cores dos cantos</span>
    <div class="pairs">${([['men', 'Lutas masculinas'], ['women', 'Lutas femininas']] as const).map(([g, t]) => { const cs = cornerSetOf(g); return `<span>${t}</span><div class="segm cur" role="group" aria-label="Cores dos cantos nas ${t.toLowerCase()}">${CORNER_SETS.map(c => `<button class="${cs.id === c.id ? 'on' : ''}" data-act="corners" data-g="${g}" data-m="${c.id}" aria-pressed="${cs.id === c.id}" aria-label="${c.a} e ${c.b}"><i class="sw ${c.id} a"></i><i class="sw ${c.id} b"></i></button>`).join('')}</div>`; }).join('')}</div>
    <p class="hint" id="cornershow">${cm.id === cw.id ? `Todas as lutas em ${cm.a} e ${cm.b}.` : `Masculinas em ${cm.a} e ${cm.b}, femininas em ${cw.a} e ${cw.b}.`} A primeira cor é a de quem aparece em cima na luta.</p></section>`;
  const su = S.stakeIn === 'units';
  h += `<section class="card" id="stakecard"><span class="label">Valor das apostas</span>
    <p class="hint">Vale pra todas as apostas: é assim que o cupom pede o valor e é o que entra quando você copia um print.</p>
    <div class="segm" role="group" aria-label="Como informar o valor das apostas"><button class="${su ? '' : 'on'}" data-act="stakein" data-m="money" aria-pressed="${!su}">Em ${esc(sym())}</button><button class="${su ? 'on' : ''}" data-act="stakein" data-m="units" aria-pressed="${su}">Em unidades</button></div>
    <p class="hint" id="stakehow">${!su ? `Você digita o valor em ${esc(sym())}. Os atalhos de 0,5u a 3u continuam no cupom.`
      : w.unit > 0 ? `Você digita quantas unidades quer apostar. Hoje 1u = ${money(w.unit)}.`
      : 'Ainda não há unidade, porque a banca está vazia. Até o primeiro depósito, o cupom pede o valor em dinheiro.'}</p>
    <p class="hint" id="tiphow">${!su ? `Ao copiar um print: mesmo valor. Um print de ${money(1750)} vira uma aposta de ${money(1750)}. Se o original só falar em unidades, entram essas unidades na sua unidade.`
      : `Ao copiar um print: mesma stake. "Stake 2 unidades" vira ${fu(2)} sua${w.unit > 0 ? ` (${money(Core.r2(2 * w.unit))})` : ''}. Print que não diz quantas unidades entra com ${fu(1)}; o dinheiro que ele mostra não é copiado.`}</p></section>`;
  const cd = S.copyDrop || 0, froms = [...new Set(S.bets.map(b => b.from).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const unnamed = S.bets.filter(b => Core.isTip(b) && !b.from).length;
  h += `<section class="card" id="copycard"><span class="label">Ao copiar apostas</span>
    <span class="label">Odd mínima</span>
    <div class="segm four" role="group" aria-label="Quanto a odd pode ter caído em relação ao print">${[0, 3, 5, 10].map(v => `<button class="${cd === v ? 'on' : ''}" data-act="copydrop" data-m="${v}" aria-pressed="${cd === v}">${v ? '−' + v + '%' : 'Desligada'}</button>`).join('')}</div>
    <p class="hint" id="drophow">${cd ? `Se a odd de agora estiver mais de ${cd}% abaixo da odd do print, a aposta fica de fora do "apostar todas" até você mandar apostar mesmo assim.` : 'Desligada: a aposta entra no "apostar todas" com a odd de agora, qualquer que seja a do print.'}</p>`;
  if (froms.length || unnamed) h += `<span class="label">Tipsters</span>
    <div class="field"><select id="orgfrom" aria-label="Tipster a renomear">${unnamed ? `<option value="">Tipster (${unnamed})</option>` : ''}${froms.map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('')}</select></div>
    <div class="field"><input id="orgto" maxlength="40" autocomplete="off" placeholder="novo nome" aria-label="Novo nome do tipster"></div>
    <button class="btn ghost block" data-act="orgrename">${froms.length ? 'Renomear' : 'Dar nome'}</button>
    <p class="hint">Toda aposta que entra pelo "Copiar aposta" é do tipster; as que você monta no card são suas. Dar a um tipster o nome de outro junta os dois.</p>`;
  h += '</section>';
  h += `<section class="card"><span class="label">Seus dados</span><p class="hint">Saldo e apostas ficam salvos só neste aparelho. Guarda um backup de vez em quando: o Safari pode limpar dados de sites que você passa muito tempo sem abrir. O arquivo pode ser mandado pra você mesmo no Telegram ou guardado nos Arquivos.</p>
    <div class="rowbtns"><button class="btn" data-act="bksave">Salvar backup em arquivo</button><label class="btn ghost" for="bkfile">Restaurar de um arquivo</label><input type="file" id="bkfile" accept="application/json,.json,text/plain,.txt" hidden></div>`;
  const rf = ui.restoreFile;
  if (rf) h += `<div class="bkpeek" id="bkpeek"><p><b>${esc(rf.name)}</b></p><p class="hint">${rf.savedAt ? `Salvo em ${esc(dWhen.format(rf.savedAt))}. ` : ''}${rf.bets} ${rf.bets === 1 ? 'aposta' : 'apostas'}${rf.open ? ` (${rf.open} ${rf.open === 1 ? 'aberta' : 'abertas'})` : ''} e ${esc(fmtOf(rf.cur).format(rf.deposited))} depositados. Restaurar troca tudo o que está neste aparelho pelo que está no arquivo.</p><div class="rowbtns"><button class="btn" data-act="bkapply">Restaurar e substituir tudo</button><button class="btn ghost" data-act="bkcancel">Cancelar</button></div></div>`;
  h += `<div class="rowbtns bktext"><button class="btn ghost" data-act="backup">Copiar como texto</button><button class="btn ghost" data-act="restore">${ui.restore ? 'Cancelar' : 'Colar um texto'}</button></div>`;
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
      h += `<div class="sel"><div class="t">${r.x ? `<b>${sideDot(r.s.key, r.f && r.f.weight)}${esc(r.x.sel)}</b><span>${esc(r.x.market)} · ${esc(names)}</span>` : `<b>${esc(names)}</b><span class="bad">Mercado fechado. Remove pra continuar.</span>`}</div>${r.x ? `<span class="o">${r.x.src === 'est' ? '≈' : ''}${fo(r.x.odd)}</span>` : ''}<button class="x" data-act="unpick" data-fid="${esc(r.s.fid)}" data-key="${esc(r.s.key)}" aria-label="Remover seleção">×</button></div>`;
    if (g.combo && !g.ok) h += `<div class="combo bad"><span>${g.why === 'impossible' ? `As seleções de ${esc(names)} não podem acontecer juntas. Tira uma pra combinar.` : `Em ${esc(names)}, uma seleção já garante a outra. Tira uma pra combinar.`}</span></div>`;
    else if (g.combo && slip.mode === 'multi') h += `<div class="combo"><span>Juntas em ${esc(names)}${g.same ? ` · mesmo que "${esc(g.same)}"` : ''}</span><b>${g.same ? '' : '≈'}${fo(g.odd)}</b></div>`;
  }
  h += '</div>';
  if (slip.mode === 'multi' && c.groups.some(g => g.combo)) h += '<p class="hint">Na mesma luta as odds não se multiplicam: o preço vem da chance de tudo acontecer junto.</p>';
  const iu = inUnits(), sug = c.unit > 0 && c.ok ? Core.suggestedUnits(c.n, slip.mode) : [];
  h += `<label class="label" for="${iu ? 'stakeu' : 'stake'}">${slip.mode === 'multi' ? 'Valor da ' + mname.toLowerCase() : c.n > 1 ? 'Valor de cada aposta' : 'Valor da aposta'}</label>
    ${iu ? `<div class="field"><button class="step" data-act="ustep" data-d="-1" aria-label="Meia unidade a menos">−</button><input id="stakeu" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(slip.units)}" aria-label="Valor em unidades"><span>unidades</span><button class="step" data-act="ustep" data-d="1" aria-label="Meia unidade a mais">+</button></div>`
      : `<div class="field"><span>${esc(sym())}</span><input id="stake" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(slip.stake)}"></div>
    <div class="quick">${[10, 50, 100].map(v => `<button data-act="stq" data-v="${v}">+${v}</button>`).join('')}<button data-act="stq" data-v="max">Tudo</button></div>
    <div class="quick">${[10000, 100000, 1000000].map(v => `<button data-act="stq" data-v="${v}">+${Core.moneyText(v)}</button>`).join('')}</div>`}
    ${sug.length ? `<div class="quick units" id="slipsug">${sug.map(u => `<button data-act="stu" data-u="${u}">${fu(u)}</button>`).join('')}</div><p class="hint">${mname} de ${c.n} seleções: stake sugerida de ${fu(sug[0])} a ${fu(sug[sug.length - 1])}.</p>` : ''}
    <div class="quick units">${[0.5, 1, 2, 3].map(u => `<button data-act="stu" data-u="${u}" ${c.unit > 0 ? '' : 'disabled'}>${fu(u)}</button>`).join('')}${iu ? '<button data-act="stq" data-v="max">Tudo</button>' : ''}</div>
    <p class="hint">${c.unit > 0 ? `1u = ${money(c.unit)} (${pctText(c.unitPct)}% da banca)` : 'Deposite para ter uma unidade: ela é uma porcentagem da banca.'} · Valor em ${iu ? 'unidades' : 'dinheiro'}: <button data-act="tab" data-tab="carteira" style="text-decoration:underline">mudar nas configurações</button></p>
    ${c.ok ? exposureNotes(slip.sels).map(n => `<p class="hint slipexpo">${esc(n)}</p>`).join('') : ''}
    ${slip.copy ? `<p class="hint" id="slipcopy">Aposta copiada${slip.copy.from ? ` de ${esc(slip.copy.from)}` : ''}: entra como do tipster, com a odd do print guardada.</p>` : ''}
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
  el.innerHTML = `<dl class="sum">${slip.mode === 'multi' ? `<dt>Odd da ${c.sameFight ? 'combinada' : 'múltipla'}</dt><dd>${c.ok ? fo(c.odd) : '—'}</dd>` : ''}<dt>Total apostado</dt><dd>${money(c.total)}${c.unit > 0 && c.total > 0 ? ' · ' + fu(c.total / c.unit) : ''}</dd><dt>Retorno possível</dt><dd class="big">${money(c.ret)}</dd><dt>Ganho possível</dt><dd id="slipgain">${c.ok && c.total > 0 ? signedBoth(c.ret - c.total, c.unit > 0 ? (c.ret - c.total) / c.unit : null) : '—'}</dd><dt>Saldo disponível</dt><dd>${money(c.balance)}</dd></dl>
    ${ui.msg ? `<p class="msg" style="margin-top:10px">${esc(ui.msg)}</p>` : ''}
    ${why === 'Saldo insuficiente.' ? `<p class="msg" style="margin-top:10px">Saldo insuficiente. <button data-act="tab" data-tab="carteira" style="text-decoration:underline">Depositar</button></p>` : ''}
    <button class="btn block" style="margin-top:12px" data-act="place" ${why || ui.placing ? 'disabled' : ''}>${ui.placing ? 'Confirmando odds na ESPN…' : why && why !== 'Saldo insuficiente.' ? esc(why) : 'Apostar ' + money(c.total)}</button>`;
}

/** Re-checks with the source right before a bet is taken: the fight may have started or the line may have moved.
 *  Reloads the card and the odds of these fights; false when the source cannot be reached. */
export async function recheck(fids: string[]): Promise<boolean> {
  try {
    await loadBoard();
    const byEv = new Map<string, string[]>();
    for (const fid of fids) { const f = D.fights.get(fid); if (f) byEv.set(f.eventId, [...(byEv.get(f.eventId) || []), f.id]); }
    for (const [eid, ids] of byEv) await loadOdds(eid, true, ids);
    D.lastSync = Date.now(); D.err = null; return true;
  } catch (e) { return false; }
}
/** Writes the bets of a slip that has already been validated (`c.ok`: every selection has its fight and its price) and
 *  returns how many were made: one for a multiple, one per selection otherwise. Saving is left to the caller. */
export function writeBets(c: SlipCalc, mode: Slip['mode'], now: number, salt: string, copy: CopyMeta | null): number {
  // a copied bet keeps what its original said: who it came from, and the odd printed for each selection and for the whole bet
  const seen = (r: Resolved): number | undefined => (copy && copy.legs[r.s.fid + '|' + r.s.key]) || undefined;
  const sameBet = !!copy && copy.sig === c.rs.map(r => r.s.fid + '|' + r.s.key).sort().join(',');
  const leg = (r: Resolved): Leg => { const f = r.f!, x = r.x!, p = seen(r); return { fid: f.id, eid: f.eventId, key: r.s.key, market: x.market, sel: x.sel, cat: x.cat, weight: f.weight, fight: `${f.a.last} x ${f.b.last}`, event: f.eventName, date: f.date, odd: x.odd, src: x.src, out: null, ...(p ? { printed: p } : {}) }; };
  const unit = c.unit;                              // the unit in force when the bet is placed; the history is measured with it
  const mk = (type: Bet['type'], legs: Leg[], i: number, odd: number, sgp: Record<string, number> | null): Bet => ({ id: 'b' + now.toString(36) + salt + i + Math.random().toString(36).slice(2, 6), t: now, type, stake: c.stake, unit, odd, sgp, legs, status: 'open', payout: 0, settledAt: null,
    ...(copy ? { copied: true } : {}), ...(copy && copy.from ? { from: copy.from } : {}), ...(type === 'multi' && sameBet && copy!.bet ? { printed: copy!.bet } : {}) });
  if (mode === 'multi') {
    const sgp: Record<string, number> = {}; for (const g of c.groups) if (g.combo) sgp[g.fid] = g.odd!;      // price of each same-fight combo, fixed at placement
    S.bets.push(mk('multi', c.rs.map(leg), 0, c.odd, sgp)); return 1;
  }
  c.rs.forEach((r, i) => S.bets.push(mk('single', [leg(r)], i, r.x!.odd, null))); return c.n;
}
export async function place(): Promise<void> {
  if (ui.placing) return;
  const before = slipCalc();
  if (!before.ok || before.stake < 1 || before.total > before.balance + 0.004) return;
  const shown = new Map(before.rs.map(r => [r.s.fid + '|' + r.s.key, r.x!.odd] as const)), mode = slip.mode;
  ui.placing = true; ui.msg = ''; slipSummary();
  const reached = await recheck(slip.sels.map(s => s.fid));
  ui.placing = false;
  if (!reached) { ui.msg = 'Sem conexão com a ESPN. Não deu pra confirmar as odds, tenta de novo.'; renderSheet(); return; }
  const c = slipCalc();
  if (!c.ok) { ui.msg = 'Uma das lutas já começou ou saiu do card.'; renderSheet(); render(); return; }
  if (slip.mode !== mode) { ui.msg = 'Essa combinação não está mais disponível com as odds novas.'; renderSheet(); render(); return; }
  if (c.rs.some(r => Math.abs(r.x!.odd - shown.get(r.s.fid + '|' + r.s.key)!) > 0.001) || (mode === 'multi' && Math.abs(c.odd - before.odd) > 0.001)) { ui.msg = 'As odds mudaram. Confere os valores novos e confirma de novo.'; renderSheet(); render(); return; }
  if (c.total > c.balance + 0.004) { renderSheet(); return; }
  const made = writeBets(c, slip.mode, Date.now(), '', slip.copy);
  saveS(); saveCache();
  slip.sels = []; slip.copy = null; setStakeMoney(0); slip.mode = 'single'; ui.sheet = false; ui.msg = ''; ui.tab = 'apostas'; ui.filter = 'open';
  renderSheet(); render(); window.scrollTo(0, 0);
  toast(made > 1 ? `${made} apostas feitas. Boa sorte.` : 'Aposta feita. Boa sorte.');
}
