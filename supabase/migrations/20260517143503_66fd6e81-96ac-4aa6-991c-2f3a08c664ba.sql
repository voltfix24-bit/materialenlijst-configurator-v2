
CREATE TABLE public.ms_kabel_regels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conditie_kabel_type text,
  conditie_oversteek boolean,
  artikel_id uuid NOT NULL,
  hoeveelheid numeric NOT NULL DEFAULT 1,
  hoeveelheid_formule text,
  herkomst_label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  actief boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ms_kabel_regels ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_all ON public.ms_kabel_regels FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER ms_kabel_regels_touch_updated_at
  BEFORE UPDATE ON public.ms_kabel_regels
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed: huidige hardcoded MS kabel-trace logica
INSERT INTO public.ms_kabel_regels (conditie_kabel_type, conditie_oversteek, artikel_id, hoeveelheid, hoeveelheid_formule, herkomst_label, sort_order)
SELECT v.kabel_type, v.oversteek, a.id, v.qty, v.formule, v.label, v.so
FROM (VALUES
  ('240AL_singel', NULL,  '20039484', 1, 'KabelMeters',        'MS kabel 240AL singel',       1),
  ('630AL_singel', NULL,  '20027992', 1, 'KabelMeters',        'MS kabel 630AL singel',       2),
  ('3x240AL',      NULL,  '20027989', 1, 'KabelMeters',        'MS kabel 3x240AL',            3),
  (NULL,           NULL,  '20018148', 1, 'RollenBeschermband', 'MS kabel beschermband',       4),
  ('240AL_singel', true,  '20036049', 1, 'TotaalBuizen',       'MS kabel oversteek buis',     5),
  ('630AL_singel', true,  '20036049', 1, 'TotaalBuizen',       'MS kabel oversteek buis',     6),
  ('3x240AL',      true,  '20028640', 1, 'TotaalBuizen',       'MS kabel oversteek buis',     7),
  (NULL,           true,  '20043703', 1, 'GeotextielAantal',   'MS kabel oversteek geotextiel',8)
) AS v(kabel_type, oversteek, art_nr, qty, formule, label, so)
JOIN public.artikelen a ON a.artikel_nummer = v.art_nr;
