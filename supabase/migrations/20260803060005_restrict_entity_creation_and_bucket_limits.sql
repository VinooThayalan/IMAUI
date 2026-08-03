/*
  F19: Enforce upload limits on the transaction-documents storage bucket.
  F21: Restrict entity creation to admins or users with the entities menu.
*/

-- F19: limit upload size and file types
UPDATE storage.buckets
SET file_size_limit = 20971520,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ]
WHERE id = 'transaction-documents';

-- F21: entity creation requires admin or entities menu access
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='entities' AND cmd='INSERT'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.entities', p.policyname); END LOOP;
END $$;
CREATE POLICY "Permitted users can create entities"
  ON public.entities FOR INSERT TO authenticated
  WITH CHECK (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1
      FROM public.user_menu_access uma
      JOIN public.menu_items mi ON mi.id = uma.menu_item_id
      WHERE uma.user_id = (select auth.uid())
        AND mi.menu_name = 'entities'
    )
  );
