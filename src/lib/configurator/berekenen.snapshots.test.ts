/**
 * Snapshot-regressietests voor berekenPreview().
 *
 * Doel (Fase 0 — refactor-vangnet):
 * Vastleggen van de huidige output van de pure berekening voor een
 * representatieve set configuraties. Iedere toekomstige refactor van
 * berekenen.ts (uitsplitsen naar domeinfuncties, regelmotor in DB, ...)
 * laat deze snapshots ongewijzigd zolang gedrag identiek blijft.
 *
 * Snapshots staan in __snapshots__/berekenen.snapshots.test.ts.snap.
 * Bij intentionele gedragswijziging: `bunx vitest run -u` om bij te werken,
 * dan handmatig de diff reviewen.
 */
import { describe, it, expect } from "vitest";
import { berekenPreview } from "./berekenen";
import {
  emptyConfig,
  type Artikel,
  type MaterialenConfig,
  type RmuConfig,
  type RmuVeldConfig,
  type LsMof,
  type MsRichting,
  type MsKabelTrace,
  emptyMofConfig,
} from "./types";
import type { Stamdata } from "./queries";

// ─── Stamdata fixture helpers ─────────────────────────────────────────────

function art(nummer: string, omschrijving = `Artikel ${nummer}`): Artikel {
  return {
    id: `art-${nummer}`,
    artikel_nummer: nummer,
    korte_omschrijving: omschrijving,
    eenheid: "st",
    categorie: "Test",
    actief: true,
  };
}

interface StamdataOverrides {
  artikelNummers?: string[];
  rmuConfigs?: unknown[];
  rmuVeldArtikelen?: unknown[];
  rmuZekeringen?: unknown[];
  msMofTypes?: unknown[];
  msMofMaterialen?: unknown[];
  lsMofTypes?: unknown[];
  lsMofMaterialen?: unknown[];
  standaardTemplates?: unknown[];
  stationVaste?: unknown[];
  ggiRegels?: unknown[];
  trafoRegels?: unknown[];
}

// Vaste seed van GGI- en Trafo-regels, identiek aan de DB-seed in productie.
// Hierdoor blijven snapshots ongewijzigd nu deze domeinen DB-driven zijn.
const DEFAULT_GGI_REGELS = [
  { nr: "20039090", qty: 2 },
  { nr: "20041319", qty: 4 },
  { nr: "20019149", qty: 100 },
  { nr: "20019177", qty: 4 },
  { nr: "20029657", qty: 10 },
  { nr: "20050552", qty: 5 },
  { nr: "20038289", qty: 5 },
].map((r, i) => ({
  id: `ggi-${i}`,
  artikel_id: `art-${r.nr}`,
  hoeveelheid: r.qty,
  sort_order: i,
  actief: true,
  artikel: art(r.nr),
}));

const DEFAULT_TRAFO_REGELS = [
  ["nieuw", "250", null, "26001090", 1, "Trafo"],
  ["nieuw", "400", null, "26001120", 1, "Trafo"],
  ["nieuw", "630", null, "26001150", 1, "Trafo"],
  ["nieuw", null,  null, "20019629", 2, "Trafo U-profiel"],
  ["nieuw", null,  null, "20011412", 1, "Trafo afschermplaat"],
  ["nieuw", null,  null, "20019614", 3, "Trafo afschermkap"],
  ["nieuw", null,  null, "20017534", 1, "Trafo soepele verbinding"],
  ["draaien", "250",  null, "20038832", 1, "Aansluitvlag trafo"],
  ["draaien", "400",  null, "20038832", 1, "Aansluitvlag trafo"],
  ["draaien", "630",  null, "20042706", 1, "Aansluitvlag trafo"],
  ["draaien", "1000", null, "20042706", 1, "Aansluitvlag trafo"],
  ["blijft",  "250",  null, "20038832", 1, "Aansluitvlag trafo"],
  ["blijft",  "400",  null, "20038832", 1, "Aansluitvlag trafo"],
  ["blijft",  "630",  null, "20042706", 1, "Aansluitvlag trafo"],
  ["blijft",  "1000", null, "20042706", 1, "Aansluitvlag trafo"],
  [null, null, "7.25", "20044290", 8, "Telcon kabel bevestigingsklem"],
  [null, null, "10",   "20044290", 8, "Telcon kabel bevestigingsklem"],
].map(([actie, kva, kabel, nr, qty, label], i) => ({
  id: `trafo-${i}`,
  conditie_actie: actie as string | null,
  conditie_kva: kva as string | null,
  conditie_kabel_lengte: kabel as string | null,
  artikel_id: `art-${nr}`,
  hoeveelheid: qty as number,
  herkomst_label: label as string,
  sort_order: i,
  actief: true,
  artikel: art(nr as string),
}));

function makeStamdata(o: StamdataOverrides = {}): Stamdata {
  const wrap = <T>(data: T[]) => ({ data, isLoading: false } as unknown as Stamdata["artikelen"]);
  const arts = (o.artikelNummers ?? []).map((n) => art(n));
  return {
    artikelen: wrap(arts),
    rmuConfigs: wrap(o.rmuConfigs ?? []),
    rmuVeldArtikelen: wrap(o.rmuVeldArtikelen ?? []),
    rmuZekeringen: wrap(o.rmuZekeringen ?? []),
    msMofTypes: wrap(o.msMofTypes ?? []),
    msMofMaterialen: wrap(o.msMofMaterialen ?? []),
    lsMofTypes: wrap(o.lsMofTypes ?? []),
    lsMofMaterialen: wrap(o.lsMofMaterialen ?? []),
    standaardTemplates: wrap(o.standaardTemplates ?? []),
    stationVaste: wrap(o.stationVaste ?? []),
    ggiRegels: wrap(o.ggiRegels ?? DEFAULT_GGI_REGELS),
    trafoRegels: wrap(o.trafoRegels ?? DEFAULT_TRAFO_REGELS),
    isLoading: false,
  } as unknown as Stamdata;
}

// Alle artikelnummers die in berekenen.ts als hardcoded constanten voorkomen.
// Door deze altijd in stamdata te zetten resolved findArtNr() naar een echt
// artikel en verschijnt het in de preview met juiste qty.
const ALL_HARDCODED_ARTIKELEN = [
  // RMU / trafo
  "20032539", "20032541",
  "20019483", "20019484", "20019485",
  "20039303", "20039648", "20018032", "20029904", "20029905",
  "20041682", "20041591", "20041593", "20041651",
  "20040681", "20040678", "20043486", "20043756",
  "26001090", "26001120", "26001150",
  "20019629", "20011412", "20019614", "20017534",
  "20038832", "20042706", "20044290",
  // MS kabel
  "20039484", "20027992", "20027989", "20018148", "20036049", "20028640", "20043703",
  // LS / LS-rek
  "20009692", "20018004", "20042042", "20042043",
  "20036622", "20036623", "20036624",
  "20050813", "20050761", "20020042",
  "20001107", "20001108", "20040148", "20040188", "20039993", "20039994", "20040149",
  // Vult kabel
  "20030299", "20030300", "20000986", "20017790", "20042739",
  // GGI
  "20039090", "20041319", "20019149", "20019177", "20029657", "20050552", "20038289",
];

function baseStamdata(extra: StamdataOverrides = {}): Stamdata {
  return makeStamdata({
    artikelNummers: ALL_HARDCODED_ARTIKELEN,
    ...extra,
  });
}

// Compacte projectie voor leesbare snapshots — alleen wat ertoe doet.
function compact(items: ReturnType<typeof berekenPreview>) {
  return items.map((p) => ({
    nr: p.artikel_nummer,
    qty: p.hoeveelheid,
    sectie: p.sectie,
    herkomst: p.herkomst.join(" | "),
  }));
}

// ─── Builders voor sub-structuren ─────────────────────────────────────────

function rmuConfig(overrides: Partial<RmuConfig> = {}): RmuConfig {
  return {
    id: "rmu-1",
    code: "TEST",
    merk: "ABB",
    is_inet: false,
    aantal_velden: 3,
    aantal_f: 1,
    aantal_c: 1,
    aantal_v: 1,
    rmu_artikel_id: null,
    frame_artikel_id: null,
    bodemplaat_artikel_id: null,
    actief: true,
    rmu_artikel: art("RMU-MAIN"),
    frame_artikel: art("RMU-FRAME"),
    bodemplaat_artikel: art("RMU-BODEM"),
    ...overrides,
  };
}

function veld(
  veldType: "F" | "C" | "V",
  nr: number,
  opts: Partial<RmuVeldConfig> = {},
): RmuVeldConfig {
  return {
    id: `v-${veldType}${nr}`,
    veldType,
    veldNummer: nr,
    isReserve: false,
    kabelType: "",
    ...opts,
  };
}

function richting(opts: Partial<MsRichting> = {}): MsRichting {
  return {
    id: `r-${Math.random()}`,
    kanZwaaien: null,
    mofTijdelijk: emptyMofConfig(),
    mofDefinitief: null,
    kabelTraceId: null,
    ...opts,
  };
}

function lsMof(opts: Partial<LsMof> = {}): LsMof {
  return {
    id: `lm-${Math.random()}`,
    type: "verbinding",
    bestaandType: "kunststof",
    hoofdkabelDoorsnede: null,
    hoofdkabelMateriaal: "",
    aantalAftakken: 1,
    aftakDoorsnede: null,
    ringklemArtikelNummer: null,
    ringklemHandmatig: false,
    aantal: 1,
    kanZwaaien: null,
    kabelLengteMeters: 0,
    heeftOversteek: false,
    aantalOversteken: 0,
    oversteekMeters: 0,
    ...opts,
  };
}

function trace(opts: Partial<MsKabelTrace> = {}): MsKabelTrace {
  return {
    id: `t-${Math.random()}`,
    kabelType: "",
    lengteMeters: 0,
    heeftOversteek: false,
    aantalOversteken: 0,
    oversteekMeters: 0,
    ...opts,
  };
}

// ─── Scenario's ────────────────────────────────────────────────────────────

describe("berekenPreview — snapshot regressies", () => {
  it("01 NSA renovatie leeg → alleen lege output (geen templates/station)", () => {
    const cfg: MaterialenConfig = { ...emptyConfig(), subType: "renovatie_nsa" };
    expect(compact(berekenPreview(cfg, baseStamdata(), "NSA"))).toMatchSnapshot();
  });

  it("02 NSA renovatie + trafo nieuw 400kVA + vultkabel 5m", () => {
    const cfg: MaterialenConfig = {
      ...emptyConfig(),
      subType: "renovatie_nsa",
      trafoActie: "nieuw",
      trafoKva: "400",
      vultKabelAfstand: 5,
    };
    expect(compact(berekenPreview(cfg, baseStamdata(), "NSA"))).toMatchSnapshot();
  });

  it("03 Compact station — LS-rek mespatroon + LS zekeringen + K56 U", () => {
    const cfg: MaterialenConfig = {
      ...emptyConfig(),
      subType: "cs_zonder_prov",
      isCompactStation: true,
      trafoKva: "630",
      lsRekAanSluitenKabels: 4,
      lsRekAantalBeveiligingen: 2,
      lsRekBeveiligingen: ["20036622", "20036623"],
    };
    expect(compact(berekenPreview(cfg, baseStamdata(), "compact"))).toMatchSnapshot();
  });

  it("04 Renovatie NSA — LS-rek vervangen 8 richtingen + extra stroken + OV 35A", () => {
    const cfg: MaterialenConfig = {
      ...emptyConfig(),
      subType: "renovatie_nsa",
      trafoKva: "400",
      lsRekActie: "vervangen",
      lsRekType: "8",
      lsRekExtraStroken: 2,
      lsRekAanSluitenKabels: 3,
      lsRekOvStuurpunt: true,
      lsRekSchroefpatroon: "35A",
      lsRekAantalBeveiligingen: 1,
      lsRekBeveiligingen: ["20036623"],
    };
    expect(compact(berekenPreview(cfg, baseStamdata(), "NSA"))).toMatchSnapshot();
  });

  it("05 Renovatie NSA — LS-rek gehandhaafd + beveiliging aanpassen 250kVA", () => {
    const cfg: MaterialenConfig = {
      ...emptyConfig(),
      subType: "renovatie_nsa",
      trafoKva: "250",
      lsRekActie: "gehandhaafd",
      lsRekBeveiligingAanpassen: true,
      lsRekAantalBeveiligingen: 1,
      lsRekBeveiligingen: ["20036622"],
    };
    expect(compact(berekenPreview(cfg, baseStamdata(), "NSA"))).toMatchSnapshot();
  });

  it("06 Renovatie prov — Magnefix RMU 1F+2C, trafokabel 7.25m, 400kVA", () => {
    const cfg: MaterialenConfig = {
      ...emptyConfig(),
      subType: "renovatie_prov",
      rmuMerk: "Magnefix",
      rmuConfig: rmuConfig({ merk: "Magnefix", aantal_velden: 3, aantal_f: 1, aantal_c: 2, aantal_v: 0 }),
      rmuVelden: [veld("F", 1), veld("C", 1), veld("C", 2)],
      trafoKva: "400",
      trafoKabelLengte: "7.25",
    };
    expect(compact(berekenPreview(cfg, baseStamdata(), "provisorium"))).toMatchSnapshot();
  });

  it("07 Renovatie prov — ABB RMU 1F, 250kVA, trafokabel 10m", () => {
    const cfg: MaterialenConfig = {
      ...emptyConfig(),
      subType: "renovatie_prov",
      rmuMerk: "ABB",
      rmuConfig: rmuConfig({ merk: "ABB", aantal_velden: 1, aantal_f: 1, aantal_c: 0, aantal_v: 0 }),
      rmuVelden: [veld("F", 1)],
      trafoKva: "250",
      trafoKabelLengte: "10",
    };
    expect(compact(berekenPreview(cfg, baseStamdata(), "provisorium"))).toMatchSnapshot();
  });

  it("08 Renovatie prov — ABB CV 240AL + 630AL V-veld inet (ombouwset 20043486)", () => {
    const cfg: MaterialenConfig = {
      ...emptyConfig(),
      subType: "renovatie_prov",
      rmuMerk: "ABB",
      rmuInet: "ja",
      rmuConfig: rmuConfig({ merk: "ABB", is_inet: true, aantal_velden: 3, aantal_f: 1, aantal_c: 1, aantal_v: 1 }),
      rmuVelden: [
        veld("F", 1),
        veld("C", 1, { kabelType: "240AL" }),
        veld("V", 1, { kabelType: "630AL" }),
      ],
      trafoKva: "400",
    };
    expect(compact(berekenPreview(cfg, baseStamdata(), "provisorium"))).toMatchSnapshot();
  });

  it("09 Renovatie prov — ABB 630AL V-veld NIET-inet (ombouwset 20043756)", () => {
    const cfg: MaterialenConfig = {
      ...emptyConfig(),
      subType: "renovatie_prov",
      rmuMerk: "ABB",
      rmuInet: "nee",
      rmuConfig: rmuConfig({ merk: "ABB", is_inet: false, aantal_velden: 2, aantal_f: 1, aantal_c: 0, aantal_v: 1 }),
      rmuVelden: [veld("F", 1), veld("V", 1, { kabelType: "630AL" })],
      trafoKva: "400",
    };
    expect(compact(berekenPreview(cfg, baseStamdata(), "provisorium"))).toMatchSnapshot();
  });

  it("10 CS met prov — Magnefix provisorium + in-bedrijfname 3 MS + 2 LS", () => {
    const cfg: MaterialenConfig = {
      ...emptyConfig(),
      subType: "cs_met_prov",
      isCompactStation: true,
      provRmuMerk: "Magnefix",
      provRmuConfig: rmuConfig({ merk: "Magnefix" }),
      provRmuVelden: [veld("F", 1)],
      provZekeringKva: "400",
      provInbMsKabels: 3,
      provInbLsKabels: 2,
    };
    expect(compact(berekenPreview(cfg, baseStamdata(), "compact_prov"))).toMatchSnapshot();
  });

  it("11 CS met prov — ABB provisorium + in-bedrijfname 4 MS kabels", () => {
    const cfg: MaterialenConfig = {
      ...emptyConfig(),
      subType: "cs_met_prov",
      isCompactStation: true,
      provRmuMerk: "ABB",
      provRmuConfig: rmuConfig({ merk: "ABB" }),
      provRmuVelden: [veld("F", 1)],
      provZekeringKva: "250",
      provInbMsKabels: 4,
      provInbLsKabels: 0,
    };
    expect(compact(berekenPreview(cfg, baseStamdata(), "compact_prov"))).toMatchSnapshot();
  });

  it("12 Renovatie prov — provRmuConfig=null skipt in-bedrijfname blok volledig", () => {
    const cfg: MaterialenConfig = {
      ...emptyConfig(),
      subType: "renovatie_prov",
      provRmuConfig: null,
      provInbMsKabels: 5,
      provInbLsKabels: 5,
    };
    expect(compact(berekenPreview(cfg, baseStamdata(), "provisorium"))).toMatchSnapshot();
  });

  it("13 Compact prov — Magnefix in-bedrijfname 1 kabel → doos altijd 1", () => {
    const cfg: MaterialenConfig = {
      ...emptyConfig(),
      subType: "cs_met_prov",
      isCompactStation: true,
      provRmuMerk: "Magnefix",
      provRmuConfig: rmuConfig({ merk: "Magnefix" }),
      provInbMsKabels: 1,
    };
    expect(compact(berekenPreview(cfg, baseStamdata(), "compact_prov"))).toMatchSnapshot();
  });

  it("14 MS kabel trace 240AL singel 50m + oversteek 12m × 2", () => {
    const cfg: MaterialenConfig = {
      ...emptyConfig(),
      subType: "renovatie_nsa",
      msKabelTraces: [
        trace({
          kabelType: "240AL_singel",
          lengteMeters: 50,
          heeftOversteek: true,
          aantalOversteken: 2,
          oversteekMeters: 12,
        }),
      ],
    };
    expect(compact(berekenPreview(cfg, baseStamdata(), "NSA"))).toMatchSnapshot();
  });

  it("15 MS kabel trace 3x240AL 80m geen oversteek", () => {
    const cfg: MaterialenConfig = {
      ...emptyConfig(),
      subType: "renovatie_nsa",
      msKabelTraces: [trace({ kabelType: "3x240AL", lengteMeters: 80 })],
    };
    expect(compact(berekenPreview(cfg, baseStamdata(), "NSA"))).toMatchSnapshot();
  });

  it("16 LS moffen actief — aftakmof + ringklem + kabel 20m", () => {
    const cfg: MaterialenConfig = {
      ...emptyConfig(),
      subType: "renovatie_nsa",
      lsMoffenActief: true,
      lsMoffen: [
        lsMof({
          type: "aftakmof",
          bestaandType: "kunststof",
          ringklemArtikelNummer: "20041574",
          aantalAftakken: 2,
          aantal: 1,
          kabelLengteMeters: 20,
        }),
      ],
    };
    // 20041574 is een ringklem-artikel, niet in default hardcoded lijst — toevoegen
    const sd = baseStamdata({ artikelNummers: [...ALL_HARDCODED_ARTIKELEN, "20041574"] });
    expect(compact(berekenPreview(cfg, sd, "NSA"))).toMatchSnapshot();
  });

  it("17 GGI vervangen bij renovatie_nsa → 7 artikelen vaste hoeveelheden", () => {
    const cfg: MaterialenConfig = {
      ...emptyConfig(),
      subType: "renovatie_nsa",
      ggiVervangen: true,
    };
    expect(compact(berekenPreview(cfg, baseStamdata(), "NSA"))).toMatchSnapshot();
  });

  it("18 Trafo actie=draaien 250kVA → aansluitvlag 20038832", () => {
    const cfg: MaterialenConfig = {
      ...emptyConfig(),
      subType: "renovatie_nsa",
      trafoActie: "draaien",
      trafoKva: "250",
    };
    expect(compact(berekenPreview(cfg, baseStamdata(), "NSA"))).toMatchSnapshot();
  });

  it("19 Trafo actie=blijft 1000kVA → aansluitvlag 20042706", () => {
    const cfg: MaterialenConfig = {
      ...emptyConfig(),
      subType: "renovatie_nsa",
      trafoActie: "blijft",
      trafoKva: "1000",
    };
    expect(compact(berekenPreview(cfg, baseStamdata(), "NSA"))).toMatchSnapshot();
  });

  it("20 MS richting niet-prov (renovatie_nsa) zonder mof → geen MS verbindingen", () => {
    const cfg: MaterialenConfig = {
      ...emptyConfig(),
      subType: "renovatie_nsa",
      msRichtingen: [richting()],
    };
    expect(compact(berekenPreview(cfg, baseStamdata(), "NSA"))).toMatchSnapshot();
  });
});
