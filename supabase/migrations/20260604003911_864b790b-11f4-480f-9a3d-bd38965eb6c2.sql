-- Voeg bron-informatie toe aan winkelwagen_correcties en beheer_notificaties.
ALTER TABLE public.winkelwagen_correcties
  ADD COLUMN IF NOT EXISTS bron_tabel text,
  ADD COLUMN IF NOT EXISTS bron_id text,
  ADD COLUMN IF NOT EXISTS bron_herkomst text,
  ADD COLUMN IF NOT EXISTS bijdragen jsonb;

ALTER TABLE public.beheer_notificaties
  ADD COLUMN IF NOT EXISTS bron_tabel text,
  ADD COLUMN IF NOT EXISTS bron_id text,
  ADD COLUMN IF NOT EXISTS bron_herkomst text,
  ADD COLUMN IF NOT EXISTS meerdere_bronnen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bijdragen jsonb;

-- Update trigger: 'altijd' maakt direct (drempel=1) een notificatie aan,
-- 'soms' blijft op drempel=3, 'eenmalig' wordt niet meegenomen.
-- Bron-info wordt mee opgeslagen op de notificatie.
CREATE OR REPLACE FUNCTION public.check_correctie_drempel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count int;
  v_gem numeric;
  v_ids uuid[];
  v_bestaand uuid;
  v_drempel int;
  v_bron_tabellen text[];
  v_meerdere boolean;
BEGIN
  IF NEW.scope = 'eenmalig' THEN
    RETURN NEW;
  END IF;

  v_drempel := CASE NEW.scope WHEN 'altijd' THEN 1 ELSE 3 END;

  SELECT
    count(*),
    avg(nieuwe_hoeveelheid),
    array_agg(id),
    array_agg(DISTINCT coalesce(bron_tabel, ''))
  INTO v_count, v_gem, v_ids, v_bron_tabellen
  FROM public.winkelwagen_correcties
  WHERE artikel_nummer = NEW.artikel_nummer
    AND case_type = NEW.case_type
    AND sub_type = NEW.sub_type
    AND actie = NEW.actie
    AND scope IN ('altijd', 'soms');

  IF v_count >= v_drempel THEN
    v_meerdere := (array_length(array_remove(v_bron_tabellen, ''), 1) > 1)
                  OR (NEW.bron_tabel IS NULL);

    SELECT id INTO v_bestaand
    FROM public.beheer_notificaties
    WHERE artikel_nummer = NEW.artikel_nummer
      AND case_type = NEW.case_type
      AND sub_type = NEW.sub_type
      AND actie = NEW.actie
      AND status = 'open';

    IF v_bestaand IS NOT NULL THEN
      UPDATE public.beheer_notificaties
      SET
        aantal_correcties = v_count,
        gemiddelde_wijziging = v_gem,
        correctie_ids = v_ids,
        bron_tabel = coalesce(NEW.bron_tabel, bron_tabel),
        bron_id = coalesce(NEW.bron_id, bron_id),
        bron_herkomst = coalesce(NEW.bron_herkomst, bron_herkomst),
        meerdere_bronnen = meerdere_bronnen OR v_meerdere,
        bijdragen = coalesce(NEW.bijdragen, bijdragen),
        updated_at = now()
      WHERE id = v_bestaand;
    ELSE
      INSERT INTO public.beheer_notificaties (
        type, case_type, sub_type, artikel_nummer,
        korte_omschrijving, actie, gemiddelde_wijziging,
        aantal_correcties, correctie_ids,
        bron_tabel, bron_id, bron_herkomst, meerdere_bronnen, bijdragen
      ) VALUES (
        CASE NEW.actie
          WHEN 'verwijderd' THEN 'artikel_verwijderen'
          WHEN 'toegevoegd' THEN 'artikel_toevoegen'
          ELSE 'standaard_aanpassen'
        END,
        NEW.case_type, NEW.sub_type, NEW.artikel_nummer,
        NEW.korte_omschrijving, NEW.actie, v_gem,
        v_count, v_ids,
        NEW.bron_tabel, NEW.bron_id, NEW.bron_herkomst, v_meerdere, NEW.bijdragen
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Zorg dat de trigger bestaat (kan ontbreken).
DROP TRIGGER IF EXISTS trg_correctie_drempel ON public.winkelwagen_correcties;
CREATE TRIGGER trg_correctie_drempel
AFTER INSERT ON public.winkelwagen_correcties
FOR EACH ROW EXECUTE FUNCTION public.check_correctie_drempel();