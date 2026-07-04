// Domain types voor de materialen configurator

export type SubType = "cs_zonder_prov" | "cs_met_prov" | "renovatie_prov" | "renovatie_nsa" | "";
export type CaseType = "NSA" | "provisorium" | "compact" | "compact_prov";
export type RmuMerk = "ABB" | "Siemens" | "Magnefix" | "";
export type TrafoActie = "nieuw" | "blijft" | "draaien" | "";
export type TrafoKva = "250" | "400" | "630" | "1000" | "";
export type LsRekActie = "vervangen" | "gehandhaafd" | "";
export type MsKabelType = "240AL_singel" | "630AL_singel" | "3x240AL" | "";

export interface MsKabelTrace {
  id: string;
  kabelType: MsKabelType;
  lengteMeters: number;
  heeftOversteek: boolean;
  aantalOversteken: number;
  oversteekMeters: number;
}

export interface Artikel {
  id: string;
  artikel_nummer: string;
  korte_omschrijving: string;
  eenheid: string;
  categorie: string | null;
  actief: boolean;
  alternatief_artikel_nummer?: string | null;
  status?: string | null;
}


export interface RmuConfig {
  id: string;
  code: string;
  merk: string;
  is_inet: boolean;
  aantal_velden: number;
  aantal_f: number;
  aantal_c: number;
  aantal_v: number;
  rmu_artikel_id: string | null;
  frame_artikel_id: string | null;
  bodemplaat_artikel_id: string | null;
  actief: boolean;
  rmu_artikel?: Artikel | null;
  frame_artikel?: Artikel | null;
  bodemplaat_artikel?: Artikel | null;
}

export type KabelType = "GPLK" | "XLPE" | "XLPE_singel" | "";

export interface MsMofConfig {
  bestaandType: KabelType;
  bestaandDoorsnede: number | null;
  nieuwType: KabelType;
  nieuwDoorsnede: number | null;
  mofTypeId: string | null;
  mofHandmatig: boolean;
  isEindmof: boolean;
}

export interface MsRichting {
  id: string;
  kanZwaaien: boolean | null; // null = nog niet gekozen
  mofTijdelijk: MsMofConfig; // bij niet-provisorium gebruikt als de enige mof
  mofDefinitief: MsMofConfig | null; // alleen bij provisorium + niet zwaaien
  kabelTraceId: string | null;
}

export function emptyMofConfig(): MsMofConfig {
  return {
    bestaandType: "",
    bestaandDoorsnede: null,
    nieuwType: "",
    nieuwDoorsnede: null,
    mofTypeId: null,
    mofHandmatig: false,
    isEindmof: false,
  };
}

export type LsMofType = "verbinding" | "aftakmof" | "eindmof" | "";
export type LsKabelType = "GPLK" | "kunststof" | "";

export interface RingklemSpec {
  artikel_nummer: string;
  omschrijving: string;
  hoofdkabel_doorsnede_min: number;
  hoofdkabel_doorsnede_max: number;
  hoofdkabel_materiaal: "Al" | "Cu" | "beide";
  aftakkabel_doorsnede_min: number;
  aftakkabel_doorsnede_max: number;
}

export const RINGKLEM_SPECS: RingklemSpec[] = [
  { artikel_nummer: "20041574", omschrijving: "Ringklem 4x25Cu / 4x6Cu-50Al",            hoofdkabel_doorsnede_min: 25,  hoofdkabel_doorsnede_max: 25,  hoofdkabel_materiaal: "Cu",    aftakkabel_doorsnede_min: 6,  aftakkabel_doorsnede_max: 50 },
  { artikel_nummer: "20000996", omschrijving: "Ringklem 3x35+1x25Cu / 4x6Cu-50Al",       hoofdkabel_doorsnede_min: 35,  hoofdkabel_doorsnede_max: 35,  hoofdkabel_materiaal: "Cu",    aftakkabel_doorsnede_min: 6,  aftakkabel_doorsnede_max: 50 },
  { artikel_nummer: "20017985", omschrijving: "Ringklem 3x50+1x35Cu / 4x6Cu-50Al",       hoofdkabel_doorsnede_min: 50,  hoofdkabel_doorsnede_max: 50,  hoofdkabel_materiaal: "Cu",    aftakkabel_doorsnede_min: 6,  aftakkabel_doorsnede_max: 50 },
  { artikel_nummer: "20041571", omschrijving: "Ringklem 4x35-70Cu & 4x50Al /4x6Cu-50Al", hoofdkabel_doorsnede_min: 35,  hoofdkabel_doorsnede_max: 70,  hoofdkabel_materiaal: "beide", aftakkabel_doorsnede_min: 6,  aftakkabel_doorsnede_max: 50 },
  { artikel_nummer: "20041575", omschrijving: "Ringklem 3x70-95+1x50-70 / 4x6Cu-50Al",   hoofdkabel_doorsnede_min: 70,  hoofdkabel_doorsnede_max: 95,  hoofdkabel_materiaal: "Cu",    aftakkabel_doorsnede_min: 6,  aftakkabel_doorsnede_max: 50 },
  { artikel_nummer: "20041563", omschrijving: "Ringklem 4x150Cu / 4x6Cu-50Al",           hoofdkabel_doorsnede_min: 150, hoofdkabel_doorsnede_max: 150, hoofdkabel_materiaal: "Cu",    aftakkabel_doorsnede_min: 6,  aftakkabel_doorsnede_max: 50 },
  { artikel_nummer: "20041459", omschrijving: "Ringklem 4x95-150Al / 4x6Cu-50Al",        hoofdkabel_doorsnede_min: 95,  hoofdkabel_doorsnede_max: 150, hoofdkabel_materiaal: "Al",    aftakkabel_doorsnede_min: 6,  aftakkabel_doorsnede_max: 50 },
  { artikel_nummer: "20041564", omschrijving: "Ringklem 4x95Al / 4x95Al-150Al",          hoofdkabel_doorsnede_min: 95,  hoofdkabel_doorsnede_max: 95,  hoofdkabel_materiaal: "Al",    aftakkabel_doorsnede_min: 95, aftakkabel_doorsnede_max: 150 },
  { artikel_nummer: "20041565", omschrijving: "Ringklem 4x150Al & 4x120Cu /4x95Al-150Al",hoofdkabel_doorsnede_min: 120, hoofdkabel_doorsnede_max: 150, hoofdkabel_materiaal: "Al",    aftakkabel_doorsnede_min: 95, aftakkabel_doorsnede_max: 150 },
];

export function zoekRingklem(
  hoofdDoorsnede: number,
  hoofdMateriaal: "Al" | "Cu",
  aftakDoorsnede: number,
): RingklemSpec[] {
  return RINGKLEM_SPECS.filter(
    (r) =>
      hoofdDoorsnede >= r.hoofdkabel_doorsnede_min &&
      hoofdDoorsnede <= r.hoofdkabel_doorsnede_max &&
      (r.hoofdkabel_materiaal === "beide" || r.hoofdkabel_materiaal === hoofdMateriaal) &&
      aftakDoorsnede >= r.aftakkabel_doorsnede_min &&
      aftakDoorsnede <= r.aftakkabel_doorsnede_max,
  );
}

export interface LsMof {
  id: string;
  type: LsMofType;
  bestaandType: LsKabelType;
  hoofdkabelDoorsnede: number | null;
  hoofdkabelMateriaal: "Al" | "Cu" | "";
  aantalAftakken: number;
  aftakDoorsnede: number | null;
  ringklemArtikelNummer: string | null;
  ringklemHandmatig: boolean;
  aantal: number;
  kanZwaaien: boolean | null;
  /** Aantal keer dat de mofset opnieuw gemaakt moet worden (extra bovenop de tijdelijke). Default 1. */
  opnieuwAantal: number;
  kabelLengteMeters: number;
  heeftOversteek: boolean;
  aantalOversteken: number;
  oversteekMeters: number;
}

export interface LsKabelTrace {
  id: string;
  lengteMeters: number;
  heeftOversteek: boolean;
  aantalOversteken: number;
  oversteekMeters: number;
}

export interface RmuVeldConfig {
  id: string;
  veldType: "F" | "C" | "V";
  veldNummer: number;
  isReserve: boolean;
  kabelType: "240AL" | "630AL" | "";
}

export interface INetArtikel {
  artikel_nummer: string;
  hoeveelheid: number;
}

export const DEFAULT_INET_ARTIKELEN: INetArtikel[] = [
  { artikel_nummer: "20042523", hoeveelheid: 2 },
  { artikel_nummer: "20016067", hoeveelheid: 2 },
  { artikel_nummer: "20039640", hoeveelheid: 1 },
  { artikel_nummer: "20037549", hoeveelheid: 2 },
  { artikel_nummer: "20015368", hoeveelheid: 2 },
  { artikel_nummer: "20039770", hoeveelheid: 1 },
  { artikel_nummer: "20039779", hoeveelheid: 1 },
];

export function buildRmuVelden(rc: RmuConfig | null): RmuVeldConfig[] {
  if (!rc) return [];
  const velden: RmuVeldConfig[] = [];
  for (let i = 1; i <= rc.aantal_f; i++) {
    velden.push({ id: crypto.randomUUID(), veldType: "F", veldNummer: i, isReserve: false, kabelType: "" });
  }
  for (let i = 1; i <= rc.aantal_c; i++) {
    velden.push({ id: crypto.randomUUID(), veldType: "C", veldNummer: i, isReserve: false, kabelType: "" });
  }
  for (let i = 1; i <= rc.aantal_v; i++) {
    velden.push({ id: crypto.randomUUID(), veldType: "V", veldNummer: i, isReserve: false, kabelType: "" });
  }
  return velden;
}

export interface MaterialenConfig {
  subType: SubType;
  rmuMerk: RmuMerk;
  rmuInet: "ja" | "nee" | "";
  rmuConfig: RmuConfig | null;
  trafoActie: TrafoActie;
  trafoKva: TrafoKva;
  trafoKabelLengte: "7.25" | "10" | "";
  vultKabelAfstand: number;
  lsRekActie: LsRekActie;
  lsRekType: "8" | "12" | "";
  lsRekExtraStroken: number;
  lsRekAanSluitenKabels: number;
  lsRekBeveiligingAanpassen: boolean;
  lsRekOvStuurpunt: boolean;
  lsRekSchroefpatroon: "35A" | "50A" | "";
  lsRekAantalBeveiligingen: number;
  lsRekBeveiligingen: string[];

  msRichtingen: MsRichting[];
  msKabelTraces: MsKabelTrace[];
  lsMoffenActief: boolean;
  lsMoffen: LsMof[];
  lsKabelTraces: LsKabelTrace[];
  rmuVelden: RmuVeldConfig[];
  iNetArtikelen: INetArtikel[];
  isCompactStation: boolean;
  ggiVervangen: boolean;
  provRmuMerk: RmuMerk;
  provRmuConfig: RmuConfig | null;
  provRmuVelden: RmuVeldConfig[];
  provLsMoffenActief: boolean;
  provLsMoffen: LsMof[];
  provZekeringKva: TrafoKva;
  provInbMsKabels: number;
  provInbLsKabels: number;
}

export type PreviewSectie =
  | "standaard"
  | "provisorium"
  | "rmu"
  | "trafo"
  | "vultKabel"
  | "lsRek"
  | "msVerbindingen"
  | "lsVerbindingen"
  | "ggi";

export interface PreviewSectieDef {
  key: PreviewSectie;
  label: string;
  color: string;
  /** Korte uitleg waarom een artikel uit deze sectie komt. */
  uitleg: string;
  /** Deep-link naar beheer: welke groep + tab beheert deze regels. */
  beheerGroep: string;
  beheerTab: string;
}

export const PREVIEW_SECTIE_DEFS: PreviewSectieDef[] = [
  {
    key: "standaard",
    label: "Standaard materialen",
    color: "#7C8089",
    uitleg:
      "Vaste basisset die altijd of bij dit subtype meekomt (NSA/provisorium/renovatie). Hoeveelheid komt uit de standaard-template.",
    beheerGroep: "standaard",
    beheerTab: "standaard",
  },
  {
    key: "provisorium",
    label: "Provisorium",
    color: "#378ADD",
    uitleg:
      "Extra artikelen die nodig zijn voor het provisorium (tijdelijke voeding). Komt uit de provisorium-regels.",
    beheerGroep: "automations",
    beheerTab: "prov_regels",
  },
  {
    key: "rmu",
    label: "RMU",
    color: "#7F77DD",
    uitleg:
      "Basisartikelen van de gekozen RMU (Magnefix/ABB/Siemens) plus extra's per veldtype (T/F/M). Hoeveelheden komen uit de RMU-config en RMU-veld-regels.",
    beheerGroep: "hardware",
    beheerTab: "rmu",
  },
  {
    key: "trafo",
    label: "Trafo",
    color: "#BA7517",
    uitleg:
      "Artikelen die afhangen van het gekozen trafovermogen (250/400/630/1000 kVA). Komt uit de trafo-regels.",
    beheerGroep: "automations",
    beheerTab: "trafo_regels",
  },
  {
    key: "vultKabel",
    label: "Vult kabel",
    color: "#2A7A6F",
    uitleg:
      "Vulkabel-artikelen (kabelschoenen, krimpkousen) per trafo + LS-rek combinatie. Komt uit trafo-vult-kabel-regels.",
    beheerGroep: "automations",
    beheerTab: "trafo_vult_kabel",
  },
  {
    key: "lsRek",
    label: "LS-rek",
    color: "#1D9E75",
    uitleg:
      "Artikelen die horen bij het gekozen LS-rek (smeltinzetten, beveiligingen). Komt uit LS-rek-regels.",
    beheerGroep: "automations",
    beheerTab: "lsrek_regels",
  },
  {
    key: "msVerbindingen",
    label: "MS verbindingen",
    color: "#D85A30",
    uitleg:
      "Mof-artikelen voor MS-kabelverbindingen, gekozen op basis van kabeltype en MS-mof-type. Komt uit MS-kabel-regels en MS-mof-config.",
    beheerGroep: "automations",
    beheerTab: "ms_kabel_regels",
  },
  {
    key: "lsVerbindingen",
    label: "LS verbindingen",
    color: "#534AB7",
    uitleg:
      "Mof-artikelen voor LS-kabelverbindingen (rekvoeding + inblusters), per gekozen LS-mof-type.",
    beheerGroep: "hardware",
    beheerTab: "ls_mof",
  },
  {
    key: "ggi",
    label: "GGI",
    color: "#64748b",
    uitleg:
      "Artikelen die specifiek bij het vervangen van de GGI horen (alleen bij renovatie + GGI-optie aan).",
    beheerGroep: "standaard",
    beheerTab: "ggi",
  },
];

export type BronTabel =
  | "standaard_materialen_templates"
  | "station_vaste_artikelen"
  | "ggi_artikelen"
  | "rmu_configuraties"
  | "rmu_veld_artikelen"
  | "rmu_zekeringen"
  | "rmu_veld_regels"
  | "trafo_regels"
  | "trafo_vult_kabel"
  | "ms_mof_types"
  | "ms_mof_materialen"
  | "ms_kabel_regels"
  | "ls_mof_types"
  | "ls_mof_materialen"
  | "ls_rek_regels"
  | "prov_regels";

export interface BronTabelDef {
  beheerGroep: string;
  beheerTab: string;
  label: string;
}

export const BRON_TABEL_DEFS: Record<BronTabel, BronTabelDef> = {
  standaard_materialen_templates: { beheerGroep: "standaard", beheerTab: "standaard", label: "Standaard materialen" },
  station_vaste_artikelen:        { beheerGroep: "standaard", beheerTab: "vast", label: "Vaste artikelen per subtype" },
  ggi_artikelen:                  { beheerGroep: "standaard", beheerTab: "ggi", label: "GGI artikelen" },
  rmu_configuraties:              { beheerGroep: "hardware",  beheerTab: "rmu", label: "RMU configuratie" },
  rmu_veld_artikelen:             { beheerGroep: "hardware",  beheerTab: "rmu", label: "RMU veld artikelen" },
  rmu_zekeringen:                 { beheerGroep: "hardware",  beheerTab: "rmu", label: "RMU zekeringen" },
  rmu_veld_regels:                { beheerGroep: "automations", beheerTab: "rmu_veld_regels", label: "RMU veld regels" },
  trafo_regels:                   { beheerGroep: "automations", beheerTab: "trafo_regels", label: "Trafo regels" },
  trafo_vult_kabel:               { beheerGroep: "automations", beheerTab: "trafo_vult_kabel", label: "Trafo vult-kabel" },
  ms_mof_types:                   { beheerGroep: "hardware",  beheerTab: "ms_mof", label: "MS mof types" },
  ms_mof_materialen:              { beheerGroep: "hardware",  beheerTab: "ms_mof", label: "MS mof materialen" },
  ms_kabel_regels:                { beheerGroep: "automations", beheerTab: "ms_kabel_regels", label: "MS kabel regels" },
  ls_mof_types:                   { beheerGroep: "hardware",  beheerTab: "ls_mof", label: "LS mof types" },
  ls_mof_materialen:              { beheerGroep: "hardware",  beheerTab: "ls_mof", label: "LS mof materialen" },
  ls_rek_regels:                  { beheerGroep: "automations", beheerTab: "lsrek_regels", label: "LS-rek regels" },
  prov_regels:                    { beheerGroep: "automations", beheerTab: "prov_regels", label: "Provisorium regels" },
};

export interface PreviewBijdrage {
  herkomst: string;
  sectie: PreviewSectie;
  hoeveelheid: number;
  /** Tabel waaruit deze bijdrage komt (voor deep-link naar beheer). */
  bronTabel?: BronTabel;
  /** ID van de specifieke regel/rij in die tabel. */
  bronId?: string;
}

/** Handmatig via de winkelwagen-zoeker toegevoegd artikel (geen berekende bron). */
export interface ToegevoegdArtikel {
  artikel_id: string;
  artikel_nummer: string;
  korte_omschrijving: string;
  eenheid: string;
  hoeveelheid: number;
}

/**
 * Handmatige aanpassingen van de engineer bovenop de berekende preview.
 * Wordt opgeslagen in cases.config_json onder de sleutel "winkelwagen"
 * zodat correcties een herlaad of latere sessie overleven.
 */
export interface WinkelwagenAanpassingen {
  /** artikel_nummer → overschreven hoeveelheid */
  overrides: Record<string, number>;
  /** artikel_nummers die uit de berekende lijst zijn verwijderd */
  verwijderd: string[];
  toegevoegd: ToegevoegdArtikel[];
}

export const legeWinkelwagenAanpassingen = (): WinkelwagenAanpassingen => ({
  overrides: {},
  verwijderd: [],
  toegevoegd: [],
});

export interface PreviewItem {
  artikel_id: string;
  artikel_nummer: string;
  korte_omschrijving: string;
  eenheid: string;
  categorie: string;
  hoeveelheid: number;
  niet_bestellen: boolean;
  herkomst: string[];
  sectie: PreviewSectie;
  bijdragen: PreviewBijdrage[];
  /**
   * True wanneer dit artikel in de DB als inactief is gemarkeerd (komt niet
   * meer voor in de huidige Liander-template). Wordt door berekenen/shared.ts
   * gezet zodat de winkelwagen visueel kan waarschuwen.
   */
  inactief?: boolean;
}

export const newRichting = (): MsRichting => ({
  id: crypto.randomUUID(),
  kanZwaaien: null,
  mofTijdelijk: emptyMofConfig(),
  mofDefinitief: null,
  kabelTraceId: null,
});

export const newLsMof = (): LsMof => ({
  id: crypto.randomUUID(),
  type: "",
  bestaandType: "",
  hoofdkabelDoorsnede: null,
  hoofdkabelMateriaal: "",
  aantalAftakken: 1,
  aftakDoorsnede: null,
  ringklemArtikelNummer: null,
  ringklemHandmatig: false,
  aantal: 1,
  kanZwaaien: null,
  opnieuwAantal: 1,
  kabelLengteMeters: 0,
  heeftOversteek: false,
  aantalOversteken: 1,
  oversteekMeters: 0,
});

export const newLsKabelTrace = (): LsKabelTrace => ({
  id: crypto.randomUUID(),
  lengteMeters: 0,
  heeftOversteek: false,
  aantalOversteken: 1,
  oversteekMeters: 0,
});

export const emptyConfig = (): MaterialenConfig => ({
  subType: "",
  rmuMerk: "",
  rmuInet: "",
  rmuConfig: null,
  trafoActie: "",
  trafoKva: "",
  trafoKabelLengte: "",
  vultKabelAfstand: 0,
  rmuVelden: [],
  iNetArtikelen: [],
  lsRekActie: "",
  lsRekType: "",
  lsRekExtraStroken: 0,
  lsRekAanSluitenKabels: 0,
  lsRekBeveiligingAanpassen: false,
  lsRekOvStuurpunt: false,
  lsRekSchroefpatroon: "",
  lsRekAantalBeveiligingen: 0,
  lsRekBeveiligingen: [],
  msRichtingen: [],
  msKabelTraces: [],
  lsMoffenActief: false,
  lsMoffen: [],
  lsKabelTraces: [],
  isCompactStation: false,
  ggiVervangen: false,
  provRmuMerk: "",
  provRmuConfig: null,
  provRmuVelden: [],
  provLsMoffenActief: false,
  provLsMoffen: [],
  provZekeringKva: "",
  provInbMsKabels: 0,
  provInbLsKabels: 0,
});
