// Domain types voor de materialen configurator

export type SubType = "cs_zonder_prov" | "cs_met_prov" | "renovatie_prov" | "renovatie_nsa" | "";
export type CaseType = "NSA" | "provisorium" | "compact" | "custom";
export type RmuMerk = "ABB" | "Siemens" | "Magnefix" | "";
export type TrafoActie = "nieuw" | "blijft" | "draaien" | "";
export type TrafoKva = "250" | "400" | "630" | "1000" | "";
export type LsRekActie = "nieuw" | "gehandhaafd" | "uitbreiding" | "";

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

export interface MsRichting {
  id: string;
  zwaaien: boolean | null; // null = nog niet gekozen, true = zwaaien, false = mof nodig
  bestaand_type: "GPLK" | "XLPE" | "XLPE_singel" | "";
  doorsnede: number | null;
  mof_type_id: string | null;
  mof_handmatig: boolean;
}

export interface LsMof {
  id: string;
  type: "verbinding" | "aftakmof" | "eindmof" | "";
  bestaand_type: "GPLK" | "kunststof" | "";
  aantal: number;
  overzettingen: number;
}

export interface MaterialenConfig {
  subType: SubType;
  rmuMerk: RmuMerk;
  rmuInet: "ja" | "nee" | "";
  rmuConfig: RmuConfig | null;
  trafoActie: TrafoActie;
  trafoKva: TrafoKva;
  vultKabelMeter: number;
  lsRekActie: LsRekActie;
  lsRichtingen: number;
  msRichtingen: MsRichting[];
  lsMoffen: LsMof[];
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
  zwaaien: null,
  bestaand_type: "",
  doorsnede: null,
  mof_type_id: null,
  mof_handmatig: false,
});

export const newLsMof = (): LsMof => ({
  id: crypto.randomUUID(),
  type: "",
  bestaand_type: "",
  aantal: 1,
  overzettingen: 0,
});

export const emptyConfig = (): MaterialenConfig => ({
  subType: "",
  rmuMerk: "",
  rmuInet: "",
  rmuConfig: null,
  trafoActie: "",
  trafoKva: "",
  vultKabelMeter: 0,
  lsRekActie: "",
  lsRichtingen: 0,
  msRichtingen: [newRichting()],
  lsMoffen: [],
});
