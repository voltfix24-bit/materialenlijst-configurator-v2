ALTER TABLE public.rmu_veld_regels
  ADD CONSTRAINT rmu_veld_regels_artikel_id_fkey
  FOREIGN KEY (artikel_id) REFERENCES public.artikelen(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS rmu_veld_regels_artikel_id_idx
  ON public.rmu_veld_regels(artikel_id);