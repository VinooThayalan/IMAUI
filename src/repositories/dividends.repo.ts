/**
 * Dividend receipts (`dividends`).
 *
 * Data access only. Paged via selectAll with a unique tiebreaker, because an
 * unbounded select is capped server-side at db-max-rows and returns short
 * without erroring.
 */

import { supabase } from '../lib/supabase';
import { selectAll } from '../lib/selectAll';

export interface DividendRow {
  entity_id: string;
  share_id: string;
  payment_date: string | null;
  amount_net: number | string;
}

/** The columns the Dividends form writes. */
export interface DividendWrite {
  entity_id: string;
  share_id: string;
  dividend_date: string | null;
  quantity: number;
  gross_dividend_per_share: number;
  withholding_tax_rate: number;
  net_dividend_per_share: number;
  tax_withheld: number;
  amount_gross: number;
  amount_net: number;
  announcement_date: string | null;
  payment_date: string | null;
  payment_date_cse: string | null;
  effective_date: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  payment_method: string | null;
  cds_account: string | null;
  notes: string | null;
  status: string;
}

export type DividendRecord = DividendWrite & { id: string; created_at: string; updated_at: string };

export async function getById(id: string): Promise<DividendRecord | null> {
  const { data, error } = await supabase.from('dividends').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as DividendRecord | null;
}

export async function insert(row: DividendWrite): Promise<{ id: string } | null> {
  const { data, error } = await supabase.from('dividends').insert(row).select('id').maybeSingle();
  if (error) throw error;
  return data as { id: string } | null;
}

export async function update(id: string, row: DividendWrite): Promise<void> {
  const { error } = await supabase.from('dividends').update(row).eq('id', id);
  if (error) throw error;
}

export async function remove(id: string): Promise<void> {
  const { error } = await supabase.from('dividends').delete().eq('id', id);
  if (error) throw error;
}

export async function listAll(): Promise<DividendRow[]> {
  const rows = await selectAll(() =>
    supabase
      .from('dividends')
      .select('entity_id, share_id, payment_date, amount_net')
      .order('id', { ascending: true }),
  );
  return rows as unknown as DividendRow[];
}
