import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_INET_ARTIKELEN,
  RINGKLEM_SPECS,
  type INetArtikel,
  type RingklemSpec,
} from "./types";

/**
 * Ringklem-specificaties uit de database (Beheer → Hardware → Ringklemmen).
 * Valt terug op de hardcoded lijst zolang de migratie niet is uitgevoerd
 * (tabel bestaat niet → query-error). Een bewust leeggemaakte tabel valt
 * NIET terug — leeg is dan leeg.
 */
export function useRingklemSpecs(): RingklemSpec[] {
  const { data, error } = useQuery({
    queryKey: ["ringklem_specs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ringklem_specs")
        .select("*")
        .eq("actief", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    retry: false,
    staleTime: 5 * 60_000,
  });
  if (error || !data) return RINGKLEM_SPECS;
  return data.map((r) => ({
    artikel_nummer: r.artikel_nummer,
    omschrijving: r.omschrijving,
    hoofdkabel_doorsnede_min: Number(r.hoofdkabel_doorsnede_min),
    hoofdkabel_doorsnede_max: Number(r.hoofdkabel_doorsnede_max),
    hoofdkabel_materiaal: r.hoofdkabel_materiaal as RingklemSpec["hoofdkabel_materiaal"],
    aftakkabel_doorsnede_min: Number(r.aftakkabel_doorsnede_min),
    aftakkabel_doorsnede_max: Number(r.aftakkabel_doorsnede_max),
  }));
}

/**
 * Standaard I-Net artikelset uit de database (Beheer → Hardware → I-Net
 * artikelen). Zelfde fallback-gedrag als useRingklemSpecs.
 */
export function useInetDefaultArtikelen(): INetArtikel[] {
  const { data, error } = useQuery({
    queryKey: ["inet_default_artikelen"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inet_default_artikelen")
        .select("*")
        .eq("actief", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    retry: false,
    staleTime: 5 * 60_000,
  });
  if (error || !data) return DEFAULT_INET_ARTIKELEN;
  return data.map((r) => ({
    artikel_nummer: r.artikel_nummer,
    hoeveelheid: Number(r.hoeveelheid),
  }));
}
