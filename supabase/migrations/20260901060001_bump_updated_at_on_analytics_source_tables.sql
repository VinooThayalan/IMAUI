/*
  # bug-34: editing a source row must move `updated_at`

  Every computed report is served from `share_analytics_cache`, keyed by the
  fingerprint in `src/repositories/sourceFingerprint.repo.ts` — the latest
  `updated_at` across eight source tables. If none has moved, the cached batch is
  reused.

  Four of those eight had no trigger maintaining `updated_at`, so the column kept
  its insert value forever. Across the live database, the number of rows where
  `updated_at` has ever differed from `created_at`:

      scrip_entries     0 of  16
      transactions      0 of 487
      dividends         0 of  61

  Editing any of them therefore left the fingerprint unchanged and the report
  served the pre-edit batch. Creating one worked, because a new row carries a
  newer timestamp and the max moves.

  `shares` is bumped by hand in `Shares.tsx` and `entities` is not bumped at all;
  both get the trigger too, so the guarantee does not depend on a screen
  remembering. A trigger overrides any client-sent value, which is what we want:
  the database decides when a row last changed.

  `update_updated_at_column()` already exists and is what the four working
  triggers call. This only attaches it where it was missing.

  Idempotent, and it skips any table that already has an `updated_at` trigger, so
  the four working ones keep the trigger they have.
*/

DO $$
DECLARE
  t text;
  has_trigger boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'scrip_entries',
    'transactions',
    'dividends',
    'shares',
    'entities'
  ]
  LOOP
    -- Skip a table that does not exist on this deployment rather than aborting
    -- the whole migration; the phantom-table history is in SELF_HOSTED_MIGRATION.md.
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'skipping %: table not present', t;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'updated_at'
    ) THEN
      RAISE NOTICE 'skipping %: no updated_at column', t;
      CONTINUE;
    END IF;

    -- Does anything already maintain it? Match on the function the trigger
    -- calls, not on a name, because the existing four are named per table.
    SELECT EXISTS (
      SELECT 1
      FROM pg_trigger tg
      JOIN pg_class c ON c.oid = tg.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_proc p ON p.oid = tg.tgfoid
      WHERE n.nspname = 'public'
        AND c.relname = t
        AND NOT tg.tgisinternal
        AND p.proname ILIKE '%updated_at%'
    ) INTO has_trigger;

    IF has_trigger THEN
      RAISE NOTICE 'skipping %: already maintained', t;
      CONTINUE;
    END IF;

    EXECUTE format(
      'CREATE TRIGGER update_%I_updated_at
         BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      t, t
    );
    RAISE NOTICE 'added updated_at trigger on %', t;
  END LOOP;
END $$;
