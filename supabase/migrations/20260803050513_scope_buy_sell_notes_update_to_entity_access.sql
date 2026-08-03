/*
  # F10: Scope contract note updates to entities the user may access

  The authenticated UPDATE policy was USING (true) WITH CHECK (true), so any
  signed-in user could approve or edit a note belonging to an entity they
  cannot even read. Use the same join through transactions that this table's
  SELECT, INSERT and DELETE policies already use.
*/

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'buy_sell_notes'
      AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.buy_sell_notes', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users can update notes for their entities"
  ON public.buy_sell_notes
  FOR UPDATE
  TO authenticated
  USING (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = buy_sell_notes.transaction_id
        AND public.has_entity_access(t.entity_id)
    )
  )
  WITH CHECK (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = buy_sell_notes.transaction_id
        AND public.has_entity_access(t.entity_id)
    )
  );
