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
