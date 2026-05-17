
-- Uitbreiden trafo_vult_kabel met kabel-artikel, muurbeugel en omschrijving
ALTER TABLE public.trafo_vult_kabel
  ADD COLUMN kabel_artikel_id uuid,
  ADD COLUMN muurbeugel_artikel_id uuid,
  ADD COLUMN omschrijving text,
  ADD COLUMN actief boolean NOT NULL DEFAULT true,
  ADD COLUMN sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.trafo_vult_kabel
  ADD CONSTRAINT trafo_vult_kabel_kabel_artikel_fk
    FOREIGN KEY (kabel_artikel_id) REFERENCES public.artikelen(id),
  ADD CONSTRAINT trafo_vult_kabel_pers_artikel_fk
    FOREIGN KEY (perskabelschoen_artikel_id) REFERENCES public.artikelen(id),
  ADD CONSTRAINT trafo_vult_kabel_muurbeugel_artikel_fk
    FOREIGN KEY (muurbeugel_artikel_id) REFERENCES public.artikelen(id);

CREATE TRIGGER trafo_vult_kabel_touch_updated_at
  BEFORE UPDATE ON public.trafo_vult_kabel
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed: 4 vult-kabel specs (was hardcoded in vultKabel.ts)
INSERT INTO public.trafo_vult_kabel
  (trafo_kva, aantal_kabels, kabel_doorsnede, kabel_artikel_id,
   aantal_perskabelschoenen, perskabelschoen_artikel_id,
   muurbeugel_artikel_id, omschrijving, sort_order)
SELECT 250, 4, 185,
       (SELECT id FROM public.artikelen WHERE artikel_nummer = '20030299' LIMIT 1),
       8,
       (SELECT id FROM public.artikelen WHERE artikel_nummer = '20000986' LIMIT 1),
       (SELECT id FROM public.artikelen WHERE artikel_nummer = '20042739' LIMIT 1),
       '4× 1x185mm² Cu (enkelvoudig)', 1
UNION ALL SELECT 400, 4, 300,
       (SELECT id FROM public.artikelen WHERE artikel_nummer = '20030300' LIMIT 1),
       8,
       (SELECT id FROM public.artikelen WHERE artikel_nummer = '20017790' LIMIT 1),
       (SELECT id FROM public.artikelen WHERE artikel_nummer = '20042739' LIMIT 1),
       '4× 1x300mm² Cu (enkelvoudig)', 2
UNION ALL SELECT 630, 8, 185,
       (SELECT id FROM public.artikelen WHERE artikel_nummer = '20030299' LIMIT 1),
       16,
       (SELECT id FROM public.artikelen WHERE artikel_nummer = '20000986' LIMIT 1),
       (SELECT id FROM public.artikelen WHERE artikel_nummer = '20042739' LIMIT 1),
       '8× 1x185mm² Cu (dubbel uitgevoerd)', 3
UNION ALL SELECT 1000, 8, 300,
       (SELECT id FROM public.artikelen WHERE artikel_nummer = '20030300' LIMIT 1),
       16,
       (SELECT id FROM public.artikelen WHERE artikel_nummer = '20017790' LIMIT 1),
       (SELECT id FROM public.artikelen WHERE artikel_nummer = '20042739' LIMIT 1),
       '8× 1x300mm² Cu (dubbel uitgevoerd)', 4;
