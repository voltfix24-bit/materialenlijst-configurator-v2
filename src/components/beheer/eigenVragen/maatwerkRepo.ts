// Data-access voor de eigen-vragen-feature: vragen, hoofdstukken en de
// artikel-regels per antwoord. Houdt de Supabase-mechaniek uit de componenten
// (DIP). fetchHoofdstukken tolereert een ontbrekende tabel (feature verschijnt
// pas na de migratie).
import { supabase } from "@/integrations/supabase/client";
import type { HoofdstukRij, RegelRij, VraagRij } from "./types";

export async function fetchVragen(): Promise<VraagRij[]> {
  const { data, error } = await supabase.from("maatwerk_vragen").select("*").order("sort_order");
  if (error) throw error;
  return data as VraagRij[];
}

export async function saveVraag(vraag: { id?: string } & Record<string, unknown>): Promise<void> {
  if (vraag.id) {
    const { error } = await supabase
      .from("maatwerk_vragen")
      .update(vraag as never)
      .eq("id", vraag.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("maatwerk_vragen").insert(vraag as never);
    if (error) throw error;
  }
}

export async function deleteVraag(id: string): Promise<void> {
  const { error } = await supabase.from("maatwerk_vragen").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchHoofdstukken(): Promise<HoofdstukRij[]> {
  const { data, error } = await supabase
    .from("maatwerk_hoofdstukken")
    .select("*")
    .order("sort_order");
  if (error) return [];
  return data as HoofdstukRij[];
}

export async function addHoofdstuk(naam: string, sortOrder: number): Promise<void> {
  const { error } = await supabase
    .from("maatwerk_hoofdstukken")
    .insert({ naam, sort_order: sortOrder });
  if (error) throw error;
}

export async function renameHoofdstuk(id: string, naam: string): Promise<void> {
  const { error } = await supabase.from("maatwerk_hoofdstukken").update({ naam }).eq("id", id);
  if (error) throw error;
}

export async function deleteHoofdstuk(id: string): Promise<void> {
  const { error } = await supabase.from("maatwerk_hoofdstukken").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchVraagRegels(vraagId: string): Promise<RegelRij[]> {
  const { data, error } = await supabase
    .from("maatwerk_vraag_regels")
    .select("*")
    .eq("vraag_id", vraagId)
    .order("sort_order");
  if (error) throw error;
  return data as RegelRij[];
}

export async function saveVraagRegel(
  regel: { id?: string } & Record<string, unknown>,
): Promise<void> {
  if (regel.id) {
    const { error } = await supabase
      .from("maatwerk_vraag_regels")
      .update(regel as never)
      .eq("id", regel.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("maatwerk_vraag_regels").insert(regel as never);
    if (error) throw error;
  }
}

export async function deleteVraagRegel(id: string): Promise<void> {
  const { error } = await supabase.from("maatwerk_vraag_regels").delete().eq("id", id);
  if (error) throw error;
}
