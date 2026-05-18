import type { MaterialenConfig } from "../types";
import type { Stamdata } from "../queries";
import { add, type ArtikelLike, type BerekenCtx, type PreviewMap } from "./shared";

/** Sectie 9: GGI vervangen — leest regels uit `ggi_artikelen`. */
export function berekenGgi(
  map: PreviewMap,
  config: MaterialenConfig,
  sd: Stamdata,
  ctx: BerekenCtx,
): void {
  if (!ctx.isRenovatie || !config.ggiVervangen) return;
  for (const r of sd.ggiRegels.data ?? []) {
    add(map, (r as unknown as ArtikelLike).artikel, Number(r.hoeveelheid), "GGI", "ggi", {
      tabel: "ggi_artikelen",
      id: (r as { id?: string }).id,
    });
  }
}
