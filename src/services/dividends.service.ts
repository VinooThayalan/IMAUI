/**
 * Saving and deleting a dividend, and the cash ledger entry it keeps.
 *
 * One rule: a Finalized dividend has exactly one entry, and the entry shows the
 * dividend as it now stands. A dividend that is not Finalized has none.
 */

import * as dividendsRepo from '../repositories/dividends.repo';
import * as cashLedgerRepo from '../repositories/cashLedger.repo';
import * as entitiesRepo from '../repositories/entities.repo';
import { entityRunningBalance } from './cashLedger.service';
import { formatDisplayDate } from '../lib/dateInput';
import { errorMessage } from '../lib/errorMessage';
import { logAudit } from '../lib/auditLog';

export type DividendWrite = dividendsRepo.DividendWrite;

export interface DividendCash {
  id: string;
  entity_id: string;
  ticker: string;
  /** XD date. */
  dividend_date: string | null;
  payment_date: string | null;
  amount_net: number;
  bank_id: string | null;
}

/** Who is acting: the name shown as Created By, and the login the audit log records. */
export interface DividendActor {
  createdBy: string;
  performedBy: string;
}

const FINALIZED = 'Finalized';
const round2 = (n: number) => Math.round(n * 100) / 100;
const cents = (n: number | string) => Math.round(Number(n) * 100);

/** Why a dividend cannot be Finalized, or null when it can. */
export function dividendCashProblem(d: Pick<DividendCash, 'payment_date' | 'amount_net'>): string | null {
  if (!d.payment_date) {
    return 'Enter the payment date. A finalized dividend is added to Cash Balance on its payment date.';
  }
  if (!(round2(d.amount_net) > 0)) {
    return 'The total net dividend must be more than zero to be added to Cash Balance.';
  }
  return null;
}

/**
 * The ledger entry a finalized dividend posts: on its payment date, the date the
 * reports already use for a dividend's cash, against the account it was paid into.
 */
export function dividendLedgerEntry(
  d: DividendCash,
  openingBalance: number,
  createdBy: string,
): cashLedgerRepo.CashLedgerInsert {
  const amount = round2(d.amount_net);
  const xd = formatDisplayDate(d.dividend_date);
  return {
    type: 'Addition',
    description: xd ? `Dividend — ${d.ticker}, XD ${xd}` : `Dividend — ${d.ticker}`,
    code: null,
    amount,
    date: (d.payment_date ?? '').slice(0, 10),
    running_balance: round2(openingBalance + amount),
    on_hold_amount: 0,
    source: 'Dividend',
    entity_id: d.entity_id,
    bank_id: d.bank_id,
    reference_id: d.id,
    created_by: createdBy,
  };
}

/** What a finalized dividend's entry must change to match it, or null when nothing differs. */
export function dividendEntryChanges(
  entry: Pick<cashLedgerRepo.ReferencedEntryRow, 'entity_id' | 'bank_id' | 'date' | 'description' | 'amount'>,
  d: DividendCash,
): cashLedgerRepo.CashLedgerUpdate | null {
  const target = dividendLedgerEntry(d, 0, '');
  const changes: cashLedgerRepo.CashLedgerUpdate = {};
  if (entry.entity_id !== target.entity_id) changes.entity_id = target.entity_id;
  if (cents(entry.amount) !== cents(target.amount)) changes.amount = target.amount;
  if (entry.bank_id !== target.bank_id) changes.bank_id = target.bank_id;
  if (target.date && entry.date.slice(0, 10) !== target.date) changes.date = target.date;
  if (entry.description !== target.description) changes.description = target.description;
  return Object.keys(changes).length > 0 ? changes : null;
}

export type DividendCashAction = 'post' | 'mirror' | 'remove' | 'none';

/**
 * What saving a dividend does to the ledger.
 *
 * A new entry is posted only when the dividend has just become Finalized. One
 * already Finalized whose entry cannot be found was posted before entries were
 * linked to their dividend, and posting again would add its cash twice.
 */
export function dividendCashAction(
  wasFinalized: boolean,
  isFinalized: boolean,
  hasEntry: boolean,
): DividendCashAction {
  if (isFinalized) {
    if (hasEntry) return 'mirror';
    return wasFinalized ? 'none' : 'post';
  }
  return hasEntry ? 'remove' : 'none';
}

/** Bring the ledger in line with a dividend: `target` is the dividend as Finalized, or null. */
async function settleDividendCash(
  dividendId: string,
  target: DividendCash | null,
  wasFinalized: boolean,
  actor: DividendActor,
): Promise<DividendCashAction> {
  const entries = await cashLedgerRepo.listByReference(dividendId);
  const action = dividendCashAction(wasFinalized, target !== null, entries.length > 0);
  const moved = new Set<string>();
  const removeEntry = async (entry: cashLedgerRepo.ReferencedEntryRow) => {
    await cashLedgerRepo.remove(entry.id);
    if (entry.entity_id) moved.add(entry.entity_id);
    void logAudit({ tableName: 'cash_balance_ledger', recordId: entry.id, action: 'DELETE', performedBy: actor.performedBy, oldValues: entry, entityId: entry.entity_id });
  };

  if (action === 'post' && target) {
    const opening = entityRunningBalance(await entityRows(target.entity_id), target.entity_id);
    const entry = dividendLedgerEntry(target, opening, actor.createdBy);
    const { id } = await cashLedgerRepo.insert(entry);
    moved.add(target.entity_id);
    void logAudit({ tableName: 'cash_balance_ledger', recordId: id, action: 'CREATE', performedBy: actor.performedBy, newValues: entry, entityId: target.entity_id });
  } else if (action === 'mirror' && target) {
    const [entry, ...duplicates] = entries;
    const changes = dividendEntryChanges(entry, target);
    if (changes) {
      await cashLedgerRepo.update(entry.id, changes);
      if (changes.amount !== undefined || changes.entity_id !== undefined) {
        if (entry.entity_id) moved.add(entry.entity_id);
        moved.add(target.entity_id);
      }
      const oldValues = Object.fromEntries(Object.keys(changes).map(k => [k, entry[k as keyof typeof entry]]));
      void logAudit({ tableName: 'cash_balance_ledger', recordId: entry.id, action: 'UPDATE', performedBy: actor.performedBy, oldValues, newValues: changes, entityId: target.entity_id });
    }
    for (const duplicate of duplicates) await removeEntry(duplicate);
  } else if (action === 'remove') {
    for (const entry of entries) await removeEntry(entry);
  }

  for (const entityId of moved) await refreshBalanceCopy(entityId);
  return action;
}

async function entityRows(entityId: string) {
  const rows = await cashLedgerRepo.listForEntity(entityId);
  return rows.map(r => ({ entity_id: r.entity_id, type: r.type, amount: Number(r.amount) }));
}

/** `entities.current_balance` is a copy of the ledger balance; a failure to refresh it is logged, not raised. */
async function refreshBalanceCopy(entityId: string): Promise<void> {
  try {
    await entitiesRepo.setCurrentBalance(entityId, entityRunningBalance(await entityRows(entityId), entityId));
  } catch (err) {
    console.error('Could not update the entity balance copy:', err);
  }
}

export interface SaveDividendInput {
  /** Null for a new dividend. */
  id: string | null;
  values: DividendWrite;
  ticker: string;
  bankId: string | null;
}

export type SaveDividendResult =
  | { saved: false; problem: string }
  | { saved: true; cash: DividendCashAction; cashError: string | null };

/** Save a dividend and bring its cash ledger entry in line. Nothing is written when it cannot be Finalized. */
export async function saveDividend(input: SaveDividendInput, actor: DividendActor): Promise<SaveDividendResult> {
  const v = input.values;
  const isFinalized = v.status === FINALIZED;
  if (isFinalized) {
    const problem = dividendCashProblem(v);
    if (problem) return { saved: false, problem };
  }

  const before = input.id ? await dividendsRepo.getById(input.id) : null;
  let id = input.id;
  if (id) {
    await dividendsRepo.update(id, v);
    void logAudit({ tableName: 'dividends', recordId: id, action: 'UPDATE', performedBy: actor.performedBy, oldValues: before, newValues: { ...before, ...v }, entityId: v.entity_id });
  } else {
    id = (await dividendsRepo.insert(v))?.id ?? null;
    void logAudit({ tableName: 'dividends', recordId: id ?? 'new', action: 'CREATE', performedBy: actor.performedBy, newValues: v, entityId: v.entity_id });
  }

  if (!id) {
    return { saved: true, cash: 'none', cashError: isFinalized ? 'the new dividend could not be read back.' : null };
  }
  const target: DividendCash | null = isFinalized
    ? { id, entity_id: v.entity_id, ticker: input.ticker, dividend_date: v.dividend_date, payment_date: v.payment_date, amount_net: v.amount_net, bank_id: input.bankId }
    : null;
  try {
    const cash = await settleDividendCash(id, target, before?.status === FINALIZED, actor);
    return { saved: true, cash, cashError: null };
  } catch (err) {
    return { saved: true, cash: 'none', cashError: errorMessage(err) };
  }
}

/** Delete a dividend and the cash ledger entry it kept. */
export async function deleteDividend(id: string, actor: DividendActor): Promise<{ cashError: string | null }> {
  const before = await dividendsRepo.getById(id);
  await dividendsRepo.remove(id);
  void logAudit({ tableName: 'dividends', recordId: id, action: 'DELETE', performedBy: actor.performedBy, oldValues: before, entityId: before?.entity_id });
  try {
    await settleDividendCash(id, null, before?.status === FINALIZED, actor);
    return { cashError: null };
  } catch (err) {
    return { cashError: errorMessage(err) };
  }
}
