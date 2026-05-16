INSERT INTO public.artikelen (artikel_nummer, korte_omschrijving, eenheid, categorie, status, actief)
VALUES
  ('20036049', 'Kabelbeschermbuis PVC 160x4,7 rood L=6m', 'LT', 'MS kabels', 'Actief', true),
  ('20028640', 'Kabelbeschermbuis PVC 110x3,2 rood L=6m', 'LT', 'MS kabels', 'Actief', true),
  ('20043703', 'Geotextiel 1x1m gevouwen 25x25cm',         'ST', 'MS kabels', 'Actief', true)
ON CONFLICT (artikel_nummer) DO NOTHING;