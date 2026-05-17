-- Add missing foreign keys from regel-tabellen naar artikelen, zodat de
-- PostgREST embed `artikel:artikel_id(*)` werkt en de artikelen daadwerkelijk
-- in de bestellijst (winkelwagen) verschijnen.

ALTER TABLE public.ggi_artikelen
  ADD CONSTRAINT ggi_artikelen_artikel_id_fkey
  FOREIGN KEY (artikel_id) REFERENCES public.artikelen(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS ggi_artikelen_artikel_id_idx
  ON public.ggi_artikelen(artikel_id);

ALTER TABLE public.trafo_regels
  ADD CONSTRAINT trafo_regels_artikel_id_fkey
  FOREIGN KEY (artikel_id) REFERENCES public.artikelen(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS trafo_regels_artikel_id_idx
  ON public.trafo_regels(artikel_id);

ALTER TABLE public.ls_rek_regels
  ADD CONSTRAINT ls_rek_regels_artikel_id_fkey
  FOREIGN KEY (artikel_id) REFERENCES public.artikelen(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS ls_rek_regels_artikel_id_idx
  ON public.ls_rek_regels(artikel_id);

ALTER TABLE public.prov_regels
  ADD CONSTRAINT prov_regels_artikel_id_fkey
  FOREIGN KEY (artikel_id) REFERENCES public.artikelen(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS prov_regels_artikel_id_idx
  ON public.prov_regels(artikel_id);

ALTER TABLE public.ms_kabel_regels
  ADD CONSTRAINT ms_kabel_regels_artikel_id_fkey
  FOREIGN KEY (artikel_id) REFERENCES public.artikelen(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS ms_kabel_regels_artikel_id_idx
  ON public.ms_kabel_regels(artikel_id);