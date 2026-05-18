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
import { LS_KABEL } from "./artikelnummers";

interface ProvRegel {
  id: string;
  conditie_merk: string | null;
  conditie_kva: string | null;
  hoeveelheid: number | string;
  hoeveelheid_formule: string | null;
  herkomst_label: string;
  artikel?: ArtikelLike["artikel"];
}

/** Evalueert een provisorium-formule tegen de huidige config. */
function evalFormule(formule: string | null, fallback: number, config: MaterialenConfig): number {
  if (!formule) return fallback;
  const fVelden = (config.provRmuVelden ?? []).filter((v) => v.veldType === "F").length;
  const inbMs = config.provInbMsKabels ?? 0;
  const inbLs = config.provInbLsKabels ?? 0;
  switch (formule) {
    case "perFVeld":       return fVelden;
    case "perFVeld*3":     return fVelden * 3;
    case "provInbMsKabels": return inbMs;
    case "provInbLsKabels": return inbLs;
    case "ifInbMsThen1":   return inbMs > 0 ? 1 : 0;
    default:               return fallback;
  }
}

/**
 * Sectie 8: Provisorium (RMU velden + LS moffen + in-bedrijfname MS/LS).
 *
 * DB-driven statische regels uit `prov_regels`. De LS-moffen-loop (variabel
 * per case, leest al uit `ls_mof_types`/`ls_mof_materialen`) blijft in code.
 */
export function berekenProvisorium(
  map: PreviewMap,
  config: MaterialenConfig,
  sd: Stamdata,
  ctx: BerekenCtx,
): void {
  if (!ctx.isProvisorum || !config.provRmuConfig) return;
  const { findArtNr } = ctx;
  const regels = (sd.provRegels.data ?? []) as unknown as ProvRegel[];

  // Statische regels (F-veld eindsluitingen, buispatronen, in-bedrijfname)
  for (const r of regels) {
    if (r.conditie_merk !== null && r.conditie_merk !== config.provRmuMerk) continue;
    if (r.conditie_kva !== null && r.conditie_kva !== (config.provZekeringKva ?? "")) continue;
    const qty = evalFormule(r.hoeveelheid_formule, Number(r.hoeveelheid), config);
    add(map, r.artikel, qty, r.herkomst_label, "provisorium", { tabel: "prov_regels", id: r.id });
  }

  // Provisorium LS moffen (dynamisch, per case)
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
          add(
            map,
            (ma as ArtikelLike).artikel,
            Number(ma.hoeveelheid) * lm.aantal,
            `Provisorium LS ${lm.type}`,
            "provisorium",
            { tabel: "ls_mof_materialen", id: (ma as { id?: string }).id },
          );
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
}
