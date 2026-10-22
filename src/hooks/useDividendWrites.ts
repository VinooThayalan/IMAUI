import { useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  deleteDividend,
  saveDividend,
  type DividendActor,
  type DividendWrite,
  type SaveDividendInput,
} from '../services/dividends.service';

export type { DividendWrite, SaveDividendInput };

export function useDividendWrites() {
  const { appUser, user } = useAuth();

  /** Created By shows the person's name, as on a manual Cash Balance entry. */
  const actor = useMemo<DividendActor>(() => ({
    createdBy: appUser?.full_name || appUser?.email || user?.email || 'Unknown',
    performedBy: user?.email || 'system',
  }), [appUser, user]);

  const save = useCallback((input: SaveDividendInput) => saveDividend(input, actor), [actor]);
  const remove = useCallback((id: string) => deleteDividend(id, actor), [actor]);

  return { save, remove };
}
