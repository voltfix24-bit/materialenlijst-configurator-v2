import { describe, expect, it } from "vitest";
import type { PreviewItem, ToegevoegdArtikel } from "@/lib/configurator/types";
import {
  CONFIG_SECTIE_NAAR_WINKELWAGEN,
  bouwSectieGroepen,
  bouwSectiesMetNieuw,
  bouwZichtbareToegevoegd,
} from "./useWinkelwagenSecties";

function item(patch: Partial<PreviewItem> = {}): PreviewItem {
  return {
    artikel_id: "id",
    artikel_nummer: "20000001",
    korte_omschrijving: "Basis artikel",
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

function handmatig(patch: Partial<ToegevoegdArtikel> = {}): ToegevoegdArtikel {
  return {
    artikel_id: "id",
    artikel_nummer: "30000001",
    korte_omschrijving: "Handmatig",
    eenheid: "ST",
    hoeveelheid: 1,
    ...patch,
  };
}

describe("CONFIG_SECTIE_NAAR_WINKELWAGEN", () => {
  it("mapt configurator-secties naar winkelwagen-secties", () => {
    expect(CONFIG_SECTIE_NAAR_WINKELWAGEN.ms).toEqual(["rmu", "msVerbindingen"]);
    expect(CONFIG_SECTIE_NAAR_WINKELWAGEN.trafo).toEqual(["trafo", "vultKabel"]);
  });
});

describe("bouwSectieGroepen", () => {
  it("groepeert items per sectie en filtert lege secties", () => {
    const groepen = bouwSectieGroepen(
      [item(), item({ artikel_nummer: "20000002", sectie: "trafo" })],
      [],
      [],
      "",
    );
    const perKey = Object.fromEntries(groepen.map((g) => [g.key, g.items.length]));
    expect(perKey.standaard).toBe(1);
    expect(perKey.trafo).toBe(1);
    expect(groepen.find((g) => g.key === "rmu")).toBeUndefined();
  });

  it("sluit handmatig toegevoegde artikelen uit van de sectiegroepen", () => {
    const groepen = bouwSectieGroepen(
      [item({ artikel_nummer: "30000001" })],
      [],
      [handmatig({ artikel_nummer: "30000001" })],
      "",
    );
    expect(groepen).toEqual([]);
  });

  it("filtert op artikel_nummer en korte_omschrijving (case-insensitive)", () => {
    const groepen = bouwSectieGroepen(
      [item(), item({ artikel_nummer: "20000002", korte_omschrijving: "TrafoKabel" })],
      [],
      [],
      "trafokabel",
    );
    expect(groepen).toHaveLength(1);
    expect(groepen[0].items[0].artikel_nummer).toBe("20000002");
  });

  it("voegt verwijderde animatie-items per sectie toe", () => {
    const groepen = bouwSectieGroepen([], [item({ sectie: "trafo" })], [], "");
    expect(groepen).toHaveLength(1);
    expect(groepen[0].key).toBe("trafo");
    expect(groepen[0].verwijderdeItems).toHaveLength(1);
  });
});

describe("bouwZichtbareToegevoegd", () => {
  it("geeft alle items terug als het filter leeg is", () => {
    const lijst = [handmatig(), handmatig({ artikel_nummer: "30000002" })];
    expect(bouwZichtbareToegevoegd(lijst, "")).toEqual(lijst);
  });

  it("filtert op nummer of omschrijving", () => {
    const lijst = [
      handmatig({ artikel_nummer: "30000001", korte_omschrijving: "Klem" }),
      handmatig({ artikel_nummer: "30000002", korte_omschrijving: "Kabel" }),
    ];
    const result = bouwZichtbareToegevoegd(lijst, "kabel");
    expect(result.map((r) => r.artikel_nummer)).toEqual(["30000002"]);
  });
});

describe("bouwSectiesMetNieuw", () => {
  it("geeft lege set als er geen nieuwe artikelen zijn", () => {
    const groepen = bouwSectieGroepen([item()], [], [], "");
    expect(bouwSectiesMetNieuw(new Set(), groepen, [])).toEqual(new Set());
  });

  it("voegt sectie-keys toe voor secties met een nieuw artikel", () => {
    const groepen = bouwSectieGroepen([item({ sectie: "trafo" })], [], [], "");
    const result = bouwSectiesMetNieuw(new Set(["20000001"]), groepen, []);
    expect(result.has("trafo")).toBe(true);
  });

  it("voegt __handmatig toe als een handmatig artikel nieuw is", () => {
    const result = bouwSectiesMetNieuw(new Set(["30000001"]), [], [handmatig()]);
    expect(result.has("__handmatig")).toBe(true);
  });
});
