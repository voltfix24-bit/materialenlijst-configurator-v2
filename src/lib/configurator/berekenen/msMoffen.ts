import type { MaterialenConfig, MsMofConfig } from "../types";
import type { Stamdata } from "../queries";
import { evaluateFormula } from "../formula";
import { add, type ArtikelLike, type BerekenCtx, type PreviewMap } from "./shared";
import { MS_KABEL } from "./artikelnummers";

/** Sectie 4: MS moffen (tijdelijk + eventueel definitief bij provisorium). */
export function berekenMsMoffen(
  map: PreviewMap,
  config: MaterialenConfig,
  sd: Stamdata,
  ctx: BerekenCtx,
): void {
  const addMof = (mof: MsMofConfig, label: string) => {
    if (!mof.mofTypeId) return;
    const mt = (sd.msMofTypes.data ?? []).find((m) => m.id === mof.mofTypeId);
    if (!mt) return;
    add(map, (mt as ArtikelLike).artikel, 1, label, "msVerbindingen");
    const mats = (sd.msMofMaterialen.data ?? []).filter((m) => m.mof_type_id === mt.id);
    for (const ma of mats) {
      const qty = ma.hoeveelheid_formule
        ? evaluateFormula(ma.hoeveelheid_formule, { N: 1 })
        : Number(ma.hoeveelheid);
      add(map, (ma as ArtikelLike).artikel, qty, label, "msVerbindingen");
    }
  };

  for (let i = 0; i < config.msRichtingen.length; i++) {
    const r = config.msRichtingen[i];
    addMof(r.mofTijdelijk, `MS verbinding ${i + 1}${ctx.isProvisorum ? " (tijdelijk)" : ""}`);
    if (ctx.isProvisorum && r.kanZwaaien === false && r.mofDefinitief) {
      addMof(r.mofDefinitief, `MS verbinding ${i + 1} (definitief)`);
    }
  }
}

/** Sectie 4b: MS kabel traces (kabel + beschermband + oversteek). */
export function berekenMsKabelTraces(
  map: PreviewMap,
  config: MaterialenConfig,
  ctx: BerekenCtx,
): void {
  const { findArtNr } = ctx;
  for (const trace of config.msKabelTraces ?? []) {
    if (!trace.kabelType || trace.lengteMeters <= 0) continue;
    const idx = config.msKabelTraces.indexOf(trace) + 1;
    const isSingel = trace.kabelType === "240AL_singel" || trace.kabelType === "630AL_singel";
    const kabelMeters = isSingel ? trace.lengteMeters * 3 : trace.lengteMeters;

    if (trace.kabelType === "240AL_singel")
      add(map, findArtNr(MS_KABEL.K_240AL_SINGEL), kabelMeters, `MS kabel trace ${idx}`, "msVerbindingen");
    else if (trace.kabelType === "630AL_singel")
      add(map, findArtNr(MS_KABEL.K_630AL_SINGEL), kabelMeters, `MS kabel trace ${idx}`, "msVerbindingen");
    else if (trace.kabelType === "3x240AL")
      add(map, findArtNr(MS_KABEL.K_3X240AL), kabelMeters, `MS kabel trace ${idx}`, "msVerbindingen");

    const rollen = Math.ceil(trace.lengteMeters / 40);
    add(map, findArtNr(MS_KABEL.BESCHERMBAND), rollen, `MS kabel beschermband trace ${idx}`, "msVerbindingen");

    if (trace.heeftOversteek && trace.oversteekMeters > 0 && trace.aantalOversteken > 0) {
      const buizenPerOversteek = Math.ceil(trace.oversteekMeters / 6);
      const totaalBuizen = buizenPerOversteek * trace.aantalOversteken;
      const buisNr = isSingel ? MS_KABEL.BUIS_SINGEL : MS_KABEL.BUIS_TRIPLE;
      add(map, findArtNr(buisNr), totaalBuizen, `MS kabel oversteek trace ${idx}`, "msVerbindingen");
      add(
        map,
        findArtNr(MS_KABEL.GEOTEXTIEL),
        trace.aantalOversteken * 2,
        `MS kabel oversteek geotextiel trace ${idx}`,
        "msVerbindingen",
      );
    }
  }
}
