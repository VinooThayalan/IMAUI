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
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { to, transaction } = await req.json() as { to: string; transaction: TransactionData };

    if (!to || !transaction) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const typeColor = transaction.transaction_type === 'BUY' ? '#10b981' : '#ef4444';
    const typeLabel = transaction.transaction_type === 'BUY' ? 'Purchase' : 'Sale';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Transaction Details</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      color: #1f2937;
      font-size: 24px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    tr {
      border-bottom: 1px solid #e5e7eb;
    }
    td {
      padding: 12px 8px;
    }
    td:first-child {
      font-weight: 600;
      color: #4b5563;
      width: 200px;
    }
    td:last-child {
      color: #1f2937;
    }
    .highlight {
      background-color: #d1fae5;
      color: #065f46;
      font-weight: 600;
    }
    .type-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-weight: 600;
      color: white;
      background-color: ${typeColor};
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Transaction Details</h1>
    <p style="margin: 10px 0 0 0; color: #6b7280;">Generated on ${new Date().toLocaleString()}</p>
  </div>

  <table>
    <tr>
      <td>Entity</td>
      <td>${transaction.entity}</td>
    </tr>
    <tr>
      <td>Transaction Type</td>
      <td><span class="type-badge">${typeLabel}</span></td>
    </tr>
    <tr>
      <td>Share</td>
      <td>${transaction.ticker} - ${transaction.share}</td>
    </tr>
    <tr>
      <td>Transaction Date</td>
      <td>${transaction.transaction_date}</td>
    </tr>
    <tr>
      <td>CDS Acc Type</td>
      <td class="highlight">${transaction.cds_acc_type}</td>
    </tr>
    <tr>
      <td>CDS Acc No.</td>
      <td class="highlight">${transaction.cds_acc_no}</td>
    </tr>
    <tr>
      <td>Order Type</td>
      <td>${transaction.order_type}</td>
    </tr>
    <tr>
      <td>No. of Shares</td>
      <td>${transaction.no_of_shares}</td>
    </tr>
    <tr>
      <td>Gross Price Per Share</td>
      <td class="highlight">LKR ${transaction.gross_price_per_share}</td>
    </tr>
    <tr>
      <td>Net Price Per Share</td>
      <td>LKR ${transaction.net_price_per_share}</td>
    </tr>
    <tr>
      <td>Total Amount</td>
      <td><strong>LKR ${transaction.total_amount}</strong></td>
    </tr>
    <tr>
      <td>Broker Name</td>
      <td>${transaction.broker_name}</td>
    </tr>
    <tr>
      <td>Brokerage Fee Type</td>
      <td>${transaction.brokerage_fee_type}</td>
    </tr>
    <tr>
      <td>Brokerage Fee Rate</td>
      <td>${transaction.brokerage_fee_rate}</td>
    </tr>
    <tr>
      <td>Brokerage Fee</td>
      <td>LKR ${transaction.brokerage_fee}</td>
    </tr>
    <tr>
      <td>CDS Acc Type</td>
      <td class="highlight">${transaction.cds_acc_type}</td>
    </tr>
    <tr>
      <td>CDS Acc No.</td>
      <td class="highlight">${transaction.cds_acc_no}</td>
    </tr>
    <tr>
      <td>Bank Name</td>
      <td class="highlight">${transaction.bank_name}</td>
    </tr>
    <tr>
      <td>Bank Acc No.</td>
      <td class="highlight">${transaction.bank_acc_no}</td>
    </tr>
    <tr>
      <td>Gross Price Per Share</td>
      <td class="highlight">LKR ${transaction.gross_price_per_share}</td>
    </tr>
  </table>

  <div class="footer">
    <p>This is an automated email containing transaction details.</p>
    <p>Please do not reply to this email.</p>
  </div>
</body>
</html>
    `;

    console.log(`Sending transaction email to: ${to}`);
    console.log(`Transaction: ${transaction.entity} - ${transaction.transaction_type} - ${transaction.share}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email would be sent in production",
        to: to,
        preview: "In production, this would send via your email service (SendGrid, Resend, etc.)"
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error("Error processing email request:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
