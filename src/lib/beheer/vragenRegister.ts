import { voorwaardenVoor, type RegelType } from "./regelSamenvatting";

/**
 * Centraal register van alle VASTE configuratorvragen: welke vraag hoort bij
 * welk hoofdstuk, welke antwoorden zijn er, en uit welke tabellen komen de
 * gekoppelde artikelen. Dit is de éne plek waar die kennis staat; het
 * "Vragen & regels"-scherm, en op termijn ook leersysteem en testpaneel,
 * lezen hieruit. Eigen (via Beheer aangemaakte) vragen staan in de database
 * (maatwerk_vragen) en worden hier niet beschreven.
 */

export type VastHoofdstuk = "project" | "provisorium" | "ms" | "trafo" | "ls" | "overig";

export const HOOFDSTUK_LABELS: Record<VastHoofdstuk, string> = {
  project: "Type opdracht",
  provisorium: "Provisorium",
  ms: "MS — Middenspanning",
  trafo: "Trafo & Vult kabel",
  ls: "LS — Laagspanning",
  overig: "Overig",
};

export const VASTE_HOOFDSTUKKEN = Object.keys(HOOFDSTUK_LABELS) as VastHoofdstuk[];

/** Eén weergaveregel van een gekoppelde regel/rij. */
export interface BronRij {
  rijId: string;
  /** Wanneer geldt dit (leesbare conditie). */
  conditie: string;
  artikelNummer: string | null;
  omschrijving: string | null;
  hoeveelheid: string;
  actief: boolean;
}

export interface BronDef {
  key: string;
  label: string;
  tabel: string;
  /** Deep-link naar de bewerk-tab (oude groep-keys; aliassen vangen ze op). */
  beheerGroep: string;
  beheerTab: string;
  select: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: (r: any) => BronRij[];
}

export interface VasteVraagDef {
  key: string;
  label: string;
  hoofdstuk: VastHoofdstuk;
  /** Leesbare antwoordopties. */
  antwoorden: string;
  uitleg?: string;
  bronnen: BronDef[];
}

// ---- map-helpers ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const artVeld = (r: any, veld = "artikel") => ({
  artikelNummer: r[veld]?.artikel_nummer ?? null,
  omschrijving: r[veld]?.korte_omschrijving ?? null,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const qty = (r: any): string =>
  r.hoeveelheid_formule && String(r.hoeveelheid_formule).trim() !== ""
    ? `${r.hoeveelheid_formule} (formule)`
    : String(r.hoeveelheid ?? 1);

const ART_SELECT = "artikel:artikel_id(artikel_nummer, korte_omschrijving)";

/** Mapper voor regel-tabellen die regelSamenvatting kent. */
const regelMap =
  (type: RegelType) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (r: any): BronRij[] => [
    {
      rijId: r.id,
      conditie:
        voorwaardenVoor(type, r)
          .map((c) => `${c.label}: ${c.waarde}`)
          .join(" · ") || "Altijd",
      ...artVeld(r),
      hoeveelheid: qty(r),
      actief: r.actief !== false,
    },
  ];

// ---- bron-definities ----

const B_STANDAARD: BronDef = {
  key: "standaard",
  label: "Standaard materialen",
  tabel: "standaard_materialen_templates",
  beheerGroep: "standaard",
  beheerTab: "standaard",
  select: `*, ${ART_SELECT}`,
  map: (r) => [
    {
      rijId: r.id,
      conditie: `Case type: ${r.case_type}`,
      ...artVeld(r),
      hoeveelheid: String(r.standaard_hoeveelheid ?? 1),
      actief: true,
    },
  ],
};

const B_VAST: BronDef = {
  key: "vast",
  label: "Vaste artikelen per subtype",
  tabel: "station_vaste_artikelen",
  beheerGroep: "standaard",
  beheerTab: "vast",
  select: `*, ${ART_SELECT}`,
  map: (r) => [
    {
      rijId: r.id,
      conditie: `${r.groep ?? "vast"} · ${(r.van_toepassing_bij ?? []).join(", ") || "alle subtypes"}`,
      ...artVeld(r),
      hoeveelheid: String(r.hoeveelheid ?? 1),
      actief: r.actief !== false,
    },
  ],
};

const B_RMU_CONFIG: BronDef = {
  key: "rmu_config",
  label: "RMU configuraties",
  tabel: "rmu_configuraties",
  beheerGroep: "hardware",
  beheerTab: "rmu",
  select:
    "*, rmu_artikel:artikelen!rmu_configuraties_rmu_artikel_id_fkey(artikel_nummer, korte_omschrijving), frame_artikel:artikelen!rmu_configuraties_frame_artikel_id_fkey(artikel_nummer, korte_omschrijving), bodemplaat_artikel:artikelen!rmu_configuraties_bodemplaat_artikel_id_fkey(artikel_nummer, korte_omschrijving)",
  map: (r) => {
    const basis = `${r.merk} ${r.code}${r.is_inet ? " · iNet" : ""} (${r.aantal_velden} velden)`;
    const out: BronRij[] = [];
    for (const [veld, rol] of [
      ["rmu_artikel", "RMU"],
      ["frame_artikel", "frame"],
      ["bodemplaat_artikel", "bodemplaat"],
    ] as const) {
      if (r[veld]) {
        out.push({
          rijId: r.id,
          conditie: `${basis} — ${rol}`,
          ...artVeld(r, veld),
          hoeveelheid: "1",
          actief: r.actief !== false,
        });
      }
    }
    return out.length > 0
      ? out
      : [
          {
            rijId: r.id,
            conditie: basis,
            artikelNummer: null,
            omschrijving: null,
            hoeveelheid: "-",
            actief: r.actief !== false,
          },
        ];
  },
};

const B_RMU_VELD_ART: BronDef = {
  key: "rmu_veld_art",
  label: "RMU veld artikelen",
  tabel: "rmu_veld_artikelen",
  beheerGroep: "hardware",
  beheerTab: "rmu",
  select: `*, ${ART_SELECT}`,
  map: (r) => [
    {
      rijId: r.id,
      conditie: `${r.merk} · veld ${r.veld_type}${r.is_inet ? " · iNet" : ""}`,
      ...artVeld(r),
      hoeveelheid: qty(r),
      actief: true,
    },
  ],
};

const B_RMU_ZEKERING: BronDef = {
  key: "rmu_zekering",
  label: "RMU zekeringen",
  tabel: "rmu_zekeringen",
  beheerGroep: "hardware",
  beheerTab: "rmu",
  select: `*, ${ART_SELECT}`,
  map: (r) => [
    {
      rijId: r.id,
      conditie: `${r.merk} · ${r.trafo_kva} kVA`,
      ...artVeld(r),
      hoeveelheid: String(r.hoeveelheid ?? 1),
      actief: true,
    },
  ],
};

const B_INET: BronDef = {
  key: "inet",
  label: "I-Net standaardset",
  tabel: "inet_default_artikelen",
  beheerGroep: "hardware",
  beheerTab: "inet",
  select: "*",
  map: (r) => [
    {
      rijId: r.id,
      conditie: "I-Net = ja",
      artikelNummer: r.artikel_nummer,
      omschrijving: null,
      hoeveelheid: String(r.hoeveelheid ?? 1),
      actief: r.actief !== false,
    },
  ],
};

const B_MS_MOF_TYPES: BronDef = {
  key: "ms_mof_types",
  label: "MS mof types",
  tabel: "ms_mof_types",
  beheerGroep: "hardware",
  beheerTab: "ms_mof",
  select: `*, ${ART_SELECT}`,
  map: (r) => [
    {
      rijId: r.id,
      conditie: `${r.code}: ${r.bestaand_type ?? "?"} ${r.bestaand_doorsnede_min ?? ""}-${r.bestaand_doorsnede_max ?? ""} → ${r.nieuwe_type ?? "?"}`,
      ...artVeld(r),
      hoeveelheid: "1",
      actief: r.actief !== false,
    },
  ],
};

const B_MS_MOF_MAT: BronDef = {
  key: "ms_mof_mat",
  label: "MS mof materialen",
  tabel: "ms_mof_materialen",
  beheerGroep: "hardware",
  beheerTab: "ms_mof",
  select: `*, ${ART_SELECT}, mof:mof_type_id(code)`,
  map: (r) => [
    {
      rijId: r.id,
      conditie: `bij mof ${r.mof?.code ?? "?"}`,
      ...artVeld(r),
      hoeveelheid: qty(r),
      actief: true,
    },
  ],
};

const B_LS_MOF_TYPES: BronDef = {
  key: "ls_mof_types",
  label: "LS mof types",
  tabel: "ls_mof_types",
  beheerGroep: "hardware",
  beheerTab: "ls_mof",
  select: "*",
  map: (r) => [
    {
      rijId: r.id,
      conditie: `${r.type} · kabel ${r.bestaand_type}`,
      artikelNummer: null,
      omschrijving: r.omschrijving ?? null,
      hoeveelheid: "-",
      actief: r.actief !== false,
    },
  ],
};

const B_LS_MOF_MAT: BronDef = {
  key: "ls_mof_mat",
  label: "LS mof materialen",
  tabel: "ls_mof_materialen",
  beheerGroep: "hardware",
  beheerTab: "ls_mof",
  select: `*, ${ART_SELECT}, mof:mof_type_id(type, bestaand_type)`,
  map: (r) => [
    {
      rijId: r.id,
      conditie: `bij ${r.mof?.type ?? "?"} (${r.mof?.bestaand_type ?? "?"})`,
      ...artVeld(r),
      hoeveelheid: qty(r),
      actief: true,
    },
  ],
};

const B_RINGKLEM: BronDef = {
  key: "ringklem",
  label: "Ringklemmen",
  tabel: "ringklem_specs",
  beheerGroep: "hardware",
  beheerTab: "ringklemmen",
  select: "*",
  map: (r) => [
    {
      rijId: r.id,
      conditie: `hoofd ${r.hoofdkabel_doorsnede_min}${r.hoofdkabel_doorsnede_min === r.hoofdkabel_doorsnede_max ? "" : `–${r.hoofdkabel_doorsnede_max}`} mm² ${r.hoofdkabel_materiaal} · aftak ${r.aftakkabel_doorsnede_min}–${r.aftakkabel_doorsnede_max} mm²`,
      artikelNummer: r.artikel_nummer,
      omschrijving: r.omschrijving,
      hoeveelheid: "1",
      actief: r.actief !== false,
    },
  ],
};

const B_VULT_KABEL: BronDef = {
  key: "vult_kabel",
  label: "Trafo vult-kabel",
  tabel: "trafo_vult_kabel",
  beheerGroep: "automations",
  beheerTab: "trafo_vult_kabel",
  select:
    "*, kabel_artikel:artikelen!trafo_vult_kabel_kabel_artikel_fk(artikel_nummer, korte_omschrijving), perskabelschoen_artikel:artikelen!trafo_vult_kabel_pers_artikel_fk(artikel_nummer, korte_omschrijving), muurbeugel_artikel:artikelen!trafo_vult_kabel_muurbeugel_artikel_fk(artikel_nummer, korte_omschrijving)",
  map: (r) => {
    const basis = `${r.trafo_kva} kVA — ${r.omschrijving ?? ""}`.trim();
    const out: BronRij[] = [];
    if (r.kabel_artikel)
      out.push({
        rijId: r.id,
        conditie: basis,
        ...artVeld(r, "kabel_artikel"),
        hoeveelheid: `${r.aantal_kabels} × afstand (m)`,
        actief: r.actief !== false,
      });
    if (r.perskabelschoen_artikel)
      out.push({
        rijId: r.id,
        conditie: basis,
        ...artVeld(r, "perskabelschoen_artikel"),
        hoeveelheid: String(r.aantal_perskabelschoenen),
        actief: r.actief !== false,
      });
    if (r.muurbeugel_artikel)
      out.push({
        rijId: r.id,
        conditie: basis,
        ...artVeld(r, "muurbeugel_artikel"),
        hoeveelheid: "1",
        actief: r.actief !== false,
      });
    return out;
  },
};

const bRegel = (
  key: string,
  label: string,
  tabel: string,
  beheerTab: string,
  type: RegelType,
): BronDef => ({
  key,
  label,
  tabel,
  beheerGroep: "automations",
  beheerTab,
  select: `*, ${ART_SELECT}`,
  map: regelMap(type),
});

// ---- het register ----

export const VASTE_VRAGEN: VasteVraagDef[] = [
  {
    key: "type_opdracht",
    label: "Type opdracht (volgt uit case type)",
    hoofdstuk: "project",
    antwoorden: "CS direct · CS via Prov · Renovatie NSA · Renovatie Prov",
    uitleg: "Bepaalt de standaard materialen en de vaste artikelen per subtype.",
    bronnen: [B_STANDAARD, B_VAST],
  },
  {
    key: "prov_rmu",
    label: "Provisorium RMU (merk + configuratie)",
    hoofdstuk: "provisorium",
    antwoorden: "ABB / Siemens / Magnefix + configuratie",
    bronnen: [
      B_RMU_CONFIG,
      bRegel("prov_regels", "Provisorium regels", "prov_regels", "prov_regels", "prov"),
    ],
  },
  {
    key: "prov_zekering",
    label: "Zekering (kVA)",
    hoofdstuk: "provisorium",
    antwoorden: "250 / 400 / 630 / 1000",
    bronnen: [B_RMU_ZEKERING],
  },
  {
    key: "rmu",
    label: "RMU merk, I-Net en configuratie",
    hoofdstuk: "ms",
    antwoorden: "ABB / Siemens / Magnefix · I-Net ja/nee · configuratie",
    bronnen: [B_RMU_CONFIG, B_RMU_VELD_ART, B_INET],
  },
  {
    key: "rmu_velden",
    label: "KV-velden (kabeltype, reserve, positie)",
    hoofdstuk: "ms",
    antwoorden: "per veld: 240AL / 630AL · reserve ja/nee",
    bronnen: [
      bRegel(
        "rmu_veld_regels",
        "RMU veld regels",
        "rmu_veld_regels",
        "rmu_veld_regels",
        "rmu_veld",
      ),
    ],
  },
  {
    key: "ms_moffen",
    label: "MS-richtingen & moffen",
    hoofdstuk: "ms",
    antwoorden: "per richting: kabeltype, doorsnede, moftype, zwaaien",
    bronnen: [B_MS_MOF_TYPES, B_MS_MOF_MAT],
  },
  {
    key: "ms_kabel",
    label: "MS-kabeltracés (type, lengte, oversteek)",
    hoofdstuk: "ms",
    antwoorden: "240AL singel / 630AL singel / 3x240AL + meters",
    bronnen: [
      bRegel(
        "ms_kabel_regels",
        "MS kabel regels",
        "ms_kabel_regels",
        "ms_kabel_regels",
        "ms_kabel",
      ),
    ],
  },
  {
    key: "trafo",
    label: "Trafo (actie + vermogen + kabellengte)",
    hoofdstuk: "trafo",
    antwoorden: "nieuw/blijft/draaien · 250/400/630/1000 kVA · 7,25/10 m",
    bronnen: [bRegel("trafo_regels", "Trafo regels", "trafo_regels", "trafo_regels", "trafo")],
  },
  {
    key: "vult_kabel",
    label: "Vult kabel (afstand in meters)",
    hoofdstuk: "trafo",
    antwoorden: "aantal meters",
    bronnen: [B_VULT_KABEL],
  },
  {
    key: "ls_rek",
    label: "LS-rek (actie, type, schroefpatroon, beveiliging, OV)",
    hoofdstuk: "ls",
    antwoorden: "vervangen/gehandhaafd · 8/12 velden · 35A/50A",
    bronnen: [bRegel("ls_rek_regels", "LS-rek regels", "ls_rek_regels", "lsrek_regels", "ls_rek")],
  },
  {
    key: "ls_moffen",
    label: "LS-moffen (type, kabel, aftakkingen, ringklem)",
    hoofdstuk: "ls",
    antwoorden: "verbinding/aftakmof/eindmof · GPLK/kunststof",
    bronnen: [B_LS_MOF_TYPES, B_LS_MOF_MAT, B_RINGKLEM],
  },
  {
    key: "ggi",
    label: "GGI vervangen",
    hoofdstuk: "overig",
    antwoorden: "ja / nee (alleen bij renovatie)",
    bronnen: [bRegel("ggi_artikelen", "GGI artikelen", "ggi_artikelen", "ggi", "ggi")],
  },
];

export const vasteVragenVoorHoofdstuk = (h: VastHoofdstuk): VasteVraagDef[] =>
  VASTE_VRAGEN.filter((v) => v.hoofdstuk === h);
