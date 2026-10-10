import { Core } from '../core';
import type { Currency } from '../core';

/* ================= formatting ================= */
/** An element that may or may not be on screen right now (most of the page is re-rendered from state). */
export const $ = <T extends HTMLElement = HTMLElement>(s: string): T | null => document.querySelector<T>(s);
/** What is typed in a field right now, or '' when the field is not on screen. */
export const valOf = (sel: string): string => { const el = $<HTMLInputElement>(sel); return el ? el.value : ''; };
/** Takes the focus off whatever field has it. On iOS a tapped button does not, and a focused field blocks the repaint. */
export const blurField = (): void => { const a = document.activeElement; if (a instanceof HTMLElement) a.blur(); };
/** One of the fixed parts of the page skeleton in index.html. */
export const part = (id: string): HTMLElement => document.getElementById(id)!;
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: unknown): string => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
export const CUR: Record<Currency, string> = { BRL: 'Real', USD: 'Dólar', EUR: 'Euro' };
export const isCurrency = (code: unknown): code is Currency => typeof code === 'string' && Object.prototype.hasOwnProperty.call(CUR, code);
export let fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
// the formatter follows the currency of the bankroll
export function setFmt(code: Currency): void { fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: code }); }
export const fmtNow = () => fmt;
export const fmtOf = (code: string) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: code });
export const symbolOf = (code: string): string => fmtOf(code).formatToParts(0).find(x => x.type === 'currency')!.value;
// "US$ 1 = R$ 5,0050": the rate said from the side that reads as a number above 1
export const rateText = (from: string, to: string, rate: number): string => { const [a, b, r]: [string, string, number] = rate < 1 ? [to, from, 1 / rate] : [from, to, rate]; return `${symbolOf(a)} 1 = ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: b, minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(r)}`; };
export const dateBR = (iso: string): string => iso.split('-').reverse().join('/');
export const sym = (): string => fmt.formatToParts(0).find(x => x.type === 'currency')!.value;
export const money = (v: number): string => fmt.format(v);
export const signed = (v: number): string => (v > 0.004 ? '+' : v < -0.004 ? '−' : '') + fmt.format(Math.abs(v));
export const fo = (o: unknown): string => Number(o).toFixed(2);
export const fu = (x: number): string => (Math.round(x * 100) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + 'u';
export const signedU = (x: number): string => (x > 0.004 ? '+' : x < -0.004 ? '−' : '') + fu(Math.abs(x));
export const pctText = (v: unknown): string => String(v).replace('.', ',');
const nodot = (f: Intl.DateTimeFormat) => ({ format: (t: number): string => f.format(t).replace('.', '') });
export const dWhen = nodot(new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }));
export const dDay = nodot(new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }));
export const dTime = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
export const WEIGHT: Record<string, string> = { 'Strawweight': 'Peso-palha', 'Flyweight': 'Peso-mosca', 'Bantamweight': 'Peso-galo', 'Featherweight': 'Peso-pena', 'Lightweight': 'Peso-leve', 'Welterweight': 'Meio-médio', 'Middleweight': 'Peso-médio', 'Light Heavyweight': 'Meio-pesado', 'Heavyweight': 'Peso-pesado', 'W Strawweight': 'Palha feminino', 'W Flyweight': 'Mosca feminino', 'W Bantamweight': 'Galo feminino', 'W Featherweight': 'Pena feminino', 'Catchweight': 'Peso casado' };
export const parseMoney = Core.parseMoney;
export const H = 3600e3, DAY = 24 * H;
