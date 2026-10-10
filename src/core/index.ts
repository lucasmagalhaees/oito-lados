// The pure core: odds maths, ESPN readers, pricing model, settlement, cashout, money and tips. No DOM, network or storage.
// `Core` keeps the surface the tests have always used.
import { am2dec, devig, mo, r2 } from './odds';
import { attachDistance, normEvent, normOdds, normResult, statValue } from './espn';
import { combo, isWomens, jointModel, ML, overUnder, price, probs, sideOf } from './pricing';
import { betResult, legOutcome } from './settlement';
import { cashout, CASHOUT_MARGIN } from './cashout';
import { balanceOf, convertState, fxRate, normFx } from './fx';
import { maskMoney, maskUnits, moneyText, parseMoney, parseUnits, unitPct, unitsText, unitValue } from './money';
import { parseTip, tipStake } from './tip';

export const Core = { r2, am2dec, devig, mo, normEvent, normOdds, attachDistance, normResult, statValue, probs, price, jointModel, combo, legOutcome, betResult, sideOf, overUnder, isWomens, cashout, CASHOUT_MARGIN, normFx, fxRate, convertState, balanceOf, tipStake, maskMoney, parseMoney, moneyText, maskUnits, parseUnits, unitsText, unitPct, unitValue, parseTip, ML };
export type * from './types';
