import type { Artikel, MaterialenConfig } from "../types";
import type { Stamdata } from "../queries";
import { add, type PreviewMap } from "./shared";

/** Regel gekoppeld aan een eigen vraag (join uit maatwerk_vraag_regels). */
export interface MaatwerkRegel {
  id: string;
  antwoord: string;
  hoeveelheid: number;
  per_eenheid: boolean;
  actief: boolean;
  artikel?: Artikel | null;
}

export interface MaatwerkVraag {
  id: string;
  vraag_key: string;
  label: string;
  uitleg: string | null;
  type: "ja_nee" | "keuze" | "aantal";
  opties: string[];
  van_toepassing_bij: string[];
  actief: boolean;
  regels?: MaatwerkRegel[];
}

/** Vragen die gelden voor dit case type (lege van_toepassing_bij = alle). */
export function vragenVoorCaseType(sd: Stamdata, caseType: string | undefined): MaatwerkVraag[] {
  // Defensief: oudere test-stubs of een deels geladen stamdata hebben de
  // maatwerk-query mogelijk niet — dan zijn er simpelweg geen eigen vragen.
  const alle = (sd.maatwerkVragen?.data ?? []) as unknown as MaatwerkVraag[];
  return alle.filter(
    (v) =>
      v.actief !== false &&
      (v.van_toepassing_bij.length === 0 ||
        (!!caseType && v.van_toepassing_bij.includes(caseType))),
  );
}

/**
 * Sectie "Eigen vragen": artikelen uit via Beheer aangemaakte vragen.
 * Per vraag matcht een regel wanneer antwoord gelijk is of de regel '*'
 * (elk antwoord) heeft. Bij aantal-vragen met per_eenheid geldt
 * totaal = hoeveelheid × ingevuld aantal.
 */
export function berekenMaatwerk(
  map: PreviewMap,
  config: MaterialenConfig,
  sd: Stamdata,
  caseType: string | undefined,
): void {
  const antwoorden = config.maatwerkAntwoorden ?? {};
  for (const vraag of vragenVoorCaseType(sd, caseType)) {
    const antwoord = (antwoorden[vraag.vraag_key] ?? "").trim();
    if (!antwoord) continue;
    // Een aantal-vraag met 0 betekent: niet van toepassing.
    if (vraag.type === "aantal" && Number(antwoord) <= 0) continue;
    for (const regel of vraag.regels ?? []) {
      if (regel.actief === false) continue;
      const matcht =
        regel.antwoord === "*" || regel.antwoord.trim().toLowerCase() === antwoord.toLowerCase();
      if (!matcht) continue;
      const basis = Number(regel.hoeveelheid) || 0;
      const qty = vraag.type === "aantal" && regel.per_eenheid ? basis * Number(antwoord) : basis;
      add(map, regel.artikel, qty, `${vraag.label}: ${antwoord}`, "maatwerk", {
        tabel: "maatwerk_vraag_regels",
        id: regel.id,
      });
    }
  }
}
