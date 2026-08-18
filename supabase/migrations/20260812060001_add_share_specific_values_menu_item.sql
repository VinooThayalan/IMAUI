/*
  # Make Share Specific Values grantable on the Menu Access screen

  1. The bug
     The Menu Access screen had no row for Share Specific Values, so an admin
     had no way to grant anyone access to it. MenuAccess.tsx builds its list
     straight from the table:

       supabase.from('menu_items').select('*').eq('is_active', true).order('sort_order')

     and Sidebar.tsx gates the item on hasMenuAccess('share-specific-values')
     (src/components/Sidebar.tsx:42). With no matching menu_items row the check
     can never pass for a non-admin, and the screen is unreachable — not by
     policy, just by omission.

  2. Why it was missing
     Same root cause as the bank_master tables in SELF_HOSTED_MIGRATION.md §5:
     the screen was built on the hosted database and its menu row was inserted
     through the dashboard rather than a migration, so it never reached any other
     environment. 20260803060003 and 20260807060002 both noted the gap without
     closing it — 20260807060002 says outright: "Seed those menu rows first if
     the intent is for non-admins to maintain them."

  3. Column names
     menu_items is created TWICE across the migration set. 20260112055003 makes
     it with a `name` column, 20260213165258 DROPs it, and 20260401185324
     recreates it with `menu_name`/`label`/`section`/`sort_order`/`is_active`.
     The second definition is the live one — this file must match it.

  4. sort_order
     MenuAccess groups by section and sorts within a group, so the value only
     decides placement inside the Main group. The 1..16 range Main already uses
     is contiguous with no free slot next to Share Analytics, and reusing an
     existing number would make two rows sort non-deterministically. 31 is
     unused, so the item lands at the end of Main rather than beside its sidebar
     neighbour. Cosmetic; renumbering the whole section for it would touch far
     more than this bug warrants.

  5. Writes are NOT granted by this migration
     20260803060003 restricts INSERT/UPDATE/DELETE on share_52week_values to
     is_app_admin(). Granting the menu makes the screen visible and readable;
     a non-admin who saves will still be refused by RLS. Closing that needs the
     has_menu_access() gate from 20260807060002, which is not on this branch —
     see the note in the pull request.
*/

INSERT INTO menu_items (menu_name, label, section, sort_order, is_active)
VALUES ('share-specific-values', 'Share Specific Values', 'Main', 31, true)
ON CONFLICT (menu_name) DO NOTHING;
