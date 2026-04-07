/*
  # Fix generate_entity_id function search path

  The function had an empty search_path but referenced the sequence without
  a schema qualifier, causing it to fail for non-admin users.
  This fixes it by using the fully qualified public.entities_sequence name.
*/

CREATE OR REPLACE FUNCTION generate_entity_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.entity_id IS NULL OR NEW.entity_id = '' THEN
    NEW.entity_id := 'ENT' || LPAD(nextval('public.entities_sequence')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path TO '';
