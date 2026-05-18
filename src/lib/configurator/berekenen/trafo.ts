import type { MaterialenConfig, PreviewSectie } from "../types";
import type { Stamdata } from "../queries";
import { add, type ArtikelLike, type BerekenCtx, type PreviewMap } from "./shared";

interface TrafoRegel {
  id: string;
  conditie_actie: string | null;
  conditie_kva: string | null;
  conditie_kabel_lengte: string | null;
  hoeveelheid: number | string;
  herkomst_label: string;
  artikel?: ArtikelLike["artikel"];
}

export function berekenTrafo(
  map: PreviewMap,
  config: MaterialenConfig,
  sd: Stamdata,
  ctx: BerekenCtx,
): void {
  if (ctx.isCompact) return;
  const sectie: PreviewSectie = "trafo";
  const regels = (sd.trafoRegels.data ?? []) as unknown as TrafoRegel[];

  for (const r of regels) {
    if (r.conditie_actie != null) {
      if (!config.trafoActie || !config.trafoKva) continue;
      if (r.conditie_actie !== config.trafoActie) continue;
      if (r.conditie_kva != null && r.conditie_kva !== config.trafoKva) continue;
    } else if (r.conditie_kabel_lengte != null) {
      if (r.conditie_kabel_lengte !== config.trafoKabelLengte) continue;
    } else {
      continue;
    }
    add(map, r.artikel, Number(r.hoeveelheid), r.herkomst_label, sectie, {
      tabel: "trafo_regels",
      id: r.id,
    });
  }
}
