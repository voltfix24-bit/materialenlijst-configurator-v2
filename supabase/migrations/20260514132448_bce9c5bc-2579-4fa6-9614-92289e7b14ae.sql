INSERT INTO public.artikelen (artikel_nummer, korte_omschrijving, eenheid, categorie, status, actief)
VALUES
  ('20039484', 'Kabel 20kV YMeKrvaslqwd 1x240Alrm + as25',          'M', 'MS kabels', 'Actief', true),
  ('20027992', 'Kabel 20kV P1/Y MeKrvaslqwd 1x630Alrm+35',          'M', 'MS kabels', 'Actief', true),
  ('20027989', 'Kabel 20kV P1/Y MeKrvaslqwd 3x240Alrm+50',          'M', 'MS kabels', 'Actief', true),
  ('20018148', 'Kabelbeschermband 250x2,5mm RD Hs (40m)',            'ST', 'MS kabels', 'Actief', true)
ON CONFLICT (artikel_nummer) DO NOTHING;