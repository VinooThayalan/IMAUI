/** Contract note review: the transactions notes belong to, and who a note's parties are (bug-56). */

import * as entityBrokersRepo from '../repositories/entityBrokers.repo';
import * as transactionsRepo from '../repositories/transactions.repo';

export type NoteReviewTransaction = transactionsRepo.NoteReviewTransactionRow;
export type EntityAccount = entityBrokersRepo.EntityAccountRow;

export function loadNoteReviewTransactions(): Promise<NoteReviewTransaction[]> {
  return transactionsRepo.listForNoteReview();
}

export function loadEntityAccounts(): Promise<EntityAccount[]> {
  return entityBrokersRepo.listAccounts();
}

/** Account numbers compared without spacing or hyphens: "SBL - 4328 -LC/00" is "SBL-4328-LC/00". */
const accountKey = (n: string) => n.replace(/[\s-]/g, '').toUpperCase();

export interface NoteParties {
  /** The CDS account the trade was booked to. */
  clientAccount: string | null;
  /** The account's recorded name, else the entity's. */
  clientName: string | null;
  /** The custodian bank, when recorded. */
  clientBank: string | null;
  /** The entity's account with the note's broker, when they are linked. */
  brokerAccount: string | null;
  /** The transaction's broker, when it is not the note's. */
  transactionBroker: string | null;
}

export function noteParties(
  note: { broker_id?: string | null },
  txn: { entity_id: string; cds_account_id?: string | null; broker_id?: string | null } | null,
  entityName: string | null,
  brokers: { id: string; broker_name: string }[],
  accounts: Pick<EntityAccount, 'entity_id' | 'broker_id' | 'broker_account_number' | 'custodian_account_number' | 'custodian_account_name' | 'bank_name'>[],
): NoteParties {
  const own = txn ? accounts.filter(a => a.entity_id === txn.entity_id) : [];
  const brokerLink = note.broker_id ? own.find(a => a.broker_id === note.broker_id) ?? null : null;
  const number = txn?.cds_account_id || null;
  const record = number
    ? own.find(a => [a.custodian_account_number, a.broker_account_number].some(n => n && accountKey(n) === accountKey(number))) ?? null
    : null;
  const differs = !!txn?.broker_id && txn.broker_id !== note.broker_id;
  return {
    clientAccount: number,
    clientName: record?.custodian_account_name?.trim() || entityName,
    clientBank: record?.bank_name || null,
    brokerAccount: brokerLink?.broker_account_number || null,
    transactionBroker: differs ? brokers.find(b => b.id === txn!.broker_id)?.broker_name ?? null : null,
  };
}
