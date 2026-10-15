/** An entity's broker and custodian accounts: saving one from the Entities form. */

import { logAudit, fetchRecordForAudit } from '../lib/auditLog';
import * as entityBrokersRepo from '../repositories/entityBrokers.repo';

export interface EntityAccountForm {
  broker_id: string;
  relationship_type: string;
  assigned_date: string;
  notes: string;
  bank_name: string;
  bank_master_id: string;
  bank_branch_id: string;
  currency: string;
  bank_account_number: string;
  custodian_account_number: string;
  custodian_account_name: string;
  facility_interest_rate: string;
  broker_account_number: string;
  broker_text: string;
}

/** Stated as written, e.g. "AWPLR + 2%". Blank is not stated. */
export function facilityInterestRate(input: string): string | null {
  return input.trim() || null;
}

export function entityAccountRow(entityId: string, form: EntityAccountForm): entityBrokersRepo.EntityAccountWrite {
  const custodian = form.relationship_type === 'Custodian';
  const row: entityBrokersRepo.EntityAccountWrite = {
    entity_id: entityId,
    broker_id: custodian ? null : (form.broker_id || null),
    relationship_type: form.relationship_type,
    assigned_date: form.assigned_date,
    notes: form.notes || null,
    bank_name: form.bank_name || null,
    bank_master_id: form.bank_master_id || null,
    bank_branch_id: form.bank_branch_id || null,
    currency: form.currency,
    is_active: true,
    bank_account_number: form.bank_account_number || null,
  };
  if (custodian) {
    row.custodian_account_number = form.custodian_account_number || null;
    row.custodian_account_name = form.custodian_account_name || null;
    row.facility_interest_rate = facilityInterestRate(form.facility_interest_rate);
  } else {
    row.broker_account_number = form.broker_account_number || null;
    row.broker_text = form.broker_text || null;
  }
  return row;
}

/** Creates the account, or updates `editingId`, and records it in the audit log. */
export async function saveEntityAccount(
  entityId: string,
  form: EntityAccountForm,
  editingId: string | null,
  actor: { email: string | null } | null,
): Promise<void> {
  const row = entityAccountRow(entityId, form);
  if (editingId) {
    const oldRecord = await fetchRecordForAudit('entity_brokers', editingId);
    await entityBrokersRepo.updateAccount(editingId, row);
    if (actor) {
      await logAudit({
        performedBy: actor.email || 'system',
        action: 'UPDATE',
        tableName: 'entity_brokers',
        recordId: editingId,
        entityId,
        oldValues: oldRecord,
        newValues: { ...row },
      });
    }
    return;
  }
  const id = await entityBrokersRepo.insertAccount(row);
  if (id && actor) {
    await logAudit({
      performedBy: actor.email || 'system',
      action: 'CREATE',
      tableName: 'entity_brokers',
      recordId: id,
      entityId,
      newValues: { ...row },
    });
  }
}
