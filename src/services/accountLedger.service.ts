/**
 * One bank account's ledger: its own entries in posting order, each with the
 * account's balance as at that entry.
 */

import * as cashLedgerRepo from '../repositories/cashLedger.repo';
import { accountRunningBalances, noteIdFor, tradeDatesFor, type TradeDates } from './cashLedger.service';
import { loadEntryDates } from './entryDates.service';

export interface AccountLedgerEntry {
  id: string;
  date: string | null;
  type: string;
  description: string | null;
  code: string | null;
  amount: number;
  /** The account's balance as at this entry, from its own entries only. */
  running_balance: number;
  /** The contract note this entry settles. Null for a manual or dividend entry. */
  noteId: string | null;
  /** A trade's trade and settlement dates, or a dividend's XD and payment dates. */
  tradeDate: string | null;
  settlementDate: string | null;
  /** Shown before each date when it is not a trade's; null otherwise. */
  dateLabels: TradeDates['labels'];
}

export async function loadAccountLedger(bankId: string): Promise<AccountLedgerEntry[]> {
  const [bankRows, entryDates] = await Promise.all([
    cashLedgerRepo.listByBank(bankId),
    loadEntryDates(),
  ]);
  const series = accountRunningBalances(
    bankRows.map(r => ({ ...r, amount: Number(r.amount) || 0 })),
    bankId,
  );
  return series.map(({ row: r, balance }) => {
    const dates = tradeDatesFor(r, entryDates);
    return {
      id: r.id,
      date: r.date,
      type: r.type,
      description: r.description,
      code: r.code,
      amount: r.amount,
      running_balance: balance,
      noteId: noteIdFor(r, entryDates),
      tradeDate: dates.tradeDate,
      settlementDate: dates.settlementDate,
      dateLabels: dates.labels,
    };
  });
}
