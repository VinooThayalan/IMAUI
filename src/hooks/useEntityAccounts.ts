import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { saveEntityAccount, type EntityAccountForm } from '../services/entityAccounts.service';

export type { EntityAccountForm } from '../services/entityAccounts.service';

/** Entities: saving a broker or custodian account as the signed-in user. */
export function useEntityAccounts() {
  const { user } = useAuth();
  const save = useCallback(
    (entityId: string, form: EntityAccountForm, editingId: string | null) =>
      saveEntityAccount(entityId, form, editingId, user ? { email: user.email ?? null } : null),
    [user],
  );
  return { save };
}
