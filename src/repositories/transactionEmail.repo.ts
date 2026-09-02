/**
 * The `send-transaction-email` Edge Function.
 *
 * Data access, in the sense that matters here: it is the one place that knows
 * the function URL, attaches the access token, and reports what came back. It
 * decides nothing — no recipient rules, no payload shaping, no retry.
 *
 * `fetch` only rejects on a network error, so a 4xx/5xx from the function — a
 * missing BREVO_API_KEY, an address Brevo refuses — resolves successfully. Three
 * callers each rediscovered that; the status is returned here so none of them
 * can forget to look.
 */

import { getAccessToken } from '../lib/supabase';

export interface EmailPostResult {
  ok: boolean;
  status: number;
  /** The function's response body, truncated. Empty when it sent nothing. */
  detail: string;
}

export async function postTransactionEmail(body: unknown): Promise<EmailPostResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const response = await fetch(`${supabaseUrl}/functions/v1/send-transaction-email`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${await getAccessToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const detail = response.ok ? '' : await response.text().catch(() => '');
  return { ok: response.ok, status: response.status, detail: detail.slice(0, 200) };
}
