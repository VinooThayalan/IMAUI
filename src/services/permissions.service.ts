/**
 * Who the signed-in person is, and what they may reach.
 *
 * This is the whole of the "None is not zero" rule applied to authorisation.
 * The load used to answer a failure the same way it answered a real account:
 *
 * ```ts
 * catch (error) {
 *   setAppUser({ id: userId, email, full_name: null, role: 'user', is_active: false });
 * }
 * ```
 *
 * A timed-out read therefore *invented* an identity — an admin became a user
 * with no name and no menu access, and stayed that way until the page was
 * reloaded, because nothing retried and the fabricated object was truthy enough
 * for the app to render a shell around. That is what an administrator saw as
 * "Access Denied" on every page with their own email still in the menu.
 *
 * So this returns a verdict that can say "I do not know", and the three cases
 * that are not "ok" are kept apart, because they call for different things:
 * a person who was never provisioned needs an administrator, a deactivated
 * account needs signing out, and an unreachable database needs a retry button.
 *
 * No React, no Supabase.
 */

import * as appUsersRepo from '../repositories/appUsers.repo';

export interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
  is_active: boolean;
}

/** Everything the app needs to decide what this person may see. */
export interface Identity {
  appUser: AppUser;
  /** Menu names. Empty and meaningful only for a non-admin. */
  menuAccess: string[];
  entityAccess: string[];
}

export type IdentityResult =
  /** The account was read and is usable. */
  | { status: 'ok'; identity: Identity }
  /** Read fine, and the account is switched off. */
  | { status: 'deactivated' }
  /** Read fine, and there is no `app_users` row for this auth account. */
  | { status: 'not-provisioned' }
  /**
   * Nothing could be read. **Not** a statement about what the person may do —
   * the caller must not turn this into a denial.
   */
  | { status: 'unavailable'; reason: string };

function describe(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; code?: unknown };
    const parts = [
      typeof e.message === 'string' ? e.message : null,
      typeof e.code === 'string' && e.code ? `code ${e.code}` : null,
    ].filter(Boolean);
    if (parts.length) return parts.join(' · ');
  }
  return String(err);
}

/**
 * Read the account and its grants.
 *
 * An admin is granted everything by rule rather than by row, so the two access
 * tables are not read for one — the same shortcut `hasMenuAccess` takes. An
 * empty list on an admin therefore means "not applicable", never "nothing
 * allowed", and only ever reaches a caller that already knows the role.
 *
 * The grants are loaded *before* the result is returned, not fired off beside
 * it. Returning an account while its permissions were still arriving is the
 * other half of the same defect: for a moment the app knew who someone was and
 * believed they could reach nothing.
 */
export async function loadIdentity(userId: string): Promise<IdentityResult> {
  let row: appUsersRepo.AppUserRow | null;
  try {
    row = await appUsersRepo.findById(userId);
  } catch (err) {
    return { status: 'unavailable', reason: describe(err) };
  }

  if (!row) return { status: 'not-provisioned' };
  if (row.is_active === false) return { status: 'deactivated' };

  const appUser: AppUser = {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    is_active: row.is_active,
  };

  if (appUser.role === 'admin') {
    return { status: 'ok', identity: { appUser, menuAccess: [], entityAccess: [] } };
  }

  try {
    const [menuAccess, entityAccess] = await Promise.all([
      appUsersRepo.listMenuAccess(userId),
      appUsersRepo.listEntityAccess(userId),
    ]);
    return { status: 'ok', identity: { appUser, menuAccess, entityAccess } };
  } catch (err) {
    // The account read succeeded, but a non-admin with no grants loaded is
    // indistinguishable from one with no grants at all. Reporting the account
    // anyway is how "Access Denied" gets shown to someone who has access.
    return { status: 'unavailable', reason: describe(err) };
  }
}

/**
 * Does this identity reach this menu?
 *
 * The one rule, so the sidebar, the router and any future guard cannot answer
 * differently. `settings` is reachable by everyone: it is where a person changes
 * their own password, and locking them out of it locks them out of their own
 * account.
 */
export function canReachMenu(identity: Identity, menuName: string): boolean {
  if (identity.appUser.role === 'admin') return true;
  if (menuName === 'settings') return true;
  return identity.menuAccess.includes(menuName);
}

export function canReachEntity(identity: Identity, entityId: string): boolean {
  if (identity.appUser.role === 'admin') return true;
  return identity.entityAccess.includes(entityId);
}
