
ALTER TABLE public.artikelen
  ADD COLUMN IF NOT EXISTS basis_eenheid text,
  ADD COLUMN IF NOT EXISTS aantal_in_verpakking integer,
  ADD COLUMN IF NOT EXISTS alternatief_artikel_nummer text,
  ADD COLUMN IF NOT EXISTS status text;

CREATE UNIQUE INDEX IF NOT EXISTS artikelen_artikel_nummer_uniq ON public.artikelen(artikel_nummer);

CREATE TABLE IF NOT EXISTS public.app_instellingen (
  sleutel text PRIMARY KEY,
  waarde text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_instellingen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_all" ON public.app_instellingen;
CREATE POLICY "public_all" ON public.app_instellingen FOR ALL USING (true) WITH CHECK (true);
