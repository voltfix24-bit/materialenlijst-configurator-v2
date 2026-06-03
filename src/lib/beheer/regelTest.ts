/**
 * Beheer-only "Test regel"-evaluator. Spiegelt de matching-semantiek van de
 * bestaande berekenmodule: een `conditie_*`-veld dat op null staat betekent
 * "maakt niet uit"; een niet-null waarde moet exact gelijk zijn aan de
 * test-invoer. Wordt NIET in productiepaden gebruikt en past geen data aan.
 */

import type { RegelType } from "./regelSamenvatting";

export interface TestVeld {
  /** Sleutel die in zowel input als regel (zonder "conditie_"-prefix) terugkomt. */
  key: string;
  /** Volledige naam van de condition-kolom op de regel-row. */
  conditieKolom: string;
  label: string;
  type: "bool" | "text" | "number";
  /** Optionele suggesties voor select-achtige velden. */
  opties?: string[];
  /** Speciale match: "trueOnly" = alleen mismatchen als regel true is en input false. */
  matchMode?: "equal" | "trueOnly";
}

/** Definitie per regeltype welke condities meegenomen worden in de test. */
export const TEST_VELDEN: Record<RegelType, TestVeld[]> = {
  ggi: [],
  trafo: [
    { key: "kva", conditieKolom: "conditie_kva", label: "Trafovermogen (kVA)", type: "text", opties: ["250", "400", "630", "1000"] },
    { key: "actie", conditieKolom: "conditie_actie", label: "Actie", type: "text", opties: ["nieuw", "vervangen", "renoveren"] },
    { key: "kabel_lengte", conditieKolom: "conditie_kabel_lengte", label: "Kabellengte", type: "text" },
  ],
  ls_rek: [
    { key: "compact", conditieKolom: "conditie_compact", label: "Compactstation", type: "bool" },
    { key: "renovatie", conditieKolom: "conditie_renovatie", label: "Renovatie", type: "bool" },
    { key: "actie", conditieKolom: "conditie_actie", label: "LS-rek actie", type: "text", opties: ["nieuw", "vervangen", "uitbreiden"] },
    { key: "lsrek_type", conditieKolom: "conditie_lsrek_type", label: "LS-rek type", type: "text", opties: ["4", "6", "8", "10", "12"] },
    { key: "beveiliging_aanpassen", conditieKolom: "conditie_beveiliging_aanpassen", label: "Beveiliging aanpassen", type: "bool", matchMode: "trueOnly" },
    { key: "ov_stuurpunt", conditieKolom: "conditie_ov_stuurpunt", label: "OV-stuurpunt", type: "bool", matchMode: "trueOnly" },
    { key: "schroefpatroon", conditieKolom: "conditie_schroefpatroon", label: "Schroefpatroon", type: "text" },
    { key: "kva", conditieKolom: "conditie_kva", label: "Trafovermogen (kVA)", type: "text", opties: ["250", "400", "630", "1000"] },
  ],
  prov: [
    { key: "kva", conditieKolom: "conditie_kva", label: "Trafovermogen (kVA)", type: "text" },
    { key: "merk", conditieKolom: "conditie_merk", label: "Merk", type: "text" },
  ],
  ms_kabel: [
    { key: "oversteek", conditieKolom: "conditie_oversteek", label: "Oversteek", type: "bool" },
    { key: "kabel_type", conditieKolom: "conditie_kabel_type", label: "Kabeltype", type: "text" },
  ],
  rmu_veld: [
    { key: "veld_type", conditieKolom: "conditie_veld_type", label: "Veldtype", type: "text", opties: ["F", "C", "V"] },
    { key: "merk", conditieKolom: "conditie_merk", label: "Merk", type: "text" },
    { key: "is_inet", conditieKolom: "conditie_is_inet", label: "iNet", type: "bool" },
    { key: "is_reserve", conditieKolom: "conditie_is_reserve", label: "Reserveveld", type: "bool", matchMode: "trueOnly" },
    { key: "veld_nummer_is_1", conditieKolom: "conditie_veld_nummer_is_1", label: "Eerste veld", type: "bool", matchMode: "trueOnly" },
    { key: "kva", conditieKolom: "conditie_kva", label: "Trafovermogen (kVA)", type: "text" },
    { key: "kabel_type", conditieKolom: "conditie_kabel_type", label: "Kabeltype", type: "text" },
    { key: "trafo_kabel_lengte", conditieKolom: "conditie_trafo_kabel_lengte", label: "Trafo-kabellengte", type: "text" },
  ],
};

export type TestInput = Record<string, string | boolean | null>;

/** Vul testinput pre-defaults: gebruik regelconditie als die ingevuld is, anders een neutrale waarde. */
export function defaultInputVoor(type: RegelType, row: Record<string, unknown>): TestInput {
  const out: TestInput = {};
  for (const v of TEST_VELDEN[type]) {
    const c = row[v.conditieKolom];
    if (c !== null && c !== undefined) {
      out[v.key] = c as string | boolean;
    } else {
      out[v.key] = v.type === "bool" ? false : "";
    }
  }
  return out;
}

export interface MatchResultaat {
  matcht: boolean;
  /** Mismatch-redenen per veld. Leeg als matcht. */
  redenen: string[];
}

/** Mirror van de match-semantiek uit de bestaande berekenmodule. */
export function evalueerRegel(
  type: RegelType,
  row: Record<string, unknown>,
  input: TestInput,
): MatchResultaat {
  const redenen: string[] = [];
  if ((row["actief"] as boolean | undefined) === false) {
    redenen.push("Regel staat uit (actief = false).");
  }
  for (const v of TEST_VELDEN[type]) {
    const cond = row[v.conditieKolom];
    if (cond === null || cond === undefined) continue;
    const inp = input[v.key];
    if (v.matchMode === "trueOnly") {
      // alleen mismatchen als regel `true` eist en input `false`/leeg is.
      if (cond === true && inp !== true) {
        redenen.push(`${v.label} moet "ja" zijn (regel vereist).`);
      }
      continue;
    }
    if (v.type === "bool") {
      if (cond !== inp) {
        redenen.push(`${v.label} moet ${cond ? "ja" : "nee"} zijn (nu ${inp ? "ja" : "nee"}).`);
      }
    } else {
      const sCond = String(cond).trim();
      const sInp = String(inp ?? "").trim();
      if (sCond !== sInp) {
        redenen.push(`${v.label} moet "${sCond}" zijn (nu "${sInp || "leeg"}").`);
      }
    }
  }
  return { matcht: redenen.length === 0, redenen };
}

/** Bereken hoeveelheid: getalveld of bekende formule. */
export function berekenTestHoeveelheid(row: Record<string, unknown>): {
  waarde: number | string;
  toelichting: string | null;
} {
  const formule = row["hoeveelheid_formule"] as string | null;
  const basis = Number(row["hoeveelheid"] ?? 1);
  if (formule) {
    return {
      waarde: `formule "${formule}"`,
      toelichting: "Hoeveelheid wordt in de echte berekening uit case-data afgeleid — getoond is de formule.",
    };
  }
  return { waarde: basis, toelichting: null };
}
