import ExcelJS from "exceljs";

const TEMPLATE_URL = "/templates/assortimentslijst.xlsx";
/**
 * Data-sheet binnen de maandelijkse Liander-template waar het assortiment
 * staat. Zowel parser (upload) als export gebruiken dezelfde sheet, zodat
 * UI-tekst en gedrag altijd overeenkomen. Wijzigingen aan deze constante
 * vereisen ook update van AssortimentTab.tsx.
 */
export const SHEET_NAAM = "Verbruik";
export const VERWIJDERD_SHEET_NAAM = "Lijst verwijderd";
const SHEET = SHEET_NAAM;
const HEADER_ROW = 13;
const DATA_START = 14;

const COL_KLANT_HOEVEELHEID = 1; // A
const COL_EENHEID = 2;            // B
const COL_ARTIKELNUMMER = 3;      // C
const COL_OMSCHRIJVING = 4;       // D
const COL_AANTAL_VERPAKKING = 5;  // E
const COL_STATUS = 6;             // F
const COL_ALTERNATIEF = 7;        // G
const COL_BASIS_EENHEID = 9;      // I
const COL_CATEGORIE = 10;         // J

const META_CASE_ROW = 8;
const META_CASE_COL = 5;
const META_DATE_ROW = 7;
const META_DATE_COL = 5;

export interface ExportItem {
  artikel_nummer: string;
  hoeveelheid: number;
  /** Optioneel: artikel actief? Wordt gebruikt voor export-waarschuwing. */
  actief?: boolean;
  /** Optioneel: omschrijving voor in de waarschuwing-toast. */
  korte_omschrijving?: string;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  matched: number;
  unmatched: ExportItem[];
  /** Artikelen die wél in template staan maar in DB als inactief gemarkeerd zijn. */
  inactief: ExportItem[];
}

function todayDDMMYYYY(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}


export async function exporteerNaarTemplate(
  items: ExportItem[],
  caseNummer: string | null | undefined,
  projectNaam?: string | null,
): Promise<ExportResult> {
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error("Kon Excel-template niet laden");
  const buf = await res.arrayBuffer();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet(SHEET);
  if (!ws) throw new Error(`Sheet "${SHEET}" niet gevonden`);

  // Index alle artikelnummer-rijen
  const rowByNummer = new Map<string, number>();
  const last = ws.actualRowCount || ws.rowCount;
  for (let r = DATA_START; r <= last; r++) {
    const v = ws.getRow(r).getCell(COL_ARTIKELNUMMER).value;
    if (v == null || v === "") continue;
    const key = String(typeof v === "object" && "result" in (v as object)
      ? (v as { result: unknown }).result
      : v).trim();
    if (key) rowByNummer.set(key, r);
  }

  // Sommeer per artikelnummer
  const sums = new Map<string, number>();
  const infoByNr = new Map<string, ExportItem>();
  for (const it of items) {
    const k = String(it.artikel_nummer).trim();
    if (!k) continue;
    sums.set(k, (sums.get(k) ?? 0) + Number(it.hoeveelheid || 0));
    if (!infoByNr.has(k)) infoByNr.set(k, it);
  }

  let matched = 0;
  const unmatched: ExportItem[] = [];
  const inactief: ExportItem[] = [];
  for (const [nummer, qty] of sums) {
    const info = infoByNr.get(nummer);
    const r = rowByNummer.get(nummer);
    if (!r) {
      unmatched.push({
        artikel_nummer: nummer,
        hoeveelheid: qty,
        korte_omschrijving: info?.korte_omschrijving,
      });
      continue;
    }
    const cell = ws.getRow(r).getCell(COL_KLANT_HOEVEELHEID);
    cell.value = qty;
    matched++;
    if (info && info.actief === false) {
      inactief.push({
        artikel_nummer: nummer,
        hoeveelheid: qty,
        korte_omschrijving: info.korte_omschrijving,
      });
    }
  }

  ws.getRow(META_CASE_ROW).getCell(META_CASE_COL).value = caseNummer ?? "";
  ws.getRow(META_DATE_ROW).getCell(META_DATE_COL).value = todayDDMMYYYY();

  const out = await wb.xlsx.writeBuffer();
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  const parts = ["Materialenlijst"];
  if (projectNaam && projectNaam.trim()) parts.push(sanitize(projectNaam));
  if (caseNummer && String(caseNummer).trim()) parts.push(sanitize(String(caseNummer)));
  const filename = `${parts.join("_")}.xlsx`;
  return {
    blob,
    filename,
    matched,
    unmatched,
    inactief,
  };
}

export interface ParsedArtikel {
  artikel_nummer: string;
  korte_omschrijving: string;
  eenheid: string;
  basis_eenheid: string | null;
  aantal_in_verpakking: number | null;
  status: string;
  categorie: string | null;
  alternatief_artikel_nummer: string | null;
}

/**
 * Eén regel uit het tabblad "Lijst verwijderd". Headers staan op rij 1,
 * data vanaf rij 2. Kolommen: A=Artikelnummer, B=Omschrijving, C=Datum,
 * D=Wie, E=Opmerking, F=Opvolgend artikelnummer.
 *
 * `opvolger_nummers` bevat alle 8-cijferige Liander-nummers die uit
 * kolom F konden worden geëxtraheerd. `opvolger_handmatig` is true
 * als de cel óók niet-numerieke tekst bevatte (bijv. "GEBR 20036380"),
 * zodat de engineer een handmatige controle krijgt.
 */
export interface ParsedVerwijderd {
  artikel_nummer: string;
  korte_omschrijving: string;
  reden: string | null;
  opvolger_raw: string | null;
  opvolger_nummers: string[];
  opvolger_handmatig: boolean;
}

function cellString(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object" && "result" in (v as object)) {
    return String((v as { result: unknown }).result ?? "");
  }
  if (typeof v === "object" && "richText" in (v as object)) {
    return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("");
  }
  return String(v);
}

/**
 * Normaliseer de status-string uit Excel naar consistente waarden.
 * Liander wisselt soms tussen "Uitloop" en "Uitgelopen" — wij slaan beide
 * op als "Uitgelopen" zodat downstream-logica (winkelwagen, impact,
 * alternatief-migratie) één waarde hoeft te kennen.
 */
function normaliseerStatus(raw: string): string {
  const s = raw.trim();
  if (!s) return "Actief";
  const l = s.toLowerCase();
  if (l === "actief") return "Actief";
  if (l === "uitgelopen" || l === "uitloop") return "Uitgelopen";
  if (l === "inactief") return "Inactief";
  if (l === "verwijderd") return "Verwijderd";
  if (l === "geblokkeerd" || l === "blokkade") return "Geblokkeerd";
  return s; // onbekend: laat originele waarde staan zodat het zichtbaar blijft in diff
}


/** Liander artikelnummers zijn 8-cijferig. */
const ARTIKELNR_RE = /\b\d{8}\b/g;
const GEEN_OPVOLGER_HINTS = new Set(["", "-", "geen opvolger", "n/a", "n.v.t.", "nvt"]);

/**
 * Parse de "Opvolgend artikelnummer"-cel uit sheet "Lijst verwijderd".
 *  - leeg / "-" / "GEEN OPVOLGER" → {nummers:[], handmatig:false}
 *  - "20039090 20041319" → twee kandidaten, handmatig=false
 *  - "GEBR 20036380" → één kandidaat, handmatig=true (engineer-check)
 */
export function parseOpvolger(raw: string | null | undefined): {
  nummers: string[];
  handmatig: boolean;
  raw: string | null;
} {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { nummers: [], handmatig: false, raw: null };
  const lower = trimmed.toLowerCase();
  if (GEEN_OPVOLGER_HINTS.has(lower)) {
    return { nummers: [], handmatig: false, raw: trimmed };
  }
  const matches = trimmed.match(ARTIKELNR_RE) ?? [];
  const seen = new Set<string>();
  const nummers: string[] = [];
  for (const m of matches) {
    if (!seen.has(m)) {
      seen.add(m);
      nummers.push(m);
    }
  }
  const overige = trimmed.replace(ARTIKELNR_RE, "").trim();
  const handmatig = overige.length > 0;
  return { nummers, handmatig, raw: trimmed };
}

const VERWIJDERD_DATA_START = 2;
const V_COL_ARTIKEL = 1;        // A
const V_COL_OMSCHRIJVING = 2;   // B
const V_COL_REDEN = 5;          // E
const V_COL_OPVOLGER = 6;       // F

export interface ParseResult {
  /** Rijen uit sheet "Verbruik" — de actuele bestelbare lijst. */
  artikelen: ParsedArtikel[];
  /** Rijen uit sheet "Lijst verwijderd" — historie + opvolgers. Lege array als sheet ontbreekt. */
  verwijderd: ParsedVerwijderd[];
}

export async function parseAssortimentslijst(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  // --- Sheet "Verbruik" (verplicht) ---
  const ws = wb.getWorksheet(SHEET);
  if (!ws) {
    const sheets = wb.worksheets.map((s) => s.name).join(", ") || "(geen)";
    throw new Error(
      `Sheet "${SHEET}" niet gevonden. Aanwezige sheets: ${sheets}. ` +
        `Controleer of dit het officiële Liander-template is.`,
    );
  }

  const headerCell = cellString(ws.getRow(HEADER_ROW).getCell(COL_ARTIKELNUMMER).value).toLowerCase();
  if (headerCell && !headerCell.includes("artikel")) {
    console.warn(
      `[assortiment] Header rij ${HEADER_ROW} kolom C bevat "${headerCell}" i.p.v. "Artikelnummer" — ` +
        `template-structuur is mogelijk gewijzigd.`,
    );
  }

  const artikelen: ParsedArtikel[] = [];
  const last = ws.actualRowCount || ws.rowCount;
  for (let r = DATA_START; r <= last; r++) {
    const row = ws.getRow(r);
    const nummer = cellString(row.getCell(COL_ARTIKELNUMMER).value).trim();
    if (!nummer) continue;
    const alt = cellString(row.getCell(COL_ALTERNATIEF).value).trim();
    const verp = cellString(row.getCell(COL_AANTAL_VERPAKKING).value).trim();
    artikelen.push({
      artikel_nummer: nummer,
      korte_omschrijving: cellString(row.getCell(COL_OMSCHRIJVING).value).trim(),
      eenheid: cellString(row.getCell(COL_EENHEID).value).trim() || "Stuks",
      basis_eenheid: cellString(row.getCell(COL_BASIS_EENHEID).value).trim() || null,
      aantal_in_verpakking: verp ? Number(verp) || null : null,
      status: normaliseerStatus(cellString(row.getCell(COL_STATUS).value)),
      categorie: cellString(row.getCell(COL_CATEGORIE).value).trim() || null,
      alternatief_artikel_nummer: alt && alt !== "." ? alt : null,
    });
  }

  // --- Sheet "Lijst verwijderd" (optioneel) ---
  const verwijderd: ParsedVerwijderd[] = [];
  const wsVerw = wb.getWorksheet(VERWIJDERD_SHEET_NAAM);
  if (wsVerw) {
    const vLast = wsVerw.actualRowCount || wsVerw.rowCount;
    for (let r = VERWIJDERD_DATA_START; r <= vLast; r++) {
      const row = wsVerw.getRow(r);
      const nummer = cellString(row.getCell(V_COL_ARTIKEL).value).trim();
      if (!nummer || !/^\d{6,}$/.test(nummer)) continue; // sla header-resten / lege rijen over
      const opv = parseOpvolger(cellString(row.getCell(V_COL_OPVOLGER).value));
      verwijderd.push({
        artikel_nummer: nummer,
        korte_omschrijving: cellString(row.getCell(V_COL_OMSCHRIJVING).value).trim(),
        reden: cellString(row.getCell(V_COL_REDEN).value).trim() || null,
        opvolger_raw: opv.raw,
        opvolger_nummers: opv.nummers,
        opvolger_handmatig: opv.handmatig,
      });
    }
  } else {
    console.info(
      `[assortiment] Sheet "${VERWIJDERD_SHEET_NAAM}" niet gevonden — geen verwijderd-lijst verwerkt.`,
    );
  }

  return { artikelen, verwijderd };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
