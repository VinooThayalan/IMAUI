/*
  # Same-day trade order: `buy_sell_notes.intraday_seq`

  ## Why

  A contract note records a trade *date* and no trade *time*. When two notes for
  one (entity, share) share a date, nothing in the data says which happened
  first, so `shareLedger.service` falls back to the order the query returns —
  `ORDER BY trade_date, id`, and `id` is a random uuid.

  For a day of only buys, or only sells, that is harmless: both are commutative
  under average cost, and the position at the end of the day is the same either
  way. For a day holding both a buy and a sell it is not. Buying then selling
  leaves the day's average cost at (C+buy)/(S+qty); selling then buying leaves it
  at something else entirely, because the sell is costed at the *pre-buy*
  average. That is the difference the manually maintained Metrocorp share
  workbook keeps showing against Share Analytics.

  Live data, 2026-09-21: 58 (entity, share, trade_date) groups hold more than one
  PROCESSED note. Ten of them mix buys and sells, and on three of those the uuid
  order disagrees with the order the migrated note numbers imply —
  BIL.N0000 2021-12-01, LOLC.N0000 2020-11-05, NDB.N0000 2026-04-08.

  ## Changes

  1. `buy_sell_notes.intraday_seq` (integer, nullable) — the note's 1-based
     position within its own (entity, share, trade_date). Its scope is that day:
     the note's transaction fixes the entity and share, and the note fixes the
     date, so a bare integer is unambiguous.
  2. `CHECK (intraday_seq IS NULL OR intraday_seq >= 1)`.
  3. Index on (trade_date, intraday_seq) for the ordered read.
  4. `share_analytics_cache.intraday_seq` (integer, nullable) — carried through
     so a cached row still says whether its day's order was stated. Without it
     the screen would report "no order stated" for every holding it served from
     cache, which is the one place a user would go looking for the answer.

  ## Notes

  Nullable, and no backfill. NULL means *nobody has stated an order*, which is
  the truth for every existing row — it is not position zero. Notes carrying a
  sequence run first, in sequence; the rest keep today's deterministic
  `id` order behind them, so nothing already on screen moves until someone says
  it should.

  `buy_sell_notes` already has an `updated_at` trigger, so setting a sequence
  bumps the fingerprint in `sourceFingerprint.repo.ts` and the analytics cache
  recomputes on the next visit. No cache invalidation is needed here.
*/

ALTER TABLE buy_sell_notes
  ADD COLUMN IF NOT EXISTS intraday_seq integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.buy_sell_notes'::regclass
      AND conname = 'buy_sell_notes_intraday_seq_positive'
  ) THEN
    ALTER TABLE public.buy_sell_notes
      ADD CONSTRAINT buy_sell_notes_intraday_seq_positive
      CHECK (intraday_seq IS NULL OR intraday_seq >= 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_buy_sell_notes_intraday_order
  ON buy_sell_notes(trade_date, intraday_seq);

COMMENT ON COLUMN buy_sell_notes.intraday_seq IS
  '1-based order of this note within its (entity, share, trade_date). NULL = no order stated; those notes run after the sequenced ones, in id order.';

ALTER TABLE share_analytics_cache
  ADD COLUMN IF NOT EXISTS intraday_seq integer;

COMMENT ON COLUMN share_analytics_cache.intraday_seq IS
  'Copy of buy_sell_notes.intraday_seq for the note this row replays. NULL for opening, dividend and scrip rows, and for notes with no order stated.';
