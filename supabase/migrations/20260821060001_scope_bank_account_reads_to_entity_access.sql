/*
  # Scope reads of `banks` to the caller's entities

  bug-37: Bank Transaction History listed all seven bank accounts to a user
  assigned two entities. The entity dropdown on the same screen showed the
  correct two, because `entities` SELECT is scoped and `banks` SELECT is not.

  ## How it got this way

  20260402053443_enforce_entity_level_rls created

      "Users can read banks for accessible entities"
        ON banks FOR SELECT USING (has_entity_access(entity_id))

  and 20260409054108_fix_banks_and_brokers_rls_policies dropped it seven days
  later. That migration was fixing an INSERT that `has_entity_access` was
  blocking, and its DROP list included the SELECT policy alongside the write
  ones. It replaced all four with `USING (true)`, reasoning that "banks are
  master data that should be manageable by any logged-in user".

  The reasoning holds for the bank *master* — which is now its own table,
  `bank_master`, added in 20260806060001 and left readable. It does not hold for
  `banks`, which is one company's account number and facility limit.

  20260803060002_scope_entity_owned_table_writes put INSERT, UPDATE and DELETE
  back under `has_entity_access`. Its policy loop filters
  `cmd IN ('INSERT','UPDATE','DELETE')`, so SELECT stayed open. Writes have been
  scoped since; reads have been open since 20260409054108.

  ## What this leaked

  Every authenticated user could read every entity's account number, branch,
  facility limit, interest rate and per-transaction charges, on nine screens
  that read `banks` — Bank Transaction History, Banks, Cash Balance,
  Transactions, Transaction Approvals, Dividends, IPO Transactions, Rights
  Issues, Share Buybacks.

  The row itself was visible; the embedded `entities(name)` was not, because that
  table is scoped. So a foreign account rendered with an em dash for its owner,
  which reads as missing data rather than as another company's account.

  ## After this

  A non-admin sees an account only for an entity they hold access to.
  `has_entity_access` returns true for any admin, so admin visibility is
  unchanged.

  `banks.entity_id` is nullable and no row has NULL today. Should one appear, it
  is readable by admins only: nobody can be granted access to an entity that is
  not named, so the alternative is showing an unowned account to everyone.
*/

DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'banks' AND cmd = 'SELECT'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.banks', p.policyname); END LOOP;
END $$;

CREATE POLICY "Users can read banks for their entities"
  ON public.banks FOR SELECT
  TO authenticated
  USING (public.has_entity_access(entity_id));
