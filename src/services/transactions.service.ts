/**
 * Rules about transactions that are not about one holding's ledger.
 *
 * bug-51: a cancelled or expired transaction still counted. The New Transaction
 * form worked out "Held" and "Avg cost" itself, from every row of
 * `transactions` for the entity and share whatever its status, so Test's
 * cancelled 99,000-share TAP.N0000 buy showed as 99,000 held. The same copy
 * ignored scrip and read the rows in no stated order, so it disagreed with the
 * ledger on 20 of 46 holdings, cancelled or not -- Metrocorp's HNB.N0000 read
 * 1,362,884 held against the 1,375,586 Share Analytics shows.
 *
 * What a holding is now comes from the one ledger (`shareGroups.service`). What
 * stays here is what a form does with it, and which statuses can never trade.
 *
 * No React, no Supabase.
 */

import { avPriceOrNull, type ShareGroup } from './shareLedger.service';

// ── Statuses ─────────────────────────────────────────────────────────────────

/**
 * A transaction in one of these will never trade: it was refused, withdrawn, or
 * ran out of time. Nothing it says may feed a figure.
 *
 * Draft and pending are not here -- they may still trade. Holdings are stricter
 * still: they count only approved transactions whose contract note has been
 * processed, which the ledger enforces on its own.
 */
const NEVER_TRADES = new Set(['CANCELLED', 'EXPIRED', 'REJECTED']);

export function canStillTrade(approvalStatus: string | null | undefined): boolean {
  return !NEVER_TRADES.has(approvalStatus ?? '');
}

/**
 * The Transactions list's "Total Volume": the value of the listed transactions
 * that did or still may trade. A cancelled 3,103,372.80 buy is not volume.
 */
export function tradableVolume(
  rows: { approval_status: string | null; total_amount: number | string | null }[],
): { volume: number; excluded: number } {
  let volume = 0;
  let excluded = 0;
  for (const r of rows) {
    if (!canStillTrade(r.approval_status)) { excluded++; continue; }
    volume += Number(r.total_amount) || 0;
  }
  return { volume, excluded };
}

// ── What an entity holds of one share ───────────────────────────────────────

/**
 * An entity's position in one share, as Share Analytics reports it.
 *
 * `heldShares` is a count a sell is checked against, so it is 0 when nothing is
 * held -- holding none of a share is a fact, not a gap. `avgCost` is the average
 * price of what is held, and null when nothing is: an average over no shares is
 * not zero.
 */
export interface Position {
  heldShares: number;
  avgCost: number | null;
}

/** The position from already-built holdings. Pure, so it can be asserted. */
export function positionOf(groups: ShareGroup[], entityId: string, shareId: string): Position {
  const g = groups.find(x => x.entity_id === entityId && x.share_id === shareId);
  const last = g?.rows[g.rows.length - 1];
  if (!last) return { heldShares: 0, avgCost: null };
  return { heldShares: last.share_cum_bal, avgCost: avPriceOrNull(last) };
}

// ── Previews on the New Transaction form ────────────────────────────────────

/**
 * The average cost a buy would leave: what is held, at its average, plus the
 * new shares at their net price. Null when there is nothing to average.
 */
export function avgCostAfterBuy(position: Position, quantity: number, netPricePerShare: number): number | null {
  const shares = position.heldShares + quantity;
  if (!(shares > 0)) return null;
  const heldCost = position.avgCost == null ? 0 : position.heldShares * position.avgCost;
  return (heldCost + quantity * netPricePerShare) / shares;
}

/**
 * Profit or loss a sell would book against the average cost of what is held.
 * Null when nothing is held -- there is no cost to measure against.
 */
export function sellPnl(
  position: Position,
  quantity: number,
  netSalePricePerShare: number,
): { avgCost: number; pnlPerShare: number; totalPnl: number } | null {
  if (position.avgCost == null) return null;
  const pnlPerShare = netSalePricePerShare - position.avgCost;
  return { avgCost: position.avgCost, pnlPerShare, totalPnl: pnlPerShare * quantity };
}
