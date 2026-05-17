-- Placeholder artikelen voor LS-rek (alle 16 nrs ontbreken nog)
INSERT INTO public.artikelen (artikel_nummer, korte_omschrijving, eenheid, categorie, actief) VALUES
  ('20050813', 'LS-rek 8 richtingen', 'st', 'LS-rek', true),
  ('20050761', 'LS-rek 12 richtingen', 'st', 'LS-rek', true),
  ('20020042', 'LS-rek extra strook', 'st', 'LS-rek', true),
  ('20042043', 'LS-rek kabelbevestigingsklem K56 U', 'st', 'LS-rek', true),
  ('20042042', 'LS-rek kabelbevestigingsklem K56', 'st', 'LS-rek', true),
  ('20018004', 'LS-rek kabelinlegklem', 'st', 'LS-rek', true),
  ('20036622', 'LS-rek mespatroon 250 kVA', 'st', 'LS-rek', true),
  ('20036623', 'LS-rek mespatroon 400 kVA', 'st', 'LS-rek', true),
  ('20036624', 'LS-rek mespatroon 630 kVA', 'st', 'LS-rek', true),
  ('20001107', 'OV-stuurpunt schroefpatroon 35A', 'st', 'OV-stuurpunt', true),
  ('20001108', 'OV-stuurpunt schroefpatroon 50A', 'st', 'OV-stuurpunt', true),
  ('20040148', 'OV-stuurpunt router', 'st', 'OV-stuurpunt', true),
  ('20040188', 'OV-stuurpunt beugel router', 'st', 'OV-stuurpunt', true),
  ('20039993', 'OV-stuurpunt FlexOV device', 'st', 'OV-stuurpunt', true),
  ('20039994', 'OV-stuurpunt beugel FlexOV', 'st', 'OV-stuurpunt', true),
  ('20040149', 'OV-stuurpunt kabel ethernet', 'st', 'OV-stuurpunt', true)
ON CONFLICT (artikel_nummer) DO NOTHING;

-- LS-rek regels tabel
CREATE TABLE public.ls_rek_regels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artikel_id uuid NOT NULL,
  hoeveelheid numeric NOT NULL DEFAULT 1,
  hoeveelheid_formule text,
  herkomst_label text NOT NULL,
  conditie_compact boolean,
  conditie_renovatie boolean,
  conditie_actie text,
  conditie_lsrek_type text,
  conditie_beveiliging_aanpassen boolean,
  conditie_ov_stuurpunt boolean,
  conditie_schroefpatroon text,
  conditie_kva text,
  sort_order integer NOT NULL DEFAULT 0,
  actief boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ls_rek_regels ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_all ON public.ls_rek_regels FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER touch_ls_rek_regels BEFORE UPDATE ON public.ls_rek_regels
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Helper inline om artikel_id op te halen
WITH a AS (SELECT artikel_nummer, id FROM public.artikelen)
INSERT INTO public.ls_rek_regels (
  artikel_id, hoeveelheid, hoeveelheid_formule, herkomst_label,
  conditie_compact, conditie_renovatie, conditie_actie, conditie_lsrek_type,
  conditie_beveiliging_aanpassen, conditie_ov_stuurpunt, conditie_schroefpatroon, conditie_kva,
  sort_order
)
SELECT a.id, q.qty, q.formule, q.label,
       q.c_compact, q.c_renovatie, q.c_actie, q.c_lsrek_type,
       q.c_bev_aanpassen, q.c_ov, q.c_schroef, q.c_kva,
       q.sort_order
FROM (VALUES
  -- Vervangen branch (!compact, renovatie, vervangen)
  ('20050813', 1::numeric, NULL::text, 'LS-rek 8 richtingen',          false, true, 'vervangen', '8',  NULL::boolean, NULL::boolean, NULL::text, NULL::text, 1),
  ('20050761', 1, NULL, 'LS-rek 12 richtingen',                          false, true, 'vervangen', '12', NULL, NULL, NULL, NULL, 2),
  ('20020042', 1, 'lsRekExtraStroken', 'LS-rek extra stroken',           false, true, 'vervangen', NULL, NULL, NULL, NULL, NULL, 3),
  ('20036622', 3, NULL, 'LS-rek beveiliging voedende strook',            false, true, 'vervangen', NULL, NULL, NULL, NULL, '250', 4),
  ('20036623', 3, NULL, 'LS-rek beveiliging voedende strook',            false, true, 'vervangen', NULL, NULL, NULL, NULL, '400', 5),
  ('20036624', 3, NULL, 'LS-rek beveiliging voedende strook',            false, true, 'vervangen', NULL, NULL, NULL, NULL, '630', 6),
  -- Gehandhaafd + aanpassen
  ('20036622', 3, NULL, 'LS-rek beveiliging aanpassen',                  false, true, 'gehandhaafd', NULL, true, NULL, NULL, '250', 10),
  ('20036623', 3, NULL, 'LS-rek beveiliging aanpassen',                  false, true, 'gehandhaafd', NULL, true, NULL, NULL, '400', 11),
  ('20036624', 3, NULL, 'LS-rek beveiliging aanpassen',                  false, true, 'gehandhaafd', NULL, true, NULL, NULL, '630', 12),
  -- OV-stuurpunt (!compact, renovatie, ov=true) — onafhankelijk van actie
  ('20001107', 3, NULL, 'OV-stuurpunt schroefpatroon',                   false, true, NULL, NULL, NULL, true, '35A', NULL, 20),
  ('20001108', 3, NULL, 'OV-stuurpunt schroefpatroon',                   false, true, NULL, NULL, NULL, true, '50A', NULL, 21),
  ('20040148', 1, NULL, 'OV-stuurpunt router',                           false, true, NULL, NULL, NULL, true, NULL, NULL, 22),
  ('20040188', 1, NULL, 'OV-stuurpunt beugel router',                    false, true, NULL, NULL, NULL, true, NULL, NULL, 23),
  ('20039993', 1, NULL, 'OV-stuurpunt FlexOV device',                    false, true, NULL, NULL, NULL, true, NULL, NULL, 24),
  ('20039994', 1, NULL, 'OV-stuurpunt beugel FlexOV',                    false, true, NULL, NULL, NULL, true, NULL, NULL, 25),
  ('20040149', 1, NULL, 'OV-stuurpunt kabel ethernet',                   false, true, NULL, NULL, NULL, true, NULL, NULL, 26),
  -- Compact mespatroon (altijd 3×)
  ('20036622', 3, NULL, 'LS-rek beveiliging voedende strook',            true,  NULL, NULL, NULL, NULL, NULL, NULL, '250', 30),
  ('20036623', 3, NULL, 'LS-rek beveiliging voedende strook',            true,  NULL, NULL, NULL, NULL, NULL, NULL, '400', 31),
  ('20036624', 3, NULL, 'LS-rek beveiliging voedende strook',            true,  NULL, NULL, NULL, NULL, NULL, NULL, '630', 32),
  -- Kabelbevestiging compact
  ('20042043', 1, 'lsRekAanSluitenKabels*2', 'LS-rek kabelbevestigingsklem K56 U', true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 40),
  ('20018004', 1, 'lsRekAanSluitenKabels',   'LS-rek kabelinlegklem',             true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 41),
  -- Kabelbevestiging vervangen+renovatie
  ('20042042', 1, 'lsRekAanSluitenKabels', 'LS-rek kabelbevestigingsklem K56',    false, true, 'vervangen', NULL, NULL, NULL, NULL, NULL, 42),
  ('20018004', 1, 'lsRekAanSluitenKabels', 'LS-rek kabelinlegklem',               false, true, 'vervangen', NULL, NULL, NULL, NULL, NULL, 43)
) AS q(nr, qty, formule, label, c_compact, c_renovatie, c_actie, c_lsrek_type, c_bev_aanpassen, c_ov, c_schroef, c_kva, sort_order)
JOIN a ON a.artikel_nummer = q.nr;