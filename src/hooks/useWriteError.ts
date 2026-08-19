/**
 * One way to report a write that was refused.
 *
 * Two things have to happen and they have to happen in this order: find out
 * whether the session is still alive, and only then decide what to say. Doing it
 * the other way round is how a dead session came to be reported as a permission
 * problem — the message named a mechanism the reader could do nothing about, and
 * left them holding a page that looked signed in.
 *
 * A hook rather than a helper in `lib` because ending the session needs the auth
 * context, and `lib` may not depend on React.
 */

import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { writeErrorMessage } from '../lib/errorMessage';

export function useWriteError() {
  const { signOutIfSessionLost } = useAuth();

  /**
   * `action` completes "You do not have permission to …" and "Failed to …", so
   * phrase it as the verb: `'create an entity'`, `'save this broker'`.
   *
   * When the session has gone the user is signed out and told once, here, rather
   * than by each caller. The login screen is the next thing they see, which is
   * the honest end state: they are not signed in, and were not for a while.
   */
  return useCallback(
    async (error: unknown, action: string): Promise<void> => {
      if (await signOutIfSessionLost(error)) {
        alert(
          'Your session has expired, so you have been signed out.\n\n' +
            `Sign in again and retry — nothing was saved, so you will need to ${action} again.`,
        );
        return;
      }
      alert(writeErrorMessage(error, action));
    },
    [signOutIfSessionLost],
  );
}
