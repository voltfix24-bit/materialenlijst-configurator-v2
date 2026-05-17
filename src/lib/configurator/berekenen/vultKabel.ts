import type { MaterialenConfig } from "../types";
import type { Stamdata } from "../queries";
import { add, type ArtikelLike, type BerekenCtx, type PreviewMap } from "./shared";

export interface VultKabelSpec {
  kabelArtNr: string;
  aantalKabels: number;
  persArtNr: string;
  aantalPers: number;
  muurbeugelArtNr: string | null;
  omschrijving: string;
}

interface VultKabelRow {
  trafo_kva: number;
  aantal_kabels: number;
  kabel_doorsnede: number;
  aantal_perskabelschoenen: number;
  omschrijving: string | null;
  kabel_artikel?: ArtikelLike["artikel"];
  perskabelschoen_artikel?: ArtikelLike["artikel"];
  muurbeugel_artikel?: ArtikelLike["artikel"];
}

/** Bouwt een VultKabelSpec voor UI-weergave uit DB-rijen, per kVA. */
export function vultKabelSpecsFromStamdata(sd: Stamdata): Record<string, VultKabelSpec> {
  const rows = (sd.trafoVultKabelSpecs?.data ?? []) as unknown as VultKabelRow[];
  const out: Record<string, VultKabelSpec> = {};
  for (const r of rows) {
    out[String(r.trafo_kva)] = {
      kabelArtNr: r.kabel_artikel?.artikel_nummer ?? "",
      aantalKabels: r.aantal_kabels,
      persArtNr: r.perskabelschoen_artikel?.artikel_nummer ?? "",
      aantalPers: r.aantal_perskabelschoenen,
      muurbeugelArtNr: r.muurbeugel_artikel?.artikel_nummer ?? null,
      omschrijving:
        r.omschrijving ??
        `${r.aantal_kabels}× 1x${r.kabel_doorsnede}mm²`,
    };
  }
  return out;
}

export function berekenVultKabel(
  map: PreviewMap,
  config: MaterialenConfig,
  sd: Stamdata,
  ctx: BerekenCtx,
): void {
  if (ctx.isCompact || !ctx.isRenovatie) return;
  if (!config.trafoKva || config.vultKabelAfstand <= 0) return;
  const rows = (sd.trafoVultKabelSpecs?.data ?? []) as unknown as (VultKabelRow & {
    kabel_artikel?: ArtikelLike["artikel"];
    perskabelschoen_artikel?: ArtikelLike["artikel"];
    muurbeugel_artikel?: ArtikelLike["artikel"];
  })[];
  const row = rows.find((r) => String(r.trafo_kva) === config.trafoKva);
  if (!row) return;
  const totaalMeters = Math.ceil(config.vultKabelAfstand * row.aantal_kabels);
  if (row.kabel_artikel) add(map, row.kabel_artikel, totaalMeters, "Vult kabel", "vultKabel");
  if (row.perskabelschoen_artikel)
    add(map, row.perskabelschoen_artikel, row.aantal_perskabelschoenen, "Vult kabel perskabelschoenen", "vultKabel");
  if (row.muurbeugel_artikel)
    add(map, row.muurbeugel_artikel, 1, "Vult kabel muurbeugel", "vultKabel");
}
