CREATE TABLE IF NOT EXISTS public.maatwerk_hoofdstukken (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naam text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  actief boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maatwerk_hoofdstukken TO anon, authenticated;
GRANT ALL ON public.maatwerk_hoofdstukken TO service_role;

ALTER TABLE public.maatwerk_hoofdstukken ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all" ON public.maatwerk_hoofdstukken;
CREATE POLICY "public_all" ON public.maatwerk_hoofdstukken FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.maatwerk_vragen
  ADD COLUMN IF NOT EXISTS hoofdstuk_id uuid REFERENCES public.maatwerk_hoofdstukken(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sectie_key text CHECK (
    sectie_key IS NULL OR sectie_key IN ('project', 'provisorium', 'ms', 'trafo', 'ls', 'overig')
  );