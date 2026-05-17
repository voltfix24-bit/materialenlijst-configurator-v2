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
import { LS_KABEL, LS_OVERSTEEK_BUIS, LS_OVERSTEEK_GEOTEXTIEL } from "./artikelnummers";

/** Sectie 5: LS moffen + bijbehorende kabels en oversteken. */
export function berekenLsMoffen(
  map: PreviewMap,
  config: MaterialenConfig,
  sd: Stamdata,
  ctx: BerekenCtx,
): void {
  if (!config.lsMoffenActief) return;
  const { findArtNr } = ctx;
  for (const lm of config.lsMoffen) {
    if (!lm.type || !lm.bestaandType) continue;
    const fases = ctx.isProvisorum && lm.kanZwaaien === false ? 2 : 1;
    const mult = lm.aantal * fases;

    const lt = zoekLsMofType(
      (sd.lsMofTypes.data ?? []) as LsMofTypeRow[],
      lm.type,
      lm.bestaandType,
    );
    if (lt) {
      const mats = (sd.lsMofMaterialen.data ?? []).filter((m) => m.mof_type_id === lt.id);
      for (const ma of mats) {
        add(map, (ma as ArtikelLike).artikel, Number(ma.hoeveelheid) * mult, `LS ${lm.type}`, "lsVerbindingen");
      }
    }

    if (lm.type === "aftakmof" && lm.ringklemArtikelNummer) {
      add(
        map,
        findArtNr(lm.ringklemArtikelNummer),
        lm.aantalAftakken * mult,
        "LS aftakmof ringklem",
        "lsVerbindingen",
      );
    }

    if (lm.kabelLengteMeters > 0) {
      const totaal = lm.kabelLengteMeters * lm.aantal * fases;
      add(map, findArtNr(LS_KABEL), totaal, "LS kabel", "lsVerbindingen");
    }

    if (lm.heeftOversteek && lm.oversteekMeters > 0 && lm.aantalOversteken > 0) {
      const buizenPerOversteek = Math.ceil(lm.oversteekMeters / 6);
      const totaalBuizen = buizenPerOversteek * lm.aantalOversteken;
      add(map, findArtNr(LS_OVERSTEEK_BUIS), totaalBuizen, "LS kabel oversteek", "lsVerbindingen");
      add(
        map,
        findArtNr(LS_OVERSTEEK_GEOTEXTIEL),
        lm.aantalOversteken * 2,
        "LS kabel oversteek geotextiel",
        "lsVerbindingen",
      );
    }
  }
}
