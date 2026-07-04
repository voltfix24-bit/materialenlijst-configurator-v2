-- Fase 1: betrouwbaar opslaan & bestelhistorie
--
-- 1. case_exporten — bevroren momentopname van elke Excel-export (= bestelling
--    richting Liander). Regels en stamdata veranderen door de maandelijkse
--    sync; zonder snapshot is niet meer terug te zien wat destijds besteld is.
-- 2. sla_case_op() — transactioneel vervangen van config + materialen +
--    moffen. Voorheen deed de client delete-dan-insert zonder transactie;
--    een fout na de delete kon de materiaallijst van een case wissen.

CREATE TABLE IF NOT EXISTS public.case_exporten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  bestand_naam text NOT NULL,
  case_nummer text,
  station_naam text,
  aantal_artikelen integer NOT NULL DEFAULT 0,
  matched integer NOT NULL DEFAULT 0,
  unmatched jsonb NOT NULL DEFAULT '[]'::jsonb,
  inactief jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Exacte lijst zoals die in de Excel is gezet: [{artikel_nummer, hoeveelheid, ...}]
  items jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_case_exporten_case_id
  ON public.case_exporten (case_id, created_at DESC);

ALTER TABLE public.case_exporten ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all" ON public.case_exporten;
CREATE POLICY "public_all" ON public.case_exporten FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.sla_case_op(
  p_case_id uuid,
  p_sub_type text,
  p_config_json jsonb,
  p_materialen jsonb DEFAULT '[]'::jsonb,
  p_ms_moffen jsonb DEFAULT '[]'::jsonb,
  p_ls_moffen jsonb DEFAULT '[]'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE cases
  SET sub_type = p_sub_type,
      config_json = p_config_json,
      updated_at = now()
  WHERE id = p_case_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Case % bestaat niet', p_case_id;
  END IF;

  DELETE FROM case_materialen WHERE case_id = p_case_id;
  INSERT INTO case_materialen (case_id, artikel_id, gewenste_hoeveelheid, niet_bestellen, herkomst_label)
  SELECT
    p_case_id,
    (m->>'artikel_id')::uuid,
    coalesce((m->>'gewenste_hoeveelheid')::numeric, 0),
    coalesce((m->>'niet_bestellen')::boolean, false),
    m->>'herkomst_label'
  FROM jsonb_array_elements(coalesce(p_materialen, '[]'::jsonb)) AS m;

  DELETE FROM case_ms_moffen WHERE case_id = p_case_id;
  INSERT INTO case_ms_moffen (
    case_id, positie, zwaaien, fase, bestaand_type, doorsnede, nieuw_type, nieuw_doorsnede,
    mof_type_id, mof_handmatig, is_eindmof, mof_definitief_type_id,
    def_bestaand_type, def_doorsnede, def_nieuw_type, def_nieuw_doorsnede,
    def_mof_handmatig, def_is_eindmof
  )
  SELECT
    p_case_id,
    (m->>'positie')::int,
    coalesce((m->>'zwaaien')::boolean, false),
    m->>'fase',
    m->>'bestaand_type',
    (m->>'doorsnede')::numeric,
    m->>'nieuw_type',
    (m->>'nieuw_doorsnede')::numeric,
    (m->>'mof_type_id')::uuid,
    coalesce((m->>'mof_handmatig')::boolean, false),
    coalesce((m->>'is_eindmof')::boolean, false),
    (m->>'mof_definitief_type_id')::uuid,
    m->>'def_bestaand_type',
    (m->>'def_doorsnede')::numeric,
    m->>'def_nieuw_type',
    (m->>'def_nieuw_doorsnede')::numeric,
    coalesce((m->>'def_mof_handmatig')::boolean, false),
    coalesce((m->>'def_is_eindmof')::boolean, false)
  FROM jsonb_array_elements(coalesce(p_ms_moffen, '[]'::jsonb)) AS m;

  DELETE FROM case_ls_moffen WHERE case_id = p_case_id;
  INSERT INTO case_ls_moffen (
    case_id, positie, type, bestaand_type, hoofdkabel_doorsnede, hoofdkabel_materiaal,
    aantal_aftakken, aftak_doorsnede, ringklem_artikel_nummer, ringklem_handmatig,
    aantal, kan_zwaaien, kabel_lengte_meters, overzettingen
  )
  SELECT
    p_case_id,
    (m->>'positie')::int,
    m->>'type',
    m->>'bestaand_type',
    (m->>'hoofdkabel_doorsnede')::numeric,
    m->>'hoofdkabel_materiaal',
    (m->>'aantal_aftakken')::int,
    (m->>'aftak_doorsnede')::numeric,
    m->>'ringklem_artikel_nummer',
    coalesce((m->>'ringklem_handmatig')::boolean, false),
    coalesce((m->>'aantal')::int, 1),
    (m->>'kan_zwaaien')::boolean,
    (m->>'kabel_lengte_meters')::numeric,
    coalesce((m->>'overzettingen')::int, 0)
  FROM jsonb_array_elements(coalesce(p_ls_moffen, '[]'::jsonb)) AS m;
END;
$function$;
