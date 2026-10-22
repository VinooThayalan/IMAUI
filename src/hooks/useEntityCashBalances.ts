import { useCallback, useEffect, useState } from 'react';
import {
  cashBalanceOf,
  combinedCashBalance,
  loadEntityCashBalances,
  type EntityCashBalances,
} from '../services/entityCash.service';
import { errorMessage } from '../lib/errorMessage';

/**
 * Every entity's cash balance from the ledger.
 *
 * `balanceOf` and `combined` answer null for an entity with no entries, and
 * undefined until the balances have loaded.
 */
export function useEntityCashBalances() {
  const [balances, setBalances] = useState<EntityCashBalances | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadEntityCashBalances()
      .then(b => { if (!cancelled) { setBalances(b); setError(null); } })
      .catch(err => {
        console.error('Could not load cash balances:', err);
        if (!cancelled) setError(errorMessage(err));
      });
    return () => { cancelled = true; };
  }, [version]);

  const reload = useCallback(() => setVersion(v => v + 1), []);
  const balanceOf = useCallback(
    (entityId: string) => (balances ? cashBalanceOf(balances, entityId) : undefined),
    [balances],
  );
  const combined = useCallback(
    (entityId?: string | null) => (balances ? combinedCashBalance(balances, entityId) : undefined),
    [balances],
  );

  return { loaded: balances !== null, error, balanceOf, combined, reload };
}
