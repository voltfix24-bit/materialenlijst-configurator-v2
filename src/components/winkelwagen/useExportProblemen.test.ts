import { describe, expect, it } from "vitest";
import type { PreviewItem } from "@/lib/configurator/types";
import { bouwExportProblemen, type AlternatiefKeuzeVoorExport } from "./useExportProblemen";

function item(patch: Partial<PreviewItem> = {}): PreviewItem {
  return {
    artikel_id: "art-1",
    artikel_nummer: "20000001",
    korte_omschrijving: "Test artikel",
    eenheid: "ST",
    categorie: "Test",
    hoeveelheid: 2,
    niet_bestellen: false,
    herkomst: ["test"],
    sectie: "standaard",
    bijdragen: [{ herkomst: "test", sectie: "standaard", hoeveelheid: 2 }],
    ...patch,
  };
}

describe("bouwExportProblemen", () => {
  it("neemt actieve bestelbare artikelen niet op", () => {
    const problemen = bouwExportProblemen(
      [item()],
      [{
        artikel_nummer: "20000001",
        korte_omschrijving: "Test artikel",
        eenheid: "ST",
        actief: true,
        status: "Actief",
      }],
    );

    expect(problemen).toHaveLength(0);
  });

  it("markeert inactieve en uitgelopen artikelen als exportprobleem", () => {
    const problemen = bouwExportProblemen(
      [
        item({ artikel_nummer: "20000001", inactief: true }),
        item({ artikel_nummer: "20000002", korte_omschrijving: "Uitgelopen" }),
      ],
      [
        {
          artikel_nummer: "20000001",
          korte_omschrijving: "Inactief",
          eenheid: "ST",
          actief: true,
          status: "Actief",
          alternatief_artikel_nummer: "20000009",
        },
        {
          artikel_nummer: "20000002",
          korte_omschrijving: "Uitgelopen",
          eenheid: "ST",
          actief: false,
          status: "Uitgelopen",
          alternatief_artikel_nummer: "-",
        },
      ],
    );

    expect(problemen.map((p) => p.artikel_nummer)).toEqual(["20000001", "20000002"]);
    expect(problemen[0]).toMatchObject({
      status_label: "Actief",
      alternatieven: ["20000009"],
      geen_opvolger: false,
      handmatig_beoordelen: false,
    });
    expect(problemen[1]).toMatchObject({
      status_label: "Uitgelopen",
      alternatieven: [],
      geen_opvolger: true,
    });
  });

  it("herkent tekst-met-nummer als handmatige beoordeling en voegt eerdere keuze toe", () => {
    const keuzes = new Map<string, AlternatiefKeuzeVoorExport>([
      ["20000001", {
        nieuw_artikel_nummer: "20000009",
        created_at: "2026-07-05T10:00:00.000Z",
        totaal_geupdate: 3,
      }],
    ]);

    const problemen = bouwExportProblemen(
      [item()],
      [{
        artikel_nummer: "20000001",
        korte_omschrijving: "Geblokkeerd",
        eenheid: "ST",
        actief: false,
        status: "Geblokkeerd",
        alternatief_artikel_nummer: "GEBR 20000009",
      }],
      keuzes,
    );

    expect(problemen).toHaveLength(1);
    expect(problemen[0]).toMatchObject({
      alternatieven: ["20000009"],
      handmatig_beoordelen: true,
      eerdere_keuze: {
        nieuw_artikel_nummer: "20000009",
        totaal_geupdate: 3,
      },
    });
  });

  it("slaat niet-bestellen regels over", () => {
    const problemen = bouwExportProblemen(
      [item({ niet_bestellen: true, inactief: true })],
      [],
    );

    expect(problemen).toHaveLength(0);
  });

  it("herkent expliciete geen-opvolger markers", () => {
    const problemen = bouwExportProblemen(
      [item()],
      [{
        artikel_nummer: "20000001",
        korte_omschrijving: "Geen opvolger",
        eenheid: "ST",
        actief: false,
        status: "Verwijderd",
        alternatief_artikel_nummer: "GEEN OPVOLGER",
      }],
    );

    expect(problemen[0]).toMatchObject({
      alternatief_raw: "GEEN OPVOLGER",
      alternatieven: [],
      geen_opvolger: true,
      handmatig_beoordelen: false,
    });
  });

  it("laat meerdere alternatiefnummers als meerdere kandidaten staan", () => {
    const problemen = bouwExportProblemen(
      [item()],
      [{
        artikel_nummer: "20000001",
        korte_omschrijving: "Meerdere alternatieven",
        eenheid: "ST",
        actief: false,
        status: "Uitgelopen",
        alternatief_artikel_nummer: "20000009 20000010",
      }],
    );

    expect(problemen[0]).toMatchObject({
      alternatieven: ["20000009", "20000010"],
      geen_opvolger: false,
      handmatig_beoordelen: false,
    });
  });

  it("trimt alternatiefvelden en detecteert status casing/whitespace", () => {
    const problemen = bouwExportProblemen(
      [item()],
      [{
        artikel_nummer: "20000001",
        korte_omschrijving: "Casing",
        eenheid: "ST",
        actief: true,
        status: " UITGELOPEN ",
        alternatief_artikel_nummer: " 20000009 ",
      }],
    );

    expect(problemen[0]).toMatchObject({
      status_label: "UITGELOPEN",
      alternatief_raw: "20000009",
      alternatieven: ["20000009"],
    });
  });

  it("markeert stamdata actief=false ook zonder preview-vlag of status", () => {
    const problemen = bouwExportProblemen(
      [item({ inactief: false })],
      [{
        artikel_nummer: "20000001",
        korte_omschrijving: "Inactief stam",
        eenheid: "ST",
        actief: false,
        status: "",
      }],
    );

    expect(problemen).toHaveLength(1);
    expect(problemen[0].status_label).toBe("Inactief");
  });

  it("slaat artikelen zonder stamdata over", () => {
    const problemen = bouwExportProblemen(
      [item({ inactief: false })],
      [],
    );

    expect(problemen).toHaveLength(0);
  });
});
