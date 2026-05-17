import type { MaterialenConfig } from "../types";
import { add, type BerekenCtx, type PreviewMap } from "./shared";
import {
  TRAFO_ARTIKEL,
  TRAFO_NIEUW,
  TRAFO_AANSLUITVLAG,
  TELCON_KABEL_BEVKLEM,
} from "./artikelnummers";

/** Sectie 3c: Trafo acties (nieuw / draaien / blijft). */
export function berekenTrafo(map: PreviewMap, config: MaterialenConfig, ctx: BerekenCtx): void {
  if (ctx.isCompact || !config.trafoActie || !config.trafoKva) return;
  const { findArtNr } = ctx;
  const kva = config.trafoKva;

  if (config.trafoActie === "nieuw") {
    const tNr = TRAFO_ARTIKEL[kva];
    if (tNr) add(map, findArtNr(tNr), 1, "Trafo", "trafo");
    add(map, findArtNr(TRAFO_NIEUW.U_PROFIEL), 2, "Trafo U-profiel", "trafo");
    add(map, findArtNr(TRAFO_NIEUW.AFSCHERMPLAAT), 1, "Trafo afschermplaat", "trafo");
    add(map, findArtNr(TRAFO_NIEUW.AFSCHERMKAP), 3, "Trafo afschermkap", "trafo");
    add(map, findArtNr(TRAFO_NIEUW.SOEPELE_VERBINDING), 1, "Trafo soepele verbinding", "trafo");
  }

  if (config.trafoActie === "draaien" || config.trafoActie === "blijft") {
    if (kva === "250" || kva === "400") {
      add(map, findArtNr(TRAFO_AANSLUITVLAG.KVA_250_400), 1, "Aansluitvlag trafo", "trafo");
    } else if (kva === "630" || kva === "1000") {
      add(map, findArtNr(TRAFO_AANSLUITVLAG.KVA_630_1000), 1, "Aansluitvlag trafo", "trafo");
    }
  }
}

/** Sectie 3d: Telcon kabel bevestigingsklem. */
export function berekenTelconBevklem(map: PreviewMap, config: MaterialenConfig, ctx: BerekenCtx): void {
  if (ctx.isCompact) return;
  if (config.trafoKabelLengte === "7.25" || config.trafoKabelLengte === "10") {
    add(map, ctx.findArtNr(TELCON_KABEL_BEVKLEM), 8, "Telcon kabel bevestigingsklem", "trafo");
  }
}
