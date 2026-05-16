UPDATE public.standaard_materialen_templates
SET case_type = 'compact_prov'
WHERE case_type = 'custom';

INSERT INTO public.standaard_materialen_templates (case_type, artikel_id, standaard_hoeveelheid)
SELECT 'compact_prov', artikel_id, standaard_hoeveelheid
FROM public.standaard_materialen_templates
WHERE case_type = 'compact'
AND NOT EXISTS (
  SELECT 1 FROM public.standaard_materialen_templates
  WHERE case_type = 'compact_prov'
);

UPDATE public.cases
SET case_type = 'compact_prov'
WHERE case_type = 'custom';