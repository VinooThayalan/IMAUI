/*
  # Stop the id generators handing out ids that already exist, and widen aer

  1. broker_id / entity_id collisions

     Creating a broker failed with:
       duplicate key value violates unique constraint "brokers_broker_id_key" (23505)

     20260220164544_add_sample_data_corrected inserts BRK001..BRK005 with the
     id spelled out, which never advances broker_id_seq. The sequence stayed at
     1 while five ids were taken, so the trigger handed out BRK001, then BRK002,
     and so on -- each one a duplicate. It only starts working once the sequence
     has burned past the highest seeded id, which is what the failed attempts
     were unwittingly doing, one wasted id per attempt.

     Fixed twice over:
     - setval() both sequences past the ids already in the table, so they are
       correct right now and after any rebuild from scratch;
     - both generators now skip ids that exist rather than trusting the
       sequence, so a future seed, restore or manual insert cannot reintroduce
       this.

     The generators become SECURITY DEFINER because they must see every row to
     check. generate_entity_id in particular would otherwise run under the
     caller's RLS, where a non-admin sees only their own entities via
     has_entity_access, and would happily hand out an id that is already taken
     by an entity they cannot see.

  2. share_analytics_cache.aer overflow

     Share Analytics reported:
       Cache write failed: insert: numeric field overflow

     aer was numeric(10,4), so it cannot hold anything at or above 1,000,000
     and cannot hold an infinity at all. The AER comes from a Newton-Raphson
     XIRR that returns its last iterate when it fails to converge, and a short
     holding period annualises into the millions. One such row failed the whole
     batch insert, leaving the page to recompute from scratch on every visit.

     Widened to numeric(20,4), matching every other value column in the table.
     The app no longer writes a non-converged rate, but the column should
     degrade to an odd number rather than taking down the entire cache write.
*/

-- 1a. Point each sequence past the ids that already exist.
DO $$
DECLARE highest bigint;
BEGIN
  SELECT coalesce(max(substring(broker_id from '\d+')::bigint), 0)
    INTO highest FROM public.brokers;
  IF highest > 0 THEN
    PERFORM setval('public.broker_id_seq', highest, true);
  ELSE
    PERFORM setval('public.broker_id_seq', 1, false);
  END IF;

  SELECT coalesce(max(substring(entity_id from '\d+')::bigint), 0)
    INTO highest FROM public.entities;
  IF highest > 0 THEN
    PERFORM setval('public.entities_sequence', highest, true);
  ELSE
    PERFORM setval('public.entities_sequence', 1, false);
  END IF;
END $$;

-- 1b. Never return an id that is already taken.
CREATE OR REPLACE FUNCTION public.generate_broker_id()
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  candidate text;
BEGIN
  LOOP
    candidate := 'BRK' || lpad(nextval('public.broker_id_seq')::text, 3, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.brokers WHERE broker_id = candidate
    );
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_entity_id()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  candidate text;
BEGIN
  IF NEW.entity_id IS NULL OR NEW.entity_id = '' THEN
    LOOP
      candidate := 'ENT' || lpad(nextval('public.entities_sequence')::text, 3, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.entities WHERE entity_id = candidate
      );
    END LOOP;
    NEW.entity_id := candidate;
  END IF;
  RETURN NEW;
END;
$$;

-- The trigger calls generate_broker_id() as the signed-in user, so that role
-- needs EXECUTE. anon holds nothing anywhere in public (20260803060001).
REVOKE ALL ON FUNCTION public.generate_broker_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.generate_entity_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_broker_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_broker_id() TO authenticated;

-- 2. Widen aer to match the other value columns.
ALTER TABLE public.share_analytics_cache
  ALTER COLUMN aer TYPE numeric(20,4);

NOTIFY pgrst, 'reload schema';
