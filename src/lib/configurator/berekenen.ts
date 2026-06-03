// Orchestrator: roept domeinfuncties op in vaste volgorde en levert preview-items.
// Fase 1 refactor — geen gedragswijzigingen t.o.v. monolithische versie.
import { emptyConfig, type MaterialenConfig, type PreviewItem } from "./types";
import type { Stamdata } from "./queries";
import { makeFindArtNr, type BerekenCtx, type PreviewMap } from "./berekenen/shared";
import { berekenStandaard } from "./berekenen/standaard";
import { berekenRmuBasis, berekenRmuVelden } from "./berekenen/rmu";
import { berekenTrafo } from "./berekenen/trafo";
import { berekenMsMoffen, berekenMsKabelTraces } from "./berekenen/msMoffen";
import { berekenLsMoffen, berekenLsKabelTraces } from "./berekenen/lsMoffen";
import { berekenVultKabel } from "./berekenen/vultKabel";
export { vultKabelSpecsFromStamdata, type VultKabelSpec } from "./berekenen/vultKabel";
import { berekenLsRek } from "./berekenen/lsRek";
import { berekenProvisorium } from "./berekenen/provisorium";
import { berekenGgi } from "./berekenen/ggi";


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
  berekenRmuVelden(map, config, sd, ctx);          // 3b
  berekenTrafo(map, config, sd, ctx);              // 3c + 3d (DB-driven)
  berekenMsMoffen(map, config, sd, ctx);           // 4
  berekenMsKabelTraces(map, config, sd);           // 4b (DB-driven)
  berekenLsMoffen(map, config, sd, ctx);           // 5
  berekenLsKabelTraces(map, config, ctx);          // 5b
  berekenVultKabel(map, config, sd, ctx);          // 6 (DB-driven)
  berekenLsRek(map, config, sd, ctx);              // 7 (DB-driven)
  berekenProvisorium(map, config, sd, ctx);        // 8 (DB-driven)
  berekenGgi(map, config, sd, ctx);                // 9 (DB-driven)

  const items = Array.from(map.values()).sort(
    (a, b) =>
      a.categorie.localeCompare(b.categorie) ||
      a.artikel_nummer.localeCompare(b.artikel_nummer),
  );

  // Dev-mode vangnet: als de gebruiker iets heeft geconfigureerd maar de
  // winkelwagen leeg blijft, is er waarschijnlijk een ontbrekende mapping.
  // Eén waarschuwing per unieke (subType, non-default veldenset) volstaat.
  if (import.meta.env?.DEV && items.length === 0 && hasNonDefaultConfig(config)) {
    warnOnce(
      `[berekenPreview] config met non-default velden levert 0 winkelwagen-items op ` +
      `— mogelijk ontbreekt een mapping. subType=${config.subType ?? "?"}`,
    );
  }

  return items;
}

const _warned = new Set<string>();
function warnOnce(msg: string) {
  if (_warned.has(msg)) return;
  _warned.add(msg);
  // eslint-disable-next-line no-console
  console.warn(msg);
}

/**
 * Detecteert of de config minstens één veld bevat dat afwijkt van `emptyConfig()`.
 * Gebruikt voor het dev-vangnet — als er níets is ingevuld is een lege
 * winkelwagen correct gedrag.
 */
function hasNonDefaultConfig(config: MaterialenConfig): boolean {
  const empty = emptyConfig() as unknown as Record<string, unknown>;
  const cfg = config as unknown as Record<string, unknown>;
  for (const k of Object.keys(cfg)) {
    const a = cfg[k];
    const b = empty[k];
    if (Array.isArray(a)) {
      if (a.length > 0) return true;
      continue;
    }
    if (a !== null && typeof a === "object") {
      if (Object.keys(a as object).length > 0) return true;
      continue;
    }
    if (a !== b && a !== "" && a !== 0 && a !== false && a !== null && a !== undefined) {
      return true;
    }
  }
  return false;
}
