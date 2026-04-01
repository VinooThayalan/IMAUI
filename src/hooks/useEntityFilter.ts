import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function useEntityFilter<T extends { entity_id?: string; id?: string }>(
  data: T[],
  idField: 'entity_id' | 'id' = 'entity_id'
): T[] {
  const { isAdmin, entityAccess } = useAuth();

  return useMemo(() => {
    if (isAdmin) return data;
    if (entityAccess.length === 0) return [];

    const accessSet = new Set(entityAccess);
    return data.filter(item => {
      const entityId = item[idField];
      if (!entityId) return false;
      return accessSet.has(entityId);
    });
  }, [data, idField, isAdmin, entityAccess]);
}
