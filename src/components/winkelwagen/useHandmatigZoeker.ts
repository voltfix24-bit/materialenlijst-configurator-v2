import { useMemo, useState } from "react";
import type { PreviewItem } from "@/lib/configurator/types";
import type { ArtikelStam } from "@/lib/configurator/artikelTypes";

const MIN_ZOEK_LENGTE = 2;
const MAX_SUGGESTIES = 8;

/**
 * Pure helper — filtert de stamdata op zoekterm en sluit reeds aanwezige
 * artikelen uit. Los getest zodat de hook zelf minimaal blijft.
 */
export function bouwSuggesties(
  zoek: string,
  artikelen: ArtikelStam[],
  effectief: PreviewItem[],
): ArtikelStam[] {
  const q = zoek.trim().toLowerCase();
  if (q.length < MIN_ZOEK_LENGTE) return [];
  const al = new Set(effectief.map((e) => e.artikel_nummer));
  return artikelen
    .filter(
      (a) =>
        !al.has(a.artikel_nummer) &&
        (a.artikel_nummer.toLowerCase().includes(q) ||
          a.korte_omschrijving.toLowerCase().includes(q)),
    )
    .slice(0, MAX_SUGGESTIES);
}

interface UseHandmatigZoekerArgs {
  artikelen: ArtikelStam[];
  effectief: PreviewItem[];
  voegHandmatigToe: (stam: ArtikelStam, qty: number) => void;
}

/**
 * Beheert alle state rond de "handmatig toevoegen"-zoeker (open/dicht,
 * zoekterm, gekozen artikel, hoeveelheid) en levert een reset-veilige
 * `bevestig`-handler die de correctie-flow triggert.
 */
export function useHandmatigZoeker({
  artikelen,
  effectief,
  voegHandmatigToe,
}: UseHandmatigZoekerArgs) {
  const [open, setOpen] = useState(false);
  const [zoek, setZoek] = useState("");
  const [hoeveelheid, setHoeveelheid] = useState(1);
  const [gekozenArtikel, setGekozenArtikel] = useState<ArtikelStam | null>(null);

  const suggesties = useMemo(
    () => bouwSuggesties(zoek, artikelen, effectief),
    [zoek, artikelen, effectief],
  );

  const reset = () => {
    setOpen(false);
    setZoek("");
    setGekozenArtikel(null);
    setHoeveelheid(1);
  };

  const bevestig = () => {
    if (!gekozenArtikel || hoeveelheid <= 0) return;
    voegHandmatigToe(gekozenArtikel, hoeveelheid);
    reset();
  };

  const wijzigZoek = (value: string) => {
    setZoek(value);
    setGekozenArtikel(null);
  };

  return {
    open,
    openZoeker: () => setOpen(true),
    sluiten: reset,
    zoek,
    wijzigZoek,
    hoeveelheid,
    setHoeveelheid,
    gekozenArtikel,
    kiesArtikel: setGekozenArtikel,
    suggesties,
    bevestig,
  };
}
