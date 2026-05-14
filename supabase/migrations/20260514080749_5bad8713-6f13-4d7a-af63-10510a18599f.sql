INSERT INTO public.artikelen (artikel_nummer, korte_omschrijving, eenheid, categorie, status, actief)
VALUES
  ('20030299', 'Kabel YmvK ss  1x185mm2 soepel v trafo', 'M',   'MS/LS transformator.', 'Actief', true),
  ('20030300', 'Kabel YmvK ss  1x300mm2 soepel v trafo', 'M',   'MS/LS transformator.', 'Actief', true),
  ('20017790', 'Perskabelschoen 300mm2 Cu   gat=21mm DIN','ST',  'MS garnituren',        'Actief', true),
  ('20042739', 'Muurbeugel voor monteren trafokabels',    'SET', 'MS/LS transformator.', 'Actief', true)
ON CONFLICT (artikel_nummer) DO NOTHING;