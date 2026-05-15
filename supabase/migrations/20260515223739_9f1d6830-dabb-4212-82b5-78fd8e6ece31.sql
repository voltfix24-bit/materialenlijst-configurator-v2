-- Nieuwe artikelen toevoegen die nog niet bestaan
INSERT INTO public.artikelen (artikel_nummer, korte_omschrijving, eenheid, categorie, status, actief)
VALUES
  ('20019509', 'Mespatroon 63A DIN-000 gG',                    'ST', 'MS beveiliging', 'Actief', true),
  ('20019505', 'Mespatroon 25A DIN-000 gG',                    'ST', 'MS beveiliging', 'Actief', true),
  ('20040942', 'Buispatroon 25A gG 10x38mm tbv laadpaal',      'ST', 'MS beveiliging', 'Actief', true),
  ('20042844', 'Buispatroon 10A gG 10x38mm',                   'ST', 'MS beveiliging', 'Actief', true)
ON CONFLICT (artikel_nummer) DO NOTHING;

DELETE FROM public.standaard_materialen_templates
WHERE case_type = 'compact';

INSERT INTO public.standaard_materialen_templates (case_type, artikel_id, standaard_hoeveelheid)
SELECT 'compact', a.id, s.qty
FROM (VALUES
  ('20017761', 15),
  ('20042791', 10),
  ('20017766', 15),
  ('20005296', 15),
  ('20040779', 30),
  ('20017767', 15),
  ('20017768', 15),
  ('20001848', 1),
  ('20001849', 1),
  ('20001850', 1),
  ('20023988', 1),
  ('20016859', 2),
  ('20033773', 1),
  ('20033803', 1),
  ('20016876', 1),
  ('20018076', 10),
  ('20018148', 1),
  ('20030245', 1),
  ('20035640', 1),
  ('20019509', 3),
  ('20019505', 3),
  ('20040942', 20),
  ('20042844', 20)
) AS s(artikel_nummer, qty)
JOIN public.artikelen a ON a.artikel_nummer = s.artikel_nummer
ON CONFLICT DO NOTHING;