/**
 * The two broker emails Buy & Sell Note Approvals sends.
 *
 * They lived side by side in the page and answered the same question two ways.
 * The comparison email CC'd whatever the dialog's CC row held, resolved through
 * `entityCcAddresses` — all three slots, deduplicated, checked against the To
 * line. The review notification pushed `entity.cc_email` and nothing else:
 *
 *   sendBrokerComparisonEmail   ccForSend(broker, dialog CC)      3 slots
 *   sendBrokerNotification      if (entity.cc_email) push(it)     slot 1 only
 *
 * So an entity with three CC addresses had two of them mailed on a query and
 * dropped on the approval, from the same screen, about the same note. Both now
 * go through `ccForSend`, and who is CC'd has one answer.
 *
 * No React here. The page owns the dialog state; this owns the payload, the
 * recipient rule, and what counts as a failure.
 */

import { ccForSend, entityCcAddresses, type EntityCcContacts } from '../lib/emailRecipients';
import { postTransactionEmail } from '../repositories/transactionEmail.repo';

/** The note fields both emails quote. Optional so the page's own row satisfies it. */
export interface EmailNote {
  note_type: string;
  note_number?: string;
  contract_no?: string;
  broker?: string;
  dealer_name?: string;
  trade_date?: string;
  settlement_date?: string;
  remarks?: string;
  no_of_shares?: number;
  price_avg?: number;
  gross_amount?: number;
  brokerage?: number;
  net_amount?: number;
}

export interface EmailEntity extends EntityCcContacts {
  name: string;
}

export interface EmailShare {
  ticker: string;
  share_name: string;
}

export interface EmailBroker {
  broker_name: string;
  contact_person_name?: string;
  contact_person_email?: string;
  contact_person_designation?: string;
}

export interface EmailTransaction {
  no_of_shares?: number;
  price_per_share?: number;
  total_amount?: number;
  transaction_date?: string;
}

export interface ComparisonRow {
  label: string;
  txnVal: string;
  noteVal: string;
  mismatch?: boolean;
}

/*
  Two dash conventions, kept exactly as they were rather than unified in
  passing. The comparison email renders an em dash, the notification a hyphen.
  Neither is a value standing in for a missing one — both say "nothing
  recorded", which is what a reader has to be able to tell.
*/
const emDashDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const hyphenDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const hyphenNum = (n?: number | null) =>
  n != null ? Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';

export interface ComparisonEmail {
  note: EmailNote;
  entity: EmailEntity | null;
  share: EmailShare | null;
  broker: EmailBroker | null;
  transaction: EmailTransaction | null;
  rows: ComparisonRow[];
  /** What the dialog's CC row holds. Trimmed and checked against To here. */
  cc: string[];
  triggeredBy: string | null;
}

/**
 * The mismatch query sent to a broker. Returns the CC list actually used.
 *
 * Throws rather than returning quietly: the caller reports success to the user
 * straight afterwards, so a silent return was indistinguishable from a send.
 */
export async function sendComparisonEmail(
  { note, entity, share, broker, transaction, rows, cc, triggeredBy }: ComparisonEmail,
): Promise<string[]> {
  const brokerEmail = broker?.contact_person_email;
  if (!brokerEmail) throw new Error('No email address on file for this broker.');

  const ccList = ccForSend(brokerEmail, cc);

  const result = await postTransactionEmail({
    type: 'broker_comparison',
    to: brokerEmail,
    // Absent rather than empty: an empty recipient reaching the send path is a
    // bounce, not a CC.
    cc: ccList.length > 0 ? ccList : undefined,
    triggered_by: triggeredBy,
    source: 'buy-sell-approvals',
    comparison: {
      contract_no: note.contract_no || note.note_number || '—',
      note_type: note.note_type,
      entity_name: entity?.name || '—',
      share_name: share?.share_name || '—',
      ticker: share?.ticker || '—',
      broker_name: broker?.broker_name || note.broker || '—',
      broker_email: brokerEmail,
      contact_person: broker?.contact_person_name || undefined,
      contact_person_designation: broker?.contact_person_designation || undefined,
      rows,
      trade_date_txn: emDashDate(transaction?.transaction_date),
      trade_date_note: emDashDate(note.trade_date),
      settlement_date_note: emDashDate(note.settlement_date),
      remarks: note.remarks || undefined,
    },
  });

  if (!result.ok) {
    throw new Error(
      `Email service returned ${result.status}${result.detail ? `: ${result.detail}` : ''}`,
    );
  }

  return ccList;
}

export interface ReviewNotification {
  note: EmailNote;
  action: 'APPROVED' | 'REJECTED';
  reviewRemarks: string;
  entity: EmailEntity | null;
  share: EmailShare | null;
  broker: EmailBroker | null;
  transaction?: EmailTransaction | null;
  /** Whether the reviewer left the "CC entity email" box checked. */
  withCcEntity: boolean;
  reviewedBy: string | null;
}

export interface NotificationOutcome {
  sent: boolean;
  reason?: string;
  /** Who was CC'd. Empty when nobody was — which is not the same as "not sent". */
  cc: string[];
}

/**
 * The approve/reject notification.
 *
 * Reports its outcome instead of throwing. It runs after the review has already
 * been written, so a throw would land in the caller's catch and tell the user
 * "Could not approve this note" about a note that was approved.
 */
export async function sendReviewNotification(
  { note, action, reviewRemarks, entity, share, broker, transaction, withCcEntity, reviewedBy }: ReviewNotification,
): Promise<NotificationOutcome> {
  const brokerEmail = broker?.contact_person_email;
  if (!brokerEmail) {
    return {
      sent: false,
      reason: broker
        ? `No email address on file for ${broker.broker_name}.`
        : 'This note has no broker on record.',
      cc: [],
    };
  }

  const ccList = withCcEntity ? ccForSend(brokerEmail, entityCcAddresses(entity)) : [];

  const reviewedAt = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  try {
    const result = await postTransactionEmail({
      type: 'approval_notification',
      to: brokerEmail,
      cc: ccList.length > 0 ? ccList : undefined,
      triggered_by: reviewedBy,
      source: 'buy-sell-approvals',
      notification: {
        action,
        contract_no: note.contract_no || note.note_number || '-',
        note_type: note.note_type,
        entity_name: entity?.name || '-',
        share_name: share?.share_name || '-',
        ticker: share?.ticker || '-',
        no_of_shares: note.no_of_shares?.toLocaleString() || '-',
        price_avg: hyphenNum(note.price_avg),
        gross_amount: hyphenNum(note.gross_amount),
        brokerage: hyphenNum(note.brokerage),
        net_amount: hyphenNum(note.net_amount),
        trade_date: hyphenDate(note.trade_date),
        settlement_date: hyphenDate(note.settlement_date),
        broker_name: broker?.broker_name || note.broker || '-',
        dealer_name: note.dealer_name || undefined,
        remarks: note.remarks || undefined,
        approval_notes: reviewRemarks || undefined,
        reviewed_by: reviewedBy || 'Reviewer',
        reviewed_at: reviewedAt,
        // Transaction (system) values for comparison — included on rejections
        txn_no_of_shares: transaction?.no_of_shares != null ? transaction.no_of_shares.toLocaleString() : undefined,
        txn_price_per_share: transaction?.price_per_share != null ? hyphenNum(transaction.price_per_share) : undefined,
        txn_total_amount: transaction?.total_amount != null ? hyphenNum(transaction.total_amount) : undefined,
      },
    });

    if (!result.ok) {
      console.error('Email notification failed:', result.status, result.detail);
      return { sent: false, reason: `Email service returned ${result.status}.`, cc: ccList };
    }
    return { sent: true, cc: ccList };
  } catch (err) {
    console.error('Email notification failed:', err);
    return { sent: false, reason: 'Could not reach the email service.', cc: ccList };
  }
}
