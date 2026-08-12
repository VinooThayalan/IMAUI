import { Component, ReactNode } from 'react';
import { isChunkLoadError } from '../lib/chunkErrors';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('Caught by ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      /*
        A stale chunk needs a different offer from an ordinary crash.

        "Try again" only clears state and re-renders, which re-runs the same
        dynamic import. For a missing chunk that can never succeed: the file is
        gone, and the browser caches the rejected module promise against the
        specifier, so the retry does not even reach the network. Users were left
        pressing a button that could not work.

        lazyWithRetry already reloads once automatically, so reaching this branch
        means that reload was spent and the chunk is still unavailable — a broken
        or partial deploy rather than a stale tab. Hence the wording, and a manual
        reload instead of an automatic one: another silent reload here would be the
        loop the one-reload rule exists to prevent.
      */
      const staleBuild = isChunkLoadError(this.state.error);

      return (
        <div className="flex items-center justify-center h-full p-8">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-2xl font-bold">!</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {staleBuild ? 'This page needs reloading' : 'Something went wrong'}
            </h2>
            <p className="text-gray-500 text-sm mb-4">
              {staleBuild
                ? 'The application was updated while this tab was open, so part of it could no longer be loaded. Reloading will pick up the new version.'
                : this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            {staleBuild ? (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
              >
                Reload
              </button>
            ) : (
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
