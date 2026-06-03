CREATE TABLE public.ls_beveiliging_opties (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artikel_id uuid NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  actief boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ls_beveiliging_opties TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ls_beveiliging_opties TO anon;
GRANT ALL ON public.ls_beveiliging_opties TO service_role;

ALTER TABLE public.ls_beveiliging_opties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all" ON public.ls_beveiliging_opties FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER ls_beveiliging_opties_touch_updated_at
  BEFORE UPDATE ON public.ls_beveiliging_opties
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed de bestaande hardcoded opties (alleen als het artikel bestaat)
INSERT INTO public.ls_beveiliging_opties (artikel_id, label, sort_order)
SELECT a.id, x.label, x.sort_order
FROM (VALUES
  ('20001042', '80A gG',    10),
  ('20001099', '125A gG',   20),
  ('20026896', '160A gFF',  30),
  ('20026895', '200A gFF',  40),
  ('20026894', '250A gFF',  50),
  ('20001038', '315A gG',   60)
) AS x(artikel_nummer, label, sort_order)
JOIN public.artikelen a ON a.artikel_nummer = x.artikel_nummer;