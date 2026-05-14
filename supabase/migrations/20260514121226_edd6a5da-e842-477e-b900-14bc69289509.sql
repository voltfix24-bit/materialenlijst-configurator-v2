INSERT INTO public.artikelen (artikel_nummer, korte_omschrijving, eenheid, categorie, status, actief)
VALUES
  ('20050761', 'LS-rek 1000A 630kVA v 12 richtingen',        'ST',  'MS voedingsstations', 'Actief', true),
  ('20050813', 'LS-rek 1000A 630kVA v 8 richtingen',         'ST',  'MS voedingsstations', 'Actief', true),
  ('20020042', 'Ls-strook 400A 1-P schakelbaar JM',           'ST',  'MS voedingsstations', 'Actief', true),
  ('20036622', 'Mespatroon 361A DIN-3 gTr-250kVA trafo',     'ST',  'MS beveiliging',      'Actief', true),
  ('20036623', 'Mespatroon 577A DIN-3 gTr-400kVA trafo',     'ST',  'MS beveiliging',      'Actief', true),
  ('20036624', 'Mespatroon 909A DIN-3 gTr-630kVA trafo',     'ST',  'MS beveiliging',      'Actief', true),
  ('20001107', 'Schroefpatroon 35A DT3 traag',               'ST',  'MS beveiliging',      'Actief', true),
  ('20001108', 'Schroefpatroon 50A DT3 traag',               'ST',  'MS beveiliging',      'Actief', true),
  ('20040148', 'Router 4G FlexOV',                           'ST',  'MS voedingsstations', 'Actief', true),
  ('20040188', 'Beugel L-vormig v montage FlexOV',           'ST',  'MS voedingsstations', 'Actief', true),
  ('20039993', 'FlexOV device',                              'ST',  'MS voedingsstations', 'Actief', true),
  ('20039994', 'Beugel v montage FlexOV',                    'ST',  'MS voedingsstations', 'Actief', true),
  ('20040149', 'Kabel ethernet shielded 50cm FlexOV',        'ST',  'MS voedingsstations', 'Actief', true)
ON CONFLICT (artikel_nummer) DO NOTHING;