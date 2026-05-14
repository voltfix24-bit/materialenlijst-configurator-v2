-- Uitbreiding ms_mof_types tabel
ALTER TABLE public.ms_mof_types
  ADD COLUMN IF NOT EXISTS nieuwe_type text,
  ADD COLUMN IF NOT EXISTS nieuwe_doorsnede_min int,
  ADD COLUMN IF NOT EXISTS nieuwe_doorsnede_max int;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE constraint_name='ms_mof_types_nieuwe_type_check') THEN
    ALTER TABLE public.ms_mof_types ADD CONSTRAINT ms_mof_types_nieuwe_type_check
      CHECK (nieuwe_type IS NULL OR nieuwe_type IN ('GPLK','XLPE','XLPE_singel','beide'));
  END IF;
END $$;

-- Unieke index op artikel_nummer als die er nog niet is (nodig voor ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS artikelen_artikel_nummer_uidx ON public.artikelen(artikel_nummer);

-- Nieuwe mof artikelen
INSERT INTO public.artikelen (artikel_nummer, korte_omschrijving, eenheid, categorie, status, actief)
VALUES
  ('20037531','Mof GPLK 10kV 3x240-300/XLPE20kV3x1x630','ST','MS garnituren','Actief',true),
  ('20039275','Mof XLPE 10-20kV 1x630','ST','MS garnituren','Actief',true),
  ('20039276','Mof XLPE 10-20kV 3x95-240','ST','MS garnituren','Actief',true),
  ('20039304','Mof GPLK 10kV 3x95-240','ST','MS garnituren','Actief',true),
  ('20039305','Mof GPLK 10kV 3x35-95','ST','MS garnituren','Actief',true),
  ('20039306','Mof GPLK 10kV 3x95-240/XLPE10-20kV3x240','ST','MS garnituren','Actief',true),
  ('20039307','Mof GPLK 10kV 3x35-70/XLPE 10-20kV3x240','ST','MS garnituren','Actief',true),
  ('20039421','Mof GPLK 10kV 3x50-95 / XLPE 10kV 3x95','ST','MS garnituren','Actief',true),
  ('20040325','Mof XLPE 20kV 1x150-240','ST','MS garnituren','Actief',true),
  ('20041048','Mof XLPE 10-20kV 3x240/20kV 3x1x400-630','ST','MS garnituren','Actief',true),
  ('20041929','Mof GPLK 10kV 3x25-70/XLPE 20kV 3x1x240','ST','MS garnituren','Actief',true),
  ('20041930','Mof GPLK 10kV 3x95-240/XLPE 20kV 3x1x240','ST','MS garnituren','Actief',true),
  ('20041931','Mof XLPE 10-20kV 3x95-240 / 20kV 3x1x240','ST','MS garnituren','Actief',true),
  ('20044293','Mof XLPE 20kV 1x240 / 10-20kV 1x630','ST','MS garnituren','Actief',true),
  ('20050555','Mof XLPE 20kV 1x400 / 20kV 1x630','ST','MS garnituren','Actief',true)
ON CONFLICT (artikel_nummer) DO NOTHING;

-- Seed mof types
INSERT INTO public.ms_mof_types (code, omschrijving, bestaand_type, bestaand_doorsnede_min, bestaand_doorsnede_max, nieuwe_type, nieuwe_doorsnede_min, nieuwe_doorsnede_max, artikel_id, actief)
SELECT s.code, s.omschrijving, s.best_type, s.best_min, s.best_max, s.nieuw_type, s.nieuw_min, s.nieuw_max, a.id, true
FROM (VALUES
  ('GPLK-240-630S','Mof GPLK 10kV 3x240-300/XLPE20kV3x1x630','GPLK',240,300,'XLPE_singel',630,630,'20037531'),
  ('XLPE-1x630','Mof XLPE 10-20kV 1x630','XLPE_singel',630,630,'XLPE_singel',630,630,'20039275'),
  ('XLPE-3x95-240','Mof XLPE 10-20kV 3x95-240','XLPE',95,240,'XLPE',95,240,'20039276'),
  ('GPLK-3x95-240','Mof GPLK 10kV 3x95-240','GPLK',95,240,'GPLK',95,240,'20039304'),
  ('GPLK-3x35-95','Mof GPLK 10kV 3x35-95','GPLK',35,95,'GPLK',35,95,'20039305'),
  ('GPLK-240-X240','Mof GPLK 10kV 3x95-240/XLPE10-20kV3x240','GPLK',95,240,'XLPE',240,240,'20039306'),
  ('GPLK-70-X240','Mof GPLK 10kV 3x35-70/XLPE 10-20kV3x240','GPLK',35,70,'XLPE',240,240,'20039307'),
  ('GPLK-95-X95','Mof GPLK 10kV 3x50-95 / XLPE 10kV 3x95','GPLK',50,95,'XLPE',95,95,'20039421'),
  ('XLPE-1x150-240','Mof XLPE 20kV 1x150-240','XLPE_singel',150,240,'XLPE_singel',150,240,'20040325'),
  ('XLPE-3x240-630','Mof XLPE 10-20kV 3x240/20kV 3x1x400-630','XLPE',240,240,'XLPE_singel',400,630,'20041048'),
  ('GPLK-70-1x240','Mof GPLK 10kV 3x25-70/XLPE 20kV 3x1x240','GPLK',25,70,'XLPE_singel',240,240,'20041929'),
  ('GPLK-240-1x240','Mof GPLK 10kV 3x95-240/XLPE 20kV 3x1x240','GPLK',95,240,'XLPE_singel',240,240,'20041930'),
  ('XLPE-240-1x240','Mof XLPE 10-20kV 3x95-240 / 20kV 3x1x240','XLPE',95,240,'XLPE_singel',240,240,'20041931'),
  ('XLPE-1x240-630','Mof XLPE 20kV 1x240 / 10-20kV 1x630','XLPE_singel',240,240,'XLPE_singel',630,630,'20044293'),
  ('XLPE-1x400-630','Mof XLPE 20kV 1x400 / 20kV 1x630','XLPE_singel',400,400,'XLPE_singel',630,630,'20050555')
) AS s(code, omschrijving, best_type, best_min, best_max, nieuw_type, nieuw_min, nieuw_max, art_nr)
JOIN public.artikelen a ON a.artikel_nummer = s.art_nr
WHERE NOT EXISTS (SELECT 1 FROM public.ms_mof_types t WHERE t.code = s.code);