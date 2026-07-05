import { describe, expect, it } from "vitest";
import type { PreviewItem } from "@/lib/configurator/types";
import type { ArtikelStam } from "@/lib/configurator/artikelTypes";
import { bouwSuggesties } from "./useHandmatigZoeker";

function stam(patch: Partial<ArtikelStam> = {}): ArtikelStam {
  return {
    id: "id-1",
    artikel_nummer: "20000001",
    korte_omschrijving: "Kabel 25mm",
    eenheid: "M",
    ...patch,
  };
}

function item(patch: Partial<PreviewItem> = {}): PreviewItem {
  return {
    artikel_id: "id",
    artikel_nummer: "20000001",
    korte_omschrijving: "Kabel",
    eenheid: "M",
    categorie: "Test",
    hoeveelheid: 1,
    niet_bestellen: false,
    herkomst: [],
    sectie: "standaard",
    bijdragen: [],
    ...patch,
  };
}

describe("bouwSuggesties", () => {
  it("geeft lege lijst bij minder dan 2 zoekkarakters", () => {
    expect(bouwSuggesties("", [stam()], [])).toEqual([]);
    expect(bouwSuggesties("k", [stam()], [])).toEqual([]);
  });

  it("filtert op nummer en omschrijving (case-insensitive)", () => {
    const result = bouwSuggesties(
      "KABEL",
      [stam(), stam({ artikel_nummer: "20000002", korte_omschrijving: "Mof" })],
      [],
    );
    expect(result.map((r) => r.artikel_nummer)).toEqual(["20000001"]);
  });

  it("sluit artikelen uit die al in de effectieve lijst staan", () => {
    const result = bouwSuggesties("kabel", [stam()], [item()]);
    expect(result).toEqual([]);
  });

  it("beperkt het aantal suggesties tot 8", () => {
    const veel = Array.from({ length: 15 }, (_, i) =>
      stam({ id: `id-${i}`, artikel_nummer: `2000000${i}`, korte_omschrijving: "Kabel variant" }),
    );
    expect(bouwSuggesties("kabel", veel, [])).toHaveLength(8);
  });
});
