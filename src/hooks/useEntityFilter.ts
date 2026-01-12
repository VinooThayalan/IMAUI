import { useAuth } from '../contexts/AuthContext';

export function useEntityFilter<T extends { entity_id?: string; id?: string }>(
  data: T[],
  idField: 'entity_id' | 'id' = 'entity_id'
): T[] {
  const { appUser, accessibleEntityIds } = useAuth();

  if (!appUser) return [];

  if (appUser.role === 'super_admin') {
    return data;
  }

  return data.filter(item => {
    const entityId = item[idField];
    if (!entityId) return true;
    return accessibleEntityIds.includes(entityId);
  });
}
