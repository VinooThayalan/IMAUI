/**
 * Readable text for anything thrown or returned as an error.
 *
 * Supabase rejects with a plain object carrying `message` (and often `code`,
 * `details`, `hint`) rather than an Error, so `error.message` alone misses it
 * and `String(error)` gives "[object Object]". Showing the real text matters:
 * a row-level security denial and a missing column are different problems, and
 * a fixed "Please try again" message hides both.
 */
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
