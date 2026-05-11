
-- Stamtabellen
CREATE TABLE public.artikelen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artikel_nummer text UNIQUE NOT NULL,
  korte_omschrijving text NOT NULL,
  eenheid text NOT NULL DEFAULT 'st',
  categorie text,
  actief boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rmu_configuraties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  merk text NOT NULL,
  is_inet boolean NOT NULL DEFAULT false,
  aantal_velden int NOT NULL DEFAULT 0,
  aantal_f int NOT NULL DEFAULT 0,
  aantal_c int NOT NULL DEFAULT 0,
  aantal_v int NOT NULL DEFAULT 0,
  rmu_artikel_id uuid REFERENCES public.artikelen(id),
  frame_artikel_id uuid REFERENCES public.artikelen(id),
  actief boolean NOT NULL DEFAULT true
);

CREATE TABLE public.rmu_veld_artikelen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merk text NOT NULL,
  is_inet boolean NOT NULL DEFAULT false,
  veld_type text NOT NULL,
  artikel_id uuid NOT NULL REFERENCES public.artikelen(id),
  hoeveelheid numeric NOT NULL DEFAULT 1,
  hoeveelheid_formule text
);

CREATE TABLE public.rmu_zekeringen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merk text NOT NULL,
  trafo_kva int NOT NULL,
  artikel_id uuid NOT NULL REFERENCES public.artikelen(id),
  hoeveelheid numeric NOT NULL DEFAULT 3
);

CREATE TABLE public.trafo_vult_kabel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trafo_kva int UNIQUE NOT NULL,
  aantal_kabels int NOT NULL DEFAULT 1,
  kabel_doorsnede int NOT NULL,
  aantal_perskabelschoenen int NOT NULL DEFAULT 6,
  perskabelschoen_artikel_id uuid REFERENCES public.artikelen(id)
);

CREATE TABLE public.ms_mof_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  omschrijving text,
  bestaand_type text NOT NULL,
  bestaand_doorsnede_min int,
  bestaand_doorsnede_max int,
  artikel_id uuid REFERENCES public.artikelen(id),
  actief boolean NOT NULL DEFAULT true
);

CREATE TABLE public.ms_mof_materialen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mof_type_id uuid NOT NULL REFERENCES public.ms_mof_types(id) ON DELETE CASCADE,
  artikel_id uuid NOT NULL REFERENCES public.artikelen(id),
  hoeveelheid numeric NOT NULL DEFAULT 1,
  hoeveelheid_formule text
);

CREATE TABLE public.ls_mof_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  bestaand_type text NOT NULL,
  omschrijving text,
  actief boolean NOT NULL DEFAULT true
);

CREATE TABLE public.ls_mof_materialen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mof_type_id uuid NOT NULL REFERENCES public.ls_mof_types(id) ON DELETE CASCADE,
  artikel_id uuid NOT NULL REFERENCES public.artikelen(id),
  hoeveelheid numeric NOT NULL DEFAULT 1,
  hoeveelheid_formule text
);

CREATE TABLE public.standaard_materialen_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_type text NOT NULL,
  artikel_id uuid NOT NULL REFERENCES public.artikelen(id),
  standaard_hoeveelheid numeric NOT NULL DEFAULT 1
);

CREATE TABLE public.station_vaste_artikelen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  groep text,
  van_toepassing_bij text[] NOT NULL DEFAULT '{}',
  artikel_id uuid NOT NULL REFERENCES public.artikelen(id),
  hoeveelheid numeric NOT NULL DEFAULT 1,
  actief boolean NOT NULL DEFAULT true
);

-- Projecttabellen
CREATE TABLE public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_nummer text,
  station_naam text,
  status text NOT NULL DEFAULT 'concept',
  case_type text NOT NULL,
  sub_type text,
  notities text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.case_materialen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  artikel_id uuid NOT NULL REFERENCES public.artikelen(id),
  gewenste_hoeveelheid numeric NOT NULL DEFAULT 0,
  niet_bestellen boolean NOT NULL DEFAULT false,
  herkomst_label text,
  notitie text,
  UNIQUE (case_id, artikel_id)
);

CREATE TABLE public.case_ms_moffen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  positie int NOT NULL,
  zwaaien boolean NOT NULL DEFAULT false,
  bestaand_type text,
  doorsnede int,
  mof_type_id uuid REFERENCES public.ms_mof_types(id),
  mof_handmatig boolean NOT NULL DEFAULT false,
  fase text
);

CREATE TABLE public.case_ls_moffen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  positie int NOT NULL,
  type text NOT NULL,
  bestaand_type text NOT NULL,
  aantal int NOT NULL DEFAULT 1,
  overzettingen int NOT NULL DEFAULT 0
);

-- updated_at trigger voor cases
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_cases_updated_at BEFORE UPDATE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS aan + public policies
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'artikelen','rmu_configuraties','rmu_veld_artikelen','rmu_zekeringen',
    'trafo_vult_kabel','ms_mof_types','ms_mof_materialen','ls_mof_types',
    'ls_mof_materialen','standaard_materialen_templates','station_vaste_artikelen',
    'cases','case_materialen','case_ms_moffen','case_ls_moffen'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "public_all" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
