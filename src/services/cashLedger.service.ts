/**
 * Cash book rules: which entries a filter admits, and where a posted entry's
 * trade and settlement dates come from.
 *
 * No React and no Supabase: rows in, answers out.
 */

import type { NoteDatesRow } from '../repositories/cashLedger.repo';

/** Trade and settlement dates, absent unless the entry came from a trade. */
export interface TradeDates {
  tradeDate: string | null;
  settlementDate: string | null;
}

export const NO_TRADE_DATES: TradeDates = { tradeDate: null, settlementDate: null };

/**
 * Index note dates by note id, for resolving a ledger entry's origin.
 *
 * `cash_balance_ledger` stores only the posting date. A manual entry has no
 * trade behind it and never will; an entry raised by settling a contract note
 * carries that note's id in `reference_id`, and the dates belong to the note.
 */
export function indexNoteDates(rows: NoteDatesRow[]): Map<string, TradeDates> {
  const index = new Map<string, TradeDates>();
  for (const r of rows) {
    index.set(r.id, { tradeDate: r.trade_date, settlementDate: r.settlement_date });
  }
  return index;
}

/**
 * The trade behind a posted entry, or nothing.
 *
 * Nothing is invented for a manual entry: it has no trade date, and showing the
 * posting date in that column would read as one. The caller renders an em dash.
 */
export function tradeDatesFor(
  row: { reference_id?: string | null },
  index: Map<string, TradeDates>,
): TradeDates {
  if (!row.reference_id) return NO_TRADE_DATES;
  return index.get(row.reference_id) ?? NO_TRADE_DATES;
}

/**
 * The balance a new entry will build on.
 *
 * `running_balance` is a stored cumulative figure **per entity**, not per bank
 * account: the one ledger row against account 1416173401 carries the whole
 * entity's balance, and `banks.balance` is 0 for every account because nothing
 * maintains it. So an account has no running balance of its own, and the number
 * a new entry continues from is the entity's.
 *
 * Ordered by `timestamp`, not `date`. The stored figure accumulates in the order
 * rows were written, so insertion time is what identifies the latest one — a
 * back-dated entry still continues from the balance as it stood when it was
 * entered.
 *
 * Extracted because the submit path and the form both need it. They each had
 * their own copy, which is two chances for the figure shown to differ from the
 * figure saved.
 */
export function entityRunningBalance(
  rows: Array<{ entity_id?: string | null; timestamp: string; running_balance: number }>,
  entityId: string,
): number {
  let latest: { timestamp: string; running_balance: number } | null = null;
  for (const r of rows) {
    if (r.entity_id !== entityId) continue;
    if (!latest || r.timestamp > latest.timestamp) latest = r;
  }
  return latest ? latest.running_balance : 0;
}

/**
 * Net movement across one bank account: additions less deductions.
 *
 * Not a balance, and deliberately not called one. There is no opening figure per
 * account to add it to — this is only what has moved through the account, which
 * is the question behind "no transactions on this account but it shows a minus
 * value".
 */
export function accountNetMovement(
  rows: Array<{ bank_id?: string | null; type: string; amount: number }>,
  bankId: string,
): { net: number; entries: number } {
  let net = 0;
  let entries = 0;
  for (const r of rows) {
    if (r.bank_id !== bankId) continue;
    entries++;
    net += r.type === 'Addition' ? r.amount : -r.amount;
  }
  return { net, entries };
}

/** What a facility limit can be read from. Only accounts carry one. */
export interface AccountFacility {
  entity_id?: string | null;
  facility_limit?: number | null;
}

/**
 * The credit available to an entity: the sum of its accounts' facility limits.
 *
 * `entities` has **no** limit column — no `od_limit`, no facility limit, nothing.
 * The frontend read `entity.od_limit` anyway, so `Number(undefined) || 0` made
 * every facility limit on this screen `Rs. 0.00`, including the ones on accounts
 * that plainly have a limit: ENT003 holds 50,000,000 and ENT001 holds 500,000,000
 * on each of four accounts.
 *
 * Summing the accounts is a derivation, not a stored fact, and it is the only one
 * the data supports. It is also the reading that matches the deduction check,
 * which already preferred the selected account's own limit.
 */
export function entityFacilityLimit(accounts: AccountFacility[], entityId: string): number {
  let total = 0;
  for (const a of accounts) {
    if (a.entity_id !== entityId) continue;
    total += Number(a.facility_limit) || 0;
  }
  return total;
}

/**
 * One account's facility limit, or null when it has none.
 *
 * Null rather than zero: an account with no limit recorded is not an account with
 * a limit of nothing, and a ledger row with no account at all has no limit to
 * report. Both render as an em dash.
 */
export function accountFacilityLimit(account: AccountFacility | null | undefined): number | null {
  if (!account || account.facility_limit == null) return null;
  return Number(account.facility_limit) || 0;
}

export interface CashPosition {
  /** From the ledger, which is the authoritative record — see below. */
  balance: number;
  /** Sum of the entity's accounts' facility limits. */
  facilityLimit: number;
  onHold: number;
  /** balance + facilityLimit - onHold. */
  availableCredit: number;
}

/**
 * An entity's cash position, from the ledger rather than the cached column.
 *
 * `entities.current_balance` is a denormalised copy, written alongside each new
 * ledger row, and it drifts: for ENT004 it holds 1,000,000,000.00 against a
 * ledger that adds to 999,140,480.00 — 859,520 out. The ledger itself is
 * internally consistent, and by a check worth stating: summing every row's signed
 * amount reproduces the latest stored `running_balance` exactly, for every entity,
 * to the cent. It is also what each new entry is computed from. So the ledger
 * decides and the cached column is not read here.
 *
 * Available credit is deliberately entity-level. Facility limits belong to
 * accounts and are summed, but balances do not exist per account at all —
 * `running_balance` accumulates per entity and `banks.balance` is zero everywhere
 * — so a per-account headroom cannot be computed from this data, however much the
 * limits being per-account invites it. That question is open separately; nothing
 * here should be read as answering it.
 */
export function entityCashPosition(
  rows: Array<{ entity_id?: string | null; timestamp: string; running_balance: number }>,
  accounts: AccountFacility[],
  entityId: string,
  onHold: number,
): CashPosition {
  const balance = entityRunningBalance(rows, entityId);
  const facilityLimit = entityFacilityLimit(accounts, entityId);
  return {
    balance,
    facilityLimit,
    onHold,
    availableCredit: balance + facilityLimit - onHold,
  };
}

export interface LedgerFilters {
  entityId: string;
  bankId: string;
  /** Posting date, inclusive. Empty means unbounded. */
  from: string;
  to: string;
}

export const NO_FILTERS: LedgerFilters = { entityId: '', bankId: '', from: '', to: '' };

export function hasActiveFilter(f: LedgerFilters): boolean {
  return Boolean(f.entityId || f.bankId || f.from || f.to);
}

/**
 * Does a posted entry belong in the filtered view?
 *
 * Dates are compared as ISO strings, which sorts correctly for `YYYY-MM-DD` and
 * avoids constructing a Date per row per keystroke. Both bounds are inclusive:
 * a user picking a single day on both sides expects that day's entries.
 */
export function matchesLedgerFilters(
  row: { entity_id?: string | null; bank_id?: string | null; date?: string | null },
  f: LedgerFilters,
): boolean {
  if (f.entityId && row.entity_id !== f.entityId) return false;
  if (f.bankId && row.bank_id !== f.bankId) return false;
  const date = (row.date ?? '').slice(0, 10);
  if (f.from && date < f.from) return false;
  if (f.to && date > f.to) return false;
  return true;
}

/**
 * Does a trade awaiting approval belong in the filtered view?
 *
 * A pending trade has no bank account yet — the money has not moved, so no
 * account has been debited. Filtering by bank therefore excludes every pending
 * trade rather than matching none of them by accident, and the caller says so
 * on screen instead of leaving a row count that silently disagrees.
 *
 * Its date is the trade date, since that is the only date it has.
 */
export function matchesPendingFilters(
  note: { entity_id: string; trade_date?: string | null },
  f: LedgerFilters,
): boolean {
  if (f.entityId && note.entity_id !== f.entityId) return false;
  if (f.bankId) return false;
  const date = (note.trade_date ?? '').slice(0, 10);
  if (f.from && (!date || date < f.from)) return false;
  if (f.to && (!date || date > f.to)) return false;
  return true;
}
