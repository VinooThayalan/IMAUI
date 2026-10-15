/**
 * Sending through the email function, for every screen that does.
 *
 * A 401 means the caller's sign-in was refused, typically because the session
 * was ended on another device while this one still held a token. The sign-in is
 * refreshed once and the send retried; if that fails the user is told why.
 */

import * as authRepo from '../repositories/auth.repo';
import * as emailRepo from '../repositories/transactionEmail.repo';

export interface EmailDelivery {
  ok: boolean;
  /** Why it was not sent, in words a user can act on. Null when sent. */
  reason: string | null;
}

export const SESSION_ENDED =
  'Your sign-in has ended, for example after signing out on another device. Sign in again, then send.';

export async function deliverEmail(body: unknown): Promise<EmailDelivery> {
  let res = await emailRepo.postTransactionEmail(body);
  if (res.status === 401) {
    const token = await authRepo.refreshAccessToken();
    if (!token) return { ok: false, reason: SESSION_ENDED };
    res = await emailRepo.postTransactionEmail(body, token);
    if (res.status === 401) return { ok: false, reason: SESSION_ENDED };
  }
  if (!res.ok) {
    return { ok: false, reason: `The email service answered ${res.status}${res.detail ? `: ${res.detail}` : ''}.` };
  }
  if (res.sent === false) {
    return { ok: false, reason: 'The mail server did not accept the email. It is listed as failed under Email Deliveries.' };
  }
  return { ok: true, reason: null };
}
