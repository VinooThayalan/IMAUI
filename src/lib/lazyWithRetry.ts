import { lazy } from 'react';
import type { ComponentType } from 'react';
import { clearChunkReloadFlag, isChunkLoadError, reloadOnceForChunkError } from './chunkErrors';

/**
 * Drop-in replacement for React.lazy that survives a deploy.
 *
 * Every lazy page in App.tsx goes through this, so the recovery is systemic
 * rather than something each page has to remember. See ./chunkErrors.ts for why a
 * full reload is the only thing that can fix a stale chunk.
 *
 * Order of attempts:
 *
 *  1. Import normally. On success, clear the reload flag so a future deploy gets
 *     its own recovery.
 *  2. If it failed for any reason other than a missing chunk, rethrow untouched —
 *     a page that crashes on import should reach the error boundary with its real
 *     error, not be masked by a reload.
 *  3. One immediate re-attempt. This is for the genuinely transient case (a
 *     dropped connection mid-request) and costs nothing when the file is really
 *     gone, because the cached rejection returns instantly.
 *  4. Reload once. The fresh document brings the new chunk names.
 *  5. If a reload has already been spent this session, rethrow so the boundary
 *     shows something rather than looping.
 *
 * The generic is constrained to ComponentType<unknown> rather than
 * ComponentType<object>: these pages are declared `() => JSX.Element`, and under
 * `object` TypeScript rejects the module shape at every one of the 37 call sites.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy<T>(async () => {
    try {
      const mod = await factory();
      clearChunkReloadFlag();
      return mod;
    } catch (error) {
      if (!isChunkLoadError(error)) throw error;

      try {
        const mod = await factory();
        clearChunkReloadFlag();
        return mod;
      } catch (retryError) {
        if (reloadOnceForChunkError(retryError)) {
          // The document is being replaced. A promise that never settles keeps the
          // component in Suspense meanwhile, so the fallback stays on screen
          // instead of the boundary flashing an error the user cannot act on
          // during the moment before the reload lands.
          return new Promise<{ default: T }>(() => {});
        }
        throw retryError;
      }
    }
  });
}
