/*
  # Fix sector_id and industry_id auto-generation functions

  Both generate_sector_id()/set_sector_id() and generate_industry_id()/set_industry_id()
  have SET search_path TO '' but reference sequences without schema prefixes, causing
  "function does not exist" errors on INSERT. This fixes all four functions to use
  fully-qualified names (public. prefix).
*/

CREATE OR REPLACE FUNCTION public.generate_sector_id()
  RETURNS text
  LANGUAGE plpgsql
  SET search_path TO ''
AS $$
DECLARE
  next_id integer;
  new_sector_id text;
BEGIN
  next_id := nextval('public.sector_id_seq');
  new_sector_id := 'SEC' || lpad(next_id::text, 3, '0');
  RETURN new_sector_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_sector_id()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO ''
AS $$
BEGIN
  IF NEW.sector_id IS NULL THEN
    NEW.sector_id := public.generate_sector_id();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_industry_id()
  RETURNS text
  LANGUAGE plpgsql
  SET search_path TO ''
AS $$
DECLARE
  next_id integer;
  new_industry_id text;
BEGIN
  next_id := nextval('public.industry_id_seq');
  new_industry_id := 'IND' || lpad(next_id::text, 3, '0');
  RETURN new_industry_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_industry_id()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO ''
AS $$
BEGIN
  IF NEW.industry_id IS NULL THEN
    NEW.industry_id := public.generate_industry_id();
  END IF;
  RETURN NEW;
END;
$$;
