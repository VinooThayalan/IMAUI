/**
 * Per-share metrics, built from the one share ledger.
 *
 * The Dashboard used to compute holdings itself, directly from `transactions`
 * and unfiltered `buy_sell_notes`, and never read `scrip_entries` at all. So its
 * figures disagreed with every screen that goes through the ledger — fewer
 * shares held, and therefore a different market value, net market value, total
 * return and AER. Four defects, one divergence.
 *
 * The holdings come from `buildShareGroups` in `shareGroups.service`, the same
 * assembly Share Analytics and Reports read; this file only aggregates them by
 * share. No React: repositories and pure functions only.
 */

import { aerPercent, netMarketValue, type CashFlow } from '../lib/aer';
import * as sharesRepo from '../repositories/shares.repo';
import * as pricesRepo from '../repositories/sharePrices.repo';
import { buildShareGroups, loadLedgerSources } from './shareGroups.service';

const num = (v: number | string | null | undefined): number => Number(v) || 0;

/** One share, aggregated across whichever entities are in scope. */
export interface ShareMetric {
  shareId: string;
  ticker: string;
  shareName: string;
  sector: string;
  sectorColor: string | null;
  heldShares: number;
  /** Average cost of the shares still held. */
  cost: number;
  /** Everything ever paid, including for shares since sold. */
  totalCostAll: number;
  /** Net of brokerage, at the latest price on file. */
  marketValue: number;
  dividends: number;
  saleProceeds: number;
  /** marketValue - cost, on what is still held. */
  netMarketValue: number;
  /** (marketValue + saleProceeds + dividends) - totalCostAll. */
  totalReturns: number;
  avgCostPerShare: number;
  latestPrice: number;
  /**
   * Pooled XIRR across every entity holding this share, or null when none
   * solves.
   *
   * Pooled, not averaged. Averaging internal rates of return is not a
   * meaningful operation, so the cash flows of every entity's position are
   * combined and discounted against one terminal value. That is the money
   * weighted return the book earned on this share.
   *
   * It therefore does NOT equal any single holding's AER when more than one
   * entity holds the share, and Share Analytics and Portfolio Summary both
   * report per (entity, share). `byEntity` carries those figures so the
   * difference can be traced rather than merely noticed.
   */
  aer: number | null;
  /** Entities holding this share, and the AER each of them reports. */
  byEntity: EntityAer[];
  /** Convenience: pooling only changes the answer when this exceeds 1. */
  entityCount: number;
}

/** One entity's holding of a share, with the AER the other screens show for it. */
export interface EntityAer {
  entityId: string;
  entityName: string;
  heldShares: number;
  /** Computed exactly as Share Analytics computes it for this group. */
  aer: number | null;
}

/**
 * Build metrics for every share, optionally scoped to one entity.
 *
 * Aggregation is by share, summing across entities, because the Dashboard shows
 * one row per share rather than per holding. The AER cannot be summed that way:
 * it is recomputed by pooling the cash flows of every entity's position in that
 * share and discounting one combined terminal value.
 */
export async function loadShareMetrics(entityId?: string): Promise<ShareMetric[]> {
  // One ledger per (entity, share), built where every other screen builds it.
  const src = await loadLedgerSources();
  const groups = buildShareGroups(src, entityId);

  // Terminal values for every AER below discount to the same instant.
  const asOf = new Date();

  const { price: priceByShare } = pricesRepo.latestByShare(src.prices);
  const defaultFeeRate = src.feeTypes.length > 0 ? num(src.feeTypes[0].rate) : 0;
  const shares = src.shares;
  const entities = src.entities;

  /** Accumulator per share, summed across entities. */
  interface Acc {
    heldShares: number;
    cost: number;
    totalCostAll: number;
    dividends: number;
    saleProceeds: number;
    cashFlows: CashFlow[];
    feeRateWeighted: number;
    feeRateWeight: number;
    byEntity: EntityAer[];
  }
  const byShare = new Map<string, Acc>();

  for (const g of groups) {
    const gEntityId = g.entity_id;
    const shareId = g.share_id;
    const marketPrice = g.market_price;
    const feeRate = g.brokerage_fee_rate;
    const rows = g.rows;

    const last = rows[rows.length - 1];
    let acc = byShare.get(shareId);
    if (!acc) {
      acc = {
        heldShares: 0, cost: 0, totalCostAll: 0, dividends: 0, saleProceeds: 0,
        cashFlows: [], feeRateWeighted: 0, feeRateWeight: 0, byEntity: [],
      };
      byShare.set(shareId, acc);
    }

    acc.heldShares += last.share_cum_bal;
    acc.cost += last.av_cost;
    acc.totalCostAll += last.cum_purchase_cost;
    acc.dividends += last.cum_dividend;
    acc.saleProceeds += last.cum_sale_value;

    // Fee rates are per (entity, share). Weighting by held shares keeps the
    // blended rate meaningful when two entities hold one share at different
    // rates, instead of whichever was seen last winning.
    acc.feeRateWeighted += feeRate * Math.max(0, last.share_cum_bal);
    acc.feeRateWeight += Math.max(0, last.share_cum_bal);

    const groupFlows: CashFlow[] = [];
    for (const r of rows) {
      if (r.cash_flow !== 0 && r.trade_date) {
        groupFlows.push({ date: new Date(r.trade_date + 'T00:00:00'), amount: r.cash_flow });
      }
    }
    acc.cashFlows.push(...groupFlows);

    // This group's own AER, computed the way Share Analytics computes it, so
    // the pooled figure above can be reconciled against what that screen shows.
    const groupTerminal = netMarketValue(last.share_cum_bal, marketPrice, feeRate);
    const groupCfs = [...groupFlows];
    if (groupTerminal > 0) groupCfs.push({ date: asOf, amount: groupTerminal });

    acc.byEntity.push({
      entityId: gEntityId,
      entityName: '',
      heldShares: last.share_cum_bal,
      aer: aerPercent(groupCfs),
    });
  }

  const shareById = new Map(shares.map(s => [s.id, s]));
  const entityNameById = new Map(entities.map(e => [e.id, e.name]));
  const result: ShareMetric[] = [];

  for (const [shareId, acc] of byShare) {
    const master = shareById.get(shareId);
    const sector = master ? sharesRepo.sectorOf(master) : { name: 'Other', color: null };
    const latestPrice = priceByShare.get(shareId) ?? 0;
    const feeRate = acc.feeRateWeight > 0 ? acc.feeRateWeighted / acc.feeRateWeight : defaultFeeRate;

    const marketValue = netMarketValue(acc.heldShares, latestPrice, feeRate);

    const cfs = [...acc.cashFlows];
    if (marketValue > 0) cfs.push({ date: asOf, amount: marketValue });

    result.push({
      shareId,
      ticker: master?.ticker || '—',
      shareName: master?.share_name || master?.ticker || '—',
      sector: sector.name,
      sectorColor: sector.color,
      heldShares: acc.heldShares,
      cost: acc.cost,
      totalCostAll: acc.totalCostAll,
      marketValue,
      dividends: acc.dividends,
      saleProceeds: acc.saleProceeds,
      netMarketValue: marketValue - acc.cost,
      totalReturns: marketValue + acc.saleProceeds + acc.dividends - acc.totalCostAll,
      avgCostPerShare: acc.heldShares > 0 ? acc.cost / acc.heldShares : 0,
      latestPrice,
      aer: aerPercent(cfs),
      byEntity: acc.byEntity
        .map(b => ({ ...b, entityName: entityNameById.get(b.entityId) ?? '—' }))
        .sort((x, y) => y.heldShares - x.heldShares),
      entityCount: acc.byEntity.length,
    });
  }

  result.sort((a, b) => b.netMarketValue - a.netMarketValue);
  return result;
}
