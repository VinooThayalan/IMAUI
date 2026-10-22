/** A short label before a date that is not what its column heading says, such as a dividend's XD date under Trade Date. */
export function DateTag({ label }: { label?: string | null }) {
  if (!label) return null;
  return <span className="mr-1 text-xs font-semibold text-purple-600">{label}</span>;
}
