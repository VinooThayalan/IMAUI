/**
 * The Share Analytics list: one line per holding, and the Grand Total under it.
 *
 * What a line holds is `holdingRow` in shareLedger.service, which the summary
 * export projects too, so the screen and the file cannot disagree (bug-50). This
 * only hands it to the page.
 *
 * The date window is still the page's (not yet migrated), so the rows a period's
 * activity columns sum arrive as a function.
 */

import {
  holdingRow,
  holdingTotals,
  type ComputedRow,
  type HoldingRow,
  type HoldingTotals,
  type ShareGroup,
} from '../services/shareLedger.service';

export interface HoldingList {
  listed: { group: ShareGroup; row: HoldingRow }[];
  totals: HoldingTotals;
}

export function useHoldingRows(
  groups: ShareGroup[],
  activityRows: (group: ShareGroup) => ComputedRow[],
): HoldingList {
  const listed = groups.map(g => ({ group: g, row: holdingRow(g, activityRows(g)) }));
  return { listed, totals: holdingTotals(listed.map(l => l.row)) };
}
