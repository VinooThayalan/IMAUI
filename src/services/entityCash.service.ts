/**
 * Each entity's cash balance, from the cash ledger: the one reading every screen
 * shows. `entities.current_balance` is a copy and is not read.
 */

import * as cashLedgerRepo from '../repositories/cashLedger.repo';
import { entityBalance } from './cashLedger.service';

/** Keyed by entity id. An entity with no entries is absent: it has no balance. */
export type EntityCashBalances = Map<string, number>;

export async function loadEntityCashBalances(): Promise<EntityCashBalances> {
  const rows = (await cashLedgerRepo.listAllAmounts())
    .map(r => ({ entity_id: r.entity_id, type: r.type, amount: Number(r.amount) }));
  const balances: EntityCashBalances = new Map();
  for (const entityId of new Set(rows.map(r => r.entity_id))) {
    if (!entityId) continue;
    const balance = entityBalance(rows, entityId);
    if (balance !== null) balances.set(entityId, balance);
  }
  return balances;
}

/** One entity's balance, or null when it has no entries. */
export function cashBalanceOf(balances: EntityCashBalances, entityId: string): number | null {
  return balances.get(entityId) ?? null;
}

/**
 * The cash across the entities in view: one entity's, or all of them summed.
 * Null when none of them has an entry.
 */
export function combinedCashBalance(balances: EntityCashBalances, entityId?: string | null): number | null {
  if (entityId) return cashBalanceOf(balances, entityId);
  if (balances.size === 0) return null;
  let total = 0;
  for (const balance of balances.values()) total += balance;
  return Math.round(total * 100) / 100;
}
