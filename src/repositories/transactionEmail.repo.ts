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
  /** The function's `sent` flag: false when the mail server refused. Null when absent. */
  sent: boolean | null;
}

/** `accessToken` overrides the current session's token. */
export async function postTransactionEmail(body: unknown, accessToken?: string): Promise<EmailPostResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const response = await fetch(`${supabaseUrl}/functions/v1/send-transaction-email`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken ?? await getAccessToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text().catch(() => '');
  let sent: boolean | null = null;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.sent === 'boolean') sent = parsed.sent;
  } catch {
    // Not JSON: an error page from the gateway.
  }
  return { ok: response.ok, status: response.status, detail: response.ok ? '' : text.slice(0, 200), sent };
}
