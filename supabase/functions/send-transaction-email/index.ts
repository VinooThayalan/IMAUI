import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import nodemailer from "npm:nodemailer@6.9.13";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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

interface ApprovalNotificationData {
  action: "APPROVED" | "REJECTED";
  contract_no: string;
  note_type: "Buy" | "Sell";
  entity_name: string;
  share_name: string;
  ticker: string;
  no_of_shares: string;
  price_avg: string;
  gross_amount: string;
  brokerage: string;
  net_amount: string;
  trade_date: string;
  settlement_date: string;
  broker_name: string;
  dealer_name?: string;
  remarks?: string;
  approval_notes?: string;
  reviewed_by: string;
  reviewed_at: string;
  txn_no_of_shares?: string;
  txn_price_per_share?: string;
  txn_total_amount?: string;
}

function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) throw new Error("Missing Supabase env vars");
  return createClient(url, serviceKey);
}

async function logEmail(params: {
  to: string;
  cc: string[] | undefined;
  subject: string;
  html: string;
  status: "sent" | "failed";
  errorMessage?: string;
  triggeredBy?: string;
  source?: string;
  emailType?: string;
}) {
  try {
    const supabase = getSupabaseClient();
    await supabase.from("email_logs").insert({
      to_email: params.to,
      cc_emails: params.cc && params.cc.length > 0 ? params.cc : null,
      subject: params.subject,
      html_content: params.html,
      status: params.status,
      error_message: params.errorMessage || null,
      triggered_by: params.triggeredBy || null,
      source: params.source || null,
      email_type: params.emailType || null,
    });
  } catch (err) {
    console.error("Failed to log email:", err);
  }
}

function createTransport() {
  const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
  if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY not set");

  return nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: {
      user: "af3070001@smtp-brevo.com",
      pass: BREVO_API_KEY,
    },
  });
}

async function sendEmail(to: string, cc: string[] | undefined, subject: string, html: string): Promise<boolean> {
  try {
    const transporter = createTransport();
    await transporter.sendMail({
      from: '"Portfolio Manager" <noreply@imametrocorp.com>',
      to,
      cc: cc && cc.length > 0 ? cc.join(", ") : undefined,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error("SMTP error:", err);
    return false;
  }
}

function buildApprovalHtml(data: ApprovalNotificationData): string {
  const isApproved = data.action === "APPROVED";
  const actionColor = isApproved ? "#16a34a" : "#dc2626";
  const actionBg = isApproved ? "#dcfce7" : "#fee2e2";
  const actionBorder = isApproved ? "#86efac" : "#fca5a5";
  const actionLabel = isApproved ? "APPROVED" : "REJECTED";
  const noteTypeColor = data.note_type === "Buy" ? "#16a34a" : "#dc2626";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Contract Note ${actionLabel}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 680px; margin: 0 auto; padding: 24px; background: #f9fafb;">
  <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background: #1e293b; padding: 24px 32px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 20px; font-weight: 700; letter-spacing: -0.3px;">Portfolio Management System</h1>
      <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 13px;">Contract Note Review Notification</p>
    </div>

    <!-- Action Banner -->
    <div style="background: ${actionBg}; border-bottom: 2px solid ${actionBorder}; padding: 16px 32px; display: flex; align-items: center;">
      <div>
        <p style="margin: 0; font-size: 18px; font-weight: 700; color: ${actionColor};">
          Contract Note ${actionLabel}
        </p>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #374151;">
          Reviewed by <strong>${data.reviewed_by}</strong> on ${data.reviewed_at}
        </p>
      </div>
    </div>

    <div style="padding: 28px 32px;">

      <!-- Contract Reference -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b;">Contract Reference</p>
        <p style="margin: 0; font-size: 22px; font-weight: 700; color: #0f172a; font-family: monospace;">${data.contract_no}</p>
        <div style="margin-top: 8px; display: inline-block; padding: 3px 10px; border-radius: 9999px; background: ${noteTypeColor}20; color: ${noteTypeColor}; font-size: 12px; font-weight: 700;">${data.note_type}</div>
      </div>

      <!-- Transaction Details -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background: #f1f5f9;">
          <td colspan="2" style="padding: 8px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b;">Transaction Details</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 12px; font-size: 13px; font-weight: 600; color: #475569; width: 180px;">Entity</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #0f172a;">${data.entity_name}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9; background: #fafafa;">
          <td style="padding: 10px 12px; font-size: 13px; font-weight: 600; color: #475569;">Security</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #0f172a;">${data.share_name} <span style="font-family: monospace; color: #64748b; font-size: 12px;">(${data.ticker})</span></td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 12px; font-size: 13px; font-weight: 600; color: #475569;">Shares</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #0f172a;">${data.no_of_shares} @ Rs. ${data.price_avg}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9; background: #fafafa;">
          <td style="padding: 10px 12px; font-size: 13px; font-weight: 600; color: #475569;">Trade Date</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #0f172a;">${data.trade_date}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 12px; font-size: 13px; font-weight: 600; color: #475569;">Settlement Date</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #0f172a;">${data.settlement_date}</td>
        </tr>
        ${data.dealer_name ? `<tr style="border-bottom: 1px solid #f1f5f9; background: #fafafa;"><td style="padding: 10px 12px; font-size: 13px; font-weight: 600; color: #475569;">Dealer</td><td style="padding: 10px 12px; font-size: 13px; color: #0f172a;">${data.dealer_name}</td></tr>` : ""}
      </table>

      <!-- Financial Summary -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background: #f1f5f9;">
          <td colspan="2" style="padding: 8px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b;">Financial Summary</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 12px; font-size: 13px; font-weight: 600; color: #475569; width: 180px;">Gross Amount</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #0f172a; font-family: monospace;">Rs. ${data.gross_amount}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9; background: #fafafa;">
          <td style="padding: 10px 12px; font-size: 13px; font-weight: 600; color: #475569;">Brokerage & Fees</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #0f172a; font-family: monospace;">Rs. ${data.brokerage}</td>
        </tr>
        <tr style="background: #0f172a;">
          <td style="padding: 12px; font-size: 14px; font-weight: 700; color: white;">Net Amount</td>
          <td style="padding: 12px; font-size: 16px; font-weight: 700; color: white; font-family: monospace;">Rs. ${data.net_amount}</td>
        </tr>
      </table>

      ${!isApproved && (data.txn_no_of_shares || data.txn_price_per_share || data.txn_total_amount) ? `
      <!-- Value Comparison -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background: #7f1d1d;">
          <td colspan="3" style="padding: 8px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #fecaca;">Value Discrepancy — System vs Contract Note</td>
        </tr>
        <tr style="background: #f1f5f9;">
          <td style="padding: 8px 12px; font-size: 11px; font-weight: 700; color: #64748b; width: 180px;">Field</td>
          <td style="padding: 8px 12px; font-size: 11px; font-weight: 700; color: #1d4ed8;">System (Transaction)</td>
          <td style="padding: 8px 12px; font-size: 11px; font-weight: 700; color: #b91c1c;">Broker Note</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 12px; font-size: 13px; font-weight: 600; color: #475569;">No. of Shares</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #1d4ed8; font-family: monospace;">${data.txn_no_of_shares || "-"}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #b91c1c; font-family: monospace;">${data.no_of_shares}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9; background: #fafafa;">
          <td style="padding: 10px 12px; font-size: 13px; font-weight: 600; color: #475569;">Price per Share</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #1d4ed8; font-family: monospace;">Rs. ${data.txn_price_per_share || "-"}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #b91c1c; font-family: monospace;">Rs. ${data.price_avg}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 12px; font-size: 13px; font-weight: 600; color: #475569;">Gross Amount</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #1d4ed8; font-family: monospace;">Rs. ${data.txn_total_amount || "-"}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #b91c1c; font-family: monospace;">Rs. ${data.gross_amount}</td>
        </tr>
        <tr style="background: #fafafa;">
          <td style="padding: 10px 12px; font-size: 13px; font-weight: 600; color: #475569;">Net Amount</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #64748b; font-family: monospace;">—</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #b91c1c; font-family: monospace;">Rs. ${data.net_amount}</td>
        </tr>
      </table>` : ""}

      ${data.approval_notes ? `
      <!-- Review Notes -->
      <div style="background: ${isApproved ? "#f0fdf4" : "#fef2f2"}; border-left: 4px solid ${actionColor}; border-radius: 4px; padding: 14px 16px; margin-bottom: 20px;">
        <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: ${actionColor};">${isApproved ? "Approval Notes" : "Rejection Reason"}</p>
        <p style="margin: 0; font-size: 14px; color: #1f2937;">${data.approval_notes}</p>
      </div>` : ""}

      ${data.remarks ? `
      <!-- Original Remarks -->
      <div style="background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 14px 16px; margin-bottom: 20px;">
        <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #92400e;">Original Remarks</p>
        <p style="margin: 0; font-size: 14px; color: #1f2937;">${data.remarks}</p>
      </div>` : ""}

    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 32px; text-align: center;">
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">This is an automated notification from Portfolio Management System.</p>
    </div>
  </div>
</body>
</html>`;
}

function buildTransactionHtml(transaction: TransactionData): string {
  const typeColor = transaction.transaction_type === "BUY" ? "#10b981" : "#ef4444";
  const typeLabel = transaction.transaction_type === "BUY" ? "Purchase" : "Sale";

  const noteSection = transaction.note
    ? `<div style="margin-top: 24px; padding: 16px; background-color: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 4px;">
    <p style="margin: 0 0 6px 0; font-weight: 600; color: #92400e; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Note</p>
    <p style="margin: 0; color: #1f2937; font-size: 15px; white-space: pre-wrap;">${transaction.note}</p>
  </div>`
    : "";

  return `<!DOCTYPE html>
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
  <div class="footer"><p>This is an automated email containing transaction details.</p></div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const triggeredBy = body.triggered_by || null;
    const source = body.source || null;

    // Approval/rejection notification path
    if (body.type === "approval_notification") {
      const { to, cc, notification } = body as {
        to: string;
        cc?: string[];
        notification: ApprovalNotificationData;
      };

      if (!to || !notification) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const actionLabel = notification.action === "APPROVED" ? "Approved" : "Rejected";
      const subject = `Contract Note ${actionLabel}: ${notification.contract_no} — ${notification.note_type} ${notification.ticker}`;
      const html = buildApprovalHtml(notification);

      const sent = await sendEmail(to, cc, subject, html);

      await logEmail({
        to,
        cc,
        subject,
        html,
        status: sent ? "sent" : "failed",
        errorMessage: sent ? undefined : "SMTP send failed — see edge function logs",
        triggeredBy,
        source,
        emailType: "approval_notification",
      });

      console.log(`Approval notification (${notification.action}) for ${notification.contract_no} → ${to}`);

      return new Response(
        JSON.stringify({ success: true, sent, to, cc: cc || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Legacy transaction email path
    const { to, cc, transaction } = body as { to: string; cc?: string[]; transaction: TransactionData };

    if (!to || !transaction) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subject = `Transaction Details — ${transaction.transaction_type} ${transaction.ticker}`;
    const html = buildTransactionHtml(transaction);
    const sent = await sendEmail(to, cc, subject, html);

    await logEmail({
      to,
      cc,
      subject,
      html,
      status: sent ? "sent" : "failed",
      errorMessage: sent ? undefined : "SMTP send failed — see edge function logs",
      triggeredBy,
      source,
      emailType: "transaction",
    });

    console.log(`Transaction email to: ${to}${cc?.length ? ` CC: ${cc.join(", ")}` : ""}`);

    return new Response(
      JSON.stringify({ success: true, sent, to, cc: cc || [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error processing email request:", error);

    // Attempt to log the failure if we have enough info
    try {
      const body = await req.clone().json();
      if (body.to) {
        await logEmail({
          to: body.to,
          cc: body.cc,
          subject: body.type === "approval_notification"
            ? `Contract Note: ${body.notification?.contract_no || "Unknown"}`
            : `Transaction Details — ${body.transaction?.transaction_type || ""} ${body.transaction?.ticker || ""}`,
          html: "",
          status: "failed",
          errorMessage: error.message || "Internal server error",
          triggeredBy: body.triggered_by || null,
          source: body.source || null,
          emailType: body.type || "transaction",
        });
      }
    } catch (logErr) {
      console.error("Failed to log error email:", logErr);
    }

    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
