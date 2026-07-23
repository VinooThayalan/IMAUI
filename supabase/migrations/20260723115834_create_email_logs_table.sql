/*
# Create email_logs table for email delivery tracking

1. New Tables
- `email_logs`
  - `id` (uuid, primary key)
  - `to_email` (text, not null) — recipient email address
  - `cc_emails` (text[]) — CC recipients, nullable
  - `subject` (text, not null) — email subject line
  - `html_content` (text) — full HTML body of the sent email
  - `status` (text, not null) — delivery status: 'sent' or 'failed'
  - `error_message` (text) — SMTP error message if status is 'failed', nullable
  - `triggered_by` (text) — email of the IMA user account that triggered the email
  - `source` (text) — which functionality/page triggered the email (e.g. 'Transactions', 'Buy & Sell Approvals', 'Transaction Approvals', 'Test Email')
  - `email_type` (text) — type of email (e.g. 'transaction', 'approval_notification')
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `email_logs`.
- Authenticated users can read all email logs (admin oversight feature).
- Only authenticated users can insert (the edge function uses service role which bypasses RLS, but this policy covers direct inserts too).
- No update or delete policies — logs are immutable once created.

3. Indexes
- Index on `created_at` for date-ordered queries.
- Index on `status` for filtering by delivery status.
- Index on `triggered_by` for filtering by user.
- Index on `source` for filtering by functionality.

4. Notes
- The edge function inserts logs using the service role key (bypasses RLS), so the INSERT policy is a safety net for any direct client inserts.
- Email content is stored as HTML so the page can render a faithful preview in an iframe sandbox.
*/

CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  cc_emails text[],
  subject text NOT NULL,
  html_content text,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  triggered_by text,
  source text,
  email_type text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_email_logs_authenticated" ON email_logs;
CREATE POLICY "select_email_logs_authenticated"
ON email_logs FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_email_logs_authenticated" ON email_logs;
CREATE POLICY "insert_email_logs_authenticated"
ON email_logs FOR INSERT
TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs (status);
CREATE INDEX IF NOT EXISTS idx_email_logs_triggered_by ON email_logs (triggered_by);
CREATE INDEX IF NOT EXISTS idx_email_logs_source ON email_logs (source);
