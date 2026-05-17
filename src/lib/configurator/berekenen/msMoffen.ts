import type { MaterialenConfig, MsMofConfig } from "../types";
import type { Stamdata } from "../queries";
import { evaluateFormula } from "../formula";
import { add, type ArtikelLike, type BerekenCtx, type PreviewMap } from "./shared";

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

/** Sectie 4b: MS kabel traces — DB-driven via ms_kabel_regels. */
export function berekenMsKabelTraces(
  map: PreviewMap,
  config: MaterialenConfig,
  sd: Stamdata,
): void {
  const regels = sd.msKabelRegels.data ?? [];
  if (regels.length === 0) return;

  for (let i = 0; i < (config.msKabelTraces ?? []).length; i++) {
    const trace = config.msKabelTraces[i];
    if (!trace.kabelType || trace.lengteMeters <= 0) continue;
    const idx = i + 1;
    const isSingel = trace.kabelType === "240AL_singel" || trace.kabelType === "630AL_singel";
    const heeftOversteek =
      trace.heeftOversteek && trace.oversteekMeters > 0 && trace.aantalOversteken > 0;

    const buizenPerOversteek = heeftOversteek ? Math.ceil(trace.oversteekMeters / 6) : 0;
    const vars: Record<string, number> = {
      LengteMeters: trace.lengteMeters,
      KabelMeters: isSingel ? trace.lengteMeters * 3 : trace.lengteMeters,
      OversteekMeters: trace.oversteekMeters,
      AantalOversteken: trace.aantalOversteken,
      RollenBeschermband: Math.ceil(trace.lengteMeters / 40),
      BuizenPerOversteek: buizenPerOversteek,
      TotaalBuizen: buizenPerOversteek * trace.aantalOversteken,
      GeotextielAantal: trace.aantalOversteken * 2,
    };

    for (const r of regels) {
      // Conditie: kabel type
      if (r.conditie_kabel_type && r.conditie_kabel_type !== trace.kabelType) continue;
      // Conditie: oversteek vereist
      if (r.conditie_oversteek === true && !heeftOversteek) continue;
      if (r.conditie_oversteek === false && heeftOversteek) continue;

      const qty = r.hoeveelheid_formule
        ? evaluateFormula(r.hoeveelheid_formule, vars)
        : Number(r.hoeveelheid);
      if (qty <= 0) continue;
      const label = `${r.herkomst_label} trace ${idx}`;
      add(map, (r as ArtikelLike).artikel, qty, label, "msVerbindingen");
    }
  }
}
