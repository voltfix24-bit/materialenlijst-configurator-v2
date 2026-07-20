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
import { berekenMaatwerk } from "./berekenen/maatwerk";

/** Alles wat een domeinberekening nodig kan hebben. Elke calculator pakt via
 *  destructuring alleen de velden die hij gebruikt. */
type CalcInput = {
  map: PreviewMap;
  config: MaterialenConfig;
  sd: Stamdata;
  ctx: BerekenCtx;
  caseType: string | undefined;
};

type Calculator = { naam: string; run: (input: CalcInput) => void };

/**
 * Registry van domeinberekeningen in vaste volgorde (sectie 1–10). Een nieuwe
 * berekening toevoegen = hier één entry bijzetten; de orchestrator-lus in
 * `berekenPreview` blijft ongewijzigd (open/closed). De volgorde is bewust
 * gelijk aan v0.
 */
const CALCULATORS: Calculator[] = [
  {
    naam: "standaard",
    run: ({ map, config, sd, caseType }) => berekenStandaard(map, config, sd, caseType),
  }, // 1 + 2
  { naam: "rmuBasis", run: ({ map, config, sd, ctx }) => berekenRmuBasis(map, config, sd, ctx) }, // 3
  { naam: "rmuVelden", run: ({ map, config, sd, ctx }) => berekenRmuVelden(map, config, sd, ctx) }, // 3b
  { naam: "trafo", run: ({ map, config, sd, ctx }) => berekenTrafo(map, config, sd, ctx) }, // 3c + 3d
  { naam: "msMoffen", run: ({ map, config, sd, ctx }) => berekenMsMoffen(map, config, sd, ctx) }, // 4
  { naam: "msKabelTraces", run: ({ map, config, sd }) => berekenMsKabelTraces(map, config, sd) }, // 4b
  { naam: "lsMoffen", run: ({ map, config, sd, ctx }) => berekenLsMoffen(map, config, sd, ctx) }, // 5
  { naam: "lsKabelTraces", run: ({ map, config, ctx }) => berekenLsKabelTraces(map, config, ctx) }, // 5b
  { naam: "vultKabel", run: ({ map, config, sd, ctx }) => berekenVultKabel(map, config, sd, ctx) }, // 6
  { naam: "lsRek", run: ({ map, config, sd, ctx }) => berekenLsRek(map, config, sd, ctx) }, // 7
  {
    naam: "provisorium",
    run: ({ map, config, sd, ctx }) => berekenProvisorium(map, config, sd, ctx),
  }, // 8
  { naam: "ggi", run: ({ map, config, sd, ctx }) => berekenGgi(map, config, sd, ctx) }, // 9
  {
    naam: "maatwerk",
    run: ({ map, config, sd, caseType }) => berekenMaatwerk(map, config, sd, caseType),
  }, // 10
];

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

  // Vaste volgorde uit de registry (sectie 1–10).
  const input: CalcInput = { map, config, sd, ctx, caseType };
  for (const calc of CALCULATORS) calc.run(input);

  const items = Array.from(map.values()).sort(
    (a, b) =>
      a.categorie.localeCompare(b.categorie) || a.artikel_nummer.localeCompare(b.artikel_nummer),
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
