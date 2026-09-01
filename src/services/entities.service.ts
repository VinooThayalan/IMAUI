/**
 * Creating an entity.
 *
 * The whole reason this is a service is one collision that is invisible from
 * the page: the identity permitted to *create* an entity is not always the
 * identity permitted to *read* it back.
 *
 *   INSERT policy   is_app_admin() OR a user_menu_access row for 'entities'
 *   SELECT policy   has_entity_access(id)
 *
 * An admin satisfies both. A non-admin holding the entities menu satisfies the
 * first and never the second for a brand-new row, because entity access is an
 * admin grant naming an id that already exists. `INSERT ... RETURNING` — which
 * is what `.insert().select()` sends — applies the SELECT policy to the new
 * row, so the write was refused for a reason the reader could not act on and
 * had nothing to do with permission to create.
 *
 * Both refusals are SQLSTATE 42501 with the identical message
 * `new row violates row-level security policy for table "entities"`, which is
 * why this was previously read as a policy gap or an expired session.
 *
 * So the id is generated here and the row is never read back.
 */

import { newUuidV4 } from '../lib/uuid';
import { logAudit } from '../lib/auditLog';
import { insertEntity, grantEntityAccess, type EntityInsert } from '../repositories/entities.repo';

/** What the form collects. Everything but the name is optional. */
export interface NewEntity {
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
}

export interface CreateEntityResult {
  id: string;
  /**
   * Whether the creator can now see what they created.
   *
   * False for a non-admin: `user_entity_access` is admin-only since
   * 20260803050148, so the self-grant is refused and the new entity will not
   * appear in their list until an administrator grants access. The entity does
   * exist. Reporting this is the difference between an honest message and what
   * reads as a second bug — "created successfully" over a list that did not
   * change.
   */
  visibleToCreator: boolean;
}

/**
 * `actor` is the signed-in user. `null` when there is none, in which case the
 * insert is attempted and the database refuses it.
 */
export async function createEntity(
  input: NewEntity,
  actor: { id: string; email: string | null } | null,
): Promise<CreateEntityResult> {
  const row: EntityInsert = {
    id: newUuidV4(),
    name: input.name,
    entity_type_id: input.entity_type_id || null,
    tax_name: input.tax_name || null,
    nic_company_id: input.nic_company_id || null,
    key_contact_name: input.key_contact_name || null,
    company_individual_address: input.company_individual_address || null,
    contact_email_company_individual: input.contact_email_company_individual || null,
    cc_email: input.cc_email || null,
    cc_email_2: input.cc_email_2 || null,
    cc_email_3: input.cc_email_3 || null,
    contact_phone: input.contact_phone || null,
    contact_mobile: input.contact_mobile || null,
    contact_mobile_number_2: input.contact_mobile_number_2 || null,
    current_balance: 0,
  };

  await insertEntity(row);

  if (!actor) return { id: row.id, visibleToCreator: false };

  await logAudit({
    performedBy: actor.email || 'system',
    action: 'CREATE',
    tableName: 'entities',
    recordId: row.id,
    entityId: row.id,
    newValues: row,
  });

  const { ok } = await grantEntityAccess(actor.id, row.id);
  return { id: row.id, visibleToCreator: ok };
}
