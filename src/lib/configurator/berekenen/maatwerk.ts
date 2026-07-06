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
  /** Bestaand configurator-hoofdstuk waar de vraag onderaan verschijnt. */
  sectie_key?: string | null;
  /** Eigen hoofdstuk (maatwerk_hoofdstukken) — eigen sectie-kaart. */
  hoofdstuk_id?: string | null;
  regels?: MaatwerkRegel[];
}

export interface MaatwerkHoofdstuk {
  id: string;
  naam: string;
  sort_order: number;
  actief: boolean;
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

export interface MaatwerkGroepen {
  /** Vragen per bestaand configurator-hoofdstuk (sectie_key). */
  perSectie: Record<string, MaatwerkVraag[]>;
  /** Eigen hoofdstukken met hun vragen, incl. fallback "Eigen vragen"
   *  voor vragen zonder plaatsing. Alleen hoofdstukken mét vragen. */
  hoofdstukken: { id: string; naam: string; vragen: MaatwerkVraag[] }[];
}

/** Standaard-hoofdstuknaam voor vragen zonder plaatsing (backwards compat). */
export const FALLBACK_HOOFDSTUK_ID = "__eigen_vragen__";

export function maatwerkGroepen(sd: Stamdata, caseType: string | undefined): MaatwerkGroepen {
  const vragen = vragenVoorCaseType(sd, caseType);
  const hoofdstukRows = (sd.maatwerkHoofdstukken?.data ?? []) as unknown as MaatwerkHoofdstuk[];

  const perSectie: Record<string, MaatwerkVraag[]> = {};
  const perHoofdstuk = new Map<string, MaatwerkVraag[]>();
  const zonderPlaatsing: MaatwerkVraag[] = [];

  for (const v of vragen) {
    if (v.sectie_key) {
      (perSectie[v.sectie_key] ??= []).push(v);
    } else if (v.hoofdstuk_id) {
      const arr = perHoofdstuk.get(v.hoofdstuk_id) ?? [];
      arr.push(v);
      perHoofdstuk.set(v.hoofdstuk_id, arr);
    } else {
      zonderPlaatsing.push(v);
    }
  }

  const hoofdstukken: MaatwerkGroepen["hoofdstukken"] = [];
  for (const h of hoofdstukRows) {
    if (h.actief === false) continue;
    const hv = perHoofdstuk.get(h.id);
    if (hv && hv.length > 0) hoofdstukken.push({ id: h.id, naam: h.naam, vragen: hv });
    perHoofdstuk.delete(h.id);
  }
  // Vragen die naar een verwijderd/inactief hoofdstuk wijzen niet kwijtraken.
  for (const rest of perHoofdstuk.values()) zonderPlaatsing.push(...rest);
  if (zonderPlaatsing.length > 0) {
    hoofdstukken.push({ id: FALLBACK_HOOFDSTUK_ID, naam: "Eigen vragen", vragen: zonderPlaatsing });
  }
  return { perSectie, hoofdstukken };
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
