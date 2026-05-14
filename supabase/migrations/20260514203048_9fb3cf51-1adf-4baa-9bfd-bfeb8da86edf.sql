ALTER TABLE public.case_ms_moffen
  ADD COLUMN IF NOT EXISTS nieuw_type text,
  ADD COLUMN IF NOT EXISTS nieuw_doorsnede int,
  ADD COLUMN IF NOT EXISTS is_eindmof boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS mof_definitief_type_id uuid REFERENCES public.ms_mof_types(id),
  ADD COLUMN IF NOT EXISTS def_bestaand_type text,
  ADD COLUMN IF NOT EXISTS def_doorsnede int,
  ADD COLUMN IF NOT EXISTS def_nieuw_type text,
  ADD COLUMN IF NOT EXISTS def_nieuw_doorsnede int,
  ADD COLUMN IF NOT EXISTS def_mof_handmatig boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS def_is_eindmof boolean DEFAULT false;

ALTER TABLE public.case_ls_moffen
  ADD COLUMN IF NOT EXISTS hoofdkabel_doorsnede int,
  ADD COLUMN IF NOT EXISTS hoofdkabel_materiaal text,
  ADD COLUMN IF NOT EXISTS aantal_aftakken int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS aftak_doorsnede int,
  ADD COLUMN IF NOT EXISTS ringklem_artikel_nummer text,
  ADD COLUMN IF NOT EXISTS ringklem_handmatig boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS kan_zwaaien boolean,
  ADD COLUMN IF NOT EXISTS kabel_lengte_meters int DEFAULT 0;

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS config_json jsonb;