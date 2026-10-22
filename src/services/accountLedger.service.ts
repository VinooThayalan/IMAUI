/**
 * One bank account's ledger: its own entries in posting order, each with the
 * account's balance as at that entry.
 */

import * as cashLedgerRepo from '../repositories/cashLedger.repo';
import { accountRunningBalances, indexNoteDates, noteIdFor, tradeDatesFor } from './cashLedger.service';

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
  /** From the contract note this entry settles. Null otherwise. */
  tradeDate: string | null;
  settlementDate: string | null;
}

export async function loadAccountLedger(bankId: string): Promise<AccountLedgerEntry[]> {
  const [bankRows, noteDateRows] = await Promise.all([
    cashLedgerRepo.listByBank(bankId),
    cashLedgerRepo.listNoteDates(),
  ]);
  const noteDates = indexNoteDates(noteDateRows);
  const series = accountRunningBalances(
    bankRows.map(r => ({ ...r, amount: Number(r.amount) || 0 })),
    bankId,
  );
  return series.map(({ row: r, balance }) => {
    const dates = tradeDatesFor(r, noteDates);
    return {
      id: r.id,
      date: r.date,
      type: r.type,
      description: r.description,
      code: r.code,
      amount: r.amount,
      running_balance: balance,
      noteId: noteIdFor(r, noteDates),
      tradeDate: dates.tradeDate,
      settlementDate: dates.settlementDate,
    };
  });
}
