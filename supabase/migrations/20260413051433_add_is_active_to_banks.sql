/*
  # Add is_active column to banks table

  The banks table is missing the is_active column that the application
  references in its UI and insert payloads. This migration adds it with
  a default of true so all existing records remain active.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'banks' AND column_name = 'is_active' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.banks ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;
