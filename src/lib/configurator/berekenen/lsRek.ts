import type { MaterialenConfig } from "../types";
import { add, type BerekenCtx, type PreviewMap } from "./shared";
import { LS_REK, LS_REK_MESPATROON, OV_STUURPUNT } from "./artikelnummers";

/** Sectie 7: LS-rek (vervangen / gehandhaafd) + OV-stuurpunt + zekeringen + kabelklemmen. */
export function berekenLsRek(map: PreviewMap, config: MaterialenConfig, ctx: BerekenCtx): void {
  const { findArtNr, isCompact, isRenovatie } = ctx;

  if (!isCompact && config.lsRekActie && isRenovatie) {
    if (config.lsRekActie === "vervangen") {
      if (config.lsRekType === "8") add(map, findArtNr(LS_REK.R_8), 1, "LS-rek 8 richtingen", "lsRek");
      else if (config.lsRekType === "12") add(map, findArtNr(LS_REK.R_12), 1, "LS-rek 12 richtingen", "lsRek");

      if (config.lsRekExtraStroken > 0) {
        add(map, findArtNr(LS_REK.EXTRA_STRO), config.lsRekExtraStroken, "LS-rek extra stroken", "lsRek");
      }

      const mpNr = LS_REK_MESPATROON[config.trafoKva ?? ""];
      if (mpNr) add(map, findArtNr(mpNr), 3, "LS-rek beveiliging voedende strook", "lsRek");
    }

    if (config.lsRekActie === "gehandhaafd" && config.lsRekBeveiligingAanpassen) {
      const mpNr = LS_REK_MESPATROON[config.trafoKva ?? ""];
      if (mpNr) add(map, findArtNr(mpNr), 3, "LS-rek beveiliging aanpassen", "lsRek");
    }

    if (config.lsRekOvStuurpunt) {
      if (config.lsRekSchroefpatroon === "35A") add(map, findArtNr(OV_STUURPUNT.SCHROEF_35A), 3, "OV-stuurpunt schroefpatroon", "lsRek");
      else if (config.lsRekSchroefpatroon === "50A") add(map, findArtNr(OV_STUURPUNT.SCHROEF_50A), 3, "OV-stuurpunt schroefpatroon", "lsRek");

      add(map, findArtNr(OV_STUURPUNT.ROUTER), 1, "OV-stuurpunt router", "lsRek");
      add(map, findArtNr(OV_STUURPUNT.ROUTER_BEUG), 1, "OV-stuurpunt beugel router", "lsRek");
      add(map, findArtNr(OV_STUURPUNT.FLEX_OV), 1, "OV-stuurpunt FlexOV device", "lsRek");
      add(map, findArtNr(OV_STUURPUNT.FLEX_BEUG), 1, "OV-stuurpunt beugel FlexOV", "lsRek");
      add(map, findArtNr(OV_STUURPUNT.ETHERNET), 1, "OV-stuurpunt kabel ethernet", "lsRek");
    }
  }

  // LS zekeringen per richting
  const lsZekeringActief =
    isCompact ||
    (isRenovatie && config.lsRekActie === "vervangen") ||
    (isRenovatie && config.lsRekActie === "gehandhaafd" && config.lsRekBeveiligingAanpassen);
  if (lsZekeringActief && (config.lsRekAantalBeveiligingen ?? 0) > 0) {
    for (const artNr of config.lsRekBeveiligingen ?? []) {
      if (artNr) add(map, findArtNr(artNr), 3, "LS richting beveiliging", "lsRek");
    }
  }

  // Mespatroon LS-rek bij compact: altijd 3×
  if (isCompact) {
    const mpNr = LS_REK_MESPATROON[config.trafoKva ?? ""];
    if (mpNr) add(map, findArtNr(mpNr), 3, "LS-rek beveiliging voedende strook", "lsRek");
  }

  // LS-rek kabelbevestigingsklemmen
  if (config.lsRekAanSluitenKabels > 0 && (isCompact || (config.lsRekActie === "vervangen" && isRenovatie))) {
    const n = config.lsRekAanSluitenKabels;
    if (isCompact) {
      add(map, findArtNr(LS_REK.K56_U), n * 2, "LS-rek kabelbevestigingsklem K56 U", "lsRek");
    } else {
      add(map, findArtNr(LS_REK.K56), n, "LS-rek kabelbevestigingsklem K56", "lsRek");
    }
    add(map, findArtNr(LS_REK.KABELINLEG), n, "LS-rek kabelinlegklem", "lsRek");
  }
}
