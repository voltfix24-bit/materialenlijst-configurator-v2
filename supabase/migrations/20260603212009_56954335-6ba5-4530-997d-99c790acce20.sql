CREATE TABLE public.beheer_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actie text NOT NULL,
  omschrijving text NOT NULL,
  artikel_nummer text,
  tabel text,
  rij_id text,
  oude_waarde jsonb,
  nieuwe_waarde jsonb,
  aantal_aangepast integer NOT NULL DEFAULT 0,
  resultaat text NOT NULL DEFAULT 'ok',
  details jsonb,
  uitgevoerd_door text
);

CREATE INDEX beheer_log_created_at_idx ON public.beheer_log (created_at DESC);
CREATE INDEX beheer_log_actie_idx ON public.beheer_log (actie);
CREATE INDEX beheer_log_artikel_nummer_idx ON public.beheer_log (artikel_nummer);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.beheer_log TO anon, authenticated;
GRANT ALL ON public.beheer_log TO service_role;

ALTER TABLE public.beheer_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all" ON public.beheer_log
  FOR ALL
  USING (true)
  WITH CHECK (true);