import type { MaterialenConfig, RmuVeldConfig } from "../types";
import type { Stamdata } from "../queries";
import { evaluateFormula } from "../formula";
import { add, type ArtikelLike, type BerekenCtx, type PreviewMap } from "./shared";

interface RmuVeldRegel {
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
  add(map, rmu.rmu_artikel, 1, "RMU", "rmu");
  add(map, rmu.frame_artikel, 1, "RMU frame", "rmu");
  add(map, rmu.bodemplaat_artikel, 1, `Bodemplaat ${rmu.merk} ${rmu.code}`, "rmu");

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
    add(map, (va as ArtikelLike).artikel, qty, `RMU velden ${va.veld_type}`, "rmu");
  }

  if (config.trafoKva) {
    const kva = Number(config.trafoKva);
    const z = (sd.rmuZekeringen.data ?? []).find((x) => x.merk === rmu.merk && x.trafo_kva === kva);
    if (z) add(map, (z as ArtikelLike).artikel, Number(z.hoeveelheid), `RMU zekering ${kva}kVA`, "rmu");
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
  if (!config.rmuConfig) return;
  const { findArtNr } = ctx;
  const regels = (sd.rmuVeldRegels.data ?? []) as unknown as RmuVeldRegel[];
  const velden = config.rmuVelden ?? [];
  const aantalKv = velden.filter((v) => v.veldType === "C" || v.veldType === "V").length;

  for (const veld of velden) {
    for (const r of regels) {
      if (!matchVeldRegel(r, veld, config, aantalKv)) continue;
      const label = r.herkomst_label.includes("{veldNummer}")
        ? r.herkomst_label.replace("{veldNummer}", String(veld.veldNummer))
        : r.herkomst_label;
      const sectie = (r.sectie as "rmu" | "trafo") ?? "rmu";
      add(map, r.artikel, Number(r.hoeveelheid), label, sectie);
    }
  }

  // I-Net vaste artikelen (engineer-input per case)
  if (config.rmuInet === "ja") {
    for (const ia of config.iNetArtikelen ?? []) {
      if (ia.hoeveelheid > 0) {
        add(map, findArtNr(ia.artikel_nummer), ia.hoeveelheid, "I-Net", "rmu");
      }
    }
  }
}
