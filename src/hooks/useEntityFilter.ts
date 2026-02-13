export function useEntityFilter<T extends { entity_id?: string; id?: string }>(
  data: T[],
  idField: 'entity_id' | 'id' = 'entity_id'
): T[] {
  return data;
}
