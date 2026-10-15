/** `entity_brokers`: an entity's broker and custodian accounts. Data access only. */

import { supabase } from '../lib/supabase';
import { selectAll } from '../lib/selectAll';

export interface EntityAccountRow {
  id: string;
  entity_id: string;
  broker_id: string | null;
  relationship_type: string | null;
  broker_account_number: string | null;
  custodian_account_number: string | null;
  custodian_account_name: string | null;
  bank_name: string | null;
}

export async function listAccounts(): Promise<EntityAccountRow[]> {
  const rows = await selectAll(() =>
    supabase
      .from('entity_brokers')
      .select('id, entity_id, broker_id, relationship_type, broker_account_number, custodian_account_number, custodian_account_name, bank_name')
      .order('id', { ascending: true }),
  );
  return rows as unknown as EntityAccountRow[];
}
