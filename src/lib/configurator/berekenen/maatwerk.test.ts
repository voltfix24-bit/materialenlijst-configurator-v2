import { describe, expect, it } from "vitest";
import { berekenPreview } from "../berekenen";
import { emptyConfig } from "../types";
import { art, baseStamdata } from "../__fixtures__/stamdata";
import type { MaatwerkRegel, MaatwerkVraag } from "./maatwerk";

function vraag(
  over: Partial<MaatwerkVraag> = {},
  regels: Partial<MaatwerkRegel>[] = [],
): MaatwerkVraag {
  return {
    id: "vraag-1",
    vraag_key: "graafwerk",
    label: "Is er graafwerk nodig?",
    uitleg: null,
    type: "ja_nee",
    opties: [],
    van_toepassing_bij: [],
    actief: true,
    ...over,
    regels: regels.map((r, i) => ({
      id: `regel-${i}`,
      antwoord: "ja",
      hoeveelheid: 1,
      per_eenheid: false,
      actief: true,
      artikel: art("30000001"),
      ...r,
    })),
  };
}

function run(vragen: MaatwerkVraag[], antwoorden: Record<string, string>, caseType = "NSA") {
  const sd = baseStamdata({ maatwerkVragen: vragen });
  const config = {
    ...emptyConfig(),
    subType: "renovatie_nsa" as const,
    maatwerkAntwoorden: antwoorden,
  };
  return berekenPreview(config, sd, caseType);
}

const vind = (items: ReturnType<typeof run>, nr: string) =>
  items.find((i) => i.artikel_nummer === nr);

describe("berekenMaatwerk (eigen vragen)", () => {
  it("voegt het artikel toe bij een matchend ja/nee-antwoord", () => {
    const items = run([vraag({}, [{ antwoord: "ja", hoeveelheid: 2 }])], { graafwerk: "ja" });
    expect(vind(items, "30000001")?.hoeveelheid).toBe(2);
    expect(vind(items, "30000001")?.sectie).toBe("maatwerk");
  });

  it("voegt niets toe zonder antwoord of bij niet-matchend antwoord", () => {
    const vragen = [vraag({}, [{ antwoord: "ja" }])];
    expect(vind(run(vragen, {}), "30000001")).toBeUndefined();
    expect(vind(run(vragen, { graafwerk: "nee" }), "30000001")).toBeUndefined();
  });

  it("matcht '*' bij elk niet-leeg antwoord", () => {
    const vragen = [vraag({}, [{ antwoord: "*", hoeveelheid: 3 }])];
    expect(vind(run(vragen, { graafwerk: "nee" }), "30000001")?.hoeveelheid).toBe(3);
    expect(vind(run(vragen, {}), "30000001")).toBeUndefined();
  });

  it("vermenigvuldigt bij aantal-vragen met per_eenheid en slaat 0 over", () => {
    const vragen = [
      vraag({ type: "aantal", vraag_key: "mantelbuizen" }, [
        { antwoord: "*", hoeveelheid: 2, per_eenheid: true },
      ]),
    ];
    expect(vind(run(vragen, { mantelbuizen: "3" }), "30000001")?.hoeveelheid).toBe(6);
    expect(vind(run(vragen, { mantelbuizen: "0" }), "30000001")).toBeUndefined();
  });

  it("respecteert van_toepassing_bij (case type filter)", () => {
    const vragen = [vraag({ van_toepassing_bij: ["compact"] }, [{ antwoord: "ja" }])];
    expect(vind(run(vragen, { graafwerk: "ja" }, "NSA"), "30000001")).toBeUndefined();
    expect(vind(run(vragen, { graafwerk: "ja" }, "compact"), "30000001")?.hoeveelheid).toBe(1);
  });

  it("slaat inactieve regels over en registreert de bron voor deep-links", () => {
    const vragen = [
      vraag({}, [
        { antwoord: "ja", actief: false },
        { antwoord: "ja", artikel: art("30000002"), hoeveelheid: 4 },
      ]),
    ];
    const items = run(vragen, { graafwerk: "ja" });
    expect(vind(items, "30000001")).toBeUndefined();
    const item = vind(items, "30000002") as
      | { bijdragen?: { bronTabel?: string; bronId?: string }[] }
      | undefined;
    expect(item).toBeDefined();
    expect(item?.bijdragen?.[0]?.bronTabel).toBe("maatwerk_vraag_regels");
    expect(item?.bijdragen?.[0]?.bronId).toBe("regel-1");
  });
});
