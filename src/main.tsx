import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { reloadOnceForChunkError } from './lib/chunkErrors';

/*
  Vite's own hook for a failed chunk fetch.

  lazyWithRetry covers the pages rendered through React.lazy, but Vite also
  preloads chunks ahead of use, and a preload that fails surfaces here rather than
  as a rejection any component sees. Without this listener Vite's default
  behaviour is to reload the page unconditionally — which is the reload loop the
  one-reload rule exists to prevent, so calling preventDefault and going through
  the same bounded path keeps both routes consistent.

  The listener is registered before render so a preload failing during startup is
  still covered.
*/
window.addEventListener('vite:preloadError', event => {
  event.preventDefault();
  if (!reloadOnceForChunkError((event as unknown as { payload?: unknown }).payload)) {
    // A reload was already spent this session: let it through to the console and
    // the error boundary rather than looping.
    console.error('Chunk preload failed and the one reload was already used.', event);
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
