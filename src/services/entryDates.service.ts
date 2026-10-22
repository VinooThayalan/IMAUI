/**
 * The dates behind every cash ledger entry raised by a contract note or a
 * dividend, keyed by the id the entry carries in `reference_id`.
 */

import * as cashLedgerRepo from '../repositories/cashLedger.repo';
import * as dividendsRepo from '../repositories/dividends.repo';
import { indexEntryDates, type TradeDates } from './cashLedger.service';

export async function loadEntryDates(): Promise<Map<string, TradeDates>> {
  const [notes, dividends] = await Promise.all([
    cashLedgerRepo.listNoteDates(),
    dividendsRepo.listDates(),
  ]);
  return indexEntryDates(notes, dividends);
}
