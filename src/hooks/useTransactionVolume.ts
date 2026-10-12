/**
 * "Total Volume" on the Transactions list: the listed transactions that did or
 * still may trade. Cancelled, expired and rejected ones are left out (bug-51)
 * and counted, so the card can say so.
 */

import { tradableVolume } from '../services/transactions.service';

export function useTransactionVolume(
  rows: { approval_status: string | null; total_amount: number | string | null }[],
): { volume: number; excluded: number } {
  return tradableVolume(rows);
}
