import type { MaterialenConfig, RmuVeldConfig } from "../types";
import type { Stamdata } from "../queries";
import { evaluateFormula } from "../formula";
import { add, type ArtikelLike, type BerekenCtx, type PreviewMap } from "./shared";

interface RmuVeldRegel {
  id: string;
  conditie_merk: string | null;
  conditie_is_inet: boolean | null;
  conditie_veld_type: string | null;
  conditie_veld_nummer_is_1: boolean | null;
  conditie_is_reserve: boolean | null;
  conditie_kabel_type: string | null;
  conditie_kva: string | null;
  conditie_trafo_kabel_lengte: string | null;
  conditie_aantal_kv_min: number | null;
  conditie_aantal_kv_max: number | null;
  hoeveelheid: number | string;
  herkomst_label: string;
  sectie: string;
  artikel?: ArtikelLike["artikel"];
}

/** Sectie 3: RMU basis + veld-formules + zekeringen. */
export function berekenRmuBasis(
  map: PreviewMap,
  config: MaterialenConfig,
  sd: Stamdata,
  ctx: BerekenCtx,
): void {
  if (!config.rmuConfig || ctx.isCompact) return;
  const rmu = config.rmuConfig;
  const cfgBron = { tabel: "rmu_configuraties" as const, id: rmu.id };
  add(map, rmu.rmu_artikel, 1, "RMU", "rmu", cfgBron);
  add(map, rmu.frame_artikel, 1, "RMU frame", "rmu", cfgBron);
  add(map, rmu.bodemplaat_artikel, 1, `Bodemplaat ${rmu.merk} ${rmu.code}`, "rmu", cfgBron);

  const isInet = rmu.is_inet;
  const merk = rmu.merk;
  const veldArts = (sd.rmuVeldArtikelen.data ?? []).filter(
    (v) => v.merk === merk && v.is_inet === isInet,
  );
  const N = rmu.aantal_velden;
  for (const va of veldArts) {
    const counts: Record<string, number> = {
      F: rmu.aantal_f,
      C: rmu.aantal_c,
      V: rmu.aantal_v,
      "*": N,
    };
    const n = counts[va.veld_type] ?? 0;
    if (n <= 0) continue;
    const qty = va.hoeveelheid_formule
      ? evaluateFormula(va.hoeveelheid_formule, { N: n })
      : Number(va.hoeveelheid) * n;
    add(map, (va as ArtikelLike).artikel, qty, `RMU velden ${va.veld_type}`, "rmu", {
      tabel: "rmu_veld_artikelen",
      id: (va as { id?: string }).id,
    });
  }

  if (config.trafoKva) {
    const kva = Number(config.trafoKva);
    const z = (sd.rmuZekeringen.data ?? []).find((x) => x.merk === rmu.merk && x.trafo_kva === kva);
    if (z)
      add(map, (z as ArtikelLike).artikel, Number(z.hoeveelheid), `RMU zekering ${kva}kVA`, "rmu", {
        tabel: "rmu_zekeringen",
        id: (z as { id?: string }).id,
      });
  }
}

/** Matcht één regel tegen één veld + config-context. */
function matchVeldRegel(
  r: RmuVeldRegel,
  veld: RmuVeldConfig,
  config: MaterialenConfig,
  aantalKv: number,
): boolean {
  if (r.conditie_merk !== null && r.conditie_merk !== config.rmuMerk) return false;
  if (r.conditie_is_inet !== null && r.conditie_is_inet !== (config.rmuInet === "ja")) return false;
  if (r.conditie_veld_type !== null && r.conditie_veld_type !== veld.veldType) return false;
  if (r.conditie_veld_nummer_is_1 === true && veld.veldNummer !== 1) return false;
  if (r.conditie_is_reserve !== null && r.conditie_is_reserve !== !!veld.isReserve) return false;
  if (r.conditie_kabel_type !== null && r.conditie_kabel_type !== (veld.kabelType ?? "")) return false;
  if (r.conditie_kva !== null && r.conditie_kva !== (config.trafoKva ?? "")) return false;
  if (r.conditie_trafo_kabel_lengte !== null && r.conditie_trafo_kabel_lengte !== (config.trafoKabelLengte ?? "")) return false;
  if (r.conditie_aantal_kv_min !== null && aantalKv < r.conditie_aantal_kv_min) return false;
  if (r.conditie_aantal_kv_max !== null && aantalKv > r.conditie_aantal_kv_max) return false;
  return true;
}

/**
 * Sectie 3b: RMU veld-specifieke artikelen (Magnefix / ABB / Siemens) + I-Net.
 *
 * Alle artikelen + condities komen uit `rmu_veld_regels`. Voor elke
 * veld × regel-combinatie wordt geëvalueerd. Het label kan
 * `{veldNummer}` bevatten voor per-veld nummering. I-Net engineer-input
 * artikelen blijven in code (per-case data).
 */
export function berekenRmuVelden(
  map: PreviewMap,
  config: MaterialenConfig,
  sd: Stamdata,
  ctx: BerekenCtx,
): void {
  const { findArtNr } = ctx;

  // I-Net vaste artikelen (engineer-input per case). Bewust BUITEN de
  // rmuConfig-gate: ook wanneer er nog geen rmu-configuratie is gekozen,
  // moeten ingevoerde I-Net artikelen in de winkelwagen verschijnen.
  if (config.rmuInet === "ja") {
    for (const ia of config.iNetArtikelen ?? []) {
      if (ia.hoeveelheid > 0) {
        add(map, findArtNr(ia.artikel_nummer), ia.hoeveelheid, "I-Net", "rmu");
      }
    }
  }

  if (!config.rmuConfig) return;
  const regels = (sd.rmuVeldRegels.data ?? []) as unknown as RmuVeldRegel[];
  const velden = config.rmuVelden ?? [];
  const aantalKv = velden.filter((v) => v.veldType === "C" || v.veldType === "V").length;

  // Hard guard: per kabeltype is er exact één toegestane HKS-steker.
  // Voorkomt dat een verkeerd geseede regel beide stekers (240 + 630) tegelijk
  // voor hetzelfde veld in de winkelwagen zet.
  const STEKER_PER_KABEL: Record<string, string> = {
    "240AL": "20040681", // Steker hks C XLPE 20kV 3x1x240
    "630AL": "20040678", // Steker hks C XLPE 10-20kV 3x1x630
  };
  const ALLE_STEKERS = new Set(Object.values(STEKER_PER_KABEL));

  for (const veld of velden) {
    const toegestaneSteker = veld.kabelType ? STEKER_PER_KABEL[veld.kabelType] : undefined;
    for (const r of regels) {
      if (!matchVeldRegel(r, veld, config, aantalKv)) continue;
      const artNr = r.artikel?.artikel_nummer;
      if (
        artNr &&
        ALLE_STEKERS.has(artNr) &&
        toegestaneSteker &&
        artNr !== toegestaneSteker
      ) {
        // Hard guard: skip + log. Niet bestellen voor dit kabeltype.
        // eslint-disable-next-line no-console
        console.warn(
          `[RMU guard] Steker ${artNr} geweigerd voor veld ${veld.veldNummer} ` +
            `(kabelType=${veld.kabelType}, verwacht ${toegestaneSteker}). ` +
            `Controleer rmu_veld_regels seed.`,
        );
        continue;
      }
      const label = r.herkomst_label.includes("{veldNummer}")
        ? r.herkomst_label.replace("{veldNummer}", String(veld.veldNummer))
        : r.herkomst_label;
      const sectie = (r.sectie as "rmu" | "trafo") ?? "rmu";
      add(map, r.artikel, Number(r.hoeveelheid), label, sectie, {
        tabel: "rmu_veld_regels",
        id: r.id,
      });
    }
  }
}
