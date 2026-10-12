/**
 * One holding's breakdown: the header figures, the two closing rows, and the
 * per-row readings the table needs.
 *
 * Every figure is the service's -- the CSV export projects the same functions,
 * so the screen and the file cannot disagree. This only hands them to the page.
 */

import {
  avPriceOrNull,
  closingRows,
  holdingSummary,
  saleCosts,
  type ClosingRow,
  type ComputedRow,
  type HoldingSummary,
  type ShareGroup,
} from '../services/shareLedger.service';

export interface HoldingBreakdown {
  summary: HoldingSummary | null;
  closing: ClosingRow[];
  /** Sale Cost of a sell row; null for every other row. */
  saleCost: (row: ComputedRow) => number | null;
  /** Average price of a row, null once nothing is held. */
  avPrice: (row: ComputedRow) => number | null;
}

export function useHoldingBreakdown(group: ShareGroup, asOf: Date): HoldingBreakdown {
  const costs = saleCosts(group);
  return {
    summary: holdingSummary(group, asOf),
    closing: closingRows(group, asOf),
    saleCost: row => costs.get(row) ?? null,
    avPrice: avPriceOrNull,
  };
}
