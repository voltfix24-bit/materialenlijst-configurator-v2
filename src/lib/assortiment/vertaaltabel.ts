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

/** Per-conflict keuze: 'overschrijf' = vertaaltabel wint, 'behoud' = huidig DB-alternatief laten staan. */
export type ConflictBesluit = "overschrijf" | "behoud";

export interface VertaaltabelImportOpties {
  /** Markeer oude artikelen inactief zodat de alternatief-migratie ze oppikt. Default true. */
  markeerInactief: boolean;
  /**
   * Maak ontbrekende nieuwe artikelen aan (uit vertaaltabel: nummer + omschrijving),
   * zodat de latere migratie ernaartoe kan verwijzen. Alleen voor rijen waarvan het
   * oude artikel in de DB staat. Default true.
   */
  maakNieuweArtikelenAan: boolean;
  /**
   * Per oud_nummer de keuze voor conflict-rijen. Ontbrekende sleutel = "behoud"
   * (bestaand alternatief laten staan; conflict wordt overgeslagen).
   */
  conflictBesluiten: Record<string, ConflictBesluit>;
}

/** Wat de import concreet met één rij gaat doen. Pure afgeleide van status + opties. */
export interface ImportActie {
  /** Nieuw artikel aanmaken (nieuw ontbreekt in DB én oud staat er wél). */
  maakNieuwAan: boolean;
  /** `alternatief_artikel_nummer` op het oude artikel zetten. */
  zetAlternatief: boolean;
  /** Oud artikel op inactief zetten. */
  markeerInactief: boolean;
  /** Rij volledig overslaan (geen DB-actie). */
  overslaan: boolean;
  /** Reden van overslaan, voor telling/uitleg. */
  redenOverslaan: "oud_ontbreekt" | "conflict_behouden" | "niets_te_doen" | null;
}

/**
 * Bepaal per rij wat er gebeurt — pure functie, geen database. Regels:
 *  - oud niet in DB → volledig overslaan (er is geen logica om te verleggen).
 *  - conflict + besluit ≠ "overschrijf" → overslaan (bestaand alternatief behouden).
 *  - nieuw ontbreekt → nieuw artikel aanmaken (indien optie aan) + alternatief zetten.
 *  - al_ingesteld → alleen inactief markeren indien nodig.
 *  - overige (gereed/nieuw_inactief) → alternatief zetten + inactief markeren.
 */
export function bepaalImportActie(
  m: VertaaltabelMatch,
  opties: VertaaltabelImportOpties,
): ImportActie {
  const niets: ImportActie = {
    maakNieuwAan: false,
    zetAlternatief: false,
    markeerInactief: false,
    overslaan: true,
    redenOverslaan: null,
  };

  if (m.status === "oud_ontbreekt" || !m.oud_id) {
    return { ...niets, redenOverslaan: "oud_ontbreekt" };
  }
  if (
    m.status === "conflict" &&
    (opties.conflictBesluiten[m.rij.oud_nummer] ?? "behoud") !== "overschrijf"
  ) {
    return { ...niets, redenOverslaan: "conflict_behouden" };
  }

  const zetAlternatief = m.status !== "al_ingesteld";
  const maakNieuwAan = opties.maakNieuweArtikelenAan && m.status === "nieuw_ontbreekt";
  const markeerInactief = opties.markeerInactief && m.oud_actief === true;

  if (!zetAlternatief && !maakNieuwAan && !markeerInactief) {
    return { ...niets, redenOverslaan: "niets_te_doen" };
  }
  return { maakNieuwAan, zetAlternatief, markeerInactief, overslaan: false, redenOverslaan: null };
}

export interface VertaaltabelImportResult {
  nieuw_aangemaakt: number;
  alt_gezet: number;
  inactief_gemarkeerd: number;
  overgeslagen: number;
  conflicten_overgeslagen: number;
  fouten: { oud_nummer: string; detail: string }[];
}

/**
 * Voer de import door: maak (waar nodig) ontbrekende nieuwe artikelen aan,
 * schrijf `alternatief_artikel_nummer` op de oude artikelen en markeer ze
 * inactief. Verlegt géén verwijzingen — draai daarna de Alternatief-migratie.
 */
export async function voerVertaaltabelImportDoor(
  diff: VertaaltabelDiff,
  opties: VertaaltabelImportOpties,
): Promise<VertaaltabelImportResult> {
  const result: VertaaltabelImportResult = {
    nieuw_aangemaakt: 0,
    alt_gezet: 0,
    inactief_gemarkeerd: 0,
    overgeslagen: 0,
    conflicten_overgeslagen: 0,
    fouten: [],
  };

  for (const m of diff.matches) {
    const actie = bepaalImportActie(m, opties);
    if (actie.overslaan) {
      result.overgeslagen++;
      if (actie.redenOverslaan === "conflict_behouden") result.conflicten_overgeslagen++;
      continue;
    }

    // 1. Nieuw artikel aanmaken indien nodig (uit vertaaltabel: nummer + omschrijving).
    //    artikel_nummer is UNIQUE; een dubbele insert (dubbelklik) faalt netjes en
    //    wordt als niet-fataal behandeld.
    if (actie.maakNieuwAan) {
      const { error: insErr } = await supabase.from("artikelen").insert({
        artikel_nummer: m.rij.nieuw_nummer,
        korte_omschrijving: m.rij.omschrijving ?? m.rij.nieuw_nummer,
        eenheid: "Stuks",
        actief: true,
        status: "Actief",
      });
      if (insErr) {
        // 23505 = unique_violation → artikel bestond tóch al; niet fataal.
        const bestondAl = /duplicate key|unique/i.test(insErr.message);
        if (!bestondAl) {
          result.fouten.push({
            oud_nummer: m.rij.oud_nummer,
            detail: `nieuw artikel ${m.rij.nieuw_nummer}: ${insErr.message}`,
          });
          continue;
        }
      } else {
        result.nieuw_aangemaakt++;
      }
    }

    // 2. Oud artikel bijwerken: alternatief + inactief.
    const patch: { alternatief_artikel_nummer?: string; actief?: boolean; status?: string } = {};
    if (actie.zetAlternatief) patch.alternatief_artikel_nummer = m.rij.nieuw_nummer;
    if (actie.markeerInactief) {
      patch.actief = false;
      patch.status = "Uitgelopen";
    }

    const { error } = await supabase.from("artikelen").update(patch).eq("id", m.oud_id!);
    if (error) {
      result.fouten.push({ oud_nummer: m.rij.oud_nummer, detail: error.message });
      continue;
    }
    if (actie.zetAlternatief) result.alt_gezet++;
    if (actie.markeerInactief) result.inactief_gemarkeerd++;
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
  const verwerkt = result.nieuw_aangemaakt + result.alt_gezet + result.inactief_gemarkeerd;
  await logActie({
    actie: "vertaaltabel_import",
    omschrijving:
      `Vertaaltabel geïmporteerd: ${result.nieuw_aangemaakt} nieuw artikel aangemaakt, ` +
      `${result.alt_gezet} alternatief(ven) gezet, ${result.inactief_gemarkeerd} inactief gemarkeerd, ` +
      `${result.conflicten_overgeslagen} conflict(en) behouden, ${result.fouten.length} fout(en).`,
    aantal_aangepast: verwerkt,
    resultaat: heeftFouten ? (verwerkt > 0 ? "gedeeltelijk" : "fout") : "ok",
    details: { ...result, telling: diff.telling },
  });

  return result;
}
