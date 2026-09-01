/**
 * Composing the fingerprint that every analytics cache is keyed by.
 *
 * Pure, so the rule can be asserted without a database — the reason it is here
 * and not in the repository that fetches the stamps.
 *
 * A fingerprint answers one question: has anything a computed report depends on
 * changed since that report was cached? It is only as good as the signals fed
 * into it, and two of them were missing (see `bug-34`, issue #96):
 *
 *  - **Edits.** `updated_at` was not maintained by a trigger on four of the eight
 *    source tables, so editing a scrip entry, transaction or dividend moved
 *    nothing. Fixed in the database, by
 *    `20260901060001_bump_updated_at_on_analytics_source_tables.sql`, because a
 *    payload fix would only cover the one screen that sent it.
 *  - **Deletes.** Removing any row that is not the newest leaves
 *    `max(updated_at)` exactly where it was, so the cache stayed warm on data
 *    that no longer existed. The row count covers this: a delete always changes
 *    it, whichever row went.
 */

/** One source table's contribution to the fingerprint. */
export interface TableStamp {
  table: string;
  /** Latest `updated_at`, or `'0'` when the table holds no rows. */
  updatedAt: string;
  /** Total rows, so a delete registers even when the newest row survives. */
  rows: number;
}

/**
 * The fingerprint for a set of stamps.
 *
 * Sorted by table name rather than trusting call order. The previous hash was
 * positional, so reordering the source list silently invalidated every cached
 * batch at once — a footgun the comment had to warn about instead of the code
 * preventing it. Each part names its table, so two tables swapping stamps cannot
 * produce the same hash either.
 *
 * The `btoa` output is stripped of `/`, `+` and `=` because the value is used as
 * a lookup key; the mapping stays injective for our inputs since the alphabet
 * before stripping is fixed-width base64 over a delimited string.
 */
export function fingerprintOf(stamps: TableStamp[]): string {
  const parts = [...stamps]
    .sort((a, b) => (a.table < b.table ? -1 : a.table > b.table ? 1 : 0))
    .map(s => `${s.table}:${s.updatedAt}:${s.rows}`);

  return btoa(parts.join('|')).replace(/[/+=]/g, '');
}
