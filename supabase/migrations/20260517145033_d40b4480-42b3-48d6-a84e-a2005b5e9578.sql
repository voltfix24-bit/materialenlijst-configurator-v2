CREATE TABLE public.rmu_veld_regels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conditie_merk text,
  conditie_is_inet boolean,
  conditie_veld_type text,
  conditie_veld_nummer_is_1 boolean,
  conditie_is_reserve boolean,
  conditie_kabel_type text,
  conditie_kva text,
  conditie_trafo_kabel_lengte text,
  conditie_aantal_kv_min integer,
  conditie_aantal_kv_max integer,
  artikel_id uuid NOT NULL,
  hoeveelheid numeric NOT NULL DEFAULT 1,
  hoeveelheid_formule text,
  herkomst_label text NOT NULL,
  sectie text NOT NULL DEFAULT 'rmu',
  sort_order integer NOT NULL DEFAULT 0,
  actief boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rmu_veld_regels ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_all ON public.rmu_veld_regels FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER rmu_veld_regels_touch_updated_at
  BEFORE UPDATE ON public.rmu_veld_regels
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed: bestaande hardcoded RMU veld-logica
INSERT INTO public.rmu_veld_regels
  (conditie_merk, conditie_is_inet, conditie_veld_type, conditie_veld_nummer_is_1, conditie_is_reserve,
   conditie_kabel_type, conditie_kva, conditie_trafo_kabel_lengte, conditie_aantal_kv_min, conditie_aantal_kv_max,
   artikel_id, hoeveelheid, herkomst_label, sectie, sort_order)
SELECT v.merk, v.inet, v.vt, v.vn1, v.res, v.kt, v.kva, v.kl, v.kvmin, v.kvmax,
       a.id, v.qty, v.lbl, v.sectie, v.so
FROM (VALUES
  -- F-veld eindsluitingen per merk
  ('Magnefix', NULL, 'F', NULL, NULL, NULL, NULL,  NULL,  NULL, NULL, '20039303', 1, 'Magnefix T-veld eindsluiting', 'rmu',   10),
  ('ABB',      NULL, 'F', NULL, NULL, NULL, NULL,  NULL,  NULL, NULL, '20041682', 1, 'RMU F-veld eindsluiting',      'rmu',   11),
  ('Siemens',  NULL, 'F', NULL, NULL, NULL, NULL,  NULL,  NULL, NULL, '20041682', 1, 'RMU F-veld eindsluiting',      'rmu',   12),
  -- Trafo kabel per F-veld (merk-agnostisch)
  (NULL,       NULL, 'F', NULL, NULL, NULL, NULL,  '7.25',NULL, NULL, '20032539', 1, 'Trafo kabel 7,25m',            'trafo', 20),
  (NULL,       NULL, 'F', NULL, NULL, NULL, NULL,  '10',  NULL, NULL, '20032541', 1, 'Trafo kabel 10m',              'trafo', 21),
  -- Buispatroon Magnefix per kVA
  ('Magnefix', NULL, 'F', NULL, NULL, NULL, '250', NULL,  NULL, NULL, '20019483', 3, 'Magnefix buispatroon',         'rmu',   30),
  ('Magnefix', NULL, 'F', NULL, NULL, NULL, '400', NULL,  NULL, NULL, '20019484', 3, 'Magnefix buispatroon',         'rmu',   31),
  ('Magnefix', NULL, 'F', NULL, NULL, NULL, '630', NULL,  NULL, NULL, '20019485', 3, 'Magnefix buispatroon',         'rmu',   32),
  -- Buispatroon ABB / Siemens per kVA
  ('ABB',      NULL, 'F', NULL, NULL, NULL, '250', NULL,  NULL, NULL, '20041591', 3, 'RMU buispatroon',              'rmu',   40),
  ('ABB',      NULL, 'F', NULL, NULL, NULL, '400', NULL,  NULL, NULL, '20041593', 3, 'RMU buispatroon',              'rmu',   41),
  ('ABB',      NULL, 'F', NULL, NULL, NULL, '630', NULL,  NULL, NULL, '20041651', 3, 'RMU buispatroon',              'rmu',   42),
  ('Siemens',  NULL, 'F', NULL, NULL, NULL, '250', NULL,  NULL, NULL, '20041591', 3, 'RMU buispatroon',              'rmu',   43),
  ('Siemens',  NULL, 'F', NULL, NULL, NULL, '400', NULL,  NULL, NULL, '20041593', 3, 'RMU buispatroon',              'rmu',   44),
  ('Siemens',  NULL, 'F', NULL, NULL, NULL, '630', NULL,  NULL, NULL, '20041651', 3, 'RMU buispatroon',              'rmu',   45),
  -- Magnefix C/V → K-veld eindsluiting + afschermset (label met {veldNummer})
  ('Magnefix', NULL, 'C', NULL, NULL, NULL, NULL,  NULL,  NULL, NULL, '20039648', 1, 'Magnefix K-veld {veldNummer} eindsluiting', 'rmu', 50),
  ('Magnefix', NULL, 'V', NULL, NULL, NULL, NULL,  NULL,  NULL, NULL, '20039648', 1, 'Magnefix K-veld {veldNummer} eindsluiting', 'rmu', 51),
  ('Magnefix', NULL, 'C', NULL, NULL, NULL, NULL,  NULL,  NULL, NULL, '20018032', 1, 'Magnefix K-veld {veldNummer} afschermset',  'rmu', 52),
  ('Magnefix', NULL, 'V', NULL, NULL, NULL, NULL,  NULL,  NULL, NULL, '20018032', 1, 'Magnefix K-veld {veldNummer} afschermset',  'rmu', 53),
  -- Magnefix doos (alleen op C-veld 1, varieert per aantal K-velden)
  ('Magnefix', NULL, 'C', true, NULL, NULL, NULL,  NULL,  NULL, 2,    '20029904', 1, 'Magnefix doos met onderdelen', 'rmu',   60),
  ('Magnefix', NULL, 'C', true, NULL, NULL, NULL,  NULL,  3,    NULL, '20029905', 1, 'Magnefix doos met onderdelen', 'rmu',   61),
  -- ABB / Siemens C/V niet-reserve eindsluiting per kabeltype
  ('ABB',      NULL, 'C', NULL, false, '240AL', NULL, NULL, NULL, NULL, '20040681', 1, 'RMU C-veld eindsluiting',   'rmu',   70),
  ('ABB',      NULL, 'V', NULL, false, '240AL', NULL, NULL, NULL, NULL, '20040681', 1, 'RMU V-veld eindsluiting',   'rmu',   71),
  ('Siemens',  NULL, 'C', NULL, false, '240AL', NULL, NULL, NULL, NULL, '20040681', 1, 'RMU C-veld eindsluiting',   'rmu',   72),
  ('Siemens',  NULL, 'V', NULL, false, '240AL', NULL, NULL, NULL, NULL, '20040681', 1, 'RMU V-veld eindsluiting',   'rmu',   73),
  ('ABB',      NULL, 'C', NULL, false, '630AL', NULL, NULL, NULL, NULL, '20040678', 1, 'RMU C-veld eindsluiting',   'rmu',   74),
  ('ABB',      NULL, 'V', NULL, false, '630AL', NULL, NULL, NULL, NULL, '20040678', 1, 'RMU V-veld eindsluiting',   'rmu',   75),
  ('Siemens',  NULL, 'C', NULL, false, '630AL', NULL, NULL, NULL, NULL, '20040678', 1, 'RMU C-veld eindsluiting',   'rmu',   76),
  ('Siemens',  NULL, 'V', NULL, false, '630AL', NULL, NULL, NULL, NULL, '20040678', 1, 'RMU V-veld eindsluiting',   'rmu',   77),
  -- Ombouwset CT 630AL V-veld (I-Net wel/niet)
  ('ABB',      true,  'V', NULL, false, '630AL', NULL, NULL, NULL, NULL, '20043486', 1, 'Ombouwset CT 630AL V-veld', 'rmu',   80),
  ('Siemens',  true,  'V', NULL, false, '630AL', NULL, NULL, NULL, NULL, '20043486', 1, 'Ombouwset CT 630AL V-veld', 'rmu',   81),
  ('ABB',      false, 'V', NULL, false, '630AL', NULL, NULL, NULL, NULL, '20043756', 1, 'Ombouwset CT 630AL V-veld', 'rmu',   82),
  ('Siemens',  false, 'V', NULL, false, '630AL', NULL, NULL, NULL, NULL, '20043756', 1, 'Ombouwset CT 630AL V-veld', 'rmu',   83)
) AS v(merk, inet, vt, vn1, res, kt, kva, kl, kvmin, kvmax, art_nr, qty, lbl, sectie, so)
JOIN public.artikelen a ON a.artikel_nummer = v.art_nr;