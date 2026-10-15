import type { TransactionEmailData } from '../lib/transactionEmail';
import { EmailHeadline } from './EmailHeadline';

/**
 * The transaction data at the top of the "Send Transaction Details" dialog --
 * what the email will say.
 *
 * Transactions and Transaction Approvals each drew their own copy, and the
 * Approvals one had lost six fee rows and "Brokerage Fee Type", so it previewed
 * less than its email sent. One component now, with the fields in the order
 * `send-transaction-email` lays them out.
 *
 * The entity is labelled and set in the body weight (bug-52). It was a small
 * grey name in the corner, here and in the email, and a broker reading an
 * email about one of several clients could not tell whose trade it was.
 */

/** Highlighted rows, as the email highlights them. */
const KEY_FIELDS = new Set([
  'Gross Price / Share', 'Total Amount', 'CDS Acc Type', 'CDS Acc No.', 'Bank Name', 'Bank Acc No.', 'Total Fees',
]);

export function TransactionEmailPreview({ data, note }: { data: TransactionEmailData; note?: string }) {
  const fields: [string, string][] = [
    ['Transaction Date', data.transaction_date],
    ['Order Type', data.order_type],
    ['No. of Shares', data.no_of_shares],
    ['Gross Price / Share', `LKR ${data.gross_price_per_share}`],
    ['Net Price / Share', `LKR ${data.net_price_per_share}`],
    ['Total Amount', `LKR ${data.total_amount}`],
    ['CDS Acc Type', data.cds_acc_type],
    ['CDS Acc No.', data.cds_acc_no],
    ['Broker', data.broker_name],
    ['Brokerage Fee Type', data.brokerage_fee_type],
    ['Brokerage Fee Rate', data.brokerage_fee_rate],
    ['Brokerage Fee', `LKR ${data.brokerage_fee_component}`],
    ['CSE Fees', `LKR ${data.cse_fee}`],
    ['CDS Fees', `LKR ${data.cds_fee}`],
    ['Clearing Fees', `LKR ${data.clearing_fee}`],
    ['SEC CESS', `LKR ${data.sec_cess}`],
    ['Share Trans. Levy', `LKR ${data.share_transaction_levy}`],
    ['Total Fees', `LKR ${data.brokerage_fee}`],
    ['Bank Name', data.bank_name],
    ['Bank Acc No.', data.bank_acc_no],
  ];

  return (
    <>
      {/* Type badge + share headline + entity */}
      <div className="mb-3">
        <EmailHeadline type={data.transaction_type} ticker={data.ticker} share={data.share} entity={data.entity} />
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-0 border border-gray-200 rounded-lg overflow-hidden">
        {fields.map(([label, value], i) => {
          const isKey = KEY_FIELDS.has(label);
          return (
            <div key={label} className={`flex items-center justify-between px-3 py-1.5 border-b border-gray-100 ${isKey ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
              <span className={`text-xs font-medium ${isKey ? 'text-blue-700' : 'text-gray-500'}`}>{label}</span>
              <span className={`text-xs font-semibold ${isKey ? 'text-blue-900' : 'text-gray-800'} tabular-nums`}>{value}</span>
            </div>
          );
        })}
      </div>

      {note && (
        <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs font-semibold text-amber-700 mb-0.5">Note</p>
          <p className="text-xs text-amber-800 whitespace-pre-line">{note}</p>
        </div>
      )}
    </>
  );
}
