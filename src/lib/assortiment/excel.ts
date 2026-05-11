import ExcelJS from "exceljs";

const TEMPLATE_URL = "/templates/assortimentslijst.xlsx";
const SHEET = "Aanvulling";
const HEADER_ROW = 13;
const DATA_START = 14;

const COL_KLANT_HOEVEELHEID = 1; // A
const COL_EENHEID = 2;            // B (Stuks/Doos/...)
const COL_ARTIKELNUMMER = 3;      // C
const COL_OMSCHRIJVING = 4;       // D
const COL_AANTAL_VERPAKKING = 5;  // E
const COL_STATUS = 6;             // F
const COL_ALTERNATIEF = 7;        // G
const COL_BASIS_EENHEID = 9;      // I
const COL_CATEGORIE = 10;         // J

// Metadata cells (1-based for openpyxl/exceljs). Spec uses 0-based:
//   row 7 col 4 -> casenummer  => exceljs row 8 col 5 (E8)
//   row 6 col 4 -> datum       => exceljs row 7 col 5 (E7)
const META_CASE_ROW = 8;
const META_CASE_COL = 5;
const META_DATE_ROW = 7;
const META_DATE_COL = 5;

export interface ExportItem {
  artikel_nummer: string;
  hoeveelheid: number;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  matched: number;
  unmatched: ExportItem[];
}

function todayDDMMYYYY(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function fileDate(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

export async function exporteerNaarTemplate(
  items: ExportItem[],
  caseNummer: string | null | undefined,
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

  // Sommeer per artikelnummer (voor zekerheid)
  const sums = new Map<string, number>();
  for (const it of items) {
    const k = String(it.artikel_nummer).trim();
    if (!k) continue;
    sums.set(k, (sums.get(k) ?? 0) + Number(it.hoeveelheid || 0));
  }

  let matched = 0;
  const unmatched: ExportItem[] = [];
  for (const [nummer, qty] of sums) {
    const r = rowByNummer.get(nummer);
    if (!r) {
      unmatched.push({ artikel_nummer: nummer, hoeveelheid: qty });
      continue;
    }
    const cell = ws.getRow(r).getCell(COL_KLANT_HOEVEELHEID);
    cell.value = qty;
    matched++;
  }

  // Metadata
  ws.getRow(META_CASE_ROW).getCell(META_CASE_COL).value = caseNummer ?? "";
  ws.getRow(META_DATE_ROW).getCell(META_DATE_COL).value = todayDDMMYYYY();

  const out = await wb.xlsx.writeBuffer();
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const safeCase = (caseNummer || "case").replace(/[^a-zA-Z0-9_-]+/g, "_");
  return {
    blob,
    filename: `Materiaallijst_${safeCase}_${fileDate()}.xlsx`,
    matched,
    unmatched,
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

export async function parseAssortimentslijst(file: File): Promise<ParsedArtikel[]> {
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet(SHEET);
  if (!ws) throw new Error(`Sheet "${SHEET}" niet gevonden in dit bestand`);

  const out: ParsedArtikel[] = [];
  const last = ws.actualRowCount || ws.rowCount;
  for (let r = DATA_START; r <= last; r++) {
    const row = ws.getRow(r);
    const nummer = cellString(row.getCell(COL_ARTIKELNUMMER).value).trim();
    if (!nummer) continue;
    const alt = cellString(row.getCell(COL_ALTERNATIEF).value).trim();
    const verp = cellString(row.getCell(COL_AANTAL_VERPAKKING).value).trim();
    out.push({
      artikel_nummer: nummer,
      korte_omschrijving: cellString(row.getCell(COL_OMSCHRIJVING).value).trim(),
      eenheid: cellString(row.getCell(COL_EENHEID).value).trim() || "Stuks",
      basis_eenheid: cellString(row.getCell(COL_BASIS_EENHEID).value).trim() || null,
      aantal_in_verpakking: verp ? Number(verp) || null : null,
      status: cellString(row.getCell(COL_STATUS).value).trim() || "Actief",
      categorie: cellString(row.getCell(COL_CATEGORIE).value).trim() || null,
      alternatief_artikel_nummer: alt && alt !== "." ? alt : null,
    });
  }
  return out;
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
