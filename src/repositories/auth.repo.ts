/** Supabase auth calls. */

import { supabase } from '../lib/supabase';

/** A new access token from the refresh token; null when the session has ended. */
export async function refreshAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.refreshSession();
  return error ? null : data.session?.access_token ?? null;
}
