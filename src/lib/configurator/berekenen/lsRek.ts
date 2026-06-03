import type { MaterialenConfig } from "../types";
import type { Stamdata } from "../queries";
import { add, type ArtikelLike, type BerekenCtx, type PreviewMap } from "./shared";

interface LsRekRegel {
  id: string;
  conditie_compact: boolean | null;
  conditie_renovatie: boolean | null;
  conditie_actie: string | null;
  conditie_lsrek_type: string | null;
  conditie_beveiliging_aanpassen: boolean | null;
  conditie_ov_stuurpunt: boolean | null;
  conditie_schroefpatroon: string | null;
  conditie_kva: string | null;
  hoeveelheid: number | string;
  hoeveelheid_formule: string | null;
  herkomst_label: string;
  artikel?: ArtikelLike["artikel"];
}

/** Evalueert een hoeveelheid-formule tegen de huidige config. */
function evalFormule(formule: string | null, fallback: number, config: MaterialenConfig): number {
  if (!formule) return fallback;
  switch (formule) {
    case "lsRekExtraStroken":
      return config.lsRekExtraStroken ?? 0;
    case "lsRekAanSluitenKabels":
      return config.lsRekAanSluitenKabels ?? 0;
    case "lsRekAanSluitenKabels*2":
      return (config.lsRekAanSluitenKabels ?? 0) * 2;
    default:
      return fallback;
  }
}

/**
 * Sectie 7: LS-rek + OV-stuurpunt + LS zekeringen + kabelbevestigingsklemmen.
 *
 * Statisch deel (LS-rek bakken, mespatronen, OV-stuurpunt, kabelklemmen)
 * komt uit `ls_rek_regels`. Het dynamische deel — door engineer ingevulde
 * `lsRekBeveiligingen` artikelnummers — blijft in code omdat het pure
 * per-case input is.
 */
export function berekenLsRek(
  map: PreviewMap,
  config: MaterialenConfig,
  sd: Stamdata,
  ctx: BerekenCtx,
): void {
  const { findArtNr, isCompact, isRenovatie } = ctx;
  const regels = (sd.lsRekRegels.data ?? []) as unknown as LsRekRegel[];

  for (const r of regels) {
    if (r.conditie_compact !== null && r.conditie_compact !== isCompact) continue;
    if (r.conditie_renovatie !== null && r.conditie_renovatie !== isRenovatie) continue;
    if (r.conditie_actie !== null && r.conditie_actie !== config.lsRekActie) continue;
    if (r.conditie_lsrek_type !== null && r.conditie_lsrek_type !== config.lsRekType) continue;
    if (r.conditie_beveiliging_aanpassen === true && !config.lsRekBeveiligingAanpassen) continue;
    if (r.conditie_ov_stuurpunt === true && !config.lsRekOvStuurpunt) continue;
    if (r.conditie_schroefpatroon !== null && r.conditie_schroefpatroon !== config.lsRekSchroefpatroon) continue;
    if (r.conditie_kva !== null && r.conditie_kva !== (config.trafoKva ?? "")) continue;

    const qty = evalFormule(r.hoeveelheid_formule, Number(r.hoeveelheid), config);
    add(map, r.artikel, qty, r.herkomst_label, "lsRek", { tabel: "ls_rek_regels", id: r.id });
  }

  // Dynamische per-richting beveiligingen (engineer-input artikelnummers).
  // GEEN subtype-gating: als de engineer artikelnummers invult, horen ze
  // altijd in de winkelwagen — anders krijg je verborgen gedrag dat
  // afhankelijk is van vooraf gekozen lsRekActie/compact/renovatie.
  if ((config.lsRekAantalBeveiligingen ?? 0) > 0) {
    for (const artNr of config.lsRekBeveiligingen ?? []) {
      if (artNr) add(map, findArtNr(artNr), 3, "LS richting beveiliging", "lsRek");
    }
  }
}
