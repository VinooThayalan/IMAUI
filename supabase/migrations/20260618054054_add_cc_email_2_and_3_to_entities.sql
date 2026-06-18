ALTER TABLE public.entities
  ADD COLUMN IF NOT EXISTS cc_email_2 text,
  ADD COLUMN IF NOT EXISTS cc_email_3 text;
