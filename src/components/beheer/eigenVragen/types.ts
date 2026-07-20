export interface VraagRij {
  id: string;
  vraag_key: string;
  label: string;
  uitleg: string | null;
  type: string;
  opties: string[];
  van_toepassing_bij: string[];
  actief: boolean;
  sort_order: number;
  sectie_key: string | null;
  hoofdstuk_id: string | null;
}

export interface HoofdstukRij {
  id: string;
  naam: string;
  sort_order: number;
  actief: boolean;
}

export interface RegelRij {
  id: string;
  vraag_id: string;
  antwoord: string;
  artikel_id: string;
  hoeveelheid: number;
  per_eenheid: boolean;
  actief: boolean;
  sort_order: number;
}

export const TYPE_LABELS: Record<string, string> = {
  ja_nee: "Ja / nee",
  keuze: "Keuzelijst",
  aantal: "Aantal",
};
