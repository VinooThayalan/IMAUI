/**
 * Writes to `portfolio_cache`, the Portfolio screen's computed summary.
 *
 * Data access only. Portfolio wrote this inline, twice, as "delete the batch,
 * then insert it" -- the pattern that stored every row of
 * `share_analytics_cache` twice when two rebuilds overlapped. No duplicate had
 * landed here yet; the unique key closes the same gap.
 */

import { supabase } from '../lib/supabase';

/** One cached row per position: the unique index of 20261012060001. */
const POSITION_KEY = 'source_hash,scope,section,is_top_performer,sort_order';

/**
 * Replace the batch for one scope and fingerprint.
 *
 * The insert skips any position already stored, so an overlapping load cannot
 * store a second copy. Needs migration 20261012060001 applied first: without the
 * unique index PostgREST refuses an `on_conflict` it cannot match.
 *
 * Resolves to PostgREST's error, or null.
 */
export async function replaceBatch(
  scope: string,
  sourceHash: string,
  rows: Record<string, unknown>[],
): Promise<unknown> {
  const { error: delErr } = await supabase
    .from('portfolio_cache')
    .delete()
    .eq('scope', scope)
    .eq('source_hash', sourceHash);
  if (delErr) return delErr;

  for (let i = 0; i < rows.length; i += 500) {
    const { error: insErr } = await supabase
      .from('portfolio_cache')
      .upsert(rows.slice(i, i + 500), { onConflict: POSITION_KEY, ignoreDuplicates: true });
    if (insErr) return insErr;
  }
  return null;
}
