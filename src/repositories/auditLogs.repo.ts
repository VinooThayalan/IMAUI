/** `audit_logs`: data access only. */

import { supabase } from '../lib/supabase';
import { selectAll } from '../lib/selectAll';

export interface AuditLogRow {
  id: string;
  action: string;
  performed_by: string | null;
  performed_at: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  description: string | null;
}

/** One record's history, oldest first. */
export async function listForRecord(tableName: string, recordId: string): Promise<AuditLogRow[]> {
  const rows = await selectAll(() =>
    supabase
      .from('audit_logs')
      .select('id, action, performed_by, performed_at, old_values, new_values, description')
      .eq('table_name', tableName)
      .eq('record_id', recordId)
      .order('performed_at', { ascending: true })
      .order('id', { ascending: true }),
  );
  return rows as unknown as AuditLogRow[];
}
