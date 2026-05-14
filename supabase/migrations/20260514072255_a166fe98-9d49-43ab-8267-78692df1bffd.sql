INSERT INTO public.artikelen (artikel_nummer, korte_omschrijving, eenheid, categorie, status, actief)
VALUES
  ('20039303', 'Eindsl XLPE 15-20kV 3x1x16-25Cu ksTrafo',         'ST', 'MS garnituren',        'Actief', true),
  ('20039648', 'Eindsl XLPE 20kV 3x1x240 magnefix',               'ST', 'MS garnituren',        'Actief', true),
  ('20018032', 'Afschermset v XLPE-eindsl onder Magnefix',         'ST', 'MS garnituren',        'Actief', true),
  ('20029904', 'Doos met onderdelen v Magnefix MD4 KKT',           'ST', 'MS schakelinstallati', 'Actief', true),
  ('20029905', 'Doos met onderdelen v Magnefix MD4 KKKT',          'ST', 'MS schakelinstallati', 'Actief', true),
  ('20019483', 'Buispatroon 12kV 20A z slagst Fullrange',         'ST', 'MS beveiliging',       'Actief', true),
  ('20019484', 'Buispatroon 12kV 31,5A z slagst Fullrange',       'ST', 'MS beveiliging',       'Actief', true),
  ('20019485', 'Buispatroon 12kV 50A z slagst Fullrange',         'ST', 'MS beveiliging',       'Actief', true)
ON CONFLICT (artikel_nummer) DO NOTHING;