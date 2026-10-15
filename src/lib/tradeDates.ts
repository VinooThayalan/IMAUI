/**
 * A trade's two dates (bug-61): the trade date, when the trade was made, and the
 * settlement date, when it completes and the cash moves.
 */

import { formatDisplayDate } from './dateInput';

/** Why a pair of trade dates cannot be saved, or null when they can. */
export function tradeDatesProblem(tradeDate: string | null | undefined, settlementDate: string | null | undefined): string | null {
  const trade = (tradeDate ?? '').slice(0, 10);
  const settlement = (settlementDate ?? '').slice(0, 10);
  if (!trade) return 'Enter the trade date.';
  if (!settlement) return 'Enter the settlement date.';
  if (settlement < trade) {
    return `The settlement date (${formatDisplayDate(settlement)}) is before the trade date (${formatDisplayDate(trade)}).`;
  }
  return null;
}

/** The date a trade's cash is posted to the cash ledger: its settlement date. Null when it has none. */
export function tradeLedgerDate(dates: { settlement_date?: string | null }): string | null {
  return dates.settlement_date?.slice(0, 10) || null;
}
