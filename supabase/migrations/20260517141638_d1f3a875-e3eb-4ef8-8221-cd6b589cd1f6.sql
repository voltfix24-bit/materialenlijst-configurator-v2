-- GGI artikelen (flat, geen condities)
CREATE TABLE public.ggi_artikelen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artikel_id uuid NOT NULL,
  hoeveelheid numeric NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  actief boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ggi_artikelen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON public.ggi_artikelen FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER ggi_artikelen_touch
  BEFORE UPDATE ON public.ggi_artikelen
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Trafo regels (conditioneel)
CREATE TABLE public.trafo_regels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conditie_actie text,          -- 'nieuw' | 'draaien' | 'blijft' | NULL
  conditie_kva text,            -- '250' | '400' | '630' | '1000' | NULL
  conditie_kabel_lengte text,   -- '7.25' | '10' | NULL
  artikel_id uuid NOT NULL,
  hoeveelheid numeric NOT NULL DEFAULT 1,
  herkomst_label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  actief boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trafo_regels_actie_check CHECK (
    conditie_actie IS NULL OR conditie_actie IN ('nieuw','draaien','blijft')
  ),
  CONSTRAINT trafo_regels_kva_check CHECK (
    conditie_kva IS NULL OR conditie_kva IN ('250','400','630','1000')
  ),
  CONSTRAINT trafo_regels_kabel_check CHECK (
    conditie_kabel_lengte IS NULL OR conditie_kabel_lengte IN ('7.25','10')
  )
);

ALTER TABLE public.trafo_regels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON public.trafo_regels FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trafo_regels_touch
  BEFORE UPDATE ON public.trafo_regels
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX trafo_regels_lookup_idx
  ON public.trafo_regels (actief, conditie_actie, conditie_kva, conditie_kabel_lengte);