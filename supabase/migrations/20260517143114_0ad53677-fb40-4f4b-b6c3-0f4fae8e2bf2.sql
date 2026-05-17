CREATE TABLE public.prov_regels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artikel_id uuid NOT NULL,
  hoeveelheid numeric NOT NULL DEFAULT 1,
  hoeveelheid_formule text,
  herkomst_label text NOT NULL,
  conditie_merk text,
  conditie_kva text,
  sort_order integer NOT NULL DEFAULT 0,
  actief boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prov_regels ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_all ON public.prov_regels FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER touch_prov_regels BEFORE UPDATE ON public.prov_regels
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

WITH a AS (SELECT artikel_nummer, id FROM public.artikelen)
INSERT INTO public.prov_regels (
  artikel_id, hoeveelheid, hoeveelheid_formule, herkomst_label,
  conditie_merk, conditie_kva, sort_order
)
SELECT a.id, q.qty, q.formule, q.label, q.c_merk, q.c_kva, q.sort_order
FROM (VALUES
  -- F-veld eindsluitingen
  ('20039303', 1::numeric, 'perFVeld', 'Provisorium T-veld eindsluiting',  'Magnefix', NULL::text, 1),
  ('20041682', 1,          'perFVeld', 'Provisorium F-veld eindsluiting',  'ABB',      NULL,        2),
  ('20041682', 1,          'perFVeld', 'Provisorium F-veld eindsluiting',  'Siemens',  NULL,        3),
  -- Buispatronen (3× per F-veld)
  ('20019483', 1, 'perFVeld*3', 'Provisorium buispatroon', 'Magnefix', '250', 10),
  ('20019484', 1, 'perFVeld*3', 'Provisorium buispatroon', 'Magnefix', '400', 11),
  ('20019485', 1, 'perFVeld*3', 'Provisorium buispatroon', 'Magnefix', '630', 12),
  ('20041591', 1, 'perFVeld*3', 'Provisorium buispatroon', 'ABB',      '250', 13),
  ('20041593', 1, 'perFVeld*3', 'Provisorium buispatroon', 'ABB',      '400', 14),
  ('20041651', 1, 'perFVeld*3', 'Provisorium buispatroon', 'ABB',      '630', 15),
  ('20041591', 1, 'perFVeld*3', 'Provisorium buispatroon', 'Siemens',  '250', 16),
  ('20041593', 1, 'perFVeld*3', 'Provisorium buispatroon', 'Siemens',  '400', 17),
  ('20041651', 1, 'perFVeld*3', 'Provisorium buispatroon', 'Siemens',  '630', 18),
  -- In-bedrijfname MS
  ('20039648', 1, 'provInbMsKabels', 'Prov in-bedrijfname MS eindsluiting', 'Magnefix', NULL, 30),
  ('20018032', 1, 'provInbMsKabels', 'Prov in-bedrijfname MS afschermset',  'Magnefix', NULL, 31),
  ('20029905', 1, 'ifInbMsThen1',    'Prov in-bedrijfname MS doos onderdelen', 'Magnefix', NULL, 32),
  ('20040681', 1, 'provInbMsKabels', 'Prov in-bedrijfname MS eindsluiting', 'ABB',      NULL, 33),
  ('20040681', 1, 'provInbMsKabels', 'Prov in-bedrijfname MS eindsluiting', 'Siemens',  NULL, 34),
  -- In-bedrijfname LS
  ('20018004', 1, 'provInbLsKabels', 'Prov in-bedrijfname LS kabelinlegklem', NULL, NULL, 40),
  ('20042042', 1, 'provInbLsKabels', 'Prov in-bedrijfname LS K56 klem',       NULL, NULL, 41)
) AS q(nr, qty, formule, label, c_merk, c_kva, sort_order)
JOIN a ON a.artikel_nummer = q.nr;