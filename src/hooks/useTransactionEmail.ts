/**
 * The transaction confirmation email, for the pages that send one.
 *
 * Transactions and Transaction Approvals both send this email, and each built
 * it its own way until they drifted (see transactionEmail.service). They pass
 * the lists they have loaded; this loads the fee-tier names, which Approvals
 * never had, and returns the one builder both now use for the preview and the
 * send.
 */

import { useEffect, useState } from 'react';
import type { BrokerContact } from '../lib/emailRecipients';
import type { TransactionEmailData } from '../lib/transactionEmail';
import { deliverEmail } from '../services/emailDelivery.service';
import {
  loadFeeTypeNames,
  transactionEmailData,
  type EmailableTransaction,
  type EmailEntityBroker,
  type TransactionEmailLookups,
} from '../services/transactionEmail.service';

type FeeTypeNames = TransactionEmailLookups<BrokerContact, EmailEntityBroker>['feeTypes'];

export function useTransactionEmail<B extends BrokerContact, L extends EmailEntityBroker>(
  lookups: Omit<TransactionEmailLookups<B, L>, 'feeTypes'>,
): (transaction: EmailableTransaction, note?: string) => TransactionEmailData {
  const [feeTypes, setFeeTypes] = useState<FeeTypeNames>([]);

  useEffect(() => {
    let cancelled = false;
    loadFeeTypeNames()
      .then(rows => { if (!cancelled) setFeeTypes(rows); })
      .catch(err => console.error('Error loading brokerage fee types:', err));
    return () => { cancelled = true; };
  }, []);

  return (transaction, note) => transactionEmailData(transaction, { ...lookups, feeTypes }, note);
}

/** Sends through the email function: one retry after a refused sign-in, and a reason when not sent. */
export function useEmailDelivery(): typeof deliverEmail {
  return deliverEmail;
}
