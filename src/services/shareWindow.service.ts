/** Share Analytics' From/To window over holdings. `''` leaves that end open. */

import type { ComputedRow, ShareGroup } from './shareLedger.service';

export interface DateWindow {
  from: string;
  to: string;
}

/** Rows on or after From: what a period's activity columns sum. */
export function activityRows(group: ShareGroup, from: string): ComputedRow[] {
  return from ? group.rows.filter(r => r.trade_date != null && r.trade_date >= from) : group.rows;
}

/**
 * History is cut at To, so each holding ends on its position as at that date
 * (undated rows are kept). With a From date, only holdings with activity inside
 * the window are listed.
 */
export function windowGroups(groups: ShareGroup[], { from, to }: DateWindow): ShareGroup[] {
  return groups
    .map(g => (to ? { ...g, rows: g.rows.filter(r => !r.trade_date || r.trade_date <= to) } : g))
    .filter(g => g.rows.length > 0 && (!from || activityRows(g, from).length > 0));
}
