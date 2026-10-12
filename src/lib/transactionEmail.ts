/**
 * The transaction confirmation email, as data.
 *
 * What `send-transaction-email` renders for a transaction, and what the "Send
 * Transaction Details" dialog previews before it goes. Every value is already
 * formatted for display.
 *
 * Lives in `lib` because three layers read it: the service builds it, the
 * preview component draws it, the hook hands one to the other. It holds no
 * logic -- the shape only.
 *
 * The Edge Function declares the same shape (`TransactionData` in
 * supabase/functions/send-transaction-email). It is a separate deployable and
 * cannot import this; change both together.
 */
export interface TransactionEmailData {
  entity: string;
  transaction_type: string;
  share: string;
  ticker: string;
  transaction_date: string;
  cds_acc_type: string;
  cds_acc_no: string;
  order_type: string;
  no_of_shares: string;
  gross_price_per_share: string;
  net_price_per_share: string;
  total_amount: string;
  broker_name: string;
  brokerage_fee_type: string;
  brokerage_fee_rate: string;
  /** Total fees -- what the email labels "Total Fees". */
  brokerage_fee: string;
  /** The brokerage part of the fees alone -- labelled "Brokerage Fee". */
  brokerage_fee_component: string;
  cse_fee: string;
  cds_fee: string;
  clearing_fee: string;
  sec_cess: string;
  share_transaction_levy: string;
  bank_name: string;
  bank_acc_no: string;
  note?: string;
}
