
CREATE TABLE public.alternatief_keuzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oud_artikel_id uuid,
  oud_artikel_nummer text NOT NULL,
  oud_omschrijving text,
  nieuw_artikel_id uuid,
  nieuw_artikel_nummer text NOT NULL,
  totaal_geupdate integer NOT NULL DEFAULT 0,
  kandidaten jsonb,
  stappen jsonb,
  notitie text,
  gekozen_door text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alternatief_keuzes_oud_nummer ON public.alternatief_keuzes(oud_artikel_nummer);
CREATE INDEX idx_alternatief_keuzes_created_at ON public.alternatief_keuzes(created_at DESC);

GRANT SELECT, INSERT ON public.alternatief_keuzes TO anon, authenticated;
GRANT ALL ON public.alternatief_keuzes TO service_role;

ALTER TABLE public.alternatief_keuzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all" ON public.alternatief_keuzes
  FOR ALL USING (true) WITH CHECK (true);
