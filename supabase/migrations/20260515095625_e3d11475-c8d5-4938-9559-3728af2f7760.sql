INSERT INTO public.artikelen (artikel_nummer, korte_omschrijving, eenheid, categorie, status, actief)
VALUES
  ('20029657', 'Kabel YMvK 4x 2,5mm2',                          'M',  'LS kabels',     'Actief', true),
  ('20050552', 'Lasklem inst 0,2-4mm2 3x #Wago 221-413',        'ST', 'LS garnituren', 'Actief', true)
ON CONFLICT (artikel_nummer) DO NOTHING;