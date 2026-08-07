/*
  # Let menu access, not just the admin role, grant reference-data writes

  Creating a broker failed with:
    new row violates row-level security policy for table "brokers" (42501)

  20260803060003 locked writes on the reference tables to is_app_admin(). The
  application does not gate those screens that way: for a non-admin,
  hasMenuAccess() in src/contexts/AuthContext.tsx checks user_menu_access, so
  a user granted the Brokers menu is shown the page, the Add Broker form and
  the Create button -- and is then refused by the database. The team has one
  admin, so in practice nobody else could maintain master data at all.

  This aligns the database with the application: a write is allowed for an
  admin, or for an active user holding the menu that owns the screen. Menu
  access is already an admin decision, made on the Menu Access screen and
  stored in user_menu_access, so this delegates rather than loosens -- a user
  with no menus gains nothing.

  ## Tables changed, and the menu that now gates each

  | table                | menu                |
  |----------------------|---------------------|
  | shares               | shares              |
  | brokers              | brokers             |
  | entity_types         | entity-types        |
  | brokerage_fee_types  | brokerage-fee-types |
  | industry_types       | industry-types      |
  | sector_types         | sector-types        |
  | daily_share_prices   | daily-prices        |

  ## Deliberately left admin-only

  - Permission and configuration surface, where menu access would be
    circular or self-granting: app_users, user_menu_access,
    user_entity_access, menu_items, audit_settings, cash_balance_config,
    entity_approvers.
  - bank_master, bank_branches and share_52week_values, whose screens
    (bank-master, share-specific-values) have no menu_items row at all, so no
    non-admin can reach them. Gating on a menu that cannot be granted would
    only look like access. Seed those menu rows first if the intent is for
    non-admins to maintain them.
  - currencies, fee_tiers, fee_rates and fee_components, which no screen
    writes.

  Reads are untouched; they were already open to authenticated users.
*/

-- Mirrors has_entity_access: SECURITY DEFINER so the check sees user_menu_access
-- regardless of the caller's own policies, and requires an active account, the
-- same condition 20260803050817 applies to is_app_admin and has_entity_access.
CREATE OR REPLACE FUNCTION public.has_menu_access(p_menu_name text)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
AS $$
  SELECT
    public.is_app_admin()
    OR EXISTS (
      SELECT 1
      FROM public.user_menu_access uma
      JOIN public.menu_items mi ON mi.id = uma.menu_item_id
      JOIN public.app_users u   ON u.id = uma.user_id
      WHERE uma.user_id = (select auth.uid())
        AND u.is_active = true
        AND mi.menu_name = p_menu_name
    );
$$;

REVOKE ALL ON FUNCTION public.has_menu_access(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_menu_access(text) TO authenticated;

DO $$
DECLARE
  m record;
  p record;
BEGIN
  FOR m IN
    SELECT * FROM (VALUES
      ('shares',              'shares'),
      ('brokers',             'brokers'),
      ('entity_types',        'entity-types'),
      ('brokerage_fee_types', 'brokerage-fee-types'),
      ('industry_types',      'industry-types'),
      ('sector_types',        'sector-types'),
      ('daily_share_prices',  'daily-prices')
    ) AS t(tbl, menu)
  LOOP
    -- Skip anything this database does not have, so the file stays replayable.
    CONTINUE WHEN to_regclass('public.' || m.tbl) IS NULL;

    FOR p IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = m.tbl
        AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, m.tbl);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_menu_access(%L))',
      m.tbl || '_insert_with_menu_access', m.tbl, m.menu);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.has_menu_access(%L)) WITH CHECK (public.has_menu_access(%L))',
      m.tbl || '_update_with_menu_access', m.tbl, m.menu, m.menu);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_menu_access(%L))',
      m.tbl || '_delete_with_menu_access', m.tbl, m.menu);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
