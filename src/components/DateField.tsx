/**
 * The date input, in one place.
 *
 * There were 59 hand-written `<input type="date">` across 22 screens, each with
 * its own class string, its own idea of whether the label was associated with
 * the field, and its own decision about whether a range's two ends constrain one
 * another. Four things kept going wrong, so they are settled here:
 *
 *  1. **A label that is not attached to anything.** Most call sites wrote a bare
 *     `<label>` next to the input, so clicking it did nothing and a screen reader
 *     announced an unlabelled field. Every field gets an id and a real `htmlFor`.
 *
 *  2. **A value the input silently refuses.** `<input type="date">` accepts only
 *     `YYYY-MM-DD`. Hand it a timestamp — which is what a column read straight
 *     from PostgREST can be — and it renders **blank** with no error, so the date
 *     looks unset when it is not. `toDateInputValue` trims one to shape.
 *
 *  3. **Ranges that can be inverted.** From/To pairs wired `min`/`max` by hand
 *     where anyone remembered. `DateRangeField` always does it, so a range cannot
 *     be put the wrong way round in the picker.
 *
 *  4. **The field being unmounted while it is in use.** The browser's calendar
 *     popup belongs to the input's DOM node: unmount the input and the popup is
 *     destroyed mid-click. Two screens replaced their whole body — filter bar
 *     included — with a spinner on every refetch, which is what made stepping to
 *     the previous month look like a page refresh. A component cannot prevent its
 *     own parent doing that; see the note on `disabled` below.
 */

import { useId } from 'react';
import { toDateInputValue } from '../lib/dateInput';

const INPUT_CLASS =
  'px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400';

export interface DateFieldProps {
  value: string | null | undefined;
  onChange: (value: string) => void;
  label?: string;
  /** Marks the label and sets the input required. */
  required?: boolean;
  min?: string | null;
  max?: string | null;
  /** Shows a Clear button when a value is set. */
  clearable?: boolean;
  /**
   * Prefer this over unmounting the field while its data reloads. A disabled
   * input keeps its DOM node, so an open calendar survives; an unmounted one
   * does not exist to keep anything.
   */
  disabled?: boolean;
  /** `inline` puts the label beside the field, `stacked` above it. */
  layout?: 'inline' | 'stacked';
  /**
   * `field` is a form label; `filter` is the small uppercase style the filter
   * bars use. Two named styles rather than a free-form class, so the screens
   * cannot drift apart again one call site at a time.
   */
  labelStyle?: 'field' | 'filter';
  /** Stretches the input to its container — what a form field in a grid needs. */
  fullWidth?: boolean;
  /** Replaces the default input classes outright. */
  className?: string;
  id?: string;
}

const LABEL_CLASS = {
  field: 'text-sm font-semibold text-gray-700',
  filter: 'text-xs font-semibold uppercase tracking-wide text-gray-500',
} as const;

export function DateField({
  value, onChange, label, required, min, max, clearable,
  disabled, layout = 'inline', labelStyle = 'field', fullWidth, className, id,
}: DateFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const current = toDateInputValue(value);

  const input = (
    <input
      id={inputId}
      type="date"
      value={current}
      onChange={e => onChange(e.target.value)}
      min={toDateInputValue(min) || undefined}
      max={toDateInputValue(max) || undefined}
      required={required}
      disabled={disabled}
      className={className ?? `${fullWidth ? 'w-full ' : ''}${INPUT_CLASS}`}
    />
  );

  if (!label) {
    return clearable ? (
      <span className="inline-flex items-center gap-2">
        {input}
        <ClearButton show={!!current} disabled={disabled} onClear={() => onChange('')} />
      </span>
    ) : input;
  }

  if (layout === 'stacked') {
    return (
      <div>
        <label htmlFor={inputId} className={`mb-1.5 block ${LABEL_CLASS[labelStyle]}`}>
          {label}{required && <span className="text-red-500"> *</span>}
        </label>
        <div className={`flex items-center gap-2 ${fullWidth ? 'w-full' : ''}`}>
          {input}
          <ClearButton show={!!clearable && !!current} disabled={disabled} onClear={() => onChange('')} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={inputId} className={`whitespace-nowrap ${LABEL_CLASS[labelStyle]}`}>
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {input}
      <ClearButton show={!!clearable && !!current} disabled={disabled} onClear={() => onChange('')} />
    </div>
  );
}

function ClearButton(
  { show, disabled, onClear }: { show: boolean; disabled?: boolean; onClear: () => void },
) {
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={onClear}
      disabled={disabled}
      className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
    >
      Clear
    </button>
  );
}

export interface DateRangeFieldProps {
  from: string | null | undefined;
  to: string | null | undefined;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  fromLabel?: string;
  toLabel?: string;
  /** Neither end may fall outside these, on top of constraining each other. */
  min?: string | null;
  max?: string | null;
  /** One Clear button for the pair, rather than one each. */
  clearable?: boolean;
  disabled?: boolean;
  layout?: 'inline' | 'stacked';
  labelStyle?: 'field' | 'filter';
}

/**
 * A From/To pair whose ends constrain each other.
 *
 * `from` can never exceed `to` and `to` can never precede `from`, enforced in
 * the picker itself rather than by validating after the fact — the browser will
 * not offer an invalid day, so there is no error state to design.
 */
export function DateRangeField({
  from, to, onFromChange, onToChange,
  fromLabel = 'From', toLabel = 'To',
  min, max, clearable, disabled, layout = 'inline', labelStyle = 'field',
}: DateRangeFieldProps) {
  const fromValue = toDateInputValue(from);
  const toValue = toDateInputValue(to);

  return (
    <div className={layout === 'stacked' ? 'space-y-3' : 'flex flex-wrap items-center gap-3'}>
      <DateField
        label={fromLabel}
        value={fromValue}
        onChange={onFromChange}
        min={min}
        max={toValue || max}
        disabled={disabled}
        layout={layout}
        labelStyle={labelStyle}
      />
      <DateField
        label={toLabel}
        value={toValue}
        onChange={onToChange}
        min={fromValue || min}
        max={max}
        disabled={disabled}
        layout={layout}
        labelStyle={labelStyle}
      />
      {clearable && (fromValue || toValue) && (
        <button
          type="button"
          onClick={() => { onFromChange(''); onToChange(''); }}
          disabled={disabled}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          Clear dates
        </button>
      )}
    </div>
  );
}
