/**
 * Pure helpers die een ruwe beheerregel-row vertalen naar een leesbare
 * Nederlandse samenvatting voor werkvoorbereiders/engineers. Mag NIET de
 * onderliggende data of berekenlogica veranderen — wordt alleen gebruikt
 * voor weergave in de "Leesbaar overzicht"-tab.
 */

export type RegelType =
  | "ggi"
  | "trafo"
  | "ls_rek"
  | "prov"
  | "ms_kabel"
  | "rmu_veld";

/** Configurator-sectie waar het artikel naar verwachting verschijnt. */
export const SECTIE_PER_TYPE: Record<RegelType, string> = {
  ggi: "MS — Middenspanning (GGI)",
  trafo: "Trafo & Vult kabel",
  ls_rek: "LS — Laagspanning (rek)",
  prov: "Provisorium",
  ms_kabel: "MS — Middenspanning (kabel)",
  rmu_veld: "MS — RMU velden",
};

export const TYPE_LABEL: Record<RegelType, string> = {
  ggi: "GGI-regel",
  trafo: "Trafo-regel",
  ls_rek: "LS-rek regel",
  prov: "Provisorium-regel",
  ms_kabel: "MS-kabel regel",
  rmu_veld: "RMU-veld regel",
};

/** Eén voorwaarde, klaar voor weergave. */
export interface VoorwaardeView {
  label: string;
  waarde: string;
}

function boolLabel(v: boolean | null | undefined, jaLabel: string, neeLabel: string): string | null {
  if (v === true) return jaLabel;
  if (v === false) return neeLabel;
  return null;
}

function txt(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** Verzamel zichtbare voorwaarden voor een regel. Lege/null worden weggelaten. */
export function voorwaardenVoor(type: RegelType, row: Record<string, unknown>): VoorwaardeView[] {
  const v: VoorwaardeView[] = [];
  const get = (k: string) => row[k] as unknown;

  switch (type) {
    case "ls_rek": {
      const compact = boolLabel(get("conditie_compact") as boolean | null, "compactstation", "geen compactstation");
      if (compact) v.push({ label: "Stationtype", waarde: compact });
      const reno = boolLabel(get("conditie_renovatie") as boolean | null, "renovatie", "geen renovatie");
      if (reno) v.push({ label: "Opdracht", waarde: reno });
      const actie = txt(get("conditie_actie") as string | null);
      if (actie) v.push({ label: "Actie", waarde: actie });
      const lsrek = txt(get("conditie_lsrek_type") as string | null);
      if (lsrek) v.push({ label: "LS-rek type", waarde: lsrek });
      const bev = boolLabel(get("conditie_beveiliging_aanpassen") as boolean | null, "wel aanpassen", "niet aanpassen");
      if (bev) v.push({ label: "Beveiliging", waarde: bev });
      const ov = boolLabel(get("conditie_ov_stuurpunt") as boolean | null, "OV-stuurpunt aanwezig", "geen OV-stuurpunt");
      if (ov) v.push({ label: "OV-stuurpunt", waarde: ov });
      const schroef = txt(get("conditie_schroefpatroon") as string | null);
      if (schroef) v.push({ label: "Schroefpatroon", waarde: schroef });
      const kva = txt(get("conditie_kva") as string | null);
      if (kva) v.push({ label: "Trafovermogen", waarde: `${kva} kVA` });
      break;
    }
    case "trafo": {
      const kva = txt(get("conditie_kva") as string | null);
      if (kva) v.push({ label: "Trafovermogen", waarde: `${kva} kVA` });
      const actie = txt(get("conditie_actie") as string | null);
      if (actie) v.push({ label: "Actie", waarde: actie });
      const kl = txt(get("conditie_kabel_lengte") as string | null);
      if (kl) v.push({ label: "Kabellengte", waarde: kl });
      break;
    }
    case "prov": {
      const kva = txt(get("conditie_kva") as string | null);
      if (kva) v.push({ label: "Trafovermogen", waarde: `${kva} kVA` });
      const merk = txt(get("conditie_merk") as string | null);
      if (merk) v.push({ label: "Merk", waarde: merk });
      break;
    }
    case "ms_kabel": {
      const over = boolLabel(get("conditie_oversteek") as boolean | null, "oversteek", "geen oversteek");
      if (over) v.push({ label: "Situatie", waarde: over });
      const kt = txt(get("conditie_kabel_type") as string | null);
      if (kt) v.push({ label: "Kabeltype", waarde: kt });
      break;
    }
    case "rmu_veld": {
      const sectie = txt(get("sectie") as string | null);
      if (sectie && sectie !== "rmu") v.push({ label: "Sectie", waarde: sectie });
      const vt = txt(get("conditie_veld_type") as string | null);
      if (vt) v.push({ label: "Veldtype", waarde: vt });
      const merk = txt(get("conditie_merk") as string | null);
      if (merk) v.push({ label: "Merk", waarde: merk });
      const inet = boolLabel(get("conditie_is_inet") as boolean | null, "iNet", "geen iNet");
      if (inet) v.push({ label: "Variant", waarde: inet });
      const res = boolLabel(get("conditie_is_reserve") as boolean | null, "reserveveld", "geen reserveveld");
      if (res) v.push({ label: "Veldrol", waarde: res });
      const v1 = boolLabel(get("conditie_veld_nummer_is_1") as boolean | null, "eerste veld", "niet eerste veld");
      if (v1) v.push({ label: "Positie", waarde: v1 });
      const kva = txt(get("conditie_kva") as string | null);
      if (kva) v.push({ label: "Trafovermogen", waarde: `${kva} kVA` });
      const kt = txt(get("conditie_kabel_type") as string | null);
      if (kt) v.push({ label: "Kabeltype", waarde: kt });
      const tl = txt(get("conditie_trafo_kabel_lengte") as string | null);
      if (tl) v.push({ label: "Trafo-kabellengte", waarde: tl });
      const min = get("conditie_aantal_kv_min");
      const max = get("conditie_aantal_kv_max");
      if (min != null || max != null) {
        v.push({
          label: "Aantal KV-velden",
          waarde: `${min ?? "?"} t/m ${max ?? "?"}`,
        });
      }
      break;
    }
    case "ggi":
    default:
      break;
  }
  return v;
}

/** Korte zin in mensentaal: "Als X en Y, voeg artikel Z toe, aantal N." */
export function zinVoor(
  type: RegelType,
  row: Record<string, unknown>,
  artikelNummer: string | null,
  artikelOms: string | null,
): string {
  const v = voorwaardenVoor(type, row);
  const hv = formuleOfGetal(row);
  const art = artikelNummer
    ? `artikel ${artikelNummer}${artikelOms ? ` (${artikelOms})` : ""}`
    : "een artikel (niet gekoppeld)";
  const conditiezin =
    v.length === 0
      ? "Altijd"
      : "Als " + v.map((c) => `${c.label.toLowerCase()} = ${c.waarde}`).join(" en ");
  return `${conditiezin}, voeg ${art} toe, aantal ${hv}.`;
}

export function formuleOfGetal(row: Record<string, unknown>): string {
  const f = txt(row["hoeveelheid_formule"] as string | null);
  if (f) return `${f} (formule)`;
  const h = row["hoeveelheid"];
  if (h === null || h === undefined) return "1";
  return String(h);
}
