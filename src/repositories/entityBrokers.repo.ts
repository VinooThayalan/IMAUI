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

export interface EntityAccountWrite {
  entity_id: string;
  broker_id: string | null;
  relationship_type: string;
  assigned_date: string;
  notes: string | null;
  bank_name: string | null;
  bank_master_id: string | null;
  bank_branch_id: string | null;
  currency: string;
  is_active: boolean;
  bank_account_number: string | null;
  custodian_account_number?: string | null;
  custodian_account_name?: string | null;
  facility_interest_rate?: string | null;
  broker_account_number?: string | null;
  broker_text?: string | null;
}

/** The new row's id, or null when it cannot be read back. */
export async function insertAccount(row: EntityAccountWrite): Promise<string | null> {
  const { data, error } = await supabase.from('entity_brokers').insert(row).select('id').maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function updateAccount(id: string, row: EntityAccountWrite): Promise<void> {
  const { error } = await supabase.from('entity_brokers').update(row).eq('id', id).select('id').maybeSingle();
  if (error) throw error;
}
