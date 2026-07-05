import { describe, expect, it } from "vitest";
import type { PreviewItem } from "@/lib/configurator/types";
import { bepaalBron } from "./useWinkelwagenCorrecties";

function itemMet(bijdragen: PreviewItem["bijdragen"]): PreviewItem {
  return {
    artikel_id: "id",
    artikel_nummer: "20000001",
    korte_omschrijving: "Test",
    eenheid: "ST",
    categorie: "Test",
    hoeveelheid: 1,
    niet_bestellen: false,
    herkomst: [],
    sectie: "standaard",
    bijdragen,
  };
}

describe("bepaalBron", () => {
  it("geeft null-bron zonder bijdragen (meerdere=false)", () => {
    expect(bepaalBron(itemMet([]))).toEqual({
      tabel: null,
      id: null,
      herkomst: null,
      meerdere: false,
    });
  });

  it("geeft de enkele bijdrage terug bij precies één", () => {
    const b = bepaalBron(
      itemMet([
        {
          herkomst: "prov_regel",
          sectie: "provisorium",
          hoeveelheid: 1,
          bronTabel: "prov_regels",
          bronId: "abc-123",
        },
      ]),
    );
    expect(b).toEqual({
      tabel: "prov_regels",
      id: "abc-123",
      herkomst: "prov_regel",
      meerdere: false,
    });
  });

  it("markeert meerdere bijdragen als meerdere=true en verbergt losse bron", () => {
    const b = bepaalBron(
      itemMet([
        { herkomst: "a", sectie: "standaard", hoeveelheid: 1 },
        { herkomst: "b", sectie: "standaard", hoeveelheid: 2 },
      ]),
    );
    expect(b).toEqual({ tabel: null, id: null, herkomst: null, meerdere: true });
  });

  it("gebruikt null voor optionele bronvelden bij een enkele bijdrage zonder tabel/id", () => {
    const b = bepaalBron(itemMet([{ herkomst: "standaard", sectie: "standaard", hoeveelheid: 1 }]));
    expect(b).toEqual({
      tabel: null,
      id: null,
      herkomst: "standaard",
      meerdere: false,
    });
  });
});
