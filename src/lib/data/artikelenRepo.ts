// Data-access laag voor het artikelen-beheer (CRUD).
//
// De beheer-UI (ArtikelenTab) hangt af van deze functies i.p.v. rechtstreeks
// van de Supabase-client: tabelnaam, filter- en paginatie-logica en de
// insert/update-grens leven hier op één plek (DIP + herbruikbaar/testbaar).
import { supabase } from "@/integrations/supabase/client";

export interface BeheerArtikel {
  id: string;
  artikel_nummer: string;
  korte_omschrijving: string;
  eenheid: string;
  basis_eenheid: string | null;
  aantal_in_verpakking: number | null;
  categorie: string | null;
  status: string | null;
  alternatief_artikel_nummer: string | null;
  actief: boolean;
}

export interface ArtikelZoekParams {
  search: string;
  status: string;
  categorie: string;
  page: number;
  pageSize: number;
}

/** Unieke, niet-lege categorieën — voor het categorie-filter. */
export async function fetchArtikelCategorieen(): Promise<string[]> {
  const { data } = await supabase
    .from("artikelen")
    .select("categorie")
    .not("categorie", "is", null);
  return Array.from(new Set((data ?? []).map((r) => r.categorie).filter(Boolean))) as string[];
}

/** Gepagineerde, gefilterde artikellijst incl. totaalaantal. */
export async function fetchArtikelenPaged(
  params: ArtikelZoekParams,
): Promise<{ rows: BeheerArtikel[]; count: number }> {
  const { search, status, categorie, page, pageSize } = params;
  let q = supabase.from("artikelen").select("*", { count: "exact" }).order("artikel_nummer");
  if (search.trim().length >= 2) {
    const s = search.replace(/[%,]/g, "");
    q = q.or(`artikel_nummer.ilike.%${s}%,korte_omschrijving.ilike.%${s}%`);
  }
  if (status) q = q.eq("status", status);
  if (categorie) q = q.eq("categorie", categorie);
  q = q.range(page * pageSize, page * pageSize + pageSize - 1);
  const { data, count } = await q;
  return { rows: (data ?? []) as BeheerArtikel[], count: count ?? 0 };
}

/** Nieuw artikel (geen id) of update van een bestaand artikel (met id). */
export async function saveArtikel(artikel: Partial<BeheerArtikel>): Promise<void> {
  if (artikel.id) {
    const { error } = await supabase.from("artikelen").update(artikel).eq("id", artikel.id);
    if (error) throw error;
  } else {
    // insert verwacht de gegenereerde Insert-vorm; op de data-grens casten we
    // bewust — de UI valideert nummer + omschrijving vóór het opslaan.
    const { error } = await supabase.from("artikelen").insert(artikel as never);
    if (error) throw error;
  }
}

export async function deleteArtikel(id: string): Promise<void> {
  const { error } = await supabase.from("artikelen").delete().eq("id", id);
  if (error) throw error;
}
