// Centrale catalogus van hardcoded artikelnummers per domein.
// Fase 1 refactor: geen gedragswijzigingen — alleen named constants i.p.v.
// magic strings verspreid door berekenen.ts.

// ── Trafo kabels ─────────────────────────────────────────────
export const TRAFO_KABEL = {
  L_7_25: "20032539",
  L_10:   "20032541",
} as const;

// ── RMU buispatronen per merk per kVA ────────────────────────
export const BUISPATROON_MAGNEFIX: Record<string, string> = {
  "250": "20019483",
  "400": "20019484",
  "630": "20019485",
};

export const BUISPATROON_ABB_SIEMENS: Record<string, string> = {
  "250": "20041591",
  "400": "20041593",
  "630": "20041651",
};

// ── RMU eindsluitingen / afschermsets ────────────────────────
export const RMU_EINDSLUITING = {
  MAGNEFIX_T_VELD:   "20039303",
  MAGNEFIX_K_VELD:   "20039648",
  MAGNEFIX_AFSCHERM: "20018032",
  MAGNEFIX_DOOS:     "20029905",
  ABB_F_VELD:        "20041682",
  ABB_CV_240AL:      "20040681",
  ABB_CV_630AL:      "20040678",
  OMBOUW_CT_INET:    "20043486",
  OMBOUW_CT_GEEN:    "20043756",
} as const;

// ── Trafo (sectie 3c) ────────────────────────────────────────
export const TRAFO_ARTIKEL: Record<string, string> = {
  "250": "26001090",
  "400": "26001120",
  "630": "26001150",
};

export const TRAFO_NIEUW = {
  U_PROFIEL:         "20019629",
  AFSCHERMPLAAT:     "20011412",
  AFSCHERMKAP:       "20019614",
  SOEPELE_VERBINDING:"20017534",
} as const;

export const TRAFO_AANSLUITVLAG = {
  KVA_250_400: "20038832",
  KVA_630_1000:"20042706",
} as const;

export const TELCON_KABEL_BEVKLEM = "20044290";

// ── MS kabels & oversteek ────────────────────────────────────
export const MS_KABEL = {
  K_240AL_SINGEL: "20039484",
  K_630AL_SINGEL: "20027992",
  K_3X240AL:      "20027989",
  BESCHERMBAND:   "20018148",
  BUIS_SINGEL:    "20036049",
  BUIS_TRIPLE:    "20028640",
  GEOTEXTIEL:     "20043703",
} as const;

// ── LS moffen / kabel / oversteek ────────────────────────────
export const LS_KABEL = "20009692";
export const LS_OVERSTEEK_BUIS = "20028640";
export const LS_OVERSTEEK_GEOTEXTIEL = "20043703";

// ── Vult kabel ───────────────────────────────────────────────
export const VULT_KABEL_MUURBEUGEL = "20042739";

// ── LS-rek ───────────────────────────────────────────────────
export const LS_REK = {
  R_8:        "20050813",
  R_12:       "20050761",
  EXTRA_STRO: "20020042",
  K56_U:      "20042043",
  K56:        "20042042",
  KABELINLEG: "20018004",
} as const;

export const LS_REK_MESPATROON: Record<string, string> = {
  "250": "20036622",
  "400": "20036623",
  "630": "20036624",
};

export const OV_STUURPUNT = {
  SCHROEF_35A: "20001107",
  SCHROEF_50A: "20001108",
  ROUTER:      "20040148",
  ROUTER_BEUG: "20040188",
  FLEX_OV:     "20039993",
  FLEX_BEUG:   "20039994",
  ETHERNET:    "20040149",
} as const;

// ── Provisorium ──────────────────────────────────────────────
// Provisorium gebruikt dezelfde buispatronen als RMU per merk.
export const PROV_BUISPATROON: Record<string, Record<string, string>> = {
  ABB:      BUISPATROON_ABB_SIEMENS,
  Siemens:  BUISPATROON_ABB_SIEMENS,
  Magnefix: BUISPATROON_MAGNEFIX,
};

export const PROV_IN_BEDRIJFNAME = {
  MAGNEFIX_EINDSLUITING: RMU_EINDSLUITING.MAGNEFIX_K_VELD,    // 20039648
  MAGNEFIX_AFSCHERM:     RMU_EINDSLUITING.MAGNEFIX_AFSCHERM,  // 20018032
  MAGNEFIX_DOOS:         RMU_EINDSLUITING.MAGNEFIX_DOOS,      // 20029905
  ABB_EINDSLUITING:      RMU_EINDSLUITING.ABB_CV_240AL,       // 20040681
  LS_KABELINLEG:         LS_REK.KABELINLEG,                   // 20018004
  LS_K56:                LS_REK.K56,                          // 20042042
} as const;

// ── GGI ──────────────────────────────────────────────────────
export const GGI_ARTIKELEN: Array<{ nr: string; qty: number }> = [
  { nr: "20039090", qty: 2 },
  { nr: "20041319", qty: 4 },
  { nr: "20019149", qty: 100 },
  { nr: "20019177", qty: 4 },
  { nr: "20029657", qty: 10 },
  { nr: "20050552", qty: 5 },
  { nr: "20038289", qty: 5 },
];
