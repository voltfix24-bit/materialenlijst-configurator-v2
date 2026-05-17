// Orchestrator: roept domeinfuncties op in vaste volgorde en levert preview-items.
// Fase 1 refactor — geen gedragswijzigingen t.o.v. monolithische versie.
import type { MaterialenConfig, PreviewItem } from "./types";
import type { Stamdata } from "./queries";
import { makeFindArtNr, type BerekenCtx, type PreviewMap } from "./berekenen/shared";
import { berekenStandaard } from "./berekenen/standaard";
import { berekenRmuBasis, berekenRmuVelden } from "./berekenen/rmu";
import { berekenTrafo } from "./berekenen/trafo";
import { berekenMsMoffen, berekenMsKabelTraces } from "./berekenen/msMoffen";
import { berekenLsMoffen } from "./berekenen/lsMoffen";
import { berekenVultKabel } from "./berekenen/vultKabel";
import { berekenLsRek } from "./berekenen/lsRek";
import { berekenProvisorium } from "./berekenen/provisorium";
import { berekenGgi } from "./berekenen/ggi";

// Re-exports voor backwards compatibility met bestaande imports.
export { VULT_KABEL_SPECS, type VultKabelSpec } from "./berekenen/vultKabel";

export function berekenPreview(
  config: MaterialenConfig,
  sd: Stamdata,
  caseType: string | undefined,
): PreviewItem[] {
  const map: PreviewMap = new Map();
  const ctx: BerekenCtx = {
    findArtNr: makeFindArtNr(sd),
    isCompact: config.isCompactStation,
    isProvisorum: config.subType === "cs_met_prov" || config.subType === "renovatie_prov",
    isRenovatie: config.subType === "renovatie_prov" || config.subType === "renovatie_nsa",
  };

  // Volgorde is bewust gelijk aan v0 (sectie-nummers 1-9).
  berekenStandaard(map, config, sd, caseType);     // 1 + 2
  berekenRmuBasis(map, config, sd, ctx);           // 3
  berekenRmuVelden(map, config, ctx);              // 3b
  berekenTrafo(map, config, sd, ctx);              // 3c + 3d (DB-driven)
  berekenMsMoffen(map, config, sd, ctx);           // 4
  berekenMsKabelTraces(map, config, sd);           // 4b (DB-driven)
  berekenLsMoffen(map, config, sd, ctx);           // 5
  berekenVultKabel(map, config, ctx);              // 6
  berekenLsRek(map, config, sd, ctx);              // 7 (DB-driven)
  berekenProvisorium(map, config, sd, ctx);        // 8 (DB-driven)
  berekenGgi(map, config, sd, ctx);                // 9 (DB-driven)

  return Array.from(map.values()).sort(
    (a, b) =>
      a.categorie.localeCompare(b.categorie) ||
      a.artikel_nummer.localeCompare(b.artikel_nummer),
  );
}
