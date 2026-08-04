/*
  # F17: Scope stored documents to entities the user may access

  Every signed-in user could read and delete any object in the
  transaction-documents bucket, including approval documents belonging to
  entities they have no access to. Approval documents are stored under a
  <transaction_id>/ prefix, so they can be tied back to the transaction's
  entity. Contract-note files live under buy-sell-notes/ and follow the same
  team-wide visibility as the buy_sell_notes table itself.
*/

DROP POLICY IF EXISTS "Authenticated users can read transaction documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete transaction documents" ON storage.objects;

CREATE POLICY "Users can read documents for their entities"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'transaction-documents'
    AND (
      public.is_app_admin()
      OR name LIKE 'buy-sell-notes/%'
      OR EXISTS (
        SELECT 1 FROM public.transactions t
        WHERE public.has_entity_access(t.entity_id)
          AND name LIKE t.id::text || '/%'
      )
    )
  );

CREATE POLICY "Admins can delete transaction documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'transaction-documents'
    AND public.is_app_admin()
  );
