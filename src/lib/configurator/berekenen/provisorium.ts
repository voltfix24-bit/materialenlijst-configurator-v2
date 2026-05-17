import type { MaterialenConfig } from "../types";
import type { Stamdata } from "../queries";
import {
  add,
  zoekLsMofType,
  type ArtikelLike,
  type BerekenCtx,
  type LsMofTypeRow,
  type PreviewMap,
} from "./shared";
import {
  PROV_BUISPATROON,
  PROV_IN_BEDRIJFNAME,
  RMU_EINDSLUITING,
  LS_KABEL,
} from "./artikelnummers";

/** Sectie 8: Provisorium (RMU velden + LS moffen + in-bedrijfname MS/LS). */
export function berekenProvisorium(
  map: PreviewMap,
  config: MaterialenConfig,
  sd: Stamdata,
  ctx: BerekenCtx,
): void {
  if (!ctx.isProvisorum || !config.provRmuConfig) return;
  const { findArtNr } = ctx;

  // Buispatronen + F-veld eindsluiting (C/V-eindsluitingen lopen via in-bedrijfname)
  for (const veld of config.provRmuVelden ?? []) {
    if (veld.veldType === "F") {
      if (config.provRmuMerk === "Magnefix") {
        add(map, findArtNr(RMU_EINDSLUITING.MAGNEFIX_T_VELD), 1, "Provisorium T-veld eindsluiting", "provisorium");
      } else {
        add(map, findArtNr(RMU_EINDSLUITING.ABB_F_VELD), 1, "Provisorium F-veld eindsluiting", "provisorium");
      }
      const bpNr = PROV_BUISPATROON[config.provRmuMerk]?.[config.provZekeringKva ?? ""];
      if (bpNr) add(map, findArtNr(bpNr), 3, "Provisorium buispatroon", "provisorium");
    }
  }

  // Provisorium LS moffen
  if (config.provLsMoffenActief) {
    for (const lm of config.provLsMoffen) {
      if (!lm.type || !lm.bestaandType) continue;
      const lt = zoekLsMofType(
        (sd.lsMofTypes.data ?? []) as LsMofTypeRow[],
        lm.type,
        lm.bestaandType,
      );
      if (lt) {
        const mats = (sd.lsMofMaterialen.data ?? []).filter((m) => m.mof_type_id === lt.id);
        for (const ma of mats) {
          add(map, (ma as ArtikelLike).artikel, Number(ma.hoeveelheid) * lm.aantal, `Provisorium LS ${lm.type}`, "provisorium");
        }
      }
      if (lm.type === "aftakmof" && lm.ringklemArtikelNummer) {
        add(map, findArtNr(lm.ringklemArtikelNummer), lm.aantalAftakken * lm.aantal, "Provisorium LS aftakmof ringklem", "provisorium");
      }
      if (lm.kabelLengteMeters > 0) {
        add(map, findArtNr(LS_KABEL), lm.kabelLengteMeters * lm.aantal, "Provisorium LS kabel", "provisorium");
      }
    }
  }

  // In-bedrijfname MS eindsluitingen
  if ((config.provInbMsKabels ?? 0) > 0) {
    const n = config.provInbMsKabels ?? 0;
    if (config.provRmuMerk === "Magnefix") {
      add(map, findArtNr(PROV_IN_BEDRIJFNAME.MAGNEFIX_EINDSLUITING), n, "Prov in-bedrijfname MS eindsluiting", "provisorium");
      add(map, findArtNr(PROV_IN_BEDRIJFNAME.MAGNEFIX_AFSCHERM), n, "Prov in-bedrijfname MS afschermset", "provisorium");
      add(map, findArtNr(PROV_IN_BEDRIJFNAME.MAGNEFIX_DOOS), 1, "Prov in-bedrijfname MS doos onderdelen", "provisorium");
    } else {
      add(map, findArtNr(PROV_IN_BEDRIJFNAME.ABB_EINDSLUITING), n, "Prov in-bedrijfname MS eindsluiting", "provisorium");
    }
  }

  // In-bedrijfname LS eindsluitingen
  if ((config.provInbLsKabels ?? 0) > 0) {
    const n = config.provInbLsKabels ?? 0;
    add(map, findArtNr(PROV_IN_BEDRIJFNAME.LS_KABELINLEG), n, "Prov in-bedrijfname LS kabelinlegklem", "provisorium");
    add(map, findArtNr(PROV_IN_BEDRIJFNAME.LS_K56), n, "Prov in-bedrijfname LS K56 klem", "provisorium");
  }
}
