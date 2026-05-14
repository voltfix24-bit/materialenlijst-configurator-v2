// Domain types voor de materialen configurator

export type SubType = "cs_zonder_prov" | "cs_met_prov" | "renovatie_prov" | "renovatie_nsa" | "";
export type CaseType = "NSA" | "provisorium" | "compact" | "custom";
export type RmuMerk = "ABB" | "Siemens" | "Magnefix" | "";
export type TrafoActie = "nieuw" | "blijft" | "draaien" | "";
export type TrafoKva = "250" | "400" | "630" | "1000" | "";
export type LsRekActie = "vervangen" | "gehandhaafd" | "";
export type MsKabelType = "240AL_singel" | "630AL_singel" | "3x240AL" | "";

export interface MsKabelTrace {
  id: string;
  kabelType: MsKabelType;
  lengteMeters: number;
}

export interface Artikel {
  id: string;
  artikel_nummer: string;
  korte_omschrijving: string;
  eenheid: string;
  categorie: string | null;
  actief: boolean;
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
  kabelLengteMeters: number;
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
  lsRichtingen: number;
  msRichtingen: MsRichting[];
  msKabelTraces: MsKabelTrace[];
  lsMoffenActief: boolean;
  lsMoffen: LsMof[];
  rmuVelden: RmuVeldConfig[];
  iNetArtikelen: INetArtikel[];
}

export interface PreviewItem {
  artikel_id: string;
  artikel_nummer: string;
  korte_omschrijving: string;
  eenheid: string;
  categorie: string;
  hoeveelheid: number;
  niet_bestellen: boolean;
  herkomst: string[];
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
  kabelLengteMeters: 0,
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
  lsRichtingen: 0,
  msRichtingen: [newRichting()],
  msKabelTraces: [],
  lsMoffenActief: false,
  lsMoffen: [],
});
