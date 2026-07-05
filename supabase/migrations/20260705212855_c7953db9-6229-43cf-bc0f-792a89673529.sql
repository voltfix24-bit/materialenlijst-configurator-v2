-- Eigen vragen: nieuwe configuratorvragen toevoegen zonder code-wijziging.
CREATE TABLE IF NOT EXISTS public.maatwerk_vragen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vraag_key text NOT NULL UNIQUE,
  label text NOT NULL,
  uitleg text,
  type text NOT NULL CHECK (type IN ('ja_nee', 'keuze', 'aantal')),
  opties text[] NOT NULL DEFAULT '{}',
  van_toepassing_bij text[] NOT NULL DEFAULT '{}',
  actief boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.maatwerk_vraag_regels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vraag_id uuid NOT NULL REFERENCES public.maatwerk_vragen(id) ON DELETE CASCADE,
  antwoord text NOT NULL DEFAULT '*',
  artikel_id uuid NOT NULL REFERENCES public.artikelen(id),
  hoeveelheid numeric NOT NULL DEFAULT 1,
  per_eenheid boolean NOT NULL DEFAULT false,
  actief boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maatwerk_vraag_regels_vraag
  ON public.maatwerk_vraag_regels (vraag_id, sort_order);

ALTER TABLE public.maatwerk_vragen ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all" ON public.maatwerk_vragen;
CREATE POLICY "public_all" ON public.maatwerk_vragen FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.maatwerk_vraag_regels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all" ON public.maatwerk_vraag_regels;
CREATE POLICY "public_all" ON public.maatwerk_vraag_regels FOR ALL USING (true) WITH CHECK (true);