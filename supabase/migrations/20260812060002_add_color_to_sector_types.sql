/*
  # Give each sector its own stored colour

  1. The problem this solves
     Dashboard.tsx used to hold a hard-coded sector-name -> hex table with a grey
     fallback, so any sector whose name was not in that table rendered grey — and
     since sector names are user data (this table, maintained on the Sector Types
     screen, seeded by no migration) most of them did.

     Deriving the colour in the front end instead fixes the grey but not the
     stability: assigning slots over the sector names in sorted order means adding
     a sector that sorts earlier shifts every later sector onto a different
     colour. Adding one sector to a set of seven repainted all seven.

     Storing the colour on the row is what makes it permanent. A sector keeps its
     colour for good, and a new sector takes a colour nothing else is using.

  2. Why the colours are a fixed list rather than random
     A random hex is not safe to show: it can land outside the readable lightness
     band, below the chroma floor (which is how the old '#1E3A5F' and the grey
     'Other' came to read as grey in the first place), or too close to a colour
     already in use for a red/green-colourblind reader to separate.

     These 16 were validated as a set: every adjacent pair clears CVD ΔE 12.9
     (protan; target >= 8) and normal-vision ΔE 16.4 (floor 15), and all 16 sit
     inside the lightness band and above the chroma floor.

     Keep this list identical to SECTOR_COLORS in src/pages/Dashboard.tsx. It is
     duplicated because SQL and TypeScript cannot share a constant; if you change
     one, change the other.

  3. Assignment rule
     Lowest-numbered palette entry that no other sector is using. Past 16 sectors
     there is no unused colour left, so it falls back to the least-used one —
     which is why there is deliberately no UNIQUE constraint on the column. Two
     sectors sharing a colour beyond 16 is a legible outcome; a failed insert is
     not.

  4. Manual override
     The column is plain text with a format check, so a colour can be set by hand
     on the Sector Types screen. The trigger only fills it when it is left null,
     so an explicit choice is never overwritten.
*/

-- ── Column ────────────────────────────────────────────────────────────────────

ALTER TABLE public.sector_types
  ADD COLUMN IF NOT EXISTS color text;

-- Rejects anything that is not a 6-digit hex colour, so a bad value fails at the
-- write rather than rendering as a broken swatch. Lower-case for consistency with
-- the palette; the trigger and the UI both write lower-case.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sector_types'::regclass
      AND conname  = 'sector_types_color_format_check'
  ) THEN
    ALTER TABLE public.sector_types
      ADD CONSTRAINT sector_types_color_format_check
      CHECK (color IS NULL OR color ~ '^#[0-9a-f]{6}$');
  END IF;
END $$;

-- ── The palette, and the "next unused" rule ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.sector_color_palette()
  RETURNS text[]
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
AS $$
  SELECT ARRAY[
    '#15803d', '#eda100', '#0369a1', '#b45309',
    '#2a78d6', '#eb6834', '#b91c6b', '#e87ba4',
    '#a16207', '#0891b2', '#4a3aa7', '#e34948',
    '#9a3412', '#1baf7a', '#6d28d9', '#008300'
  ]
$$;

/*
  Picks the lowest-numbered palette entry not in use, ignoring one row so the
  function can be used both to fill a new row and to backfill an existing one.

  SECURITY DEFINER because it must see every sector to judge "not in use". Under
  the caller's privileges a future policy that narrowed reads on sector_types
  would silently start handing out colours that are already taken, and the bug
  would look like the original one.
*/
CREATE OR REPLACE FUNCTION public.next_sector_color(p_exclude_id uuid DEFAULT NULL)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  chosen text;
BEGIN
  SELECT p.color INTO chosen
  FROM unnest(public.sector_color_palette()) WITH ORDINALITY AS p(color, ord)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.sector_types s
    WHERE s.color = p.color
      AND (p_exclude_id IS NULL OR s.id <> p_exclude_id)
  )
  ORDER BY p.ord
  LIMIT 1;

  IF chosen IS NOT NULL THEN
    RETURN chosen;
  END IF;

  -- More sectors than palette entries: reuse the least-used, earliest-listed one.
  SELECT p.color INTO chosen
  FROM unnest(public.sector_color_palette()) WITH ORDINALITY AS p(color, ord)
  LEFT JOIN public.sector_types s
    ON s.color = p.color
   AND (p_exclude_id IS NULL OR s.id <> p_exclude_id)
  GROUP BY p.color, p.ord
  ORDER BY count(s.id), p.ord
  LIMIT 1;

  RETURN chosen;
END $$;

-- ── Backfill ──────────────────────────────────────────────────────────────────

/*
  Ordered by sector_id ('SEC001', 'SEC002', ...), which is assigned once at insert
  and never changes, so the result is the same whenever this runs and does not
  depend on sector names. Row by row rather than set-based, because each choice
  has to see the ones already made.
*/
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.sector_types
    WHERE color IS NULL
    ORDER BY sector_id NULLS LAST, created_at, id
  LOOP
    UPDATE public.sector_types
      SET color = public.next_sector_color(r.id)
      WHERE id = r.id;
  END LOOP;
END $$;

-- ── Keep it filled for new sectors ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_sector_color()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
BEGIN
  -- Only when left null, so a colour chosen on the Sector Types screen stands.
  IF NEW.color IS NULL THEN
    NEW.color := public.next_sector_color(NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trigger_set_sector_color ON public.sector_types;
CREATE TRIGGER trigger_set_sector_color
  BEFORE INSERT ON public.sector_types
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sector_color();

COMMENT ON COLUMN public.sector_types.color IS
  'Chart colour for this sector, #rrggbb. Filled by trigger_set_sector_color with the lowest unused entry of sector_color_palette(); may be overridden by hand. Mirrors SECTOR_COLORS in src/pages/Dashboard.tsx.';
