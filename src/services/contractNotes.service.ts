/**
 * A contract note's cash: the entry a processed note posts to the cash ledger,
 * kept in line with the note, and removed with it.
 */

import * as cashLedgerRepo from '../repositories/cashLedger.repo';
import * as notesRepo from '../repositories/notes.repo';
import * as transactionsRepo from '../repositories/transactions.repo';
import { entityRunningBalance } from './cashLedger.service';
import { tradeLedgerDate } from '../lib/tradeDates';
import { errorMessage } from '../lib/errorMessage';
import { logAudit } from '../lib/auditLog';

export interface NoteCash {
  noteId: string;
  /** The transaction the note settles; its bank account, when stated, is where the cash moves. */
  transactionId: string | null;
  entityId: string;
  noteType: 'Buy' | 'Sell';
  netAmount: number;
  settlementDate: string | null;
  description: string;
  code: string | null;
  notes: string | null;
}

export interface NoteCashActor {
  createdBy: string;
  performedBy: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const cents = (n: number | string) => Math.round(Number(n) * 100);

/** Why a note's cash cannot be posted, or null when it can. */
export function noteCashProblem(n: Pick<NoteCash, 'netAmount' | 'settlementDate'>): string | null {
  if (!tradeLedgerDate({ settlement_date: n.settlementDate })) {
    return 'Enter the settlement date. A note\'s cash is posted to Cash Balance on its settlement date.';
  }
  if (!(round2(n.netAmount) > 0)) {
    return 'The note\'s net amount must be more than zero to post its cash to Cash Balance.';
  }
  return null;
}

const entryType = (noteType: NoteCash['noteType']) => (noteType === 'Buy' ? 'Deduction' : 'Addition');

/** The entry a processed note posts: on its settlement date, to the account its transaction states. */
export function noteLedgerEntry(
  n: NoteCash,
  bankId: string | null,
  openingBalance: number,
  createdBy: string,
): cashLedgerRepo.CashLedgerInsert {
  const amount = round2(n.netAmount);
  const type = entryType(n.noteType);
  return {
    type,
    description: n.description,
    code: n.code,
    amount,
    date: tradeLedgerDate({ settlement_date: n.settlementDate }) ?? '',
    running_balance: round2(openingBalance + (type === 'Addition' ? amount : -amount)),
    on_hold_amount: 0,
    source: 'Trade',
    entity_id: n.entityId,
    bank_id: bankId,
    reference_id: n.noteId,
    created_by: createdBy,
    notes: n.notes,
  };
}

/** Post a processed note's cash, once. Returns the entry. */
export async function postNoteCash(n: NoteCash, actor: NoteCashActor): Promise<{ id: string }> {
  const problem = noteCashProblem(n);
  if (problem) throw new Error(problem);

  const existing = await cashLedgerRepo.listByReference(n.noteId);
  if (existing.length > 0) return { id: existing[0].id };

  const transaction = n.transactionId ? await transactionsRepo.getById(n.transactionId) : null;
  const rows = (await cashLedgerRepo.listForEntity(n.entityId))
    .map(r => ({ entity_id: r.entity_id, type: r.type, amount: Number(r.amount) }));
  const entry = noteLedgerEntry(n, transaction?.bank_id ?? null, entityRunningBalance(rows, n.entityId), actor.createdBy);
  const { id } = await cashLedgerRepo.insert(entry);
  void logAudit({ tableName: 'cash_balance_ledger', recordId: id, action: 'CREATE', performedBy: actor.performedBy, newValues: entry, entityId: n.entityId });
  return { id };
}

/** What a processed note's entry must change to match the note, or null when nothing differs. */
export function noteEntryChanges(
  entry: Pick<cashLedgerRepo.ReferencedEntryRow, 'type' | 'amount' | 'date'>,
  n: Pick<NoteCash, 'noteType' | 'netAmount' | 'settlementDate'>,
): cashLedgerRepo.CashLedgerUpdate | null {
  const changes: cashLedgerRepo.CashLedgerUpdate = {};
  const type = entryType(n.noteType);
  const date = tradeLedgerDate({ settlement_date: n.settlementDate });
  if (entry.type !== type) changes.type = type;
  if (cents(entry.amount) !== cents(n.netAmount)) changes.amount = round2(n.netAmount);
  if (date && entry.date.slice(0, 10) !== date) changes.date = date;
  return Object.keys(changes).length > 0 ? changes : null;
}

/** The note columns the edit form writes. */
export type NoteEdit = Record<string, unknown> & {
  note_type: NoteCash['noteType'];
  net_amount: number | null;
  settlement_date: string | null;
};

export type SaveNoteEditResult =
  | { saved: false; problem: string }
  | { saved: true; cashError: string | null };

/**
 * Save an edit to a note and bring its cash entry in line: type, net amount and
 * settlement date. A note with an entry cannot be saved into a state whose cash
 * could not be posted; nothing is written then.
 */
export async function saveNoteEdit(noteId: string, values: NoteEdit, performedBy: string): Promise<SaveNoteEditResult> {
  const entries = await cashLedgerRepo.listByReference(noteId);
  const target = { noteType: values.note_type, netAmount: Number(values.net_amount) || 0, settlementDate: values.settlement_date };
  if (entries.length > 0) {
    const problem = noteCashProblem(target);
    if (problem) return { saved: false, problem };
  }

  const before = await notesRepo.getById(noteId);
  await notesRepo.update(noteId, values);
  void logAudit({ tableName: 'buy_sell_notes', recordId: noteId, action: 'UPDATE', oldValues: before, newValues: values, performedBy });

  try {
    for (const entry of entries) {
      const changes = noteEntryChanges(entry, target);
      if (!changes) continue;
      await cashLedgerRepo.update(entry.id, changes);
      const oldValues = Object.fromEntries(Object.keys(changes).map(k => [k, entry[k as keyof typeof entry]]));
      void logAudit({ tableName: 'cash_balance_ledger', recordId: entry.id, action: 'UPDATE', performedBy, oldValues, newValues: changes, entityId: entry.entity_id });
    }
    return { saved: true, cashError: null };
  } catch (err) {
    return { saved: true, cashError: errorMessage(err) };
  }
}

/**
 * Delete a note, the transaction it settles and its cash entry.
 *
 * No other entry is rewritten: a balance is the sum of the entries, so removing
 * one is the whole change.
 */
export async function deleteNote(noteId: string, performedBy: string): Promise<void> {
  const note = await notesRepo.getById(noteId);
  if (!note) throw new Error('This note no longer exists.');
  const entries = await cashLedgerRepo.listByReference(noteId);
  const transaction = note.transaction_id ? await transactionsRepo.getById(note.transaction_id) : null;

  await notesRepo.remove(noteId);
  void logAudit({ tableName: 'buy_sell_notes', recordId: noteId, action: 'DELETE', oldValues: note, performedBy });

  if (transaction) {
    await transactionsRepo.remove(transaction.id);
    void logAudit({ tableName: 'transactions', recordId: transaction.id, action: 'DELETE', oldValues: transaction, performedBy });
  }

  for (const entry of entries) {
    await cashLedgerRepo.remove(entry.id);
    void logAudit({ tableName: 'cash_balance_ledger', recordId: entry.id, action: 'DELETE', oldValues: entry, performedBy, entityId: entry.entity_id });
  }
}
