import type { MaterialenConfig } from "../types";
import { add, type BerekenCtx, type PreviewMap } from "./shared";
import { VULT_KABEL_MUURBEUGEL } from "./artikelnummers";

export interface VultKabelSpec {
  kabelArtNr: string;
  aantalKabels: number;
  persArtNr: string;
  aantalPers: number;
  omschrijving: string;
}

export const VULT_KABEL_SPECS: Record<string, VultKabelSpec> = {
  "250":  { kabelArtNr: "20030299", aantalKabels: 4, persArtNr: "20000986", aantalPers: 8,  omschrijving: "4× 1x185mm² Cu (enkelvoudig)" },
  "400":  { kabelArtNr: "20030300", aantalKabels: 4, persArtNr: "20017790", aantalPers: 8,  omschrijving: "4× 1x300mm² Cu (enkelvoudig)" },
  "630":  { kabelArtNr: "20030299", aantalKabels: 8, persArtNr: "20000986", aantalPers: 16, omschrijving: "8× 1x185mm² Cu (dubbel uitgevoerd)" },
  "1000": { kabelArtNr: "20030300", aantalKabels: 8, persArtNr: "20017790", aantalPers: 16, omschrijving: "8× 1x300mm² Cu (dubbel uitgevoerd)" },
};

export function berekenVultKabel(map: PreviewMap, config: MaterialenConfig, ctx: BerekenCtx): void {
  if (ctx.isCompact || !ctx.isRenovatie) return;
  if (!config.trafoKva || config.vultKabelAfstand <= 0) return;
  const spec = VULT_KABEL_SPECS[config.trafoKva];
  if (!spec) return;
  const totaalMeters = Math.ceil(config.vultKabelAfstand * spec.aantalKabels);
  add(map, ctx.findArtNr(spec.kabelArtNr), totaalMeters, "Vult kabel", "vultKabel");
  add(map, ctx.findArtNr(spec.persArtNr), spec.aantalPers, "Vult kabel perskabelschoenen", "vultKabel");
  add(map, ctx.findArtNr(VULT_KABEL_MUURBEUGEL), 1, "Vult kabel muurbeugel", "vultKabel");
}
