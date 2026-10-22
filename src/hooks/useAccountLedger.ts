import { useEffect, useState } from 'react';
import { loadAccountLedger, type AccountLedgerEntry } from '../services/accountLedger.service';

export type { AccountLedgerEntry };

/** One bank account's ledger, loaded whenever the account changes. Empty for none. */
export function useAccountLedger(bankId: string | null) {
  const [entries, setEntries] = useState<AccountLedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEntries([]);
    if (!bankId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadAccountLedger(bankId)
      .then(rows => { if (!cancelled) setEntries(rows); })
      .catch(err => console.error('Could not load the account ledger:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [bankId]);

  return { entries, loading };
}
