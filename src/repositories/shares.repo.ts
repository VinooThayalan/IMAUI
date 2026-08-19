/**
 * Share master (`shares`).
 *
 * Data access only. Paged via selectAll with a unique tiebreaker, because an
 * unbounded select is capped server-side at db-max-rows and returns short
 * without erroring.
 */

import { supabase } from '../lib/supabase';
import { selectAll } from '../lib/selectAll';

type SectorType = { sector_name: string; color?: string | null };

export interface ShareMasterRow {
  id: string;
  ticker: string | null;
  share_name: string | null;
  sector: string | null;
  sector_types: SectorType | SectorType[] | null;
}

/** Every share, active or not: a sold-out holding still has to be nameable. */
export async function listAll(): Promise<ShareMasterRow[]> {
  const rows = await selectAll(() =>
    supabase
      .from('shares')
      .select('id, ticker, share_name, sector, sector_types(sector_name, color)')
      .order('id', { ascending: true }),
  );
  return rows as unknown as ShareMasterRow[];
}

/** PostgREST returns a to-one embed as an object; supabase-js types it as an array. */
export function sectorOf(row: ShareMasterRow): { name: string; color: string | null } {
  const st = Array.isArray(row.sector_types) ? row.sector_types[0] : row.sector_types;
  return { name: st?.sector_name || row.sector || 'Other', color: st?.color ?? null };
}
