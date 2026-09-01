/**
 * Coerce anything date-shaped to what `<input type="date">` will accept.
 *
 * The input accepts only `YYYY-MM-DD`. Hand it a timestamp — which is what a
 * column read straight from PostgREST can be — and it renders **blank** with no
 * error, so a date that is set looks unset.
 *
 * Returns `''` for anything that is not a date, because an empty input honestly
 * shows "no date" whereas a rejected value shows the same thing while the caller
 * believes one is set.
 *
 * Lives in `lib` rather than beside the component so that file exports only
 * components, which is what keeps fast refresh working.
 */
export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const head = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : '';
}
