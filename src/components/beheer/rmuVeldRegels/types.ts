export type Regel = {
  id: string;
  conditie_merk: string | null;
  conditie_is_inet: boolean | null;
  conditie_veld_type: string | null;
  conditie_veld_nummer_is_1: boolean | null;
  conditie_is_reserve: boolean | null;
  conditie_kabel_type: string | null;
  conditie_kva: string | null;
  conditie_trafo_kabel_lengte: string | null;
  conditie_aantal_kv_min: number | null;
  conditie_aantal_kv_max: number | null;
  artikel_id: string;
  hoeveelheid: number;
  herkomst_label: string;
  sectie: string;
  sort_order: number;
  actief: boolean;
};

export const MERKEN = ["Magnefix", "ABB", "Siemens"] as const;
export const VELD_TYPES: { v: string; label: string }[] = [
  { v: "F", label: "F-veld (trafo / aftak)" },
  { v: "C", label: "C-veld (kabelaftak met scheider)" },
  { v: "V", label: "V-veld (kabelaftak met vermogensschakelaar)" },
];
export const KABEL_TYPES = ["240AL", "630AL"];
export const KVAS = ["250", "400", "630"];
export const KABEL_LENGTES = ["7.25", "10"];
