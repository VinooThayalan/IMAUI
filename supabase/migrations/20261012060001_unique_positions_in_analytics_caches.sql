/*
# One stored row per position in the analytics caches

## Why

Both caches are rebuilt in the browser as "delete this batch, then insert it".
Nothing stopped two rebuilds overlapping -- two tabs, two users, or React
StrictMode running a page's load effect twice under `npm run dev` -- and when
they did, both deletes landed before either insert and every row was stored
twice.

On 2026-10-12 `share_analytics_cache` held 1,099 rows for 567 positions:
Metrocorp's 525 rows were written twice, one second apart. Share Analytics sums
the rows it is handed, so ALUM.N0000's breakdown listed every event twice and
its Cost per share row read a cash flow of 1,151,593.90 against 881,163.80, and
an AER of 3.40% against 4.99%. `portfolio_cache` is written the same way; it
held no duplicate on that date, and this closes the same gap before it does.

## Changes

1. Remove the duplicates, keeping one row of each position.
2. Unique index on `share_analytics_cache (source_hash, entity_id, share_id,
   row_index)`.
3. Unique index on `portfolio_cache (source_hash, scope, section,
   is_top_performer, sort_order)`, NULLS NOT DISTINCT. Summary, sector and
   entity rows leave `is_top_performer` NULL; with NULLs distinct, those rows
   could still be stored twice.

## Order

The frontend now writes with ON CONFLICT DO NOTHING against these columns, so a
second, overlapping rebuild skips what the first stored. PostgREST refuses an
`on_conflict` it cannot match to a unique index, so this migration must be
applied before that frontend deploys, or no cache write succeeds.

Both tables are locked for the length of this migration so a rebuild cannot
insert a duplicate between the cleanup and the index.
*/

LOCK TABLE share_analytics_cache, portfolio_cache IN SHARE ROW EXCLUSIVE MODE;

DELETE FROM share_analytics_cache a
USING share_analytics_cache b
WHERE a.source_hash = b.source_hash
  AND a.entity_id   = b.entity_id
  AND a.share_id    = b.share_id
  AND a.row_index   = b.row_index
  AND a.id > b.id;

DELETE FROM portfolio_cache a
USING portfolio_cache b
WHERE a.source_hash = b.source_hash
  AND a.scope       = b.scope
  AND a.section     = b.section
  AND a.is_top_performer IS NOT DISTINCT FROM b.is_top_performer
  AND a.sort_order  = b.sort_order
  AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS share_analytics_cache_position_key
  ON share_analytics_cache (source_hash, entity_id, share_id, row_index);

CREATE UNIQUE INDEX IF NOT EXISTS portfolio_cache_position_key
  ON portfolio_cache (source_hash, scope, section, is_top_performer, sort_order)
  NULLS NOT DISTINCT;
