INSERT INTO public.artikelen (artikel_nummer, korte_omschrijving, eenheid, categorie, status, actief)
VALUES
  ('20042042', 'Kabelbevestigingsklem 52-56mm K56',    'ST', 'MS voedingsstations', 'Actief', true),
  ('20042043', 'Kabelbevestigingsklem 52-56mm K56 U',  'ST', 'MS voedingsstations', 'Actief', true),
  ('20018004', 'Kabelinlegklem 50-150mm2 Al m stift M10', 'ST', 'MS voedingsstations', 'Actief', true)
ON CONFLICT (artikel_nummer) DO NOTHING;