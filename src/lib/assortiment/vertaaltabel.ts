import ExcelJS from "exceljs";
import { supabase } from "@/integrations/supabase/client";
import { logActie } from "@/lib/beheer/log";

/**
 * Import van de losse "Vertaaltabel nieuwe artikelnummers".
 *
 * Deze tabel bevat de gezaghebbende oud → nieuw mapping (kolom A = oud
 * artikelnummer, kolom B = nieuw artikelnummer, kolom C = omschrijving) die
 * NIET volledig in de maandelijkse assortimentslijst zit. De import zet per
 * oud artikel het `alternatief_artikel_nummer`-veld op het nieuwe nummer en
 * markeert het oude artikel inactief, zodat de bestaande **Alternatief-migratie**
 * de `artikel_id`-verwijzingen (regels, vragen, configuraties, cases) van oud
 * naar nieuw kan verleggen. Zo blijft alle logica behouden.
 *
 * De import verlegt zélf geen verwijzingen — dat blijft de expliciete,
 * gecontroleerde stap in `alternatief.ts`.
 */

/** Eén regel uit de vertaaltabel. */
export interface VertaaltabelRij {
  oud_nummer: string;
  nieuw_nummer: string;
  omschrijving: string | null;
}

/** Minimale artikel-info die de categorisatie nodig heeft. */
export interface BestaandArtikelMini {
  id: string;
  artikel_nummer: string;
  actief: boolean;
  alternatief_artikel_nummer: string | null;
}

export type VertaaltabelStatus =
  /** Oud in DB, nieuw in DB & actief → alt zetten + oud inactief; direct migreerbaar. */
  | "gereed"
  /** Oud in DB, nieuw bestaat maar is inactief → alt zetten, migratie geblokkeerd tot nieuw actief is. */
  | "nieuw_inactief"
  /** Oud in DB, nieuw komt (nog) niet voor in DB → alt zetten, migratie kan pas na insert nieuw artikel. */
  | "nieuw_ontbreekt"
  /** Oud heeft al exact dit alternatief → geen alt-write nodig (alleen evt. inactief markeren). */
  | "al_ingesteld"
  /** Oud heeft al een ánder alternatief → niet overschrijven tenzij expliciet gekozen. */
  | "conflict"
  /** Oud artikel bestaat niet in de DB → niets te doen. */
  | "oud_ontbreekt";

export interface VertaaltabelMatch {
  rij: VertaaltabelRij;
  status: VertaaltabelStatus;
  oud_id: string | null;
  oud_actief: boolean | null;
  huidig_alternatief: string | null;
  nieuw_id: string | null;
  nieuw_actief: boolean | null;
}

const NUMMER_RE = /^\d{6,}$/;

function cellString(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object" && "result" in (v as object)) {
    return String((v as { result: unknown }).result ?? "");
  }
  if (typeof v === "object" && "richText" in (v as object)) {
    return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("");
  }
  if (typeof v === "object" && "text" in (v as object)) {
    return String((v as { text: unknown }).text ?? "");
  }
  return String(v);
}

const COL_OUD = 1; // A
const COL_NIEUW = 2; // B
const COL_OMSCHRIJVING = 3; // C
const DATA_START = 2; // rij 1 = header

/**
 * Parse de vertaaltabel. Neemt de eerste worksheet (Liander levert deze als
 * "Blad1"). Alleen rijen waarvan zowel oud als nieuw een artikelnummer-achtig
 * token zijn, worden meegenomen. Duplicaten (zelfde oud nummer) worden op de
 * eerste voorkomst gehouden.
 */
export async function parseVertaaltabel(file: File): Promise<VertaaltabelRij[]> {
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("Vertaaltabel bevat geen werkblad.");

  const rijen: VertaaltabelRij[] = [];
  const seen = new Set<string>();
  const last = ws.actualRowCount || ws.rowCount;
  for (let r = DATA_START; r <= last; r++) {
    const row = ws.getRow(r);
    const oud = cellString(row.getCell(COL_OUD).value).trim();
    const nieuw = cellString(row.getCell(COL_NIEUW).value).trim();
    if (!NUMMER_RE.test(oud) || !NUMMER_RE.test(nieuw)) continue;
    if (oud === nieuw) continue; // geen echte wijziging
    if (seen.has(oud)) continue;
    seen.add(oud);
    rijen.push({
      oud_nummer: oud,
      nieuw_nummer: nieuw,
      omschrijving: cellString(row.getCell(COL_OMSCHRIJVING).value).trim() || null,
    });
  }
  if (rijen.length === 0) {
    throw new Error(
      "Geen geldige oud→nieuw rijen gevonden. Verwacht: kolom A = oud nummer, " +
        "kolom B = nieuw nummer, kolom C = omschrijving (data vanaf rij 2).",
    );
  }
  return rijen;
}

/**
 * Pure categorisatie — geen database. Bepaalt per vertaaltabel-rij wat de
 * import ermee doet, op basis van wat er al in de DB staat (`byNr`).
 */
export function categoriseerVertaaltabel(
  rijen: VertaaltabelRij[],
  byNr: Map<string, BestaandArtikelMini>,
): VertaaltabelMatch[] {
  return rijen.map((rij) => {
    const oud = byNr.get(rij.oud_nummer) ?? null;
    const nieuw = byNr.get(rij.nieuw_nummer) ?? null;
    const huidigAlt = (oud?.alternatief_artikel_nummer ?? "").trim() || null;

    let status: VertaaltabelStatus;
    if (!oud) {
      status = "oud_ontbreekt";
    } else if (huidigAlt && huidigAlt === rij.nieuw_nummer) {
      status = "al_ingesteld";
    } else if (huidigAlt && huidigAlt !== rij.nieuw_nummer) {
      status = "conflict";
    } else if (!nieuw) {
      status = "nieuw_ontbreekt";
    } else if (!nieuw.actief) {
      status = "nieuw_inactief";
    } else {
      status = "gereed";
    }

    return {
      rij,
      status,
      oud_id: oud?.id ?? null,
      oud_actief: oud?.actief ?? null,
      huidig_alternatief: huidigAlt,
      nieuw_id: nieuw?.id ?? null,
      nieuw_actief: nieuw?.actief ?? null,
    };
  });
}

export interface VertaaltabelDiff {
  matches: VertaaltabelMatch[];
  telling: Record<VertaaltabelStatus, number>;
}

function tel(matches: VertaaltabelMatch[]): Record<VertaaltabelStatus, number> {
  const t: Record<VertaaltabelStatus, number> = {
    gereed: 0,
    nieuw_inactief: 0,
    nieuw_ontbreekt: 0,
    al_ingesteld: 0,
    conflict: 0,
    oud_ontbreekt: 0,
  };
  for (const m of matches) t[m.status]++;
  return t;
}

/** Laad de relevante artikelen (oud ∪ nieuw) en categoriseer. */
export async function berekenVertaaltabelDiff(rijen: VertaaltabelRij[]): Promise<VertaaltabelDiff> {
  const nummers = new Set<string>();
  for (const r of rijen) {
    nummers.add(r.oud_nummer);
    nummers.add(r.nieuw_nummer);
  }
  const byNr = new Map<string, BestaandArtikelMini>();
  const alle = [...nummers];
  const CHUNK = 300; // .in() met grote arrays opknippen
  for (let i = 0; i < alle.length; i += CHUNK) {
    const slice = alle.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("artikelen")
      .select("id, artikel_nummer, actief, alternatief_artikel_nummer")
      .in("artikel_nummer", slice);
    if (error) throw error;
    for (const a of data ?? []) {
      byNr.set(a.artikel_nummer as string, a as BestaandArtikelMini);
    }
  }
  const matches = categoriseerVertaaltabel(rijen, byNr);
  return { matches, telling: tel(matches) };
}

export interface VertaaltabelImportOpties {
  /** Overschrijf bestaande, afwijkende alternatieven (status "conflict"). Default false. */
  overschrijfConflicten: boolean;
  /** Markeer oude artikelen inactief zodat de alternatief-migratie ze oppikt. Default true. */
  markeerInactief: boolean;
}

export interface VertaaltabelImportResult {
  alt_gezet: number;
  inactief_gemarkeerd: number;
  overgeslagen: number;
  conflicten_overgeslagen: number;
  fouten: { oud_nummer: string; detail: string }[];
}

/**
 * Voer de import door: schrijf `alternatief_artikel_nummer` op de oude
 * artikelen en markeer ze (optioneel) inactief. Verlegt géén verwijzingen —
 * draai daarna de Alternatief-migratie.
 */
export async function voerVertaaltabelImportDoor(
  diff: VertaaltabelDiff,
  opties: VertaaltabelImportOpties,
): Promise<VertaaltabelImportResult> {
  const result: VertaaltabelImportResult = {
    alt_gezet: 0,
    inactief_gemarkeerd: 0,
    overgeslagen: 0,
    conflicten_overgeslagen: 0,
    fouten: [],
  };

  for (const m of diff.matches) {
    if (m.status === "oud_ontbreekt" || !m.oud_id) {
      result.overgeslagen++;
      continue;
    }
    if (m.status === "conflict" && !opties.overschrijfConflicten) {
      result.conflicten_overgeslagen++;
      continue;
    }

    const moetAltSchrijven = m.status !== "al_ingesteld";
    const moetInactief = opties.markeerInactief && m.oud_actief === true;
    if (!moetAltSchrijven && !moetInactief) {
      result.overgeslagen++;
      continue;
    }

    const patch: { alternatief_artikel_nummer?: string; actief?: boolean; status?: string } = {};
    if (moetAltSchrijven) patch.alternatief_artikel_nummer = m.rij.nieuw_nummer;
    if (moetInactief) {
      patch.actief = false;
      patch.status = "Uitgelopen";
    }

    const { error } = await supabase.from("artikelen").update(patch).eq("id", m.oud_id);
    if (error) {
      result.fouten.push({ oud_nummer: m.rij.oud_nummer, detail: error.message });
      continue;
    }
    if (moetAltSchrijven) result.alt_gezet++;
    if (moetInactief) result.inactief_gemarkeerd++;
  }

  // logging — best-effort
  try {
    const stamp = new Date().toISOString();
    await supabase.from("app_instellingen").upsert({
      sleutel: "laatste_vertaaltabel_import",
      waarde: JSON.stringify({ timestamp: stamp, ...result, telling: diff.telling }),
      updated_at: stamp,
    });
  } catch {
    /* best-effort */
  }
  const heeftFouten = result.fouten.length > 0;
  const verwerkt = result.alt_gezet + result.inactief_gemarkeerd;
  await logActie({
    actie: "vertaaltabel_import",
    omschrijving:
      `Vertaaltabel geïmporteerd: ${result.alt_gezet} alternatief(ven) gezet, ` +
      `${result.inactief_gemarkeerd} artikel(en) inactief gemarkeerd, ` +
      `${result.conflicten_overgeslagen} conflict(en) overgeslagen, ${result.fouten.length} fout(en).`,
    aantal_aangepast: verwerkt,
    resultaat: heeftFouten ? (verwerkt > 0 ? "gedeeltelijk" : "fout") : "ok",
    details: { ...result, telling: diff.telling },
  });

  return result;
}
