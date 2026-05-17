import type { MaterialenConfig } from "../types";
import { add, type BerekenCtx, type PreviewMap } from "./shared";
import { GGI_ARTIKELEN } from "./artikelnummers";

/** Sectie 9: GGI vervangen. */
export function berekenGgi(map: PreviewMap, config: MaterialenConfig, ctx: BerekenCtx): void {
  if (!ctx.isRenovatie || !config.ggiVervangen) return;
  for (const g of GGI_ARTIKELEN) {
    add(map, ctx.findArtNr(g.nr), g.qty, "GGI", "ggi");
  }
}
