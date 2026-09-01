/**
 * Entity master (`entities`).
 *
 * Data access only. Paged via selectAll with a unique tiebreaker, because an
 * unbounded select is capped server-side at db-max-rows and returns short
 * without erroring.
 */

import { supabase } from '../lib/supabase';
import { selectAll } from '../lib/selectAll';

/** The writable columns of `entities`, as the Entities form collects them. */
export interface EntityInsert {
  id: string;
  name: string;
  entity_type_id: string | null;
  tax_name: string | null;
  nic_company_id: string | null;
  key_contact_name: string | null;
  company_individual_address: string | null;
  contact_email_company_individual: string | null;
  cc_email: string | null;
  cc_email_2: string | null;
  cc_email_3: string | null;
  contact_phone: string | null;
  contact_mobile: string | null;
  contact_mobile_number_2: string | null;
  current_balance: number;
}

export interface EntityMasterRow {
  id: string;
  name: string;
  current_balance: number | string | null;
}

export async function listAll(): Promise<EntityMasterRow[]> {
  const rows = await selectAll(() =>
    supabase
      .from('entities')
      .select('id, name, current_balance')
      .order('name', { ascending: true })
      .order('id', { ascending: true }),
  );
  return rows as unknown as EntityMasterRow[];
}

/**
 * Insert one entity.
 *
 * No `.select()`, deliberately, and the caller supplies `id`. Asking for the
 * row back turns this into `INSERT ... RETURNING`, and Postgres then applies
 * the SELECT policy on `entities` to the new row. That policy is
 * `has_entity_access(id)`, which a row created a moment ago cannot satisfy —
 * entity access is an admin grant against an existing id. The insert is
 * permitted and the read-back is refused, both reported as 42501 with the same
 * text. Do not add a `.select()` here.
 */
export async function insertEntity(row: EntityInsert): Promise<void> {
  const { error } = await supabase.from('entities').insert(row);
  if (error) throw error;
}

/** Grant one user access to one entity. Admin-only at the database. */
export async function grantEntityAccess(userId: string, entityId: string): Promise<{ ok: boolean }> {
  const { error } = await supabase
    .from('user_entity_access')
    .insert({ user_id: userId, entity_id: entityId });
  return { ok: !error };
}
