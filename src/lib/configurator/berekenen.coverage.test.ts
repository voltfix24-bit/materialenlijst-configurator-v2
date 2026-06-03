/**
 * Coverage-test: voor elk configureerbaar veld van MaterialenConfig dat
 * een mapping naar de winkelwagen heeft, controleert deze test dat het
 * toggelen van het veld een meetbaar verschil oplevert in berekenPreview().
 *
 * Doel:
 * - Voorkomen dat een UI-veld in MaterialenConfig wordt toegevoegd zonder
 *   bijbehorende mapping in berekenen/* of in een ls_rek_regels-achtige tabel.
 * - Vangnet bij elke refactor: een veld dat per ongeluk niet meer
 *   doorwerkt in de winkelwagen wordt onmiddellijk geflagd.
 *
 * Strategie per dimensie:
 *  - `baseline`: minimale config (subType + eventueel gating-context).
 *  - `toggled`: baseline + alleen het veld dat we testen ingevuld.
 *  - Assertie: toggled bevat tenminste 1 preview-item dat baseline NIET
 *    heeft, en (waar opgegeven) een specifiek artikelnummer.
 */
import { describe, it, expect } from "vitest";
import { berekenPreview } from "./berekenen";
import { emptyConfig, type MaterialenConfig } from "./types";
import { baseStamdata } from "./__fixtures__/stamdata";

type ConfigPatch = Partial<MaterialenConfig>;

interface Dim {
  /** Naam van het config-veld (of veld-groep) dat we testen. */
  name: string;
  /** Minimale gating-context die nodig is om dit veld effect te laten hebben. */
  baseline: ConfigPatch;
  /** Veld(en) toggelen. */
  toggle: ConfigPatch;
  /** caseType voor stamdata-lookup (alleen relevant voor standaard-templates). */
  caseType?: string;
  /** Specifieke artikelnummers die in toggled MOETEN voorkomen, niet in baseline. */
  mustAppear?: string[];
  /** Specifieke hoeveelheid-assertie per artikelnummer. */
  mustHaveQty?: Record<string, number>;
}

// Subtype dat de meeste regels activeert (renovatie_nsa = niet-prov, niet-compact).
const RENOV = { subType: "renovatie_nsa" } as ConfigPatch;
// Provisorium-baseline vereist een (stub) provRmuConfig — gating in
// berekenProvisorium kijkt naar `!config.provRmuConfig` om vroeg te returnen.
const PROV_STUB_CFG = {
  id: "stub", code: "stub", merk: "stub", is_inet: false,
  aantal_velden: 0, aantal_f: 0, aantal_c: 0, aantal_v: 0,
  rmu_artikel_id: null, frame_artikel_id: null, bodemplaat_artikel_id: null,
  actief: true,
};
const PROV = {
  subType: "renovatie_prov",
  provRmuConfig: PROV_STUB_CFG as unknown as MaterialenConfig["provRmuConfig"],
} as ConfigPatch;
const COMPACT = { subType: "cs_zonder_prov", isCompactStation: true } as ConfigPatch;

const DIMS: Dim[] = [
  // ─── Trafo ──────────────────────────────────────────────────────────────
  {
    name: "trafoActie=nieuw + trafoKva=400",
    baseline: { ...RENOV },
    toggle: { ...RENOV, trafoActie: "nieuw", trafoKva: "400" },
    mustAppear: ["26001120", "20019629", "20011412", "20019614", "20017534"],
  },
  {
    name: "trafoActie=draaien + trafoKva=250",
    baseline: { ...RENOV },
    toggle: { ...RENOV, trafoActie: "draaien", trafoKva: "250" },
    mustAppear: ["20038832"],
  },
  {
    name: "trafoActie=blijft + trafoKva=1000",
    baseline: { ...RENOV },
    toggle: { ...RENOV, trafoActie: "blijft", trafoKva: "1000" },
    mustAppear: ["20042706"],
  },
  {
    name: "trafoKabelLengte=7.25",
    baseline: { ...RENOV, trafoActie: "nieuw", trafoKva: "400" },
    toggle: { ...RENOV, trafoActie: "nieuw", trafoKva: "400", trafoKabelLengte: "7.25" },
    mustAppear: ["20044290"],
  },
  {
    name: "trafoKabelLengte=10",
    baseline: { ...RENOV, trafoActie: "nieuw", trafoKva: "400" },
    toggle: { ...RENOV, trafoActie: "nieuw", trafoKva: "400", trafoKabelLengte: "10" },
    mustAppear: ["20044290"],
  },
  {
    name: "vultKabelAfstand>0 + trafoKva=400",
    baseline: { ...RENOV, trafoKva: "400" },
    toggle: { ...RENOV, trafoKva: "400", vultKabelAfstand: 5 },
    mustAppear: ["20030300", "20017790", "20042739"],
  },
  {
    name: "vultKabelAfstand>0 + trafoKva=630 (dubbel)",
    baseline: { ...RENOV, trafoKva: "630" },
    toggle: { ...RENOV, trafoKva: "630", vultKabelAfstand: 5 },
    mustAppear: ["20030299", "20000986"],
  },

  // ─── LS-rek (renovatie, vervangen) ──────────────────────────────────────
  {
    name: "lsRekActie=vervangen + lsRekType=8",
    baseline: { ...RENOV },
    toggle: { ...RENOV, lsRekActie: "vervangen", lsRekType: "8" },
    mustAppear: ["20050813"],
  },
  {
    name: "lsRekActie=vervangen + lsRekType=12",
    baseline: { ...RENOV },
    toggle: { ...RENOV, lsRekActie: "vervangen", lsRekType: "12" },
    mustAppear: ["20050761"],
    mustHaveQty: { "20050761": 1 },
  },
  {
    name: "lsRekExtraStroken=2",
    baseline: { ...RENOV, lsRekActie: "vervangen", lsRekType: "8" },
    toggle: {
      ...RENOV, lsRekActie: "vervangen", lsRekType: "8", lsRekExtraStroken: 2,
    },
    mustAppear: ["20020042"],
    mustHaveQty: { "20020042": 2 },
  },
  {
    name: "lsRekAanSluitenKabels=3 (renovatie vervangen)",
    baseline: { ...RENOV, lsRekActie: "vervangen", lsRekType: "8" },
    toggle: {
      ...RENOV, lsRekActie: "vervangen", lsRekType: "8", lsRekAanSluitenKabels: 3,
    },
    mustAppear: ["20042042", "20018004"],
    mustHaveQty: { "20042042": 3, "20018004": 3 },
  },
  {
    name: "trafoKva=250 op vervangen → mespatroon voedende strook",
    baseline: { ...RENOV, lsRekActie: "vervangen", lsRekType: "8" },
    toggle: {
      ...RENOV, lsRekActie: "vervangen", lsRekType: "8", trafoKva: "250",
    },
    mustAppear: ["20036622"],
    mustHaveQty: { "20036622": 3 },
  },
  {
    name: "lsRekOvStuurpunt=true → router/beugel/flexov",
    baseline: { ...RENOV, lsRekActie: "vervangen", lsRekType: "8" },
    toggle: {
      ...RENOV, lsRekActie: "vervangen", lsRekType: "8", lsRekOvStuurpunt: true,
    },
    mustAppear: ["20040148", "20040188", "20039993", "20039994", "20040149"],
  },
  {
    name: "lsRekSchroefpatroon=35A",
    baseline: { ...RENOV, lsRekActie: "vervangen", lsRekType: "8", lsRekOvStuurpunt: true },
    toggle: {
      ...RENOV, lsRekActie: "vervangen", lsRekType: "8",
      lsRekOvStuurpunt: true, lsRekSchroefpatroon: "35A",
    },
    mustAppear: ["20001107"],
    mustHaveQty: { "20001107": 3 },
  },
  {
    name: "lsRekSchroefpatroon=50A",
    baseline: { ...RENOV, lsRekActie: "vervangen", lsRekType: "8", lsRekOvStuurpunt: true },
    toggle: {
      ...RENOV, lsRekActie: "vervangen", lsRekType: "8",
      lsRekOvStuurpunt: true, lsRekSchroefpatroon: "50A",
    },
    mustAppear: ["20001108"],
  },

  // ─── LS-rek (renovatie, gehandhaafd) ────────────────────────────────────
  {
    name: "lsRekActie=gehandhaafd + beveiligingAanpassen + trafoKva=400",
    baseline: { ...RENOV, lsRekActie: "gehandhaafd", trafoKva: "400" },
    toggle: {
      ...RENOV, lsRekActie: "gehandhaafd",
      lsRekBeveiligingAanpassen: true, trafoKva: "400",
    },
    mustAppear: ["20036623"],
  },
  {
    name: "lsRekAantalBeveiligingen + lsRekBeveiligingen (engineer-input)",
    baseline: { ...RENOV, lsRekActie: "vervangen", lsRekType: "8" },
    toggle: {
      ...RENOV, lsRekActie: "vervangen", lsRekType: "8",
      lsRekAantalBeveiligingen: 2,
      lsRekBeveiligingen: ["20026895", "20001038"],
    },
    mustAppear: ["20026895", "20001038"],
    mustHaveQty: { "20026895": 3, "20001038": 3 },
  },

  // ─── Compact station ────────────────────────────────────────────────────
  {
    name: "isCompactStation + trafoKva=250 → mespatroon voedende strook",
    baseline: { subType: "cs_zonder_prov", isCompactStation: false },
    toggle: { ...COMPACT, trafoKva: "250" },
    mustAppear: ["20036622"],
  },
  {
    name: "isCompactStation + lsRekAanSluitenKabels=4 → K56 U dubbel + kabelinlegklem",
    baseline: { ...COMPACT },
    toggle: { ...COMPACT, lsRekAanSluitenKabels: 4 },
    mustAppear: ["20042043", "20018004"],
    mustHaveQty: { "20042043": 8, "20018004": 4 },
  },

  // ─── GGI ────────────────────────────────────────────────────────────────
  {
    name: "ggiVervangen=true → 7 GGI artikelen",
    baseline: { ...RENOV },
    toggle: { ...RENOV, ggiVervangen: true },
    mustAppear: [
      "20039090", "20041319", "20019149", "20019177",
      "20029657", "20050552", "20038289",
    ],
  },

  // ─── MS kabel traces ────────────────────────────────────────────────────
  {
    name: "msKabelTraces 240AL_singel 50m (kabel ×3 fases voor singel)",
    baseline: { ...RENOV },
    toggle: {
      ...RENOV,
      msKabelTraces: [{
        id: "t1", kabelType: "240AL_singel", lengteMeters: 50,
        heeftOversteek: false, aantalOversteken: 0, oversteekMeters: 0,
      }],
    },
    mustAppear: ["20039484", "20018148"],
    mustHaveQty: { "20039484": 150 }, // 50m × 3 fases (singel)
  },
  {
    name: "msKabelTraces oversteek 240AL_singel 50m + 12m × 2",
    baseline: {
      ...RENOV,
      msKabelTraces: [{
        id: "t1", kabelType: "240AL_singel", lengteMeters: 50,
        heeftOversteek: false, aantalOversteken: 0, oversteekMeters: 0,
      }],
    },
    toggle: {
      ...RENOV,
      msKabelTraces: [{
        id: "t1", kabelType: "240AL_singel", lengteMeters: 50,
        heeftOversteek: true, aantalOversteken: 2, oversteekMeters: 12,
      }],
    },
    mustAppear: ["20036049", "20043703"],
  },

  // ─── LS kabel traces ────────────────────────────────────────────────────
  {
    name: "lsKabelTraces lengte 20m",
    baseline: { ...RENOV },
    toggle: {
      ...RENOV,
      lsKabelTraces: [{
        id: "t1", lengteMeters: 20,
        heeftOversteek: false, aantalOversteken: 0, oversteekMeters: 0,
      }],
    },
    mustAppear: ["20009692"],
    mustHaveQty: { "20009692": 20 },
  },

  // ─── I-Net artikelen — AUDIT-BEVINDING ──────────────────────────────────
  // iNetArtikelen worden alleen toegevoegd wanneer rmuInet === "ja". De
  // UI vult ze alleen wanneer ook een rmuConfig met is_inet is gekozen.
  // Test bevestigt dat de mapping werkt zodra rmuInet correct staat.
  {
    name: "rmuInet=ja + iNetArtikelen entry → I-Net artikel in winkelwagen",
    baseline: { ...RENOV, rmuInet: "ja" },
    toggle: {
      ...RENOV, rmuInet: "ja",
      iNetArtikelen: [{ artikel_nummer: "20039090", hoeveelheid: 2 }],
    },
    mustAppear: ["20039090"],
    mustHaveQty: { "20039090": 2 },
  },

  // ─── Provisorium (prov_regels) — AUDIT-BEVINDING ────────────────────────
  // provInb* regels in de DB worden alleen geëvalueerd via berekenProvisorium,
  // dat gating-condities op subType/isProvisorum heeft. Gevonden gating:
  // de prov-regels firen alleen wanneer ctx.isProvisorum === true en
  // provRmuMerk een prov_regels match heeft. Onderstaande tests valideren
  // dat de DB-mapping intact is voor de happy path.
  {
    name: "Magnefix prov + provInbMsKabels=3 → MS eindsluiting + afschermset",
    baseline: { ...PROV, provRmuMerk: "Magnefix" },
    toggle: {
      ...PROV, provRmuMerk: "Magnefix", provInbMsKabels: 3,
    },
    mustAppear: ["20039648", "20018032"],
  },
  {
    name: "ABB prov + provInbLsKabels=2 → kabelinlegklem + K56",
    baseline: { ...PROV, provRmuMerk: "ABB" },
    toggle: { ...PROV, provRmuMerk: "ABB", provInbLsKabels: 2 },
    mustAppear: ["20018004", "20042042"],
  },
  {
    name: "Magnefix prov + provZekeringKva=400 + 1 F-veld → buispatroon",
    baseline: { ...PROV, provRmuMerk: "Magnefix" },
    toggle: {
      ...PROV, provRmuMerk: "Magnefix", provZekeringKva: "400",
      provRmuVelden: [{
        id: "v1", veldType: "F", veldNummer: 1, isReserve: false, kabelType: "",
      }],
    },
    mustAppear: ["20019484"],
  },
];

function nummers(items: ReturnType<typeof berekenPreview>): Set<string> {
  return new Set(items.map((p) => p.artikel_nummer));
}

describe("berekenPreview — dekking per config-veld", () => {
  for (const d of DIMS) {
    it(d.name, () => {
      const base = berekenPreview(
        { ...emptyConfig(), ...d.baseline },
        baseStamdata(),
        d.caseType ?? "NSA",
      );
      const after = berekenPreview(
        { ...emptyConfig(), ...d.toggle },
        baseStamdata(),
        d.caseType ?? "NSA",
      );
      const baseNrs = nummers(base);
      const afterNrs = nummers(after);

      // Toggled moet MINSTENS 1 nieuw artikel toevoegen, anders heeft het
      // veld geen mapping en zou de winkelwagen het niet kunnen reflecteren.
      const added = [...afterNrs].filter((n) => !baseNrs.has(n));
      expect(
        added.length,
        `Veld zonder zichtbaar effect — geen winkelwagen-mapping?\n` +
          `baseline=${[...baseNrs].sort().join(",")}\n` +
          `after   =${[...afterNrs].sort().join(",")}`,
      ).toBeGreaterThan(0);

      if (d.mustAppear) {
        for (const nr of d.mustAppear) {
          expect(afterNrs.has(nr), `Verwacht artikel ${nr} in winkelwagen`).toBe(true);
        }
      }
      if (d.mustHaveQty) {
        for (const [nr, qty] of Object.entries(d.mustHaveQty)) {
          const item = after.find((p) => p.artikel_nummer === nr);
          expect(item?.hoeveelheid, `Verkeerd aantal voor ${nr}`).toBe(qty);
        }
      }
    });
  }
});

describe("berekenPreview — integratiescenario (meerdere secties tegelijk)", () => {
  it("renovatie NSA met trafo+vultkabel+LS-rek+OV+MS-trace+LS-trace+GGI", () => {
    const cfg: MaterialenConfig = {
      ...emptyConfig(),
      subType: "renovatie_nsa",
      trafoActie: "nieuw",
      trafoKva: "400",
      trafoKabelLengte: "7.25",
      vultKabelAfstand: 6,
      lsRekActie: "vervangen",
      lsRekType: "12",
      lsRekExtraStroken: 1,
      lsRekAanSluitenKabels: 4,
      lsRekOvStuurpunt: true,
      lsRekSchroefpatroon: "50A",
      lsRekAantalBeveiligingen: 1,
      lsRekBeveiligingen: ["20026895"],
      msKabelTraces: [{
        id: "t1", kabelType: "240AL_singel", lengteMeters: 40,
        heeftOversteek: true, aantalOversteken: 1, oversteekMeters: 8,
      }],
      lsKabelTraces: [{
        id: "lt1", lengteMeters: 15,
        heeftOversteek: false, aantalOversteken: 0, oversteekMeters: 0,
      }],
      ggiVervangen: true,
    };
    const preview = berekenPreview(cfg, baseStamdata(), "NSA");
    const nrs = nummers(preview);

    // Per sectie minstens één signature-artikel aanwezig:
    const expects: Record<string, string> = {
      "Trafo nieuw 400kVA": "26001120",
      "Trafo telcon kabel 7.25m": "20044290",
      "Vult kabel 4×300 Cu": "20030300",
      "Muurbeugel vultkabel": "20042739",
      "LS-rek 12 richtingen": "20050761",
      "LS-rek extra stroken": "20020042",
      "LS-rek K56 klem": "20042042",
      "LS-rek mespatroon 400kVA": "20036623",
      "OV-stuurpunt router": "20040148",
      "OV schroefpatroon 50A": "20001108",
      "LS richting beveiliging engineer-input": "20026895",
      "MS kabel 240AL_singel": "20039484",
      "MS kabel oversteek buis": "20036049",
      "MS kabel oversteek geotextiel": "20043703",
      "LS kabel": "20009692",
      "GGI artikel #1": "20039090",
    };
    for (const [label, nr] of Object.entries(expects)) {
      expect(nrs.has(nr), `${label}: artikel ${nr} ontbreekt in winkelwagen`).toBe(true);
    }

    // Hoeveelheden voor de duidelijk berekenbare regels
    const q = (nr: string) => preview.find((p) => p.artikel_nummer === nr)?.hoeveelheid;
    expect(q("20050761")).toBe(1);              // 1 LS-rek
    expect(q("20020042")).toBe(1);              // 1 extra strook
    expect(q("20042042")).toBe(4);              // 4 kabels → 4 K56-klemmen
    expect(q("20018004")).toBe(4);              // 4 kabelinlegklemmen
    expect(q("20039484")).toBe(120);            // 40m × 3 fases (singel)
    expect(q("20009692")).toBe(15);             // 15m LS kabel
    expect(q("20036623")).toBe(3);              // mespatroon 400kVA × 3
    expect(q("20026895")).toBe(3);              // 1 richting × 3 mespatronen
    expect(q("20040148")).toBe(1);              // OV router 1×
  });
});
