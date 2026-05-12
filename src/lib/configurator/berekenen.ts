import type { MaterialenConfig, PreviewItem, Artikel } from "./types";
import type { Stamdata } from "./queries";
import { evaluateFormula } from "./formula";

interface ArtikelLike { artikel?: Artikel | null }

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

  // 6. Vult kabel perskabelschoenen
  if (config.trafoActie && config.trafoActie !== "blijft" && config.trafoKva) {
    const kva = Number(config.trafoKva);
    const v = (sd.trafoVultKabel.data ?? []).find((x) => x.trafo_kva === kva);
    if (v) {
      add(map, (v as ArtikelLike).artikel, Number(v.aantal_perskabelschoenen), "Vult kabel");
    }
  }

  return Array.from(map.values()).sort((a, b) => a.categorie.localeCompare(b.categorie) || a.artikel_nummer.localeCompare(b.artikel_nummer));
}
