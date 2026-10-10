import { Core } from '../core';
import { getJSON } from './api';
import { LS } from './state';
import type { FxRates } from '../core';

/* ================= exchange rate ================= */
// Reference rates from Frankfurter, kept on the device: asked again only when the copy is older than FX_TTL.
export const FX_URL = 'https://api.frankfurter.dev/v1/latest?base=BRL&symbols=USD,EUR', FX_TTL = 12 * 3600e3;
type Kept = FxRates & { ts: number };
const kept: Kept | null = LS.get('oitolados.fx.v1');
export let FX: Kept | null = (kept && kept.rates && kept.ts) ? kept : null;
export async function loadFx(): Promise<Kept> {
  if (FX && Date.now() - FX.ts < FX_TTL) return FX;
  try {
    const fx = Core.normFx(await getJSON(FX_URL, 8000));
    if (!fx) throw new Error('unexpected answer');
    FX = Object.assign(fx, { ts: Date.now() }); LS.set('oitolados.fx.v1', FX);
  } catch (e) { if (!FX) throw e; }          // no answer: an older rate still converts, and the screen shows its date
  return FX!;
}
