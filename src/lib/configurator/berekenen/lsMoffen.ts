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
    // "Kan kabel worden omgezwaaid? → Nee — opnieuw" verdubbelt (of vermenigvuldigt
    // met opnieuwAantal) de moffenset: 1 tijdelijke + N nieuwe.
    const extra = lm.kanZwaaien === false ? Math.max(1, lm.opnieuwAantal ?? 1) : 0;
    const fases = 1 + extra;
    const mult = lm.aantal * fases;

    const lt = zoekLsMofType(
      (sd.lsMofTypes.data ?? []) as LsMofTypeRow[],
      lm.type,
      lm.bestaandType,
    );
    if (lt) {
      const mats = (sd.lsMofMaterialen.data ?? []).filter((m) => m.mof_type_id === lt.id);
      for (const ma of mats) {
        add(
          map,
          (ma as ArtikelLike).artikel,
          Number(ma.hoeveelheid) * mult,
          `LS ${lm.type}`,
          "lsVerbindingen",
          { tabel: "ls_mof_materialen", id: (ma as { id?: string }).id },
        );
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

/**
 * Sectie 5b: LS-kabel traces — vaste artikelen, alleen lengte invullen.
 * Werkt identiek aan MS-trace: kabel × meters + (optioneel) PVC 110mm
 * beschermbuis × ceil(m/6) × n oversteken + geotextiel × n × 2.
 */
export function berekenLsKabelTraces(
  map: PreviewMap,
  config: MaterialenConfig,
  ctx: BerekenCtx,
): void {
  const { findArtNr } = ctx;
  for (let i = 0; i < (config.lsKabelTraces ?? []).length; i++) {
    const trace = config.lsKabelTraces[i];
    if (trace.lengteMeters <= 0) continue;
    const idx = i + 1;
    add(map, findArtNr(LS_KABEL), trace.lengteMeters, `LS kabel trace ${idx}`, "lsVerbindingen");

    if (trace.heeftOversteek && trace.oversteekMeters > 0 && trace.aantalOversteken > 0) {
      const buizenPerOversteek = Math.ceil(trace.oversteekMeters / 6);
      const totaalBuizen = buizenPerOversteek * trace.aantalOversteken;
      add(map, findArtNr(LS_OVERSTEEK_BUIS), totaalBuizen, `LS kabel trace ${idx} oversteek`, "lsVerbindingen");
      add(
        map,
        findArtNr(LS_OVERSTEEK_GEOTEXTIEL),
        trace.aantalOversteken * 2,
        `LS kabel trace ${idx} oversteek geotextiel`,
        "lsVerbindingen",
      );
    }
  }
}
