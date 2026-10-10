// The pure core: odds maths, ESPN readers, pricing model, settlement, cashout, money, tips and questions asked of the
// bet history. No DOM, network or storage.
// `Core` keeps the surface the tests have always used.
import { am2dec, devig, mo, r2 } from './odds';
import { attachDistance, normEvent, normOdds, normResult, statValue } from './espn';
import { combo, isWomens, jointModel, ML, overUnder, price, probs, sideOf } from './pricing';
import { betResult, legOutcome } from './settlement';
import { cashout, CASHOUT_MARGIN } from './cashout';
import { balanceOf, convertState, fxRate, normFx } from './fx';
import { LONG_MULTI, maskMoney, maskUnits, moneyText, parseMoney, parseUnits, stepUnits, suggestedUnits, unitPct, unitsText, unitValue } from './money';
import { completeTip, edgeSummary, parseTip, printedEdge, tipStake } from './tip';
import { byOrigin, copyDrop, dupBets, exposure, openByEvent, periodBets, renameOrigin, selSig, sinceSummary } from './history';

export const Core = { r2, am2dec, devig, mo, normEvent, normOdds, attachDistance, normResult, statValue, probs, price, jointModel, combo, legOutcome, betResult, sideOf, overUnder, isWomens, cashout, CASHOUT_MARGIN, normFx, fxRate, convertState, balanceOf, tipStake, completeTip, printedEdge, edgeSummary, selSig, dupBets, exposure, openByEvent, copyDrop, byOrigin, renameOrigin, periodBets, sinceSummary, maskMoney, parseMoney, moneyText, maskUnits, parseUnits, unitsText, unitPct, unitValue, suggestedUnits, stepUnits, LONG_MULTI, parseTip, ML };
export type * from './types';
export type { OpenGroup, OriginRow, Period } from './history';
