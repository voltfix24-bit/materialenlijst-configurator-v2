-- Eigen hoofdstukken + plaatsing van eigen vragen.
--
-- Een eigen vraag kan nu geplaatst worden:
--  a) in een bestaand configurator-hoofdstuk (sectie_key: 'project',
--     'provisorium', 'ms', 'trafo', 'ls' of 'overig') — de vraag verschijnt
--     dan onderaan dat hoofdstuk onder "Extra vragen";
--  b) in een eigen hoofdstuk met zelfgekozen naam (hoofdstuk_id) — elk eigen
--     hoofdstuk wordt een eigen sectie-kaart in de configurator;
--  c) nergens (beide null) — dan valt hij terug in het standaardhoofdstuk
--     "Eigen vragen", zoals voorheen.

CREATE TABLE IF NOT EXISTS public.maatwerk_hoofdstukken (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naam text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  actief boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.maatwerk_hoofdstukken ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all" ON public.maatwerk_hoofdstukken;
CREATE POLICY "public_all" ON public.maatwerk_hoofdstukken FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.maatwerk_vragen
  ADD COLUMN IF NOT EXISTS hoofdstuk_id uuid REFERENCES public.maatwerk_hoofdstukken(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sectie_key text CHECK (
    sectie_key IS NULL OR sectie_key IN ('project', 'provisorium', 'ms', 'trafo', 'ls', 'overig')
  );
