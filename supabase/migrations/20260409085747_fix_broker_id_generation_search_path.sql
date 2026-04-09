/*
  # Fix broker_id auto-generation functions

  Both generate_broker_id() and set_broker_id() have SET search_path TO ''
  but reference objects without schema prefixes, causing "function does not exist"
  errors on INSERT. This fixes both functions to use fully-qualified names.
*/

CREATE OR REPLACE FUNCTION public.generate_broker_id()
  RETURNS text
  LANGUAGE plpgsql
  SET search_path TO ''
AS $$
DECLARE
  next_id integer;
  new_broker_id text;
BEGIN
  next_id := nextval('public.broker_id_seq');
  new_broker_id := 'BRK' || lpad(next_id::text, 3, '0');
  RETURN new_broker_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_broker_id()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO ''
AS $$
BEGIN
  IF NEW.broker_id IS NULL THEN
    NEW.broker_id := public.generate_broker_id();
  END IF;
  RETURN NEW;
END;
$$;
