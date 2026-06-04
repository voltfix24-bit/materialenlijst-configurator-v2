-- Voeg context-velden toe aan winkelwagen_correcties: volledige case-configuratie en
-- expliciete meerdere_bronnen-flag. Werk trigger bij zodat hij deze flag respecteert.

ALTER TABLE public.winkelwagen_correcties
  ADD COLUMN IF NOT EXISTS config_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS meerdere_bronnen boolean NOT NULL DEFAULT false;

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
    -- Meerdere bronnen wanneer: expliciet gemarkeerd op de correctie, of
    -- verschillende bron-tabellen voorkomen, of er geen bron-tabel bekend is.
    v_meerdere := coalesce(NEW.meerdere_bronnen, false)
                  OR (array_length(array_remove(v_bron_tabellen, ''), 1) > 1)
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

-- Zorg dat de trigger bestaat (idempotent).
DROP TRIGGER IF EXISTS trg_check_correctie_drempel ON public.winkelwagen_correcties;
CREATE TRIGGER trg_check_correctie_drempel
  AFTER INSERT ON public.winkelwagen_correcties
  FOR EACH ROW EXECUTE FUNCTION public.check_correctie_drempel();
