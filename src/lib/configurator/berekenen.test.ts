import { describe, it, expect } from "vitest";
import { berekenPreview } from "./berekenen";
import { emptyConfig, type Artikel, type MaterialenConfig, type SubType } from "./types";
import type { Stamdata } from "./queries";

const artikel: Artikel = {
  id: "art-1",
  artikel_nummer: "20029278",
  korte_omschrijving: "Sluitring M12",
  eenheid: "ST",
  categorie: "Bevestiging",
  actief: true,
};

// Minimale Stamdata-stub: alleen standaardTemplates is relevant; alle andere
// queries leveren lege arrays. We casten naar Stamdata zodat we niet alle
// react-query velden hoeven na te bootsen.
function makeStamdata(): Stamdata {
  const empty = { data: [], isLoading: false } as unknown as Stamdata["artikelen"];
  const templates = {
    data: [{ artikel_id: artikel.id, case_type: "NSA", standaard_hoeveelheid: 50, artikel }],
    isLoading: false,
  } as unknown as Stamdata["standaardTemplates"];
  return {
    artikelen: empty,
    rmuConfigs: empty,
    rmuVeldArtikelen: empty,
    rmuZekeringen: empty,
    msMofTypes: empty,
    msMofMaterialen: empty,
    lsMofTypes: empty,
    lsMofMaterialen: empty,
    standaardTemplates: templates,
    stationVaste: empty,
    ggiRegels: empty,
    trafoRegels: empty,
    lsRekRegels: empty,
    provRegels: empty,
    msKabelRegels: empty,
    rmuVeldRegels: empty,
    trafoVultKabelSpecs: empty,
    isLoading: false,
  } as unknown as Stamdata;
}

describe("berekenPreview - standaard materialen gating", () => {
  it("toont GEEN standaard materialen wanneer subType leeg is", () => {
    const config: MaterialenConfig = { ...emptyConfig(), subType: "" as SubType };
    const preview = berekenPreview(config, makeStamdata(), "NSA");
    expect(preview.find((p) => p.artikel_nummer === artikel.artikel_nummer)).toBeUndefined();
    expect(preview).toHaveLength(0);
  });

  it("toont standaard materialen WEL zodra subType is gekozen", () => {
    const config: MaterialenConfig = { ...emptyConfig(), subType: "renovatie_nsa" };
    const preview = berekenPreview(config, makeStamdata(), "NSA");
    const row = preview.find((p) => p.artikel_nummer === artikel.artikel_nummer);
    expect(row).toBeDefined();
    expect(row?.hoeveelheid).toBe(50);
    expect(row?.sectie).toBe("standaard");
  });

  it("toont GEEN standaard materialen wanneer caseType ontbreekt, ook al is subType gekozen", () => {
    const config: MaterialenConfig = { ...emptyConfig(), subType: "renovatie_nsa" };
    const preview = berekenPreview(config, makeStamdata(), undefined);
    expect(preview).toHaveLength(0);
  });
});

describe("berekenPreview - LS-rek (renovatie, vervangen, 12 richtingen)", () => {
  const lsRek12: Artikel = {
    id: "lsrek-12-id",
    artikel_nummer: "20050761",
    korte_omschrijving: "LS-rek 1000A 630kVA v 12 richtingen",
    eenheid: "ST",
    categorie: "LS-REK",
    actief: true,
  };
  const mespatroon250: Artikel = {
    id: "mes-250-id",
    artikel_nummer: "MES-250",
    korte_omschrijving: "Mespatroon 250 kVA",
    eenheid: "ST",
    categorie: "LS-REK",
    actief: true,
  };

  function makeLsStamdata(): Stamdata {
    const empty = { data: [], isLoading: false } as unknown as Stamdata["artikelen"];
    const lsRekRegels = {
      data: [
        {
          id: "r-12",
          conditie_compact: false,
          conditie_renovatie: true,
          conditie_actie: "vervangen",
          conditie_lsrek_type: "12",
          conditie_beveiliging_aanpassen: null,
          conditie_ov_stuurpunt: null,
          conditie_schroefpatroon: null,
          conditie_kva: null,
          hoeveelheid: 1,
          hoeveelheid_formule: null,
          herkomst_label: "LS-rek 12 richtingen",
          artikel: lsRek12,
        },
        {
          id: "r-mes",
          conditie_compact: false,
          conditie_renovatie: true,
          conditie_actie: "vervangen",
          conditie_lsrek_type: null,
          conditie_beveiliging_aanpassen: null,
          conditie_ov_stuurpunt: null,
          conditie_schroefpatroon: null,
          conditie_kva: "250",
          hoeveelheid: 3,
          hoeveelheid_formule: null,
          herkomst_label: "LS-rek beveiliging voedende strook",
          artikel: mespatroon250,
        },
      ],
      isLoading: false,
    } as unknown as Stamdata["lsRekRegels"];
    return {
      artikelen: empty,
      rmuConfigs: empty,
      rmuVeldArtikelen: empty,
      rmuZekeringen: empty,
      msMofTypes: empty,
      msMofMaterialen: empty,
      lsMofTypes: empty,
      lsMofMaterialen: empty,
      standaardTemplates: empty,
      stationVaste: empty,
      ggiRegels: empty,
      trafoRegels: empty,
      lsRekRegels,
      provRegels: empty,
      msKabelRegels: empty,
      rmuVeldRegels: empty,
      trafoVultKabelSpecs: empty,
      isLoading: false,
    } as unknown as Stamdata;
  }

  it("voegt 20050761 toe bij vervangen + 12 richtingen op renovatie", () => {
    const config: MaterialenConfig = {
      ...emptyConfig(),
      subType: "renovatie_nsa",
      lsRekActie: "vervangen",
      lsRekType: "12",
      trafoKva: "250",
    };
    const preview = berekenPreview(config, makeLsStamdata(), "NSA");
    const rek = preview.find((p) => p.artikel_nummer === "20050761");
    expect(rek).toBeDefined();
    expect(rek?.hoeveelheid).toBe(1);
    expect(rek?.sectie).toBe("lsRek");
    const mes = preview.find((p) => p.artikel_nummer === "MES-250");
    expect(mes?.hoeveelheid).toBe(3);
  });

  it("voegt LS-rek NIET toe wanneer lsRekType nog leeg is", () => {
    const config: MaterialenConfig = {
      ...emptyConfig(),
      subType: "renovatie_nsa",
      lsRekActie: "vervangen",
      lsRekType: "",
      trafoKva: "250",
    };
    const preview = berekenPreview(config, makeLsStamdata(), "NSA");
    expect(preview.find((p) => p.artikel_nummer === "20050761")).toBeUndefined();
  });

  it("matcht 8-richtingen regel niet wanneer 12 is gekozen", () => {
    const config: MaterialenConfig = {
      ...emptyConfig(),
      subType: "renovatie_nsa",
      lsRekActie: "vervangen",
      lsRekType: "8",
      trafoKva: "250",
    };
    const preview = berekenPreview(config, makeLsStamdata(), "NSA");
    expect(preview.find((p) => p.artikel_nummer === "20050761")).toBeUndefined();
  });
});
