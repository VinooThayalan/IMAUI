/**
 * What an entity holds of one share, for the New Transaction form.
 *
 * Read from the same ledger Share Analytics shows (bug-51): approved
 * transactions with a processed contract note, opening balances and scrip. The
 * form used to add up `transactions` itself, cancelled and expired ones
 * included.
 *
 * Holdings are loaded per entity, so choosing another share of the same entity
 * does not read the ledger again.
 */

import { useEffect, useState } from 'react';
import { loadShareGroups } from '../services/shareGroups.service';
import type { ShareGroup } from '../services/shareLedger.service';
import {
  avgCostAfterBuy,
  positionOf,
  sellPnl,
  type Position,
} from '../services/transactions.service';

export interface UseHolding {
  /** Null until the entity's holdings have loaded, or when none is chosen. */
  position: Position | null;
  loading: boolean;
  avgCostAfterBuy: (quantity: number, netPricePerShare: number) => number | null;
  sellPnl: (quantity: number, netSalePricePerShare: number) => ReturnType<typeof sellPnl>;
}

export function useHolding(entityId: string, shareId: string): UseHolding {
  const [loaded, setLoaded] = useState<{ entityId: string; groups: ShareGroup[] } | null>(null);

  useEffect(() => {
    if (!entityId) return;
    // A slow answer for the previous entity must not land over this one.
    let cancelled = false;
    loadShareGroups(entityId)
      .then(groups => { if (!cancelled) setLoaded({ entityId, groups }); })
      .catch(err => console.error('Error loading holdings:', err));
    return () => { cancelled = true; };
  }, [entityId]);

  const ready = !!entityId && !!shareId && loaded?.entityId === entityId;
  const position = ready ? positionOf(loaded.groups, entityId, shareId) : null;

  return {
    position,
    loading: !!entityId && loaded?.entityId !== entityId,
    avgCostAfterBuy: (q, p) => (position ? avgCostAfterBuy(position, q, p) : null),
    sellPnl: (q, p) => (position ? sellPnl(position, q, p) : null),
  };
}
