// Data-access laag voor alle configurator-stamdata.
//
// Deze module is de enige plek die de Supabase-tabelnamen, select-strings en
// PostgREST-embeds voor de stamdata kent. De React-hook `useStamdata`
// (queries.ts) hangt af van déze functies in plaats van rechtstreeks van de
// Supabase-client — dat maakt de queries op één plek onderhoudbaar, los
// testbaar (mockbaar) en ontkoppelt de UI van de concrete backend (DIP).
import { supabase } from "@/integrations/supabase/client";

export async function fetchArtikelen() {
  const { data, error } = await supabase.from("artikelen").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function fetchRmuConfigs() {
  const { data, error } = await supabase
    .from("rmu_configuraties")
    .select(
      "*, rmu_artikel:artikelen!rmu_configuraties_rmu_artikel_id_fkey(*), frame_artikel:artikelen!rmu_configuraties_frame_artikel_id_fkey(*), bodemplaat_artikel:artikelen!rmu_configuraties_bodemplaat_artikel_id_fkey(*)",
    )
    .eq("actief", true);
  if (error) throw error;
  return data ?? [];
}

export async function fetchRmuVeldArtikelen() {
  const { data, error } = await supabase
    .from("rmu_veld_artikelen")
    .select("*, artikel:artikel_id(*)");
  if (error) throw error;
  return data ?? [];
}

export async function fetchRmuZekeringen() {
  const { data, error } = await supabase.from("rmu_zekeringen").select("*, artikel:artikel_id(*)");
  if (error) throw error;
  return data ?? [];
}

export async function fetchMsMofTypes() {
  const { data, error } = await supabase
    .from("ms_mof_types")
    .select("*, artikel:artikel_id(*)")
    .eq("actief", true);
  if (error) throw error;
  return data ?? [];
}

export async function fetchMsMofMaterialen() {
  const { data, error } = await supabase
    .from("ms_mof_materialen")
    .select("*, artikel:artikel_id(*)");
  if (error) throw error;
  return data ?? [];
}

export async function fetchLsMofTypes() {
  const { data, error } = await supabase.from("ls_mof_types").select("*").eq("actief", true);
  if (error) throw error;
  return data ?? [];
}

export async function fetchLsMofMaterialen() {
  const { data, error } = await supabase
    .from("ls_mof_materialen")
    .select("*, artikel:artikel_id(*)");
  if (error) throw error;
  return data ?? [];
}

export async function fetchStandaardTemplates(caseType: string) {
  const { data, error } = await supabase
    .from("standaard_materialen_templates")
    .select("*, artikel:artikel_id(*)")
    .eq("case_type", caseType);
  if (error) throw error;
  return data ?? [];
}

export async function fetchStationVaste() {
  const { data, error } = await supabase
    .from("station_vaste_artikelen")
    .select("*, artikel:artikel_id(*)")
    .eq("actief", true);
  if (error) throw error;
  return data ?? [];
}

export async function fetchGgiRegels() {
  const { data, error } = await supabase
    .from("ggi_artikelen")
    .select("*, artikel:artikel_id(*)")
    .eq("actief", true)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function fetchTrafoRegels() {
  const { data, error } = await supabase
    .from("trafo_regels")
    .select("*, artikel:artikel_id(*)")
    .eq("actief", true)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function fetchLsRekRegels() {
  const { data, error } = await supabase
    .from("ls_rek_regels")
    .select("*, artikel:artikel_id(*)")
    .eq("actief", true)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function fetchProvRegels() {
  const { data, error } = await supabase
    .from("prov_regels")
    .select("*, artikel:artikel_id(*)")
    .eq("actief", true)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function fetchMsKabelRegels() {
  const { data, error } = await supabase
    .from("ms_kabel_regels")
    .select("*, artikel:artikel_id(*)")
    .eq("actief", true)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function fetchRmuVeldRegels() {
  const { data, error } = await supabase
    .from("rmu_veld_regels")
    .select("*, artikel:artikel_id(*)")
    .eq("actief", true)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function fetchTrafoVultKabelSpecs() {
  const { data, error } = await supabase
    .from("trafo_vult_kabel")
    .select(
      "*, kabel_artikel:artikelen!trafo_vult_kabel_kabel_artikel_fk(*), perskabelschoen_artikel:artikelen!trafo_vult_kabel_pers_artikel_fk(*), muurbeugel_artikel:artikelen!trafo_vult_kabel_muurbeugel_artikel_fk(*)",
    )
    .eq("actief", true)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

// Eigen (via Beheer aangemaakte) vragen incl. hun regels + artikelen.
// De tabel bestaat pas na de eigen-vragen-migratie; tot die tijd leveren we
// bewust een lege lijst zodat de feature vanzelf verschijnt na de migratie.
export async function fetchMaatwerkVragen() {
  const { data, error } = await supabase
    .from("maatwerk_vragen")
    .select("*, regels:maatwerk_vraag_regels(*, artikel:artikel_id(*))")
    .eq("actief", true)
    .order("sort_order");
  if (error) return [];
  return data ?? [];
}

// Eigen hoofdstukken waarin eigen vragen geplaatst kunnen worden.
export async function fetchMaatwerkHoofdstukken() {
  const { data, error } = await supabase
    .from("maatwerk_hoofdstukken")
    .select("*")
    .eq("actief", true)
    .order("sort_order");
  if (error) return [];
  return data ?? [];
}

export async function fetchLsBeveiligingOpties() {
  // Handmatige join — er is geen FK ls_beveiliging_opties.artikel_id → artikelen.id,
  // dus PostgREST kan geen embed resolven; we joinen in code.
  const { data: opties, error } = await supabase
    .from("ls_beveiliging_opties")
    .select("*")
    .eq("actief", true)
    .order("sort_order");
  if (error) throw error;
  const ids = [...new Set((opties ?? []).map((o) => o.artikel_id).filter(Boolean) as string[])];
  let byId = new Map<
    string,
    { id: string; artikel_nummer: string; korte_omschrijving: string; actief: boolean }
  >();
  if (ids.length > 0) {
    const { data: arts } = await supabase
      .from("artikelen")
      .select("id, artikel_nummer, korte_omschrijving, actief")
      .in("id", ids);
    byId = new Map((arts ?? []).map((a) => [a.id as string, a as never]));
  }
  return (opties ?? []).map((o) => ({
    ...o,
    artikel: o.artikel_id ? (byId.get(o.artikel_id as string) ?? null) : null,
  }));
}
