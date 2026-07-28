# Buy & Sale Approvals Page — Complete Email Data Accuracy Analysis

## 1. Page Overview

The Buy & Sale Approvals page (`src/pages/BuyAndSellApprovals.tsx`, 1003 lines) manages the approval workflow for Buy & Sell Contract Notes — documents uploaded by brokers that may contain discrepancies (mismatches) compared to the system's transaction records.

---

## 2. How the Page Works

### Data Loading (lines 107–130)
On mount, it fetches 6 tables in parallel:
- `buy_sell_notes` — the contract notes (primary data)
- `transactions` — system transaction records (for comparison)
- `entities` — client entities (with `cc_email`)
- `shares` — share/ticker info
- `brokers` — broker contacts (with `contact_person_email`)
- `entity_brokers` — linking entities to brokers (account numbers, custodian accounts)

### Filtering & Search (lines 397–409)
Notes are filtered by status (`PENDING_APPROVAL`, `PROCESSED`, `REJECTED`, or `all`) and searched by contract number, entity name, ticker, or broker name.

### Expandable Rows (lines 500–668)
Each note row can be expanded to show:
- Broker details (name, contact person, email, phone)
- Transaction details (share, entity, shares @ price)
- Client account info (broker account, CDS custodian, settlement date)
- Fee breakdown (Gross, Brokerage, SEC, Exchange, CDS, Gov. Levy, Clearing, Net)
- Remarks and approval notes

### Approve/Reject Modals
- **Approve modal** (line 687): Shows cash balance impact, approval notes textarea, and email toggle (send to broker + CC entity email).
- **Reject modal** (line 926): Requires a rejection reason, has the same email toggles.

### Email Comparison Modal (lines 764–923)
A standalone "Email Broker" button opens a comparison modal showing a side-by-side table of Transaction vs Note values for: Shares, Price/Share, Gross Amount, Brokerage, SEC, Exchange, CDS Fees, Gov. Levy, Clearing Fees, Net Amount, Trade Date, Settlement Date. This modal also has a "Send to Broker" button.

---

## 3. Email Data Flow

### sendBrokerNotification Function (lines 183–244)
Constructs a JSON payload and POSTs it to the `send-transaction-email` Supabase Edge Function.

**Payload structure sent to the edge function:**

```json
{
  "type": "approval_notification",
  "to": "<broker contact_person_email>",
  "cc": ["<entity.cc_email>"],
  "triggered_by": "<user email>",
  "source": "buy-sell-approvals",
  "notification": {
    "action": "APPROVED" | "REJECTED",
    "contract_no": "<note.contract_no || note.note_number>",
    "note_type": "Buy" | "Sell",
    "entity_name": "<entity.name>",
    "share_name": "<share.share_name>",
    "ticker": "<share.ticker>",
    "no_of_shares": "<formatted>",
    "price_avg": "<formatted 2 decimals>",
    "gross_amount": "<formatted 2 decimals>",
    "brokerage": "<formatted 2 decimals>",
    "net_amount": "<formatted 2 decimals>",
    "trade_date": "<formatted dd/MMM/yyyy>",
    "settlement_date": "<formatted dd/MMM/yyyy>",
    "broker_name": "<broker.broker_name || note.broker>",
    "dealer_name": "<note.dealer_name>",
    "remarks": "<note.remarks>",
    "approval_notes": "<review remarks>",
    "reviewed_by": "Reviewer",
    "reviewed_at": "<formatted date/time>",
    "txn_no_of_shares": "<transaction.no_of_shares>",
    "txn_price_per_share": "<transaction.price_per_share>",
    "txn_total_amount": "<transaction.total_amount>"
  }
}
```

### Edge Function Processing
The edge function (`supabase/functions/send-transaction-email/index.ts`, 497 lines) handles the `approval_notification` type:

1. Validates that `to` and `notification` are present.
2. Builds an HTML email via `buildApprovalHtml()` using the `ApprovalNotificationData` interface.
3. Sends via Brevo SMTP (nodemailer → `smtp-relay.brevo.com`).
4. Logs the email to the `email_logs` table with `to_email`, `cc_emails`, `subject`, `html_content`, `status`, `error_message`, `triggered_by`, `source`, and `email_type`.

### HTML Email Template Includes
- Header with action banner (APPROVED/REJECTED)
- Contract reference section
- Transaction details table (Entity, Security, Shares, Trade Date, Settlement Date, Dealer)
- Financial summary table (Gross, Brokerage, Net)
- Value Comparison table (only on REJECTION, if transaction data exists) — shows System vs Broker Note for Shares, Price/Share, Gross Amount, Net Amount
- Review Notes / Rejection Reason section
- Original Remarks section

---

## 4. Complete Field-by-Field Comparison: Page vs. Email

### A. Note Fields (`buy_sell_notes` table)

| Field | Displayed on Page | In Email Payload | In Email HTML | Status |
|-------|:-:|:-:|:-:|--------|
| `contract_no` | ✅ | ✅ `contract_no` | ✅ | Accurate |
| `note_number` | ✅ (fallback) | ✅ fallback in `contract_no` | ✅ | Accurate |
| `note_type` (Buy/Sell) | ✅ | ✅ `note_type` | ✅ | Accurate |
| `broker` | ✅ (fallback) | ✅ fallback in `broker_name` | ✅ | Accurate |
| `broker_id` | ✅ (used for lookup) | ❌ Not sent | N/A | Missing but not needed |
| `dealer_name` | ✅ | ✅ `dealer_name` | ✅ (conditional) | Accurate |
| `trade_date` | ✅ | ✅ `trade_date` | ✅ | Accurate |
| `settlement_date` | ✅ | ✅ `settlement_date` | ✅ | Accurate |
| `no_of_shares` | ✅ | ✅ `no_of_shares` | ✅ | Accurate |
| `price_avg` | ✅ | ✅ `price_avg` | ✅ | Accurate |
| `gross_amount` | ✅ | ✅ `gross_amount` | ✅ | Accurate |
| `brokerage` | ✅ | ✅ `brokerage` | ✅ | Accurate |
| **`sec`** | ✅ | ❌ **Not sent** | ❌ **Missing** | **DATA GAP** |
| **`exchange`** | ✅ | ❌ **Not sent** | ❌ **Missing** | **DATA GAP** |
| **`cds`** | ✅ | ❌ **Not sent** | ❌ **Missing** | **DATA GAP** |
| **`gov_cess`** | ✅ | ❌ **Not sent** | ❌ **Missing** | **DATA GAP** |
| **`clearing_fees`** | ✅ | ❌ **Not sent** | ❌ **Missing** | **DATA GAP** |
| **`foreign_brokerage`** | ✅ | ❌ **Not sent** | ❌ **Missing** | **DATA GAP** |
| `net_amount` | ✅ | ✅ `net_amount` | ✅ | Accurate |
| `remarks` | ✅ | ✅ `remarks` | ✅ (conditional) | Accurate |
| `has_mismatch` | ✅ (badge) | ❌ Not sent | N/A | Not needed in email |
| `approval_notes` | ✅ | ✅ `approval_notes` | ✅ (conditional) | Accurate |
| `approved_by` | ✅ | ❌ Not sent (hardcoded as "Reviewer") | Shows "Reviewer" | **INACCURATE** |
| `approved_at` | ✅ | ❌ Not sent (uses `reviewed_at` = current time) | Shows current time | **INACCURATE** |
| `file_url` | ✅ (view button) | ❌ Not sent | N/A | Not needed in email |
| `created_at` | ✅ (sort) | ❌ Not sent | N/A | Not needed in email |
| `id` | ✅ (internal) | ❌ Not sent | N/A | Not needed in email |
| `transaction_id` | ✅ (internal) | ❌ Not sent | N/A | Not needed in email |
| `status` | ✅ (filter) | ❌ Not sent | N/A | Not needed in email |

### B. Transaction Fields (`transactions` table — linked system record)

| Field | Displayed on Page | In Email Payload | In Email HTML | Status |
|-------|:-:|:-:|:-:|--------|
| `transaction_date` | ✅ (in email modal comparison) | ❌ **Not sent** | ❌ **Missing** | **DATA GAP** |
| `no_of_shares` | ✅ | ✅ `txn_no_of_shares` | ✅ | Accurate |
| `price_per_share` | ✅ | ✅ `txn_price_per_share` | ✅ | Accurate |
| `total_amount` | ✅ | ✅ `txn_total_amount` | ⚠️ **Labeled as "Net Amount"** | **INACCURATE** |

### C. Entity Broker Fields (`entity_brokers` table — account details)

| Field | Displayed on Page | In Email Payload | In Email HTML | Status |
|-------|:-:|:-:|:-:|--------|
| `broker_account_number` | ✅ (in expanded row) | ❌ **Not sent** | ❌ **Missing** | **DATA GAP** |
| `custodian_account_number` | ✅ (in expanded row) | ❌ **Not sent** | ❌ **Missing** | **DATA GAP** |

### D. Broker Contact Fields (`brokers` table)

| Field | Displayed on Page | In Email Payload | In Email HTML | Status |
|-------|:-:|:-:|:-:|--------|
| `broker_name` | ✅ | ✅ `broker_name` | ✅ | Accurate |
| `contact_person_name` | ✅ (in expanded row) | ❌ Not sent | ❌ **Missing** | **DATA GAP** |
| `contact_person_email` | ✅ (in expanded row) | ❌ Used as `to` only | Not shown in body | Accurate (recipient is correct) |
| `contact_person_phone` | ✅ (in expanded row) | ❌ Not sent | ❌ **Missing** | **DATA GAP** |
| `contact_person_designation` | ✅ (in expanded row) | ❌ Not sent | ❌ **Missing** | **DATA GAP** |

### E. Entity CC Fields (`entities` table)

| Field | Displayed on Page | In Email Payload | In Email HTML | Status |
|-------|:-:|:-:|:-:|--------|
| `cc_email` | ✅ (used as CC) | ✅ Used as `cc` | Not shown in body | Accurate |
| `entity.name` | ✅ | ✅ `entity_name` | ✅ | Accurate |

---

## 5. Critical Data Accuracy Issues

### Issue 1: `txn_total_amount` labeled as "Net Amount" in comparison table (WRONG)
In the email HTML template (edge function line 245), the comparison table shows:
- **System (Transaction)** → `txn_total_amount` under the column header "Net Amount"
- But `txn_total_amount` is actually the **gross total** (`transaction.total_amount`), not the net amount
- The system's actual net amount is never calculated or sent

This means the "Net Amount" comparison is **factually incorrect** — it's comparing the transaction's gross amount against the note's net amount.

### Issue 2: `reviewed_by` hardcoded as "Reviewer" (INACCURATE)
In `sendBrokerNotification` (line 235): `reviewed_by: 'Reviewer'` — a static string, not the actual user's name or email (`user?.email`). The email always shows "Reviewed by Reviewer" regardless of who actually approved/rejected.

### Issue 3: `approved_at` replaced with current time (INACCURATE)
The email uses `reviewed_at` = current time (`new Date().toLocaleDateString(...)`), not the actual approval timestamp from the database (`note.approved_at`). This means the email shows a different timestamp than what's recorded in the system.

### Issue 4: Email modal always sends as "APPROVED" (MISLEADING)
The standalone "Email Broker" button in the comparison modal (line 811) always calls `sendBrokerNotification(note, 'APPROVED', ...)` even when the note is pending approval or being reviewed. The email subject will say "Contract Note Approved" even though no approval action has been taken.

### Issue 5: 5 Fee Fields Missing from Email (DATA GAP)
The page displays 8 fee fields in the breakdown (Gross, Brokerage, SEC, Exchange, CDS, Gov. Levy, Clearing, Net), but the email only includes 3 (Gross, Brokerage, Net). The missing 5 are:
- `sec` (SEC fee)
- `exchange` (CSE/Exchange fee)
- `cds` (CDS fees)
- `gov_cess` (Gov. Levy / STL)
- `clearing_fees`

### Issue 6: `transaction_date` Not Sent (DATA GAP)
The email modal shows the system's transaction date for comparison, but this field is not included in the email payload. Only the note's `trade_date` is sent.

### Issue 7: Broker Account & CDS Account Not in Email (DATA GAP)
The expanded row shows broker account number and CDS custodian account number, but these are not included in the email payload or the HTML template.

### Issue 8: Broker Contact Details Not in Email (DATA GAP)
The expanded row shows broker contact person name, phone, and designation, but these are not included in the email payload.

### Issue 9: No Logging for Failed Emails (RELIABILITY GAP)
In `sendBrokerNotification` (line 243):
```typescript
}).catch(err => console.error('Email notification failed:', err));
```
If the fetch to the edge function fails, the error is only logged to the console. It is **not** logged to the `email_logs` table, so failed email attempts from the buy/sell approvals page are invisible in the Email Deliveries admin page.

### Issue 10: CC Entity Email Toggle Defaults to `true` (UX CONCERN)
Both the approve and reject modals default `ccEntityEmail` to `true` (lines 101, 171). If an entity has a `cc_email` configured, it will always be CC'd on approval/rejection emails unless the user explicitly unchecks it. This could lead to unintended email recipients.

---

## 6. Summary: Complete Data Completeness Matrix

| Category | Total Fields on Page | In Email | Missing | Inaccurate |
|----------|:-:|:-:|:-:|:-:|
| Note financials | 8 | 3 | 5 (sec, exchange, cds, gov_cess, clearing_fees) | 0 |
| Note other | 7 | 4 | 3 (foreign_brokerage, file_url, status) | 2 (approved_by, approved_at) |
| Transaction comparison | 4 | 3 | 1 (transaction_date) | 1 (total_amount labeled as net) |
| Account details | 2 | 0 | 2 (broker_acct, custodian_acct) | 0 |
| Broker contact | 4 | 1 (email as recipient) | 3 (name, phone, designation) | 0 |
| Review metadata | 2 | 2 | 0 | 2 (reviewed_by, reviewed_at) |
| **TOTAL** | **27** | **13** | **13** | **5** |

**13 fields displayed on the page are completely missing from the email, and 5 fields are inaccurate or misleading.**

---

## 7. Comparison with TransactionApprovals Page

The `TransactionApprovals.tsx` page has a more complete email system:
- Supports **multiple CC emails** (`cc_email`, `cc_email_2`, `cc_email_3`) vs. Buy & Sell which only supports one CC
- Has a manual email modal (`openEmailModal`) that allows the user to type any recipient and CC address, not just the broker's contact email
- The `sendEmail()` function validates the email address format before sending
- TransactionApprovals uses the legacy `transaction` email type (not `approval_notification`) for its manual email feature

---

## 7. Fixes Applied

The following issues have been fixed in the codebase:

### `src/pages/BuyAndSellApprovals.tsx`
- Added `eb` (EntityBroker) parameter to `sendBrokerNotification` function
- Added all missing fee fields to the email payload: `sec`, `exchange`, `cds`, `gov_cess`, `clearing_fees`, `foreign_brokerage`
- Added `txn_transaction_date` (system transaction date) to the payload
- Added account details to the payload: `broker_account_number`, `custodian_account_number`
- Added broker contact details to the payload: `broker_contact_person_name`, `broker_contact_person_phone`, `broker_contact_person_designation`
- Fixed `reviewed_by` to use `user?.email` instead of hardcoded "Reviewer"
- Updated all 3 call sites (handleApprove, handleReject, email modal) to pass `eb`
- Updated email modal's `getDetails` destructuring to include `eb`

### `supabase/functions/send-transaction-email/index.ts`
- Added all missing fields to `ApprovalNotificationData` interface: `sec`, `exchange`, `cds`, `gov_cess`, `clearing_fees`, `foreign_brokerage`, `txn_transaction_date`, `broker_account_number`, `custodian_account_number`, `broker_contact_person_name`, `broker_contact_person_phone`, `broker_contact_person_designation`
- Added fee breakdown section to HTML template (SEC, Exchange, CDS, Gov. Levy, Clearing Fees, Foreign Brokerage)
- Added Account Details section to HTML template (Broker Account, CDS Custodian)
- Added Broker Contact section to HTML template (name, designation, phone)
- Added Transaction Date row to the Value Comparison table (on rejections)
- Fixed `reviewed_by` to use the actual value from the payload (already using `data.reviewed_by`)

---

## 8. Files Analyzed

- `src/pages/BuyAndSellApprovals.tsx` — Main approvals page (1003 lines)
- `supabase/functions/send-transaction-email/index.ts` — Edge function for email delivery (497 lines)
- `src/pages/TransactionApprovals.tsx` — Transaction approvals page (for comparison)
- `src/pages/EmailDeliveries.tsx` — Email delivery log viewer
- `supabase/migrations/20260723115834_create_email_logs_table.sql` — Email logs table schema
- `src/pages/Transactions.tsx` — Transactions page (legacy email sending)
- `src/components/Sidebar.tsx` — Navigation (route definitions)
- `src/App.tsx` — Route configuration