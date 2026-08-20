/**
 * Bank accounts (`banks`).
 *
 * Data access only. Paged via selectAll with a unique tiebreaker, because an
 * unbounded select is capped server-side at db-max-rows and returns short
 * without erroring.
 *
 * Note what this table does **not** hold: a usable balance. `banks.balance` is
 * 0 for every row because nothing maintains it, so it is not selected here. An
 * account's balance is derived from the ledger — see `accountBalance` in
 * `services/cashLedger.service.ts`.
 */

import { supabase } from '../lib/supabase';
import { selectAll } from '../lib/selectAll';

export interface BankAccountRow {
  id: string;
  name: string;
  account_number: string | null;
  entity_id: string;
  is_active: boolean | null;
  /**
   * The owning entity's name, embedded. PostgREST returns an embed as an object
   * or an array depending on how it resolves the relationship, so callers must
   * handle both — reading `.name` off the wrong shape yields `undefined`, which
   * would render as a blank entity rather than an error.
   */
  entity: { name: string } | { name: string }[] | null;
}

/**
 * Bank accounts with their owning entity's name, optionally for one entity.
 *
 * Ordered by name with `id` breaking the tie, so paging cannot drop or repeat a
 * row. The caller did this select inline and unpaged; past `db-max-rows` an
 * account would simply stop appearing, and a missing account reads as one that
 * does not exist rather than as a failed read.
 */
export async function listWithEntity(entityId?: string): Promise<BankAccountRow[]> {
  const rows = await selectAll(() => {
    const query = supabase
      .from('banks')
      .select('id, name, account_number, entity_id, is_active, entity:entities(name)')
      .order('name', { ascending: true })
      .order('id', { ascending: true });
    return entityId ? query.eq('entity_id', entityId) : query;
  });
  return rows as unknown as BankAccountRow[];
}

/** The entity name off an embed, whichever shape it came back as. */
export function entityNameOf(row: BankAccountRow): string | null {
  const one = Array.isArray(row.entity) ? row.entity[0] : row.entity;
  return one?.name ?? null;
}
