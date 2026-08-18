/*
# Add row_index to share_analytics_cache

## Why

Every consumer of this cache reads a group's *last* row to get the closing
balance, average cost, market value and cumulative totals. Nothing recorded
what "last" meant, so each screen re-derived it from `trade_date` — and they
did not agree:

  - ShareAnalytics.tsx sorted in JS with `(a.trade_date ?? '')`, so a NULL trade
    date became the empty string and sorted FIRST.
  - PortfolioSummary.tsx sorted in SQL with `ORDER BY trade_date ASC`, and
    Postgres puts NULLs LAST.

A share with one undated note therefore reported its earliest event as the
closing position on one screen and its latest on the other, which is one of the
reasons the two reports disagreed.

`row_index` records the order the rows were actually computed in, so every
consumer can order by it and land on the same row.

## Changes

1. `share_analytics_cache.row_index` (integer, default 0) — 0-based position of
   the row within its (entity_id, share_id) group at compute time.
2. Index on (entity_id, share_id, row_index) for ordered group reads.

## Notes

Existing cached rows get 0. They are keyed by `source_hash` and are replaced on
the next compute, so no backfill is attempted — a stale batch is discarded
rather than reordered.
*/

ALTER TABLE share_analytics_cache
  ADD COLUMN IF NOT EXISTS row_index integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_analytics_cache_group_order
  ON share_analytics_cache(entity_id, share_id, row_index);
