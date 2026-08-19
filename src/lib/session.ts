/**
 * When a refused request means the session is over.
 *
 * Pure, so the decision can be exercised without a browser or a login. The
 * fetching of the session stays in the auth context; only the judgement lives
 * here.
 */

import { isAuthExpired, isPermissionDenied } from './errorMessage';

/** The part of a Supabase session this decision needs. */
export interface SessionLike {
  /** Seconds since the epoch, as Supabase reports it. */
  expires_at?: number | null;
}

/**
 * Is there still a session worth trusting?
 *
 * A missing session is the clear case: `getSession` refreshes when it can, so
 * null means the refresh token is dead too.
 *
 * A session with no `expires_at` is treated as usable rather than suspect. It is
 * not evidence of expiry, and the cost of guessing wrong here is signing out
 * somebody who was working.
 */
export function isSessionUsable(session: SessionLike | null | undefined, now: number): boolean {
  if (!session) return false;
  if (session.expires_at == null) return true;
  return session.expires_at * 1000 > now;
}

/**
 * Should this failure end the session?
 *
 * Only auth-shaped failures are candidates, and even then the session decides.
 *
 * The check matters because **42501 is also exactly what a genuine permission
 * denial looks like**. Signing a user out because they lack a permission would be
 * a worse defect than the one being fixed: it would read as the app logging
 * people out at random, and it would do so most often to the people with the
 * fewest permissions. So a live session means the denial was real — the user stays
 * signed in and is told what they cannot do.
 */
export function shouldEndSession(
  error: unknown,
  session: SessionLike | null | undefined,
  now: number,
): boolean {
  if (!isAuthExpired(error) && !isPermissionDenied(error)) return false;
  return !isSessionUsable(session, now);
}
