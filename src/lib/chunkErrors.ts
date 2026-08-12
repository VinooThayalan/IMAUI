/**
 * Recovery for the stale-deploy chunk failure.
 *
 * ## What goes wrong
 *
 * Vite code-splits every lazy page into its own file with a content hash in the
 * name — `assets/MenuAccess-C5SQXds3.js`. A new build produces new hashes, and
 * deploying replaces the `assets/` directory. Any browser that loaded the *old*
 * `index.html` still holds the old chunk names, so the first time the user opens
 * a page they had not visited yet, it requests a file that no longer exists:
 *
 *     Failed to fetch dynamically imported module:
 *     http://.../assets/MenuAccess-C5SQXds3.js
 *
 * It looks intermittent because it only affects sessions that were already open
 * when a deploy happened, and only for pages not yet loaded into memory.
 *
 * ## Why retrying the import cannot fix it
 *
 * Two reasons, and both matter:
 *
 *  1. The file is genuinely gone. No number of retries will find it.
 *  2. The browser caches the *rejected* module promise against the specifier, so
 *     calling the same `import()` again returns the same rejection without even
 *     making a request.
 *
 * That is why the error boundary's "Try again" — which only resets React state
 * and re-renders, re-running the identical import — could never clear this. Only
 * a fresh document can, because that fetches a fresh `index.html` carrying the
 * new chunk names.
 *
 * ## The one-reload rule
 *
 * `reloadOnceForChunkError` reloads at most once per session. If the page comes
 * back and the import still fails, the flag is already set and the error is
 * allowed through to the boundary. Without that guard a genuinely missing chunk —
 * a broken deploy, an asset the server never received — would put the app in an
 * endless reload loop, which is far worse than an error screen.
 *
 * The flag is cleared on the next successful chunk load, so a later deploy gets
 * its own recovery.
 */

const RELOAD_FLAG = 'imaui:chunk-reload-attempted';

/**
 * sessionStorage throws rather than no-ops when storage is denied (Safari private
 * mode, embedded webviews, blocked third-party storage). A failure to read the
 * flag must not become a second error on top of the one being handled, so every
 * access is guarded. With storage unavailable the reload simply never fires and
 * the user sees the error screen — degraded, not broken.
 */
function readFlag(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_FLAG) === '1';
  } catch {
    return true; // treat as "already tried": never risk a reload we cannot bound
  }
}

function writeFlag(): void {
  try {
    sessionStorage.setItem(RELOAD_FLAG, '1');
  } catch {
    /* storage denied — reloadOnceForChunkError will not be called again anyway */
  }
}

export function clearChunkReloadFlag(): void {
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* nothing to clear if storage is denied */
  }
}

/**
 * Is this the stale-chunk failure rather than an error thrown by the page itself?
 *
 * The message differs per engine, so all the known wordings are matched:
 *   Chrome/Edge  "Failed to fetch dynamically imported module: <url>"
 *   Firefox      "error loading dynamically imported module"
 *   Safari       "Importing a module script failed."
 *   bundler      ChunkLoadError / "Loading chunk N failed"
 *
 * Deliberately narrow. Treating an unrelated crash as a chunk error would reload
 * the page under the user and lose whatever they had typed, so anything not
 * recognised here is left to the error boundary.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;

  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  const haystack = `${name} ${message}`.toLowerCase();

  return (
    haystack.includes('failed to fetch dynamically imported module') ||
    haystack.includes('error loading dynamically imported module') ||
    haystack.includes('importing a module script failed') ||
    haystack.includes('chunkloaderror') ||
    /loading chunk \S+ failed/.test(haystack)
  );
}

/**
 * Reloads once for a stale chunk. Returns true if a reload was started, in which
 * case the caller should stop — the document is being replaced.
 */
export function reloadOnceForChunkError(error: unknown): boolean {
  if (!isChunkLoadError(error)) return false;
  if (readFlag()) return false;

  writeFlag();
  // Not reload(true): that argument is non-standard and ignored by modern
  // browsers. A plain reload re-requests index.html, which is what carries the
  // new chunk names; the HTML must not be served with a long cache lifetime for
  // this to help.
  window.location.reload();
  return true;
}
