import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAlternatiefKeuzes, splitAlternatieven } from "@/lib/assortiment/alternatief";
import type { PreviewItem } from "@/lib/configurator/types";
import type { ExportProbleemArtikel } from "./ExportBevestigingDialoog";

interface ArtikelStam {
  artikel_nummer: string;
  korte_omschrijving: string;
  eenheid: string;
  actief?: boolean;
  status?: string | null;
  alternatief_artikel_nummer?: string | null;
}

export interface AlternatiefKeuzeVoorExport {
  nieuw_artikel_nummer: string;
  created_at: string;
  totaal_geupdate: number;
}

export function bouwExportProblemen(
  effectief: PreviewItem[],
  artikelen: ArtikelStam[],
  alternatiefKeuzes: Map<string, AlternatiefKeuzeVoorExport> = new Map(),
): ExportProbleemArtikel[] {
  const artByNr = new Map(artikelen.map((a) => [a.artikel_nummer, a]));
  const out: ExportProbleemArtikel[] = [];
  for (const it of effectief) {
    if (it.niet_bestellen) continue;
    const stam = artByNr.get(it.artikel_nummer);
    const status = (stam?.status ?? "").trim();
    const statusLower = status.toLowerCase();
    const isInactief =
      !!it.inactief ||
      stam?.actief === false ||
      ["uitgelopen", "verwijderd", "geblokkeerd"].includes(statusLower);
    if (!isInactief) continue;

    const altRaw = (stam?.alternatief_artikel_nummer ?? "").trim();
    const alternatieven = splitAlternatieven(altRaw);
    const geenOpvolger =
      !altRaw ||
      altRaw === "-" ||
      /geen\s*opvolger/i.test(altRaw);
    const handmatigBeoordelen =
      !geenOpvolger &&
      alternatieven.length >= 1 &&
      /[a-zA-Z]/.test(altRaw);

    const k = alternatiefKeuzes.get(it.artikel_nummer);
    out.push({
      artikel_nummer: it.artikel_nummer,
      korte_omschrijving: it.korte_omschrijving,
      hoeveelheid: it.hoeveelheid,
      eenheid: it.eenheid,
      status_label: status || "Inactief",
      alternatief_raw: altRaw || null,
      alternatieven,
      geen_opvolger: geenOpvolger,
      handmatig_beoordelen: handmatigBeoordelen,
      eerdere_keuze: k
        ? {
            nieuw_artikel_nummer: k.nieuw_artikel_nummer,
            created_at: k.created_at,
            totaal_geupdate: k.totaal_geupdate,
          }
        : null,
    });
  }
  return out;
}

export function useExportProblemen(effectief: PreviewItem[], artikelen: ArtikelStam[]) {
  const { data: alternatiefKeuzes } = useQuery({
    queryKey: ["alternatief-keuzes"],
    queryFn: getAlternatiefKeuzes,
  });

  return useMemo(
    () => bouwExportProblemen(effectief, artikelen, alternatiefKeuzes ?? new Map()),
    [effectief, artikelen, alternatiefKeuzes],
  );
}
