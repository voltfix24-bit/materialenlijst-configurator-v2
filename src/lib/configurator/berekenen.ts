import type { MaterialenConfig, PreviewItem, Artikel } from "./types";
import type { Stamdata } from "./queries";
import { evaluateFormula } from "./formula";

interface ArtikelLike { artikel?: Artikel | null }

export interface VultKabelSpec {
  kabelArtNr: string;
  aantalKabels: number;
  persArtNr: string;
  aantalPers: number;
  omschrijving: string;
}

export const VULT_KABEL_SPECS: Record<string, VultKabelSpec> = {
  "250": { kabelArtNr: "20030299", aantalKabels: 4, persArtNr: "20000986", aantalPers: 8, omschrijving: "4× 1x185mm² Cu (enkelvoudig)" },
  "400": { kabelArtNr: "20030300", aantalKabels: 4, persArtNr: "20017790", aantalPers: 8, omschrijving: "4× 1x300mm² Cu (enkelvoudig)" },
  "630": { kabelArtNr: "20030299", aantalKabels: 8, persArtNr: "20000986", aantalPers: 16, omschrijving: "8× 1x185mm² Cu (dubbel uitgevoerd)" },
  "1000": { kabelArtNr: "20030300", aantalKabels: 8, persArtNr: "20017790", aantalPers: 16, omschrijving: "8× 1x300mm² Cu (dubbel uitgevoerd)" },
};

function add(map: Map<string, PreviewItem>, artikel: Artikel | null | undefined, qty: number, herkomst: string, nietBestellen = false) {
  if (!artikel || qty <= 0) return;
  const ex = map.get(artikel.id);
  if (ex) {
    ex.hoeveelheid += qty;
    if (!ex.herkomst.includes(herkomst)) ex.herkomst.push(herkomst);
    if (nietBestellen) ex.niet_bestellen = true;
  } else {
    map.set(artikel.id, {
      artikel_id: artikel.id,
      artikel_nummer: artikel.artikel_nummer,
      korte_omschrijving: artikel.korte_omschrijving,
      eenheid: artikel.eenheid,
      categorie: artikel.categorie ?? "Overig",
      hoeveelheid: qty,
      niet_bestellen: nietBestellen,
      herkomst: [herkomst],
    });
  }
}

export function berekenPreview(config: MaterialenConfig, sd: Stamdata, caseType: string | undefined): PreviewItem[] {
  const map = new Map<string, PreviewItem>();

  // 1. Standaard templates
  if (caseType) {
    for (const t of sd.standaardTemplates.data ?? []) {
      const a = (t as ArtikelLike).artikel;
      add(map, a, Number(t.standaard_hoeveelheid), "Standaard container");
    }
  }

  // 2. Station vaste artikelen
  if (config.subType) {
    for (const s of sd.stationVaste.data ?? []) {
      if ((s.van_toepassing_bij ?? []).includes(config.subType)) {
        add(map, (s as ArtikelLike).artikel, Number(s.hoeveelheid), `Station (${s.groep ?? "vast"})`);
      }
    }
  }

  // 3. RMU
  if (config.rmuConfig) {
    const rmu = config.rmuConfig;
    add(map, rmu.rmu_artikel, 1, "RMU");
    add(map, rmu.frame_artikel, 1, "RMU frame");
    add(map, rmu.bodemplaat_artikel, 1, `Bodemplaat ${rmu.merk} ${rmu.code}`);

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
      add(map, (va as ArtikelLike).artikel, qty, `RMU velden ${va.veld_type}`);
    }

    // Zekeringen op basis van trafoKva
    if (config.trafoKva) {
      const kva = Number(config.trafoKva);
      const z = (sd.rmuZekeringen.data ?? []).find((x) => x.merk === merk && x.trafo_kva === kva);
      if (z) add(map, (z as ArtikelLike).artikel, Number(z.hoeveelheid), `RMU zekering ${kva}kVA`);
    }
  }

  // 3b. RMU veld-specifieke artikelen (alleen ABB / Siemens)
  const isInetCfg = config.rmuInet === "ja";
  const findArtNr = (nr: string): Artikel | null =>
    (sd.artikelen.data ?? []).find((a) => a.artikel_nummer === nr) ?? null;

  if (config.rmuConfig) {
    const isMagnefix = config.rmuMerk === "Magnefix";
    for (const veld of config.rmuVelden ?? []) {
      // ── MAGNEFIX ─────────────────────────────────────────
      if (isMagnefix) {
        if (veld.veldType === "F") {
          add(map, findArtNr("20039303"), 1, "Magnefix T-veld eindsluiting");
          if (config.trafoKabelLengte === "7.25") {
            add(map, findArtNr("20032539"), 1, "Trafo kabel 7,25m");
          } else if (config.trafoKabelLengte === "10") {
            add(map, findArtNr("20032541"), 1, "Trafo kabel 10m");
          }
          const magnefixPatroon: Record<string, string> = {
            "250": "20019483",
            "400": "20019484",
            "630": "20019485",
          };
          const mpNr = magnefixPatroon[config.trafoKva ?? ""];
          if (mpNr) add(map, findArtNr(mpNr), 3, "Magnefix buispatroon");
        }
        if (veld.veldType === "C" || veld.veldType === "V") {
          add(map, findArtNr("20039648"), 1, `Magnefix K-veld ${veld.veldNummer} eindsluiting`);
          add(map, findArtNr("20018032"), 1, `Magnefix K-veld ${veld.veldNummer} afschermset`);
        }
        if (veld.veldType === "C" && veld.veldNummer === 1) {
          const aantalK = (config.rmuVelden ?? []).filter(
            (v) => v.veldType === "C" || v.veldType === "V",
          ).length;
          const doosNr = aantalK <= 2 ? "20029904" : "20029905";
          add(map, findArtNr(doosNr), 1, "Magnefix doos met onderdelen");
        }
        continue;
      }

      // ── ABB / SIEMENS ────────────────────────────────────
      if (veld.veldType === "F") {
        add(map, findArtNr("20041682"), 1, "RMU F-veld eindsluiting");
        if (config.trafoKabelLengte === "7.25") {
          add(map, findArtNr("20032539"), 1, "Trafo kabel 7,25m");
        } else if (config.trafoKabelLengte === "10") {
          add(map, findArtNr("20032541"), 1, "Trafo kabel 10m");
        }
        const buispatroon: Record<string, string> = {
          "250": "20041591",
          "400": "20041593",
          "630": "20041651",
        };
        const bpNr = buispatroon[config.trafoKva ?? ""];
        if (bpNr) add(map, findArtNr(bpNr), 3, "RMU buispatroon");
      }

      if ((veld.veldType === "C" || veld.veldType === "V") && !veld.isReserve) {
        if (veld.kabelType === "240AL") {
          add(map, findArtNr("20040681"), 1, `RMU ${veld.veldType}-veld eindsluiting`);
        } else if (veld.kabelType === "630AL") {
          add(map, findArtNr("20040678"), 1, `RMU ${veld.veldType}-veld eindsluiting`);
          if (veld.veldType === "V") {
            const ombouw = isInetCfg ? "20043486" : "20043756";
            add(map, findArtNr(ombouw), 1, "Ombouwset CT 630AL V-veld");
          }
        }
      }
    }

    // I-Net vaste artikelen
    if (isInetCfg) {
      for (const ia of config.iNetArtikelen ?? []) {
        if (ia.hoeveelheid > 0) {
          add(map, findArtNr(ia.artikel_nummer), ia.hoeveelheid, "I-Net");
        }
      }
    }
  }

  // 3c. TRAFO
  if (config.trafoActie && config.trafoKva) {
    const kva = config.trafoKva;

    if (config.trafoActie === "nieuw") {
      const trafoArtNr: Record<string, string> = {
        "250": "26001090",
        "400": "26001120",
        "630": "26001150",
      };
      const tNr = trafoArtNr[kva];
      if (tNr) add(map, findArtNr(tNr), 1, "Trafo");

      add(map, findArtNr("20019629"), 2, "Trafo U-profiel");
      add(map, findArtNr("20011412"), 1, "Trafo afschermplaat");
      add(map, findArtNr("20019614"), 3, "Trafo afschermkap");
      add(map, findArtNr("20017534"), 1, "Trafo soepele verbinding");
    }

    if (config.trafoActie === "draaien" || config.trafoActie === "blijft") {
      if (kva === "250" || kva === "400") {
        add(map, findArtNr("20038832"), 1, "Aansluitvlag trafo");
      } else if (kva === "630") {
        add(map, findArtNr("20042706"), 1, "Aansluitvlag trafo");
      }
    }
  }

  // 3d. Telcon kabel bevestigingsklem
  if (config.trafoKabelLengte === "7.25" || config.trafoKabelLengte === "10") {
    add(map, findArtNr("20044290"), 8, "Telcon kabel bevestigingsklem");
  }

  // 4. MS moffen
  for (const r of config.msRichtingen) {
    if (r.zwaaien === false && r.mof_type_id) {
      const mt = (sd.msMofTypes.data ?? []).find((m) => m.id === r.mof_type_id);
      if (mt) {
        add(map, (mt as ArtikelLike).artikel, 1, `MS mof ${mt.code}`);
        const mats = (sd.msMofMaterialen.data ?? []).filter((m) => m.mof_type_id === mt.id);
        for (const ma of mats) {
          const qty = ma.hoeveelheid_formule
            ? evaluateFormula(ma.hoeveelheid_formule, { N: 1 })
            : Number(ma.hoeveelheid);
          add(map, (ma as ArtikelLike).artikel, qty, `MS mof ${mt.code}`);
        }
      }
    }
  }

  // 4b. MS-kabel traces
  for (const trace of config.msKabelTraces ?? []) {
    if (!trace.kabelType || trace.lengteMeters <= 0) continue;
    const idx = config.msKabelTraces.indexOf(trace) + 1;
    const isSingel = trace.kabelType === "240AL_singel" || trace.kabelType === "630AL_singel";
    const kabelMeters = isSingel ? trace.lengteMeters * 3 : trace.lengteMeters;

    if (trace.kabelType === "240AL_singel")
      add(map, findArtNr("20039484"), kabelMeters, `MS kabel trace ${idx}`);
    else if (trace.kabelType === "630AL_singel")
      add(map, findArtNr("20027992"), kabelMeters, `MS kabel trace ${idx}`);
    else if (trace.kabelType === "3x240AL")
      add(map, findArtNr("20027989"), kabelMeters, `MS kabel trace ${idx}`);

    const rollen = Math.ceil(trace.lengteMeters / 40);
    add(map, findArtNr("20018148"), rollen, `MS kabel beschermband trace ${idx}`);
  }

  // 5. LS moffen
  for (const lm of config.lsMoffen) {
    if (!lm.type || !lm.bestaand_type) continue;
    const lt = (sd.lsMofTypes.data ?? []).find(
      (t) => t.type === lm.type && (t.bestaand_type === lm.bestaand_type || t.bestaand_type === "beide"),
    );
    if (!lt) continue;
    const mats = (sd.lsMofMaterialen.data ?? []).filter((m) => m.mof_type_id === lt.id);
    for (const ma of mats) {
      const base = Number(ma.hoeveelheid) * lm.aantal;
      add(map, (ma as ArtikelLike).artikel, base, `LS mof ${lm.type}`);
      if (lm.type === "aftakmof" && lm.overzettingen > 0) {
        add(map, (ma as ArtikelLike).artikel, Number(ma.hoeveelheid) * lm.overzettingen, "LS overzettingen");
      }
    }
  }

  // 6. VULT KABEL (alleen renovatie)
  const isRenovatie = config.subType === "renovatie_prov" || config.subType === "renovatie_nsa";
  if (isRenovatie && config.trafoKva && config.vultKabelAfstand > 0) {
    const spec = VULT_KABEL_SPECS[config.trafoKva];
    if (spec) {
      const totaalMeters = Math.ceil(config.vultKabelAfstand * spec.aantalKabels);
      add(map, findArtNr(spec.kabelArtNr), totaalMeters, "Vult kabel");
      add(map, findArtNr(spec.persArtNr), spec.aantalPers, "Vult kabel perskabelschoenen");
      add(map, findArtNr("20042739"), 1, "Vult kabel muurbeugel");
    }
  }

  // 7. LS-REK (alleen renovatie)
  if (config.lsRekActie && isRenovatie) {
    const mespatroon: Record<string, string> = {
      "250": "20036622",
      "400": "20036623",
      "630": "20036624",
    };

    if (config.lsRekActie === "vervangen") {
      if (config.lsRekType === "8") add(map, findArtNr("20050813"), 1, "LS-rek 8 richtingen");
      else if (config.lsRekType === "12") add(map, findArtNr("20050761"), 1, "LS-rek 12 richtingen");

      if (config.lsRekExtraStroken > 0) {
        add(map, findArtNr("20020042"), config.lsRekExtraStroken, "LS-rek extra stroken");
      }

      if (config.lsRekAanSluitenKabels > 0) {
        const n = config.lsRekAanSluitenKabels;
        add(map, findArtNr("20042042"), n, "LS-rek kabelbevestigingsklem K56");
        add(map, findArtNr("20018004"), n, "LS-rek kabelinlegklem");
      }

      const mpNr = mespatroon[config.trafoKva ?? ""];
      if (mpNr) add(map, findArtNr(mpNr), 1, "LS-rek beveiliging voedende strook");
    }

    if (config.lsRekActie === "gehandhaafd" && config.lsRekBeveiligingAanpassen) {
      const mpNr = mespatroon[config.trafoKva ?? ""];
      if (mpNr) add(map, findArtNr(mpNr), 1, "LS-rek beveiliging aanpassen");
    }

    if (config.lsRekOvStuurpunt) {
      if (config.lsRekSchroefpatroon === "35A") add(map, findArtNr("20001107"), 3, "OV-stuurpunt schroefpatroon");
      else if (config.lsRekSchroefpatroon === "50A") add(map, findArtNr("20001108"), 3, "OV-stuurpunt schroefpatroon");

      add(map, findArtNr("20040148"), 1, "OV-stuurpunt router");
      add(map, findArtNr("20040188"), 1, "OV-stuurpunt beugel router");
      add(map, findArtNr("20039993"), 1, "OV-stuurpunt FlexOV device");
      add(map, findArtNr("20039994"), 1, "OV-stuurpunt beugel FlexOV");
      add(map, findArtNr("20040149"), 1, "OV-stuurpunt kabel ethernet");
    }
  }

  return Array.from(map.values()).sort((a, b) => a.categorie.localeCompare(b.categorie) || a.artikel_nummer.localeCompare(b.artikel_nummer));
}
