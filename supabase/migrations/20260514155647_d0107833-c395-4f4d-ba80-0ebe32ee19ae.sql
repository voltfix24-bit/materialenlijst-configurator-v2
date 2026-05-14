-- LS eindmof materialen seeden
DO $$
DECLARE v_id uuid;
BEGIN
  FOR v_id IN SELECT id FROM public.ls_mof_types WHERE type = 'eindmof'
  LOOP
    INSERT INTO public.ls_mof_materialen (mof_type_id, artikel_id, hoeveelheid)
    SELECT v_id, a.id, s.qty
    FROM (VALUES
      ('20043763', 3::numeric),
      ('20018102', 2::numeric),
      ('20023996', 2::numeric),
      ('20036317', 1::numeric),
      ('20043765', 2::numeric),
      ('20043767', 2::numeric),
      ('20001011', 1::numeric),
      ('20001006', 1::numeric),
      ('20041618', 1::numeric)
    ) AS s(nr, qty)
    JOIN public.artikelen a ON a.artikel_nummer = s.nr
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- MS eindmof type aanmaken
INSERT INTO public.ms_mof_types (code, omschrijving, bestaand_type, bestaand_doorsnede_min, bestaand_doorsnede_max, nieuwe_type, nieuwe_doorsnede_min, nieuwe_doorsnede_max, artikel_id, actief)
VALUES ('EINDMOF', 'MS Eindmof', 'GPLK', 0, 999, null, null, null, null, true)
ON CONFLICT DO NOTHING;

-- MS eindmof materialen
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.ms_mof_types WHERE code = 'EINDMOF';
  IF v_id IS NOT NULL THEN
    INSERT INTO public.ms_mof_materialen (mof_type_id, artikel_id, hoeveelheid)
    SELECT v_id, a.id, s.qty
    FROM (VALUES
      ('20043763', 9::numeric),
      ('20018102', 6::numeric),
      ('20023996', 6::numeric),
      ('20036317', 1::numeric),
      ('20043765', 2::numeric),
      ('20043767', 2::numeric)
    ) AS s(nr, qty)
    JOIN public.artikelen a ON a.artikel_nummer = s.nr
    ON CONFLICT DO NOTHING;
  END IF;
END $$;