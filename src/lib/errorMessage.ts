/**
 * Readable text for anything thrown or returned as an error.
 *
 * Supabase rejects with a plain object carrying `message` (and often `code`,
 * `details`, `hint`) rather than an Error, so `error.message` alone misses it
 * and `String(error)` gives "[object Object]". Showing the real text matters:
 * a row-level security denial and a missing column are different problems, and
 * a fixed "Please try again" message hides both.
 */
function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return '';
}

/** Postgres refused the write: `insufficient_privilege`, i.e. an RLS denial. */
export function isPermissionDenied(error: unknown): boolean {
  return errorCode(error) === '42501';
}

/** PostgREST rejected the token rather than the row. */
export function isAuthExpired(error: unknown): boolean {
  const code = errorCode(error);
  return code === 'PGRST301' || code === '401';
}

/**
 * What to tell someone whose write was refused.
 *
 * "new row violates row-level security policy for table \"entities\" (42501)" is
 * accurate and unusable. It names a mechanism, not a thing the reader can do.
 *
 * The advice about signing in matters more than it looks. Access is decided the
 * same way in both places — an admin, or a `user_menu_access` row for the screen —
 * and the route already refuses anyone without it, so somebody who reached the
 * form has the permission the policy asks for. When the write is refused anyway,
 * the usual reason is that Postgres saw a different identity than the page
 * believes: `auth.uid()` is null once a token has expired, while React still
 * holds the permissions it loaded when the token was good. The screen looks
 * signed in right up until it writes.
 *
 * The technical text is kept, because a genuine policy gap and an expired session
 * look identical to the reader and only one of them is worth reporting.
 */
export function writeErrorMessage(error: unknown, action: string): string {
  const detail = errorMessage(error);

  if (isAuthExpired(error)) {
    return `Your session has expired. Sign in again, then retry.\n\n${detail}`;
  }

  if (isPermissionDenied(error)) {
    return (
      `You do not have permission to ${action}.\n\n` +
      'If you had it a moment ago, your session has probably expired — sign out ' +
      'and back in, then retry. If that does not help, ask an administrator to ' +
      `grant access.\n\n${detail}`
    );
  }

  return `Failed to ${action}: ${detail}`;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const e = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [e.message, e.details, e.hint].filter(
      (p): p is string => typeof p === 'string' && p.length > 0
    );
    if (parts.length) {
      const code = typeof e.code === 'string' && e.code ? ` (${e.code})` : '';
      return parts.join(' — ') + code;
    }
  }
  return String(error);
}
