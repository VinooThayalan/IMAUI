/**
 * The signed-in account and what it may reach (`app_users`,
 * `user_menu_access`, `user_entity_access`).
 *
 * Data access only. Every read here answers a question the whole app's
 * permission model rests on, so each one either returns what the database said
 * or throws — none of them invents a fallback. Deciding what an absent row means
 * is `permissions.service`'s job, and deciding what to show the user is the
 * context's.
 */

import { supabase } from '../lib/supabase';
import { selectAll } from '../lib/selectAll';

export interface AppUserRow {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
  is_active: boolean;
}

/**
 * Reject a read that has not answered in time.
 *
 * A hung fetch is indistinguishable from a slow one, and a tab coming back from
 * sleep produces plenty of both. Turning it into a rejection is what lets the
 * caller say "we could not find out" instead of waiting forever — or, as this
 * code used to, guessing.
 */
function withTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/**
 * The account row, or null when the database says there is none.
 *
 * Null is a real answer — an auth account with no `app_users` row is a person
 * who was never provisioned. It is not the same as the read failing, which
 * throws.
 */
export async function findById(userId: string): Promise<AppUserRow | null> {
  const { data, error } = await withTimeout(
    supabase.from('app_users').select('id, email, full_name, role, is_active').eq('id', userId).maybeSingle(),
    5000,
    'load account',
  );
  if (error) throw error;
  return (data as AppUserRow | null) ?? null;
}

/** Menu names this user has been granted, via the join to `menu_items`. */
export async function listMenuAccess(userId: string): Promise<string[]> {
  const rows = await withTimeout(
    selectAll(() =>
      supabase
        .from('user_menu_access')
        .select('menu_item_id, menu_items(menu_name)')
        .eq('user_id', userId)
        .order('menu_item_id', { ascending: true })
        .order('id', { ascending: true }),
    ),
    5000,
    'load menu access',
  );
  return (rows as unknown as Array<{ menu_items?: { menu_name?: string } | null }>)
    .map(r => r.menu_items?.menu_name)
    .filter((n): n is string => Boolean(n));
}

/** Entity ids this user has been granted. */
export async function listEntityAccess(userId: string): Promise<string[]> {
  const rows = await withTimeout(
    selectAll(() =>
      supabase
        .from('user_entity_access')
        .select('entity_id')
        .eq('user_id', userId)
        .order('entity_id', { ascending: true })
        .order('id', { ascending: true }),
    ),
    5000,
    'load entity access',
  );
  return (rows as unknown as Array<{ entity_id: string }>).map(r => r.entity_id);
}
