/**
 * Every holding's ledger, built once from the source tables.
 *
 * A holding is one (entity, share). Its rows are `computeRows` over the settled
 * contract notes, the opening balance, the dividends and the received scrip --
 * the same replay Share Analytics caches and the Dashboard aggregates.
 *
 * Three copies of this assembly existed: Share Analytics built it inline in the
 * page, `shareMetrics.service` built it again for the Dashboard, and Reports had
 * two more of its own that never read scrip at all. The Reports versions are how
 * HNB.X0000 came to read 520,792,567.99 there against 519,220,201.41 on Share
 * Analytics. This file is the one that remains.
 *
 * No React, no Supabase: repositories and pure functions only.
 */

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
  type ShareGroup,
} from './shareLedger.service';

const num = (v: number | string | null | undefined): number => Number(v) || 0;

/** The raw rows a ledger is built from, as the repositories return them. */
export interface LedgerSources {
  notes: notesRepo.NoteRow[];
  txns: txnRepo.TransactionRow[];
  openings: openingRepo.OpeningBalanceRow[];
  dividends: dividendsRepo.DividendRow[];
  scrips: scripsRepo.ScripRow[];
  prices: pricesRepo.SharePriceRow[];
  feeTypes: feeTypesRepo.FeeTypeRow[];
  shares: sharesRepo.ShareMasterRow[];
  entities: entitiesRepo.EntityMasterRow[];
}

export async function loadLedgerSources(): Promise<LedgerSources> {
  const [notes, txns, openings, dividends, scrips, prices, feeTypes, shares, entities] =
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
  return { notes, txns, openings, dividends, scrips, prices, feeTypes, shares, entities };
}

/**
 * Every holding, sorted by entity then ticker.
 *
 * @param entityId scope to one entity; omitted, every entity the caller can read
 */
export async function loadShareGroups(entityId?: string): Promise<ShareGroup[]> {
  return buildShareGroups(await loadLedgerSources(), entityId);
}

/**
 * The assembly itself, pure so it can be asserted against rows read from the
 * database without a browser.
 */
export function buildShareGroups(src: LedgerSources, entityId?: string): ShareGroup[] {
  const inScope = (e: string) => !entityId || e === entityId;
  const key = (e: string, s: string) => `${e}__${s}`;

  const { price: priceByShare, asAt: priceDateByShare } = pricesRepo.latestByShare(src.prices);
  // The cheapest active tier, for a holding none of whose transactions states a rate.
  const defaultFeeRate = src.feeTypes.length > 0 ? num(src.feeTypes[0].rate) : 0;

  const entityName = new Map(src.entities.map(e => [e.id, e.name]));
  const shareInfo = new Map(src.shares.map(s => [s.id, { ticker: s.ticker || '—', name: s.share_name || '—' }]));

  /*
    A note counts only through an approved transaction: the note carries the
    settled amounts, the transaction carries whose they are.

    The fee rate is the latest one a holding's transactions state. Share
    Analytics took the newest and the Dashboard took the oldest; no holding
    carries two different rates today, so settling on one moves no figure.
  */
  const txnById = new Map(src.txns.map(t => [t.id, t]));
  const feeRate = new Map<string, number>();
  const cdsAccounts = new Map<string, Set<string>>();
  for (const t of src.txns) {                 // oldest first, so the last write wins
    const k = key(t.entity_id, t.share_id);
    if (t.brokerage_fee_rate != null) feeRate.set(k, num(t.brokerage_fee_rate));
    if (t.cds_account_id) {
      if (!cdsAccounts.has(k)) cdsAccounts.set(k, new Set());
      cdsAccounts.get(k)!.add(t.cds_account_id);
    }
  }

  const push = <T,>(m: Map<string, T[]>, k: string, v: T) => {
    const list = m.get(k);
    if (list) list.push(v); else m.set(k, [v]);
  };

  const notes = new Map<string, RawNote[]>();
  for (const n of src.notes) {
    const t = n.transaction_id ? txnById.get(n.transaction_id) : undefined;
    if (!t || !inScope(t.entity_id)) continue;
    const net = num(n.net_amount);
    const gross = num(n.gross_amount);
    const share = shareInfo.get(t.share_id) ?? { ticker: '—', name: '—' };
    push(notes, key(t.entity_id, t.share_id), {
      id: n.id,
      note_type: n.note_type,
      trade_date: n.trade_date,
      no_of_shares: num(n.no_of_shares),
      price_avg: n.price_avg != null ? num(n.price_avg) : null,
      // Net of fees where the note states it.
      gross_amount: net > 0 ? net : gross,
      net_amount: net,
      entity_id: t.entity_id,
      entity_name: entityName.get(t.entity_id) ?? '—',
      share_id: t.share_id,
      share_ticker: share.ticker,
      share_name: share.name,
      cds_account: t.cds_account_id ?? null,
      intraday_seq: n.intraday_seq,
    });
  }

  const openings = new Map<string, OpeningBalance>();
  for (const o of src.openings) {
    if (!inScope(o.entity_id)) continue;
    openings.set(key(o.entity_id, o.share_id), {
      entity_id: o.entity_id,
      share_id: o.share_id,
      opening_shares: num(o.opening_shares),
      average_purchase_cost: num(o.average_purchase_cost),
      effective_date: o.effective_date,
    });
  }

  const dividends = new Map<string, DividendRecord[]>();
  for (const d of src.dividends) {
    if (!inScope(d.entity_id)) continue;
    push(dividends, key(d.entity_id, d.share_id), {
      entity_id: d.entity_id, share_id: d.share_id,
      payment_date: d.payment_date, amount_net: num(d.amount_net),
    });
  }

  const scrips = new Map<string, ScripRecord[]>();
  for (const s of src.scrips) {
    if (!inScope(s.entity_id)) continue;
    push(scrips, key(s.entity_id, s.share_id), {
      entity_id: s.entity_id, share_id: s.share_id,
      no_of_shares: num(s.no_of_shares),
      effective_date: s.effective_date ?? null, entry_date: s.entry_date,
    });
  }

  // A holding exists if anything was recorded against it -- including one held
  // only through scrip, never bought (Mr. DJ Ambani's NDB.N0000).
  const keys = new Set([...notes.keys(), ...openings.keys(), ...scrips.keys()]);

  const groups: ShareGroup[] = [];
  for (const k of keys) {
    const [eId, sId] = k.split('__');
    const share = shareInfo.get(sId) ?? { ticker: '—', name: '—' };
    const eName = entityName.get(eId) ?? '—';
    const marketPrice = priceByShare.get(sId) ?? 0;

    const rows = computeRows(notes.get(k) ?? [], openings.get(k) ?? null, dividends.get(k) ?? [], marketPrice, scrips.get(k) ?? []);
    if (rows.length === 0) continue;
    for (const r of rows) {
      if (!r.entity_name) r.entity_name = eName;
      if (!r.share_ticker) r.share_ticker = share.ticker;
      if (!r.share_name) r.share_name = share.name;
    }

    groups.push({
      share_id: sId, share_ticker: share.ticker, share_name: share.name,
      entity_id: eId, entity_name: eName,
      market_price: marketPrice,
      market_price_date: priceDateByShare.get(sId) ?? null,
      cds_accounts: Array.from(cdsAccounts.get(k) ?? []),
      brokerage_fee_rate: feeRate.get(k) ?? defaultFeeRate,
      rows,
    });
  }

  groups.sort((a, b) => a.entity_name.localeCompare(b.entity_name) || a.share_ticker.localeCompare(b.share_ticker));
  return groups;
}
