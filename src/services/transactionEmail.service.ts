/**
 * What a transaction confirmation email says.
 *
 * Built in three places before this: twice in Transactions (once for the
 * preview, once again inside the send) and once in Transaction Approvals. The
 * Approvals copy had drifted -- it sent no CSE, CDS, clearing, SEC CESS, share
 * levy or brokerage component, so the email printed "LKR undefined" in six
 * cells (the 2026-08-04 test email shows exactly those six), and it found the
 * broker by `transactions.broker_id`, which is null on every row, so it would
 * always have said "Broker: N/A". Both pages build it here now, through
 * `useTransactionEmail`, and send the same email for the same transaction.
 *
 * No React. The broker comes from `resolveTransactionRecipient`, the rule both
 * pages already use for the To address, so the name in the body is the broker
 * the email is addressed to.
 */

import {
  resolveTransactionRecipient,
  resolvedBrokerName,
  type BrokerContact,
  type EntityBrokerLink,
  type RecipientTransaction,
} from '../lib/emailRecipients';
import type { TransactionEmailData } from '../lib/transactionEmail';
import * as feeTypesRepo from '../repositories/brokerageFeeTypes.repo';

type Num = number | string | null | undefined;

/** The columns of a `transactions` row the email reads. */
export interface EmailableTransaction extends RecipientTransaction {
  share_id: string;
  bank_id?: string | null;
  brokerage_fee_type_id?: string | null;
  transaction_type: string;
  transaction_date: string;
  order_type?: string | null;
  no_of_shares: Num;
  price_per_share: Num;
  net_price_per_share: Num;
  total_amount: Num;
  brokerage_fee_rate?: Num;
  /** Total fees. */
  fees?: Num;
  brokerage_fee?: Num;
  cse_fee?: Num;
  cds_fee?: Num;
  clearing_fee?: Num;
  sec_cess?: Num;
  share_transaction_levy?: Num;
}

/** An `entity_brokers` row, with the columns the email reads. */
export interface EmailEntityBroker extends EntityBrokerLink {
  relationship_type?: string | null;
  bank_account_number?: string | null;
  broker_text?: string | null;
}

/** The lists the email resolves names from. */
export interface TransactionEmailLookups<B extends BrokerContact, L extends EmailEntityBroker> {
  entities: { id: string; name: string }[];
  shares: { id: string; share_name?: string | null; ticker?: string | null }[];
  banks: { id: string; name?: string | null; account_number?: string | null }[];
  brokers: B[];
  entityBrokers: L[];
  feeTypes: feeTypesRepo.FeeTypeNameRow[];
}

const money = (v: Num) =>
  (Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
const price = (v: Num) =>
  (Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });

export function transactionEmailData<B extends BrokerContact, L extends EmailEntityBroker>(
  transaction: EmailableTransaction,
  lookups: TransactionEmailLookups<B, L>,
  note?: string,
): TransactionEmailData {
  const entity = lookups.entities.find(e => e.id === transaction.entity_id);
  const share = lookups.shares.find(s => s.id === transaction.share_id);
  const bank = transaction.bank_id ? lookups.banks.find(b => b.id === transaction.bank_id) : null;
  const feeType = transaction.brokerage_fee_type_id
    ? lookups.feeTypes.find(ft => ft.id === transaction.brokerage_fee_type_id)
    : null;

  const resolved = resolveTransactionRecipient(transaction, lookups.entityBrokers, lookups.brokers);
  const { entityBroker } = resolved;

  const brokerName = resolvedBrokerName(resolved) ?? 'N/A';

  return {
    entity: entity?.name || 'N/A',
    transaction_type: transaction.transaction_type,
    share: share?.share_name || 'N/A',
    ticker: share?.ticker || 'N/A',
    transaction_date: new Date(transaction.transaction_date).toLocaleDateString(),
    cds_acc_type: entityBroker?.relationship_type || 'N/A',
    cds_acc_no: transaction.cds_account_id || entityBroker?.custodian_account_number || 'N/A',
    order_type: transaction.order_type || 'N/A',
    no_of_shares: (Number(transaction.no_of_shares) || 0).toLocaleString(),
    gross_price_per_share: price(transaction.price_per_share),
    net_price_per_share: price(transaction.net_price_per_share),
    total_amount: money(transaction.total_amount),
    broker_name: brokerName,
    brokerage_fee_type: feeType?.name || 'N/A',
    brokerage_fee_rate: transaction.brokerage_fee_rate ? `${transaction.brokerage_fee_rate}%` : 'N/A',
    brokerage_fee: money(transaction.fees),
    brokerage_fee_component: money(transaction.brokerage_fee),
    cse_fee: money(transaction.cse_fee),
    cds_fee: money(transaction.cds_fee),
    clearing_fee: money(transaction.clearing_fee),
    sec_cess: money(transaction.sec_cess),
    share_transaction_levy: money(transaction.share_transaction_levy),
    bank_name: bank?.name || 'N/A',
    bank_acc_no: entityBroker?.bank_account_number || bank?.account_number || 'N/A',
    ...(note ? { note } : {}),
  };
}

/** Fee tier names, for the "Brokerage Fee Type" line. */
export function loadFeeTypeNames(): Promise<feeTypesRepo.FeeTypeNameRow[]> {
  return feeTypesRepo.listNames();
}
