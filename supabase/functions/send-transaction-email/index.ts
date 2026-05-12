import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TransactionData {
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
  brokerage_fee: string;
  bank_name: string;
  bank_acc_no: string;
  note?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { to, cc, transaction } = await req.json() as { to: string; cc?: string[]; transaction: TransactionData };

    if (!to || !transaction) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const typeColor = transaction.transaction_type === 'BUY' ? '#10b981' : '#ef4444';
    const typeLabel = transaction.transaction_type === 'BUY' ? 'Purchase' : 'Sale';

    const noteSection = transaction.note
      ? `
  <div style="margin-top: 24px; padding: 16px; background-color: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 4px;">
    <p style="margin: 0 0 6px 0; font-weight: 600; color: #92400e; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Note</p>
    <p style="margin: 0; color: #1f2937; font-size: 15px; white-space: pre-wrap;">${transaction.note}</p>
  </div>`
      : '';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Transaction Details</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px; }
    .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 24px; text-align: center; }
    .header h1 { margin: 0; color: #1f2937; font-size: 22px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    tr { border-bottom: 1px solid #e5e7eb; }
    td { padding: 10px 8px; }
    td:first-child { font-weight: 600; color: #4b5563; width: 200px; font-size: 14px; }
    td:last-child { color: #1f2937; font-size: 14px; }
    .highlight { background-color: #d1fae5; color: #065f46; font-weight: 600; }
    .type-badge { display: inline-block; padding: 3px 12px; border-radius: 9999px; font-weight: 600; color: white; background-color: ${typeColor}; font-size: 13px; }
    .section-header { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #9ca3af; padding: 10px 8px 4px; border-bottom: 2px solid #f3f4f6; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 13px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Transaction Details</h1>
    <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;">Generated on ${new Date().toLocaleString()}</p>
  </div>

  <table>
    <tr class="section-header"><td colspan="2">Transaction</td></tr>
    <tr><td>Entity</td><td>${transaction.entity}</td></tr>
    <tr><td>Transaction Type</td><td><span class="type-badge">${typeLabel}</span></td></tr>
    <tr><td>Share</td><td>${transaction.ticker} — ${transaction.share}</td></tr>
    <tr><td>Transaction Date</td><td>${transaction.transaction_date}</td></tr>
    <tr><td>Order Type</td><td>${transaction.order_type}</td></tr>
    <tr><td>No. of Shares</td><td>${transaction.no_of_shares}</td></tr>

    <tr class="section-header"><td colspan="2">Pricing</td></tr>
    <tr><td>Gross Price Per Share</td><td class="highlight">LKR ${transaction.gross_price_per_share}</td></tr>
    <tr><td>Net Price Per Share</td><td>LKR ${transaction.net_price_per_share}</td></tr>
    <tr><td>Total Amount</td><td><strong>LKR ${transaction.total_amount}</strong></td></tr>

    <tr class="section-header"><td colspan="2">Brokerage</td></tr>
    <tr><td>Broker Name</td><td>${transaction.broker_name}</td></tr>
    <tr><td>Brokerage Fee Type</td><td>${transaction.brokerage_fee_type}</td></tr>
    <tr><td>Brokerage Fee Rate</td><td>${transaction.brokerage_fee_rate}</td></tr>
    <tr><td>Brokerage Fee</td><td>LKR ${transaction.brokerage_fee}</td></tr>

    <tr class="section-header"><td colspan="2">Settlement</td></tr>
    <tr><td>CDS Account Type</td><td class="highlight">${transaction.cds_acc_type}</td></tr>
    <tr><td>CDS Account No.</td><td class="highlight">${transaction.cds_acc_no}</td></tr>
    <tr><td>Bank Name</td><td class="highlight">${transaction.bank_name}</td></tr>
    <tr><td>Bank Account No.</td><td class="highlight">${transaction.bank_acc_no}</td></tr>
  </table>

  ${noteSection}

  <div class="footer">
    <p>This is an automated email containing transaction details.</p>
  </div>
</body>
</html>
    `;

    console.log(`Sending transaction email to: ${to}${cc?.length ? ` CC: ${cc.join(', ')}` : ''}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email would be sent in production",
        to,
        cc: cc || [],
        preview: "In production, this would send via your email service (SendGrid, Resend, etc.)"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error processing email request:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
