/**
 * Gedeelde stamdata-fixtures voor berekenPreview() tests.
 *
 * Bevat:
 * - DEFAULT_*_REGELS: seeds identiek aan de productie-DB voor alle DB-gedreven
 *   secties (GGI, trafo, LS-rek, prov, MS-kabel, RMU-veld, vult-kabel).
 * - ALL_HARDCODED_ARTIKELEN: lijst van artikelnummers die in berekenen/*.ts
 *   nog hardcoded staan; in stamdata gezet zodat findArtNr() ze vindt.
 * - makeStamdata() / baseStamdata(): builders.
 *
 * Wordt gebruikt door:
 *  - berekenen.snapshots.test.ts (gedrag-regressies via snapshots)
 *  - berekenen.coverage.test.ts (dekkingstest per config-veld)
 */
import type { Artikel } from "../types";
import type { Stamdata } from "../queries";

export function art(nummer: string, omschrijving = `Artikel ${nummer}`): Artikel {
  return {
    id: `art-${nummer}`,
    artikel_nummer: nummer,
    korte_omschrijving: omschrijving,
    eenheid: "st",
    categorie: "Test",
    actief: true,
  };
}

export interface StamdataOverrides {
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
  lsRekRegels?: unknown[];
  provRegels?: unknown[];
  msKabelRegels?: unknown[];
  rmuVeldRegels?: unknown[];
  trafoVultKabelSpecs?: unknown[];
}

export const DEFAULT_GGI_REGELS = [
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

export const DEFAULT_TRAFO_REGELS = [
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

export const DEFAULT_LS_REK_REGELS = [
  [false, true, "vervangen",   "8",  null, null, null, null,  "20050813", 1, null,                       "LS-rek 8 richtingen"],
  [false, true, "vervangen",   "12", null, null, null, null,  "20050761", 1, null,                       "LS-rek 12 richtingen"],
  [false, true, "vervangen",   null, null, null, null, null,  "20020042", 1, "lsRekExtraStroken",        "LS-rek extra stroken"],
  [false, true, "vervangen",   null, null, null, null, "250", "20036622", 3, null,                       "LS-rek beveiliging voedende strook"],
  [false, true, "vervangen",   null, null, null, null, "400", "20036623", 3, null,                       "LS-rek beveiliging voedende strook"],
  [false, true, "vervangen",   null, null, null, null, "630", "20036624", 3, null,                       "LS-rek beveiliging voedende strook"],
  [false, true, "gehandhaafd", null, true, null, null, "250", "20036622", 3, null,                       "LS-rek beveiliging aanpassen"],
  [false, true, "gehandhaafd", null, true, null, null, "400", "20036623", 3, null,                       "LS-rek beveiliging aanpassen"],
  [false, true, "gehandhaafd", null, true, null, null, "630", "20036624", 3, null,                       "LS-rek beveiliging aanpassen"],
  [false, true, null,          null, null, true, "35A", null, "20001107", 3, null,                       "OV-stuurpunt schroefpatroon"],
  [false, true, null,          null, null, true, "50A", null, "20001108", 3, null,                       "OV-stuurpunt schroefpatroon"],
  [false, true, null,          null, null, true, null,  null, "20040148", 1, null,                       "OV-stuurpunt router"],
  [false, true, null,          null, null, true, null,  null, "20040188", 1, null,                       "OV-stuurpunt beugel router"],
  [false, true, null,          null, null, true, null,  null, "20039993", 1, null,                       "OV-stuurpunt FlexOV device"],
  [false, true, null,          null, null, true, null,  null, "20039994", 1, null,                       "OV-stuurpunt beugel FlexOV"],
  [false, true, null,          null, null, true, null,  null, "20040149", 1, null,                       "OV-stuurpunt kabel ethernet"],
  [true,  null, null,          null, null, null, null, "250", "20036622", 3, null,                       "LS-rek beveiliging voedende strook"],
  [true,  null, null,          null, null, null, null, "400", "20036623", 3, null,                       "LS-rek beveiliging voedende strook"],
  [true,  null, null,          null, null, null, null, "630", "20036624", 3, null,                       "LS-rek beveiliging voedende strook"],
  [true,  null, null,          null, null, null, null, null,  "20042043", 1, "lsRekAanSluitenKabels*2",  "LS-rek kabelbevestigingsklem K56 U"],
  [true,  null, null,          null, null, null, null, null,  "20018004", 1, "lsRekAanSluitenKabels",    "LS-rek kabelinlegklem"],
  [false, true, "vervangen",   null, null, null, null, null,  "20042042", 1, "lsRekAanSluitenKabels",    "LS-rek kabelbevestigingsklem K56"],
  [false, true, "vervangen",   null, null, null, null, null,  "20018004", 1, "lsRekAanSluitenKabels",    "LS-rek kabelinlegklem"],
].map(([c, r, a, t, ba, ov, sch, kva, nr, qty, formule, label], i) => ({
  id: `lsrek-${i}`,
  conditie_compact: c as boolean | null,
  conditie_renovatie: r as boolean | null,
  conditie_actie: a as string | null,
  conditie_lsrek_type: t as string | null,
  conditie_beveiliging_aanpassen: ba as boolean | null,
  conditie_ov_stuurpunt: ov as boolean | null,
  conditie_schroefpatroon: sch as string | null,
  conditie_kva: kva as string | null,
  artikel_id: `art-${nr}`,
  hoeveelheid: qty as number,
  hoeveelheid_formule: formule as string | null,
  herkomst_label: label as string,
  sort_order: i,
  actief: true,
  artikel: art(nr as string),
}));

export const DEFAULT_PROV_REGELS = [
  ["20039303", 1, "perFVeld",        "Provisorium T-veld eindsluiting",       "Magnefix", null],
  ["20041682", 1, "perFVeld",        "Provisorium F-veld eindsluiting",       "ABB",      null],
  ["20041682", 1, "perFVeld",        "Provisorium F-veld eindsluiting",       "Siemens",  null],
  ["20019483", 1, "perFVeld*3",      "Provisorium buispatroon",               "Magnefix", "250"],
  ["20019484", 1, "perFVeld*3",      "Provisorium buispatroon",               "Magnefix", "400"],
  ["20019485", 1, "perFVeld*3",      "Provisorium buispatroon",               "Magnefix", "630"],
  ["20041591", 1, "perFVeld*3",      "Provisorium buispatroon",               "ABB",      "250"],
  ["20041593", 1, "perFVeld*3",      "Provisorium buispatroon",               "ABB",      "400"],
  ["20041651", 1, "perFVeld*3",      "Provisorium buispatroon",               "ABB",      "630"],
  ["20041591", 1, "perFVeld*3",      "Provisorium buispatroon",               "Siemens",  "250"],
  ["20041593", 1, "perFVeld*3",      "Provisorium buispatroon",               "Siemens",  "400"],
  ["20041651", 1, "perFVeld*3",      "Provisorium buispatroon",               "Siemens",  "630"],
  ["20039648", 1, "provInbMsKabels", "Prov in-bedrijfname MS eindsluiting",   "Magnefix", null],
  ["20018032", 1, "provInbMsKabels", "Prov in-bedrijfname MS afschermset",    "Magnefix", null],
  ["20029905", 1, "ifInbMsThen1",    "Prov in-bedrijfname MS doos onderdelen","Magnefix", null],
  ["20040681", 1, "provInbMsKabels", "Prov in-bedrijfname MS eindsluiting",   "ABB",      null],
  ["20040681", 1, "provInbMsKabels", "Prov in-bedrijfname MS eindsluiting",   "Siemens",  null],
  ["20018004", 1, "provInbLsKabels", "Prov in-bedrijfname LS kabelinlegklem", null,       null],
  ["20042042", 1, "provInbLsKabels", "Prov in-bedrijfname LS K56 klem",       null,       null],
].map(([nr, qty, formule, label, merk, kva], i) => ({
  id: `prov-${i}`,
  conditie_merk: merk as string | null,
  conditie_kva: kva as string | null,
  artikel_id: `art-${nr}`,
  hoeveelheid: qty as number,
  hoeveelheid_formule: formule as string | null,
  herkomst_label: label as string,
  sort_order: i,
  actief: true,
  artikel: art(nr as string),
}));

export const DEFAULT_MS_KABEL_REGELS = [
  ["240AL_singel", null,  "20039484", 1, "KabelMeters",        "MS kabel"],
  ["630AL_singel", null,  "20027992", 1, "KabelMeters",        "MS kabel"],
  ["3x240AL",      null,  "20027989", 1, "KabelMeters",        "MS kabel"],
  [null,           null,  "20018148", 1, "RollenBeschermband", "MS kabel beschermband"],
  ["240AL_singel", true,  "20036049", 1, "TotaalBuizen",       "MS kabel oversteek"],
  ["630AL_singel", true,  "20036049", 1, "TotaalBuizen",       "MS kabel oversteek"],
  ["3x240AL",      true,  "20028640", 1, "TotaalBuizen",       "MS kabel oversteek"],
  [null,           true,  "20043703", 1, "GeotextielAantal",   "MS kabel oversteek geotextiel"],
].map(([kt, ov, nr, qty, formule, label], i) => ({
  id: `mskab-${i}`,
  conditie_kabel_type: kt as string | null,
  conditie_oversteek: ov as boolean | null,
  artikel_id: `art-${nr}`,
  hoeveelheid: qty as number,
  hoeveelheid_formule: formule as string | null,
  herkomst_label: label as string,
  sort_order: i,
  actief: true,
  artikel: art(nr as string),
}));

export const DEFAULT_RMU_VELD_REGELS = [
  ["Magnefix", null,  "F", null, null, null,    null,  null,   null, null, "20039303", 1, "Magnefix T-veld eindsluiting",              "rmu"],
  ["ABB",      null,  "F", null, null, null,    null,  null,   null, null, "20041682", 1, "RMU F-veld eindsluiting",                   "rmu"],
  ["Siemens",  null,  "F", null, null, null,    null,  null,   null, null, "20041682", 1, "RMU F-veld eindsluiting",                   "rmu"],
  [null,       null,  "F", null, null, null,    null,  "7.25", null, null, "20032539", 1, "Trafo kabel 7,25m",                         "trafo"],
  [null,       null,  "F", null, null, null,    null,  "10",   null, null, "20032541", 1, "Trafo kabel 10m",                           "trafo"],
  ["Magnefix", null,  "F", null, null, null,    "250", null,   null, null, "20019483", 3, "Magnefix buispatroon",                      "rmu"],
  ["Magnefix", null,  "F", null, null, null,    "400", null,   null, null, "20019484", 3, "Magnefix buispatroon",                      "rmu"],
  ["Magnefix", null,  "F", null, null, null,    "630", null,   null, null, "20019485", 3, "Magnefix buispatroon",                      "rmu"],
  ["ABB",      null,  "F", null, null, null,    "250", null,   null, null, "20041591", 3, "RMU buispatroon",                           "rmu"],
  ["ABB",      null,  "F", null, null, null,    "400", null,   null, null, "20041593", 3, "RMU buispatroon",                           "rmu"],
  ["ABB",      null,  "F", null, null, null,    "630", null,   null, null, "20041651", 3, "RMU buispatroon",                           "rmu"],
  ["Siemens",  null,  "F", null, null, null,    "250", null,   null, null, "20041591", 3, "RMU buispatroon",                           "rmu"],
  ["Siemens",  null,  "F", null, null, null,    "400", null,   null, null, "20041593", 3, "RMU buispatroon",                           "rmu"],
  ["Siemens",  null,  "F", null, null, null,    "630", null,   null, null, "20041651", 3, "RMU buispatroon",                           "rmu"],
  ["Magnefix", null,  "C", null, null, null,    null,  null,   null, null, "20039648", 1, "Magnefix K-veld {veldNummer} eindsluiting", "rmu"],
  ["Magnefix", null,  "V", null, null, null,    null,  null,   null, null, "20039648", 1, "Magnefix K-veld {veldNummer} eindsluiting", "rmu"],
  ["Magnefix", null,  "C", null, null, null,    null,  null,   null, null, "20018032", 1, "Magnefix K-veld {veldNummer} afschermset",  "rmu"],
  ["Magnefix", null,  "V", null, null, null,    null,  null,   null, null, "20018032", 1, "Magnefix K-veld {veldNummer} afschermset",  "rmu"],
  ["Magnefix", null,  "C", true, null, null,    null,  null,   null, 2,    "20029904", 1, "Magnefix doos met onderdelen",              "rmu"],
  ["Magnefix", null,  "C", true, null, null,    null,  null,   3,    null, "20029905", 1, "Magnefix doos met onderdelen",              "rmu"],
  ["ABB",      null,  "C", null, false, "240AL", null, null,   null, null, "20040681", 1, "RMU C-veld eindsluiting",                   "rmu"],
  ["ABB",      null,  "V", null, false, "240AL", null, null,   null, null, "20040681", 1, "RMU V-veld eindsluiting",                   "rmu"],
  ["Siemens",  null,  "C", null, false, "240AL", null, null,   null, null, "20040681", 1, "RMU C-veld eindsluiting",                   "rmu"],
  ["Siemens",  null,  "V", null, false, "240AL", null, null,   null, null, "20040681", 1, "RMU V-veld eindsluiting",                   "rmu"],
  ["ABB",      null,  "C", null, false, "630AL", null, null,   null, null, "20040678", 1, "RMU C-veld eindsluiting",                   "rmu"],
  ["ABB",      null,  "V", null, false, "630AL", null, null,   null, null, "20040678", 1, "RMU V-veld eindsluiting",                   "rmu"],
  ["Siemens",  null,  "C", null, false, "630AL", null, null,   null, null, "20040678", 1, "RMU C-veld eindsluiting",                   "rmu"],
  ["Siemens",  null,  "V", null, false, "630AL", null, null,   null, null, "20040678", 1, "RMU V-veld eindsluiting",                   "rmu"],
  ["ABB",      true,  "V", null, false, "630AL", null, null,   null, null, "20043486", 1, "Ombouwset CT 630AL V-veld",                 "rmu"],
  ["Siemens",  true,  "V", null, false, "630AL", null, null,   null, null, "20043486", 1, "Ombouwset CT 630AL V-veld",                 "rmu"],
  ["ABB",      false, "V", null, false, "630AL", null, null,   null, null, "20043756", 1, "Ombouwset CT 630AL V-veld",                 "rmu"],
  ["Siemens",  false, "V", null, false, "630AL", null, null,   null, null, "20043756", 1, "Ombouwset CT 630AL V-veld",                 "rmu"],
].map(([merk, inet, vt, vn1, res, kt, kva, kl, kvmin, kvmax, nr, qty, lbl, sectie], i) => ({
  id: `rmuveld-${i}`,
  conditie_merk: merk as string | null,
  conditie_is_inet: inet as boolean | null,
  conditie_veld_type: vt as string | null,
  conditie_veld_nummer_is_1: vn1 as boolean | null,
  conditie_is_reserve: res as boolean | null,
  conditie_kabel_type: kt as string | null,
  conditie_kva: kva as string | null,
  conditie_trafo_kabel_lengte: kl as string | null,
  conditie_aantal_kv_min: kvmin as number | null,
  conditie_aantal_kv_max: kvmax as number | null,
  artikel_id: `art-${nr}`,
  hoeveelheid: qty as number,
  herkomst_label: lbl as string,
  sectie: sectie as string,
  sort_order: i,
  actief: true,
  artikel: art(nr as string),
}));

export const DEFAULT_VULT_KABEL_SPECS = [
  [250, 4, 185, "20030299", 8,  "20000986", "20042739", "4× 1x185mm² Cu (enkelvoudig)"],
  [400, 4, 300, "20030300", 8,  "20017790", "20042739", "4× 1x300mm² Cu (enkelvoudig)"],
  [630, 8, 185, "20030299", 16, "20000986", "20042739", "8× 1x185mm² Cu (dubbel uitgevoerd)"],
  [1000,8, 300, "20030300", 16, "20017790", "20042739", "8× 1x300mm² Cu (dubbel uitgevoerd)"],
].map(([kva, ak, dn, knr, ap, pnr, mnr, oms], i) => ({
  id: `vk-${i}`,
  trafo_kva: kva as number,
  aantal_kabels: ak as number,
  kabel_doorsnede: dn as number,
  aantal_perskabelschoenen: ap as number,
  omschrijving: oms as string,
  sort_order: i,
  actief: true,
  kabel_artikel: art(knr as string),
  perskabelschoen_artikel: art(pnr as string),
  muurbeugel_artikel: art(mnr as string),
}));

export function makeStamdata(o: StamdataOverrides = {}): Stamdata {
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
    lsRekRegels: wrap(o.lsRekRegels ?? DEFAULT_LS_REK_REGELS),
    provRegels: wrap(o.provRegels ?? DEFAULT_PROV_REGELS),
    msKabelRegels: wrap(o.msKabelRegels ?? DEFAULT_MS_KABEL_REGELS),
    rmuVeldRegels: wrap(o.rmuVeldRegels ?? DEFAULT_RMU_VELD_REGELS),
    trafoVultKabelSpecs: wrap(o.trafoVultKabelSpecs ?? DEFAULT_VULT_KABEL_SPECS),
    isLoading: false,
  } as unknown as Stamdata;
}

export const ALL_HARDCODED_ARTIKELEN = [
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

export function baseStamdata(extra: StamdataOverrides = {}): Stamdata {
  return makeStamdata({
    artikelNummers: ALL_HARDCODED_ARTIKELEN,
    ...extra,
  });
}
