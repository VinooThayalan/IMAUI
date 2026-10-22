import { useCallback, useEffect, useState } from 'react';
import { loadEntryDates } from '../services/entryDates.service';
import { tradeDatesFor, type TradeDates } from '../services/cashLedger.service';

export type { TradeDates };

/**
 * The trade or dividend dates behind each ledger entry. Until they load, every
 * entry answers with no dates, which renders as an em dash.
 */
export function useLedgerEntryDates() {
  const [index, setIndex] = useState<Map<string, TradeDates>>(new Map());

  useEffect(() => {
    let cancelled = false;
    loadEntryDates()
      .then(i => { if (!cancelled) setIndex(i); })
      .catch(err => console.error('Could not load ledger entry dates:', err));
    return () => { cancelled = true; };
  }, []);

  const datesFor = useCallback(
    (row: { reference_id?: string | null }) => tradeDatesFor(row, index),
    [index],
  );

  return { datesFor };
}
