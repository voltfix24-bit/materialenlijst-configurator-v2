
-- Nieuwe artikelen
INSERT INTO public.artikelen (artikel_nummer, korte_omschrijving, eenheid, categorie, status, actief)
VALUES
  ('20009692', 'Kabel V-VMvKhsas 4x150Al + 4x6 + sas50',         'M',  'LS kabels',    'Actief', true),
  ('20043767', 'Giethars wikkelmof 1500ml',                       'ST', 'LS garnituren','Actief', true),
  ('20041565', 'Ringklem 4x150Al & 4x120Cu /4x95Al-150Al',        'ST', 'LS garnituren','Actief', true),
  ('20041459', 'Ringklem 4x95-150Al / 4x6Cu-50Al',                'ST', 'LS garnituren','Actief', true),
  ('20000996', 'Ringklem 3x 35+1x25Cu / 4x6Cu-50Al',              'ST', 'LS garnituren','Actief', true),
  ('20017985', 'Ringklem 3x 50+1x35Cu / 4x6Cu-50Al',              'ST', 'LS garnituren','Actief', true),
  ('20041571', 'Ringklem 4x35-70Cu & 4x50Al /4x6Cu-50Al',         'ST', 'LS garnituren','Actief', true),
  ('20041574', 'Ringklem 4x25Cu / 4x6Cu-50Al',                    'ST', 'LS garnituren','Actief', true),
  ('20041575', 'Ringklem 3x70-95+1x50-70 / 4x6Cu-50Al',           'ST', 'LS garnituren','Actief', true),
  ('20041564', 'Ringklem 4x95Al / 4x95Al-150Al',                  'ST', 'LS garnituren','Actief', true),
  ('20041563', 'Ringklem 4x150Cu / 4x6Cu-50Al',                   'ST', 'LS garnituren','Actief', true),
  ('20041567', 'Aftakklem geïsol. 16-95Cu&25-150Al/150Al',        'ST', 'LS garnituren','Actief', true),
  ('20041608', 'Aftakklem geïsoleerd 1-10Cu/1-10Cu',              'ST', 'LS garnituren','Actief', true),
  ('20041618', 'Aftakklem geïsoleer Aarde-0 16-70/16-35',         'ST', 'LS garnituren','Actief', true),
  ('20041619', 'Aftakklem geïsoleer Aarde0 95-150/35-50',         'ST', 'LS garnituren','Actief', true),
  ('20043487', 'Aftakklem geisoleerd OV-0 16-150/1,5-16',         'ST', 'LS garnituren','Actief', true)
ON CONFLICT (artikel_nummer) DO NOTHING;

-- Reseed ls_mof_types + materialen
DELETE FROM public.ls_mof_materialen;
DELETE FROM public.ls_mof_types;

INSERT INTO public.ls_mof_types (id, type, bestaand_type, omschrijving, actief)
VALUES
  (gen_random_uuid(), 'verbinding', 'GPLK',      'Verbindingsmof GPLK',       true),
  (gen_random_uuid(), 'verbinding', 'kunststof', 'Verbindingsmof kunststof',  true),
  (gen_random_uuid(), 'verbinding', 'beide',     'Verbindingsmof universeel', true),
  (gen_random_uuid(), 'aftakmof',   'GPLK',      'Aftakmof GPLK',             true),
  (gen_random_uuid(), 'aftakmof',   'kunststof', 'Aftakmof kunststof',        true),
  (gen_random_uuid(), 'eindmof',    'GPLK',      'Eindmof GPLK',              true),
  (gen_random_uuid(), 'eindmof',    'kunststof', 'Eindmof kunststof',         true);

DO $$
DECLARE v_id uuid;
BEGIN
  FOR v_id IN SELECT id FROM public.ls_mof_types WHERE type = 'verbinding'
  LOOP
    INSERT INTO public.ls_mof_materialen (mof_type_id, artikel_id, hoeveelheid)
    SELECT v_id, a.id, s.qty
    FROM (VALUES
      ('20043763', 5),
      ('20018102', 2),
      ('20018103', 1),
      ('20023996', 1),
      ('20036317', 1),
      ('20039901', 5),
      ('20041556', 1),
      ('20041557', 1),
      ('20043767', 2),
      ('20043765', 2),
      ('20001011', 2),
      ('20001006', 2),
      ('20041553', 1)
    ) AS s(nr, qty)
    JOIN public.artikelen a ON a.artikel_nummer = s.nr;
  END LOOP;
END $$;

DO $$
DECLARE v_id uuid;
BEGIN
  FOR v_id IN SELECT id FROM public.ls_mof_types WHERE type = 'aftakmof'
  LOOP
    INSERT INTO public.ls_mof_materialen (mof_type_id, artikel_id, hoeveelheid)
    SELECT v_id, a.id, s.qty
    FROM (VALUES
      ('20043763', 5),
      ('20018102', 2),
      ('20018103', 1),
      ('20023996', 1),
      ('20036317', 1),
      ('20039901', 5),
      ('20041556', 1),
      ('20041557', 1),
      ('20043767', 2),
      ('20043765', 2),
      ('20001011', 2),
      ('20001006', 2)
    ) AS s(nr, qty)
    JOIN public.artikelen a ON a.artikel_nummer = s.nr;
  END LOOP;
END $$;
