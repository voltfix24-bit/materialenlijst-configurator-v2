-- Nieuwe artikelen toevoegen
INSERT INTO public.artikelen (artikel_nummer, korte_omschrijving, eenheid, categorie, status, actief)
VALUES
  ('20036181', 'Aardkabel geisoleerd 50mm2 l=480mm',           'ST',  'MS voedingsstations',   'Actief', true),
  ('20004862', 'Stripkoper 20x3 vertind rol 1kg=1,70m',        'KG',  'MS voedingsstations',   'Actief', true),
  ('20017533', 'Soepele verbinding 50mm2 gat=14mm L=390',      'ST',  'MS garnituren',         'Actief', true),
  ('20018164', 'Soepele verbinding 25mm2 gat= 8mm L=500',      'ST',  'MS garnituren',         'Actief', true),
  ('20017561', 'Install.draad VD 50mm2 groen/gl samenges',     'M',   'MS voedingsstations',   'Actief', true),
  ('20015532', 'Afvalzak buit 80x120x0,01cm "Asbest"',         'ST',  'MRO algemeen',          'Actief', true),
  ('20000817', 'Cement snel hardend 12,5kg #Cebar',            'BUS', 'MRO algemeen',          'Actief', true),
  ('20001092', 'Sok v installatiebuis 5/8" slagvast',          'ST',  'LS-install.drd.&snr.',  'Actief', true),
  ('20029266', 'Muurplug Nylon #Fischer S6 ds100',             'DS',  'Bevestigingsmiddelen',  'Actief', true),
  ('20029267', 'Muurplug Nylon #Fischer S8 ds100',             'DS',  'Bevestigingsmiddelen',  'Actief', true),
  ('20029304', 'Spaanplaatschroef ck kk 5 x50 ds200',          'DS',  'Bevestigingsmiddelen',  'Actief', true),
  ('20029272', 'Plaatschroef bck kk 5,5x16 mont.pl ds200',     'DS',  'Bevestigingsmiddelen',  'Actief', true)
ON CONFLICT (artikel_nummer) DO NOTHING;

-- Schoon bestaande renovatie templates
DELETE FROM public.standaard_materialen_templates
WHERE case_type IN ('NSA', 'provisorium');

-- Standaard materialen voor renovatie (NSA en provisorium)
-- Stationsinrichting (20039090, 20041319, 20019026) bewust weggelaten -
-- die loopt via de GGI sectie om dubbele optelling te voorkomen.
DO $$
DECLARE v_case_type text;
BEGIN
  FOREACH v_case_type IN ARRAY ARRAY['NSA', 'provisorium']
  LOOP
    INSERT INTO public.standaard_materialen_templates (case_type, artikel_id, standaard_hoeveelheid)
    SELECT v_case_type, a.id, s.qty
    FROM (VALUES
      ('20019149', 50),
      ('20001092', 5),
      ('20029266', 1),
      ('20029267', 1),
      ('20029304', 1),
      ('20029272', 1),
      ('20039901', 10),
      ('20018076', 10),
      ('20038289', 12),
      ('20019177', 2),
      ('20017761', 15),
      ('20042791', 10),
      ('20017766', 15),
      ('20005296', 15),
      ('20040779', 30),
      ('20017767', 15),
      ('20017768', 15),
      ('20029268', 1),
      ('20029270', 1),
      ('20029215', 1),
      ('20029235', 1),
      ('20029278', 50),
      ('20033593', 10),
      ('20029343', 20),
      ('20029620', 10),
      ('20029479', 20),
      ('20040912', 2),
      ('20029385', 20),
      ('20018085', 40),
      ('20036822', 1),
      ('20036823', 1),
      ('20029336', 1),
      ('20029338', 1),
      ('20029328', 1),
      ('20036852', 1),
      ('20036853', 1),
      ('20029383', 1),
      ('20029384', 1),
      ('20018161', 5),
      ('20041869', 2),
      ('20005038', 10),
      ('20016859', 4),
      ('20033773', 2),
      ('20036850', 1),
      ('20036849', 1),
      ('20001850', 1),
      ('20001848', 1),
      ('20023988', 1),
      ('20001849', 1),
      ('20005037', 60),
      ('20039728', 5),
      ('20009637', 5),
      ('20016876', 1),
      ('20000984', 20),
      ('20038538', 10),
      ('20033803', 1),
      ('20039413', 1),
      ('20029218', 1),
      ('20029219', 1),
      ('20005450', 5),
      ('20006086', 200),
      ('20030246', 1),
      ('20016066', 1),
      ('20036181', 10),
      ('20004862', 26),
      ('20017533', 3),
      ('20018164', 20),
      ('20017561', 20),
      ('20017768', 10),
      ('20029657', 15),
      ('20015532', 4),
      ('20000817', 2),
      ('20019167', 15),
      ('20019168', 3)
    ) AS s(artikel_nummer, qty)
    JOIN public.artikelen a ON a.artikel_nummer = s.artikel_nummer
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;