/**
 * Per-share metrics, built from the one share ledger.
 *
 * The Dashboard used to compute holdings itself, directly from `transactions`
 * and unfiltered `buy_sell_notes`, and never read `scrip_entries` at all. So its
 * figures disagreed with every screen that goes through the ledger — fewer
 * shares held, and therefore a different market value, net market value, total
 * return and AER. Four defects, one divergence.
 *
 * This loads the same sources the ledger expects, runs the same `computeRows`,
 * and then aggregates. No React: repositories and pure functions only.
 */

import { aerPercent, netMarketValue, type CashFlow } from '../lib/aer';
import * as notesRepo from '../repositories/notes.repo';
import * as txnRepo from '../repositories/transactions.repo';
import * as openingRepo from '../repositories/openingBalances.repo';
import * as dividendsRepo from '../repositories/dividends.repo';
import * as scripsRepo from '../repositories/scrips.repo';
import * as pricesRepo from '../repositories/sharePrices.repo';
import * as feeTypesRepo from '../repositories/brokerageFeeTypes.repo';
import * as sharesRepo from '../repositories/shares.repo';
import * as entitiesRepo from '../repositories/entities.repo';
import {
  computeRows,
  type DividendRecord,
  type OpeningBalance,
  type RawNote,
  type ScripRecord,
} from './shareLedger.service';

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
  const [notes, txns, openings, dividends, scrips, priceRows, feeTypes, shares, entities] =
    await Promise.all([
      notesRepo.listProcessed(),
      txnRepo.listApproved(),
      openingRepo.listAll(),
      dividendsRepo.listAll(),
      scripsRepo.listReceived(),
      pricesRepo.listNewestFirst(),
      feeTypesRepo.listActive(),
      sharesRepo.listAll(),
      entitiesRepo.listAll(),
    ]);

  // Terminal values for every AER below discount to the same instant.
  const asOf = new Date();

  const { price: priceByShare } = pricesRepo.latestByShare(priceRows);
  const defaultFeeRate = feeTypes.length > 0 ? num(feeTypes[0].rate) : 0;

  // A note only counts if its transaction is approved — the note carries the
  // settled amounts, the transaction carries who it belongs to.
  const txnById = new Map(txns.map(t => [t.id, t]));
  const feeRateByGroup = new Map<string, number>();
  for (const t of txns) {
    const key = `${t.entity_id}__${t.share_id}`;
    if (!feeRateByGroup.has(key) && t.brokerage_fee_rate != null) {
      feeRateByGroup.set(key, num(t.brokerage_fee_rate));
    }
  }

  const notesByGroup = new Map<string, RawNote[]>();
  for (const n of notes) {
    const txn = n.transaction_id ? txnById.get(n.transaction_id) : undefined;
    if (!txn) continue;
    if (entityId && txn.entity_id !== entityId) continue;

    const net = num(n.net_amount);
    const gross = num(n.gross_amount);
    const key = `${txn.entity_id}__${txn.share_id}`;
    const list = notesByGroup.get(key) ?? [];
    list.push({
      id: n.id,
      note_type: n.note_type,
      trade_date: n.trade_date,
      no_of_shares: num(n.no_of_shares),
      price_avg: n.price_avg != null ? num(n.price_avg) : null,
      // Net of fees where available, matching the ledger's other callers.
      gross_amount: net > 0 ? net : gross,
      net_amount: net,
      entity_id: txn.entity_id,
      entity_name: '',
      share_id: txn.share_id,
      share_ticker: '',
      share_name: '',
      cds_account: txn.cds_account_id ?? null,
    });
    notesByGroup.set(key, list);
  }

  const openingByGroup = new Map<string, OpeningBalance>();
  for (const o of openings) {
    if (entityId && o.entity_id !== entityId) continue;
    openingByGroup.set(`${o.entity_id}__${o.share_id}`, {
      entity_id: o.entity_id,
      share_id: o.share_id,
      opening_shares: num(o.opening_shares),
      average_purchase_cost: num(o.average_purchase_cost),
      effective_date: o.effective_date,
    });
  }

  const dividendsByGroup = new Map<string, DividendRecord[]>();
  for (const d of dividends) {
    if (entityId && d.entity_id !== entityId) continue;
    const key = `${d.entity_id}__${d.share_id}`;
    const list = dividendsByGroup.get(key) ?? [];
    list.push({
      entity_id: d.entity_id,
      share_id: d.share_id,
      payment_date: d.payment_date,
      amount_net: num(d.amount_net),
    });
    dividendsByGroup.set(key, list);
  }

  const scripsByGroup = new Map<string, ScripRecord[]>();
  for (const s of scrips) {
    if (entityId && s.entity_id !== entityId) continue;
    const key = `${s.entity_id}__${s.share_id}`;
    const list = scripsByGroup.get(key) ?? [];
    list.push({
      entity_id: s.entity_id,
      share_id: s.share_id,
      no_of_shares: num(s.no_of_shares),
      effective_date: s.effective_date,
      entry_date: s.entry_date,
    });
    scripsByGroup.set(key, list);
  }

  const groupKeys = new Set<string>([
    ...notesByGroup.keys(),
    ...openingByGroup.keys(),
    ...scripsByGroup.keys(),
  ]);

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

  for (const key of groupKeys) {
    const [gEntityId, shareId] = key.split('__');
    const marketPrice = priceByShare.get(shareId) ?? 0;
    const feeRate = feeRateByGroup.get(key) ?? defaultFeeRate;

    const rows = computeRows(
      notesByGroup.get(key) ?? [],
      openingByGroup.get(key) ?? null,
      dividendsByGroup.get(key) ?? [],
      marketPrice,
      scripsByGroup.get(key) ?? [],
    );
    if (rows.length === 0) continue;

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
