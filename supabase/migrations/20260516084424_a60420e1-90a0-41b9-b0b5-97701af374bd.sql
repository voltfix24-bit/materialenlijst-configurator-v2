-- ── CORRECTIES ────────────────────────────────────────────────
CREATE TABLE public.winkelwagen_correcties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  case_type text NOT NULL,
  sub_type text NOT NULL,
  artikel_nummer text NOT NULL,
  korte_omschrijving text,
  actie text NOT NULL CHECK (actie IN ('hoeveelheid_gewijzigd', 'verwijderd', 'toegevoegd')),
  oude_hoeveelheid numeric,
  nieuwe_hoeveelheid numeric,
  reden text,
  scope text NOT NULL CHECK (scope IN ('eenmalig', 'altijd', 'soms')),
  engineer_id text,
  created_at timestamptz DEFAULT now()
);

-- ── NOTIFICATIES ──────────────────────────────────────────────
CREATE TABLE public.beheer_notificaties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('standaard_aanpassen', 'artikel_verwijderen', 'artikel_toevoegen')),
  case_type text NOT NULL,
  sub_type text NOT NULL,
  artikel_nummer text NOT NULL,
  korte_omschrijving text,
  actie text NOT NULL,
  gemiddelde_wijziging numeric,
  aantal_correcties int NOT NULL DEFAULT 1,
  correctie_ids uuid[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'goedgekeurd', 'afgewezen')),
  afgehandeld_door text,
  afgehandeld_op timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.winkelwagen_correcties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beheer_notificaties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all" ON public.winkelwagen_correcties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.beheer_notificaties FOR ALL USING (true) WITH CHECK (true);

-- ── DREMPEL FUNCTIE ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_correctie_drempel()
RETURNS TRIGGER AS $$
DECLARE
  v_count int;
  v_gem numeric;
  v_ids uuid[];
  v_bestaand uuid;
BEGIN
  SELECT
    count(*),
    avg(nieuwe_hoeveelheid),
    array_agg(id)
  INTO v_count, v_gem, v_ids
  FROM public.winkelwagen_correcties
  WHERE artikel_nummer = NEW.artikel_nummer
    AND case_type = NEW.case_type
    AND sub_type = NEW.sub_type
    AND actie = NEW.actie
    AND scope IN ('altijd', 'soms');

  IF v_count >= 3 THEN
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
        updated_at = now()
      WHERE id = v_bestaand;
    ELSE
      INSERT INTO public.beheer_notificaties (
        type, case_type, sub_type, artikel_nummer,
        korte_omschrijving, actie, gemiddelde_wijziging,
        aantal_correcties, correctie_ids
      ) VALUES (
        CASE NEW.actie
          WHEN 'verwijderd' THEN 'artikel_verwijderen'
          WHEN 'toegevoegd' THEN 'artikel_toevoegen'
          ELSE 'standaard_aanpassen'
        END,
        NEW.case_type,
        NEW.sub_type,
        NEW.artikel_nummer,
        NEW.korte_omschrijving,
        NEW.actie,
        v_gem,
        v_count,
        v_ids
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER check_correctie_drempel_trigger
  AFTER INSERT ON public.winkelwagen_correcties
  FOR EACH ROW EXECUTE FUNCTION public.check_correctie_drempel();