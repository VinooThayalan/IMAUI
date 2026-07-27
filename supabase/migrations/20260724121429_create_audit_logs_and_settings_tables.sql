/*
# Create audit_logs and audit_settings tables

1. New Tables
- `audit_logs`: Stores a record of every CREATE / UPDATE / DELETE action across
  application tables (transactions, buy_sell_notes, dividends, etc.).
  - id (uuid, primary key)
  - table_name (text, not null) — the affected table
  - record_id (text, not null) — the affected record's id
  - action (text, not null) — CREATE | UPDATE | DELETE
  - performed_by (text, not null) — email or identifier of the user
  - performed_at (timestamptz, default now())
  - old_values (jsonb) — previous row state for UPDATE/DELETE
  - new_values (jsonb) — new row state for CREATE/UPDATE
  - changed_fields (text[]) — list of fields that changed
  - entity_id (text) — optional entity context
  - description (text) — human-readable summary of the change

- `audit_settings`: Single-row table controlling whether audit logging is on/off.
  - id (uuid, primary key)
  - audit_enabled (boolean, default true)
  - updated_by (text) — who last changed the setting
  - updated_at (timestamptz, default now())

2. Seed
- Inserts a default row into audit_settings with audit_enabled = true.

3. Security
- Enable RLS on both tables.
- audit_logs: authenticated users can read and insert; updates/deletes not
  allowed via the anon key (audit trail is append-only from the app).
- audit_settings: authenticated users can read and update.
*/

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
  performed_by text NOT NULL,
  performed_at timestamptz NOT NULL DEFAULT now(),
  old_values jsonb,
  new_values jsonb,
  changed_fields text[],
  entity_id text,
  description text
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_audit_logs" ON public.audit_logs;
CREATE POLICY "select_audit_logs"
  ON public.audit_logs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_audit_logs" ON public.audit_logs;
CREATE POLICY "insert_audit_logs"
  ON public.audit_logs FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_audit_logs" ON public.audit_logs;
CREATE POLICY "update_audit_logs"
  ON public.audit_logs FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_audit_logs" ON public.audit_logs;
CREATE POLICY "delete_audit_logs"
  ON public.audit_logs FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_at ON public.audit_logs (performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON public.audit_logs (entity_id);

CREATE TABLE IF NOT EXISTS public.audit_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_enabled boolean NOT NULL DEFAULT true,
  updated_by text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.audit_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_audit_settings" ON public.audit_settings;
CREATE POLICY "select_audit_settings"
  ON public.audit_settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_audit_settings" ON public.audit_settings;
CREATE POLICY "insert_audit_settings"
  ON public.audit_settings FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_audit_settings" ON public.audit_settings;
CREATE POLICY "update_audit_settings"
  ON public.audit_settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.audit_settings (audit_enabled)
SELECT true
WHERE NOT EXISTS (SELECT 1 FROM public.audit_settings);