import type { MaterialenConfig, PreviewSectie } from "../types";
import type { Stamdata } from "../queries";
import { add, type ArtikelLike, type BerekenCtx, type PreviewMap } from "./shared";

interface TrafoRegel {
  conditie_actie: string | null;
  conditie_kva: string | null;
  conditie_kabel_lengte: string | null;
  hoeveelheid: number | string;
  herkomst_label: string;
  artikel?: ArtikelLike["artikel"];
}

/**
 * Sectie 3c + 3d: Trafo materialen — leest regels uit `trafo_regels`.
 *
 * Match-regels:
 *  - Een regel met `conditie_actie` vereist dat zowel `trafoActie` als
 *    `trafoKva` gezet zijn én dat actie + kVA (indien gespecificeerd)
 *    matchen. Dit dekt zowel kVA-specifieke regels (trafo zelf, aansluitvlag)
 *    als kVA-onafhankelijke regels (vaste onderdelen bij actie=nieuw).
 *  - Een regel zonder `conditie_actie` maar met `conditie_kabel_lengte`
 *    matcht puur op kabellengte — los van trafo-actie (telcon klem).
 */
export function berekenTrafo(
  map: PreviewMap,
  config: MaterialenConfig,
  sd: Stamdata,
  ctx: BerekenCtx,
): void {
  if (ctx.isCompact) return;
  const sectie: PreviewSectie = "trafo";
  const regels = (sd.trafoRegels.data ?? []) as TrafoRegel[];

  for (const r of regels) {
    if (r.conditie_actie != null) {
      if (!config.trafoActie || !config.trafoKva) continue;
      if (r.conditie_actie !== config.trafoActie) continue;
      if (r.conditie_kva != null && r.conditie_kva !== config.trafoKva) continue;
    } else if (r.conditie_kabel_lengte != null) {
      if (r.conditie_kabel_lengte !== config.trafoKabelLengte) continue;
    } else {
      // Onbedoelde "match alles" regel — overslaan als vangnet.
      continue;
    }
    add(map, r.artikel, Number(r.hoeveelheid), r.herkomst_label, sectie);
  }
}
