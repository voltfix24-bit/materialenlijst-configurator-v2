import type { MaterialenConfig } from "../types";
import type { Stamdata } from "../queries";
import { evaluateFormula } from "../formula";
import { add, type ArtikelLike, type BerekenCtx, type PreviewMap } from "./shared";
import {
  TRAFO_KABEL,
  BUISPATROON_MAGNEFIX,
  BUISPATROON_ABB_SIEMENS,
  RMU_EINDSLUITING,
} from "./artikelnummers";

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

/** Sectie 3b: RMU veld-specifieke artikelen (Magnefix / ABB / Siemens) + I-Net. */
export function berekenRmuVelden(
  map: PreviewMap,
  config: MaterialenConfig,
  ctx: BerekenCtx,
): void {
  if (!config.rmuConfig) return;
  const isInetCfg = config.rmuInet === "ja";
  const isMagnefix = config.rmuMerk === "Magnefix";
  const { findArtNr } = ctx;

  for (const veld of config.rmuVelden ?? []) {
    // ── MAGNEFIX ─────────────────────────────────────────
    if (isMagnefix) {
      if (veld.veldType === "F") {
        add(map, findArtNr(RMU_EINDSLUITING.MAGNEFIX_T_VELD), 1, "Magnefix T-veld eindsluiting", "rmu");
        if (config.trafoKabelLengte === "7.25") {
          add(map, findArtNr(TRAFO_KABEL.L_7_25), 1, "Trafo kabel 7,25m", "trafo");
        } else if (config.trafoKabelLengte === "10") {
          add(map, findArtNr(TRAFO_KABEL.L_10), 1, "Trafo kabel 10m", "trafo");
        }
        const mpNr = BUISPATROON_MAGNEFIX[config.trafoKva ?? ""];
        if (mpNr) add(map, findArtNr(mpNr), 3, "Magnefix buispatroon", "rmu");
      }
      if (veld.veldType === "C" || veld.veldType === "V") {
        add(map, findArtNr(RMU_EINDSLUITING.MAGNEFIX_K_VELD), 1, `Magnefix K-veld ${veld.veldNummer} eindsluiting`, "rmu");
        add(map, findArtNr(RMU_EINDSLUITING.MAGNEFIX_AFSCHERM), 1, `Magnefix K-veld ${veld.veldNummer} afschermset`, "rmu");
      }
      if (veld.veldType === "C" && veld.veldNummer === 1) {
        const aantalK = (config.rmuVelden ?? []).filter(
          (v) => v.veldType === "C" || v.veldType === "V",
        ).length;
        // Behoud bestaand gedrag: ≤2 → 20029904, anders 20029905
        const doosNr = aantalK <= 2 ? "20029904" : RMU_EINDSLUITING.MAGNEFIX_DOOS;
        add(map, findArtNr(doosNr), 1, "Magnefix doos met onderdelen", "rmu");
      }
      continue;
    }

    // ── ABB / SIEMENS ────────────────────────────────────
    if (veld.veldType === "F") {
      add(map, findArtNr(RMU_EINDSLUITING.ABB_F_VELD), 1, "RMU F-veld eindsluiting", "rmu");
      if (config.trafoKabelLengte === "7.25") {
        add(map, findArtNr(TRAFO_KABEL.L_7_25), 1, "Trafo kabel 7,25m", "trafo");
      } else if (config.trafoKabelLengte === "10") {
        add(map, findArtNr(TRAFO_KABEL.L_10), 1, "Trafo kabel 10m", "trafo");
      }
      const bpNr = BUISPATROON_ABB_SIEMENS[config.trafoKva ?? ""];
      if (bpNr) add(map, findArtNr(bpNr), 3, "RMU buispatroon", "rmu");
    }

    if ((veld.veldType === "C" || veld.veldType === "V") && !veld.isReserve) {
      if (veld.kabelType === "240AL") {
        add(map, findArtNr(RMU_EINDSLUITING.ABB_CV_240AL), 1, `RMU ${veld.veldType}-veld eindsluiting`, "rmu");
      } else if (veld.kabelType === "630AL") {
        add(map, findArtNr(RMU_EINDSLUITING.ABB_CV_630AL), 1, `RMU ${veld.veldType}-veld eindsluiting`, "rmu");
        if (veld.veldType === "V") {
          const ombouw = isInetCfg ? RMU_EINDSLUITING.OMBOUW_CT_INET : RMU_EINDSLUITING.OMBOUW_CT_GEEN;
          add(map, findArtNr(ombouw), 1, "Ombouwset CT 630AL V-veld", "rmu");
        }
      }
    }
  }

  // I-Net vaste artikelen
  if (isInetCfg) {
    for (const ia of config.iNetArtikelen ?? []) {
      if (ia.hoeveelheid > 0) {
        add(map, findArtNr(ia.artikel_nummer), ia.hoeveelheid, "I-Net", "rmu");
      }
    }
  }
}
