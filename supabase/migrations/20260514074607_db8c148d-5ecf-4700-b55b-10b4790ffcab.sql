INSERT INTO public.artikelen (artikel_nummer, korte_omschrijving, eenheid, categorie, status, actief)
VALUES
  ('26001090', 'Nettrafo 10kV  250kVA  DYN5 isol',                'ST',  'MS/LS transformator.', 'Actief', true),
  ('26001120', 'Nettrafo 10kV  400kVA  DYN5 isol',                'ST',  'MS/LS transformator.', 'Actief', true),
  ('26001150', 'Nettrafo 10kV  630kVA  DYN5 isol',                'ST',  'MS/LS transformator.', 'Actief', true),
  ('20019629', 'U-profiel v opstelling trafo L=1000mm',           'ST',  'MS/LS transformator.', 'Actief', true),
  ('20011412', 'Afschermplaat v Ls-zijde nettrafo +bev.b',        'ST',  'MS/LS transformator.', 'Actief', true),
  ('20019614', 'Afschermkap kunststof v 10kV-zijde trafo',        'ST',  'MS/LS transformator.', 'Actief', true),
  ('20017534', 'Soepele verbinding  50mm2 gat=21mm L=390',        'ST',  'MS garnituren',        'Actief', true),
  ('20038832', 'Aansluitvlag 200 t/m 400kVA v trafo',             'SET', 'MS/LS transformator.', 'Actief', true),
  ('20042706', 'Aansluitvlag trafo LS  630kVA  (set=4st)',        'SET', 'MS/LS transformator.', 'Actief', true),
  ('20044290', 'Kabelbevestigingsklem v 3kabels 24-35mm',         'ST',  'MS/LS transformator.', 'Actief', true)
ON CONFLICT (artikel_nummer) DO NOTHING;