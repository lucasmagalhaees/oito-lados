// The pure core: odds maths, ESPN readers, pricing model, settlement, cashout, money, tips and questions asked of the
// bet history. No DOM, network or storage.
// `Core` keeps the surface the tests have always used.
import { am2dec, devig, mo, r2 } from './odds';
import { attachDistance, normEvent, normOdds, normResult, statValue, normEventlog, normPastFight, statusRef } from './espn';
import { countryCode, flagOf } from './flags';
import { fightSeconds, formSummary } from './form';
import { combo, isWomens, jointModel, ML, overUnder, price, probs, sideOf } from './pricing';
import { betResult, legOutcome, legState, oddLeft } from './settlement';
import { cashout, CASHOUT_MARGIN } from './cashout';
import { balanceOf, convertState, fxRate, normFx } from './fx';
import { LONG_MULTI, maskMoney, maskUnits, moneyText, parseMoney, parseUnits, stepUnits, suggestedUnits, unitPct, unitsText, unitValue } from './money';
import { completeTip, edgeSummary, parseTip, printedEdge, tipStake } from './tip';
import { cardSections, cardsToShow, countries, findFights, fromCountry, NEXT_CARDS, RECENT_CARD } from './card';
import { benchmark, byOrigin, copyDrop, dupBets, exposure, isTip, oddNow, openByEvent, openTotals, periodBets, PERIOD_DAYS, renameOrigin, selSig, sinceSummary, statement } from './history';

export const Core = { r2, am2dec, devig, mo, normEvent, normOdds, attachDistance, normResult, statValue, normEventlog, normPastFight, statusRef, flagOf, countryCode, countries, fromCountry, cardsToShow, NEXT_CARDS, RECENT_CARD, formSummary, fightSeconds, probs, price, jointModel, combo, legOutcome, betResult, oddLeft, legState, sideOf, overUnder, isWomens, cashout, CASHOUT_MARGIN, normFx, fxRate, convertState, balanceOf, tipStake, completeTip, printedEdge, edgeSummary, selSig, dupBets, exposure, openByEvent, openTotals, oddNow, cardSections, findFights, copyDrop, byOrigin, benchmark, isTip, renameOrigin, periodBets, statement, PERIOD_DAYS, sinceSummary, maskMoney, parseMoney, moneyText, maskUnits, parseUnits, unitsText, unitPct, unitValue, suggestedUnits, stepUnits, LONG_MULTI, parseTip, ML };
export type * from './types';
export type { BenchSide, OpenGroup, OpenTotals, OriginRow, OutOf, Period, StatementRow } from './history';
export type { LegState } from './settlement';
export type { Form } from './form';
export type { CardPart, CardSection } from './card';
