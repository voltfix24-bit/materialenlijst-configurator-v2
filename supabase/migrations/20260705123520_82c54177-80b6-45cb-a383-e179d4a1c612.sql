-- Fase 2: hardcoded stamdata naar de database
CREATE TABLE IF NOT EXISTS public.ringklem_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artikel_nummer text NOT NULL UNIQUE,
  omschrijving text NOT NULL,
  hoofdkabel_doorsnede_min numeric NOT NULL,
  hoofdkabel_doorsnede_max numeric NOT NULL,
  hoofdkabel_materiaal text NOT NULL CHECK (hoofdkabel_materiaal IN ('Al', 'Cu', 'beide')),
  aftakkabel_doorsnede_min numeric NOT NULL,
  aftakkabel_doorsnede_max numeric NOT NULL,
  actief boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ringklem_specs TO anon, authenticated;
GRANT ALL ON public.ringklem_specs TO service_role;

ALTER TABLE public.ringklem_specs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all" ON public.ringklem_specs;
CREATE POLICY "public_all" ON public.ringklem_specs FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.ringklem_specs
  (artikel_nummer, omschrijving, hoofdkabel_doorsnede_min, hoofdkabel_doorsnede_max, hoofdkabel_materiaal, aftakkabel_doorsnede_min, aftakkabel_doorsnede_max, sort_order)
VALUES
  ('20041574', 'Ringklem 4x25Cu / 4x6Cu-50Al',             25,  25,  'Cu',    6,  50,  1),
  ('20000996', 'Ringklem 3x35+1x25Cu / 4x6Cu-50Al',        35,  35,  'Cu',    6,  50,  2),
  ('20017985', 'Ringklem 3x50+1x35Cu / 4x6Cu-50Al',        50,  50,  'Cu',    6,  50,  3),
  ('20041571', 'Ringklem 4x35-70Cu & 4x50Al /4x6Cu-50Al',  35,  70,  'beide', 6,  50,  4),
  ('20041575', 'Ringklem 3x70-95+1x50-70 / 4x6Cu-50Al',    70,  95,  'Cu',    6,  50,  5),
  ('20041563', 'Ringklem 4x150Cu / 4x6Cu-50Al',            150, 150, 'Cu',    6,  50,  6),
  ('20041459', 'Ringklem 4x95-150Al / 4x6Cu-50Al',         95,  150, 'Al',    6,  50,  7),
  ('20041564', 'Ringklem 4x95Al / 4x95Al-150Al',           95,  95,  'Al',    95, 150, 8),
  ('20041565', 'Ringklem 4x150Al & 4x120Cu /4x95Al-150Al', 120, 150, 'Al',    95, 150, 9)
ON CONFLICT (artikel_nummer) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.inet_default_artikelen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artikel_nummer text NOT NULL UNIQUE,
  hoeveelheid numeric NOT NULL DEFAULT 1,
  actief boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inet_default_artikelen TO anon, authenticated;
GRANT ALL ON public.inet_default_artikelen TO service_role;

ALTER TABLE public.inet_default_artikelen ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all" ON public.inet_default_artikelen;
CREATE POLICY "public_all" ON public.inet_default_artikelen FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.inet_default_artikelen (artikel_nummer, hoeveelheid, sort_order)
VALUES
  ('20042523', 2, 1),
  ('20016067', 2, 2),
  ('20039640', 1, 3),
  ('20037549', 2, 4),
  ('20015368', 2, 5),
  ('20039770', 1, 6),
  ('20039779', 1, 7)
ON CONFLICT (artikel_nummer) DO NOTHING;