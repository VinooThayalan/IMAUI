/**
 * The one loading indicator.
 *
 * Every screen drew its own: a blue arc in a box of whatever height the author
 * picked, an SVG ring on Entities, a lucide icon on Test Email, and plain
 * "Loading..." text on seven more. This is the Share Analytics one, used
 * everywhere.
 *
 *   <LoadingState />                    a section waiting for its data
 *   <LoadingState compact />            inside an expanded row or a table cell
 *   <LoadingState screen />             the whole viewport, before the app has a layout
 *   <LoadingState label="Loading…" />   with a caption, when the wait needs naming
 *   <Spinner />                         inline, in a button next to its label
 *
 * Presentational only: it renders what it is told and fetches nothing.
 */

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-10 w-10',
};

interface SpinnerProps {
  size?: SpinnerSize;
  /**
   * Arc colour. Defaults to the text colour around it, so a spinner in a white
   * button on blue is white and one in a grey icon button is grey.
   */
  className?: string;
}

/** The arc alone. Decorative: the surrounding button or block says what is happening. */
export function Spinner({ size = 'sm', className = 'border-current' }: SpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 animate-spin rounded-full border-b-2 ${SIZE[size]} ${className}`}
    />
  );
}

interface LoadingStateProps {
  /** Shown under the spinner. Omitted, only screen readers hear "Loading". */
  label?: string;
  /** Smaller spinner, less height: for a row being expanded or a table cell. */
  compact?: boolean;
  /** Fill the viewport: for the app shell before any page has rendered. */
  screen?: boolean;
}

export function LoadingState({ label, compact = false, screen = false }: LoadingStateProps) {
  const box = screen
    ? 'h-screen bg-gray-50'
    : compact
      ? 'py-6'
      : 'h-48';
  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center justify-center gap-3 ${box}`}>
      <Spinner size={compact ? 'md' : 'lg'} className="border-blue-600" />
      {label
        ? <p className="text-sm text-gray-500">{label}</p>
        : <span className="sr-only">Loading</span>}
    </div>
  );
}
