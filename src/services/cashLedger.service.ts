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
 * An entry's effect on a balance. One place decides the sign.
 *
 * The table's CHECK constraint admits only `Addition` and `Deduction`, so the
 * lower-case forms cannot reach here from the database — they are accepted
 * because the screens were already testing for them, and a sign rule that
 * disagrees with the one beside it is how a credit ends up subtracted.
 */
function signedAmount(row: { type: string; amount: number }): number {
  return row.type === 'Addition' || row.type === 'addition' ? row.amount : -row.amount;
}

/**
 * Net movement across one bank account: additions less deductions.
 *
 * The same sum as `accountBalance` below, which is this figure with the grain
 * named and an empty account distinguished from one that nets to nothing. Both
 * sign a row through `signedAmount`, because they did not: this function read
 * `type === 'Addition'` while the balance accepted `'addition'` too, so one
 * lower-case row made them return **opposite signs** for the same entry. The
 * CHECK constraint means no such row exists today, which is exactly why it
 * would have gone unnoticed.
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
    net += signedAmount(r);
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

/**
 * Does this entity have any ledger entry at all?
 *
 * The distinction the screens need. `entityRunningBalance` answers 0 for an
 * entity with no rows, which is right for its job — a new entry has to continue
 * from something, and zero is what it continues from. It is wrong as a *display*
 * of a balance: an entity with nothing recorded does not have a balance of
 * nothing, and `Rs. 0.00` in that cell is a figure the data never stated.
 */
function hasLedgerEntry(
  rows: Array<{ entity_id?: string | null }>,
  entityId: string,
): boolean {
  return rows.some(r => r.entity_id === entityId);
}

/**
 * An entity's balance for display, or null when it has no entries.
 *
 * Delegates to `entityRunningBalance` rather than picking the latest row again,
 * so there is still one rule for which row the balance comes from.
 */
export function entityBalance(
  rows: Array<{ entity_id?: string | null; timestamp: string; running_balance: number }>,
  entityId: string,
): number | null {
  return hasLedgerEntry(rows, entityId) ? entityRunningBalance(rows, entityId) : null;
}

/**
 * An entity's facility limit, or null when none of its accounts records one.
 *
 * Null covers two cases that look the same on screen and are the same in
 * substance: an entity with no bank accounts, and one whose accounts all leave
 * `facility_limit` unset. Neither has a limit; neither has a limit of zero.
 * An account carrying 0 explicitly still counts as a limit, and sums as 0.
 */
export function entityFacilityLimitOrNull(
  accounts: AccountFacility[],
  entityId: string,
): number | null {
  const recorded = accounts.some(a => a.entity_id === entityId && a.facility_limit != null);
  return recorded ? entityFacilityLimit(accounts, entityId) : null;
}

export interface CashPosition {
  /**
   * From the ledger, which is the authoritative record — see below. Null when
   * the entity has no entries: no balance to report, rendered as an em dash.
   */
  balance: number | null;
  /** Sum of the entity's accounts' facility limits. Null when none records one. */
  facilityLimit: number | null;
  onHold: number;
  /**
   * balance + facilityLimit - onHold, and null when there is no balance to
   * compute headroom from. A missing limit counts as nothing to draw on rather
   * than voiding the figure, so an entity with entries and no facility still
   * gets an available credit.
   */
  availableCredit: number | null;
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
  const balance = entityBalance(rows, entityId);
  const facilityLimit = entityFacilityLimitOrNull(accounts, entityId);
  return {
    balance,
    facilityLimit,
    onHold,
    availableCredit: balance === null ? null : balance + (facilityLimit ?? 0) - onHold,
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

/** A ledger row as a per-account balance needs it. */
export interface AccountLedgerRow {
  id: string;
  bank_id?: string | null;
  type: string;
  amount: number;
  date?: string | null;
  timestamp?: string;
}

/**
 * The order a printed balance accumulates in: posting date, then write order,
 * then id.
 *
 * Posting date first, because a balance printed beside a date column has to
 * accumulate down the page or it cannot be reconciled by a reader. `timestamp`
 * breaks a same-date tie, and `id` makes the order total — the tiebreaker the
 * cache reads already require, for the same reason: two entries sharing a date
 * otherwise sort arbitrarily.
 */
function comparePostingOrder(a: AccountLedgerRow, b: AccountLedgerRow): number {
  const ad = a.date ?? '';
  const bd = b.date ?? '';
  if (ad !== bd) return ad < bd ? -1 : 1;
  const at = a.timestamp ?? '';
  const bt = b.timestamp ?? '';
  if (at !== bt) return at < bt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export interface AccountBalancePoint<T> {
  row: T;
  /** The account's balance as at this row, from its own entries only. */
  balance: number;
}

/**
 * One account's entries in posting order, each with the balance as at that row.
 *
 * This exists because `running_balance` is a **stored** column, written at
 * insert time from the entity's previous balance — never recomputed per account,
 * because `bank_id` was added to the table three weeks after it was created.
 * Printing it beside rows filtered to one account is the reported defect, and
 * the arithmetic behind the report is exact: the entity stood at
 * -432,038,715.57, a manual credit of 5,841,004.33 was posted against account
 * 1416173401, and the row therefore stored -426,197,711.24 — the entity's new
 * balance, not the account's. That single credit is the only entry on the
 * account, so the account holds +5,841,004.33.
 *
 * Opens at zero, which is a statement about the entries and not about the bank:
 * an account whose first entry is its `Initial` credit opens at zero and closes
 * at that credit. An account funded by an entry posted with no `bank_id` opens
 * at zero and stays understated — the write-path defect showing through rather
 * than something to paper over here. Every trade-driven writer posts
 * `bank_id: null` today.
 */
export function accountRunningBalances<T extends AccountLedgerRow>(
  rows: T[],
  bankId: string,
): Array<AccountBalancePoint<T>> {
  const own = rows.filter(r => r.bank_id === bankId).sort(comparePostingOrder);
  let balance = 0;
  return own.map(row => {
    balance += signedAmount(row);
    return { row, balance };
  });
}

/**
 * The account's closing balance, or null when it has no entries at all.
 *
 * Null rather than zero, so a caller can tell "nothing recorded here" from "it
 * nets to nothing". The caller on Bank Transaction History currently coerces to
 * zero to keep its cell unchanged; that reading is the screen's to make.
 */
export function accountBalance(rows: AccountLedgerRow[], bankId: string): number | null {
  const series = accountRunningBalances(rows, bankId);
  if (series.length === 0) return null;
  return series[series.length - 1].balance;
}
