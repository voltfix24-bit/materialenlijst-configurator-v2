import { describe, expect, it } from "vitest";
import type { PreviewItem } from "@/lib/configurator/types";
import { berekenAnimatieDelta } from "./useWinkelwagenAnimaties";

function item(patch: Partial<PreviewItem> = {}): PreviewItem {
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
    bijdragen: [],
    ...patch,
  };
}

describe("berekenAnimatieDelta", () => {
  it("geeft geen nieuwe of verwijderde items op de eerste render", () => {
    const { nieuwNrs, verwijderdItems, huidig } = berekenAnimatieDelta(
      new Map(),
      [item()],
      [item()],
      true,
    );
    expect(nieuwNrs.size).toBe(0);
    expect(verwijderdItems).toEqual([]);
    expect(huidig.get("20000001")).toBe(1);
  });

  it("markeert artikelen met een gewijzigde hoeveelheid als nieuw", () => {
    const vorige = new Map([["20000001", 1]]);
    const { nieuwNrs } = berekenAnimatieDelta(
      vorige,
      [item({ hoeveelheid: 3 })],
      [item({ hoeveelheid: 1 })],
      false,
    );
    expect([...nieuwNrs]).toEqual(["20000001"]);
  });

  it("markeert nieuwe artikelnummers als nieuw", () => {
    const { nieuwNrs } = berekenAnimatieDelta(
      new Map([["20000001", 1]]),
      [item(), item({ artikel_nummer: "20000002" })],
      [item()],
      false,
    );
    expect([...nieuwNrs]).toEqual(["20000002"]);
  });

  it("levert weggevallen items uit de vorige berekende lijst", () => {
    const { verwijderdItems } = berekenAnimatieDelta(
      new Map([
        ["20000001", 1],
        ["20000002", 1],
      ]),
      [item()],
      [item(), item({ artikel_nummer: "20000002" })],
      false,
    );
    expect(verwijderdItems.map((v) => v.artikel_nummer)).toEqual(["20000002"]);
  });

  it("negeert items die nooit eerder in de vorige-map stonden", () => {
    // 20000002 zit in `items` maar niet in `vorige` — was dus niet zichtbaar,
    // geen verwijder-animatie nodig.
    const { verwijderdItems } = berekenAnimatieDelta(
      new Map([["20000001", 1]]),
      [item()],
      [item(), item({ artikel_nummer: "20000002" })],
      false,
    );
    expect(verwijderdItems).toEqual([]);
  });
});
