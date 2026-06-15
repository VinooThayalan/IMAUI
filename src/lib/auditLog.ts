import { supabase } from './supabase';

interface AuditParams {
  tableName: string;
  recordId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  performedBy: string;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  entityId?: string | null;
  description?: string;
}

let cachedAuditEnabled: boolean | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30_000;

async function isAuditEnabled(): Promise<boolean> {
  if (cachedAuditEnabled !== null && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedAuditEnabled;
  }
  try {
    const { data } = await supabase
      .from('audit_settings')
      .select('audit_enabled')
      .limit(1)
      .maybeSingle();
    cachedAuditEnabled = data?.audit_enabled ?? true;
    cacheTimestamp = Date.now();
    return cachedAuditEnabled;
  } catch {
    return true;
  }
}

export function invalidateAuditCache() {
  cachedAuditEnabled = null;
}

function computeChangedFields(
  oldObj: Record<string, any>,
  newObj: Record<string, any>
): string[] {
  const fields: string[] = [];
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
  for (const key of allKeys) {
    if (key === 'updated_at' || key === 'created_at') continue;
    const oldVal = JSON.stringify(oldObj[key] ?? null);
    const newVal = JSON.stringify(newObj[key] ?? null);
    if (oldVal !== newVal) fields.push(key);
  }
  return fields;
}

function buildDescription(
  action: string,
  tableName: string,
  changedFields: string[],
  oldValues?: Record<string, any> | null,
  newValues?: Record<string, any> | null
): string {
  const table = tableName.replace(/_/g, ' ');
  if (action === 'CREATE') return `Created ${table} record`;
  if (action === 'DELETE') return `Deleted ${table} record`;
  if (!changedFields.length) return `Updated ${table} record`;

  const parts = changedFields.slice(0, 3).map((f) => {
    const from = oldValues?.[f] ?? '(empty)';
    const to = newValues?.[f] ?? '(empty)';
    return `${f}: ${from} -> ${to}`;
  });
  const suffix = changedFields.length > 3 ? ` (+${changedFields.length - 3} more)` : '';
  return `Updated ${table}: ${parts.join(', ')}${suffix}`;
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    const enabled = await isAuditEnabled();
    if (!enabled) return;

    const changedFields =
      params.action === 'UPDATE' && params.oldValues && params.newValues
        ? computeChangedFields(params.oldValues, params.newValues)
        : null;

    if (params.action === 'UPDATE' && changedFields && changedFields.length === 0) return;

    const description =
      params.description ||
      buildDescription(
        params.action,
        params.tableName,
        changedFields || [],
        params.oldValues,
        params.newValues
      );

    await supabase.from('audit_logs').insert({
      table_name: params.tableName,
      record_id: String(params.recordId),
      action: params.action,
      performed_by: params.performedBy,
      old_values: params.oldValues || null,
      new_values: params.newValues || null,
      changed_fields: changedFields,
      entity_id: params.entityId ? String(params.entityId) : null,
      description,
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

export async function fetchRecordForAudit(
  tableName: string,
  recordId: string
): Promise<Record<string, any> | null> {
  try {
    const { data } = await supabase.from(tableName).select('*').eq('id', recordId).maybeSingle();
    return data;
  } catch {
    return null;
  }
}
