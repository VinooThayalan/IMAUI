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

/** `2026-01-10` → `10/01/2026`; anything that is not a date → `''`. */
export function formatDisplayDate(iso: string | null | undefined): string {
  const v = toDateInputValue(iso);
  return v ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : '';
}

/** A timestamp as `12 Oct 2026, 14:59`, local time; anything that is not one → `''`. */
export function formatDisplayDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * A typed dd/mm/yyyy date (separator `/ - .` or space, or `ddmmyyyy`, or ISO) as
 * `YYYY-MM-DD`. `''` for blank, `null` for anything that is not a real date.
 */
export function parseDisplayDate(text: string): string | null {
  const t = text.trim();
  if (t === '') return '';

  let d: number, m: number, y: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  const parts = /^(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{4})$/.exec(t);
  const run = /^(\d{2})(\d{2})(\d{4})$/.exec(t);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (parts) [d, m, y] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  else if (run) [d, m, y] = [Number(run[1]), Number(run[2]), Number(run[3])];
  else return null;

  if (y < 1900 || y > 2999 || m < 1 || m > 12 || d < 1) return null;
  if (d > new Date(Date.UTC(y, m, 0)).getUTCDate()) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
