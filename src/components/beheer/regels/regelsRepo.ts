// Gedeelde data-access voor de beheer-regeltabs. Alle *_regels-tabs delen
// hetzelfde CRUD-patroon (lijst op sort_order, upsert-op-id, delete); die
// Supabase-mechaniek zit hier op één plek zodat de tabs zelf de client niet
// hoeven te kennen (DIP + DRY).
import { supabase } from "@/integrations/supabase/client";

export type RegelTabel =
  "ggi_artikelen" | "trafo_regels" | "ls_rek_regels" | "prov_regels" | "ms_kabel_regels";

export async function fetchRegels<T>(tabel: RegelTabel): Promise<T[]> {
  // `as never`: de Supabase-generics kunnen geen union van tabelnamen resolven.
  const { data } = await supabase
    .from(tabel as never)
    .select("*")
    .order("sort_order");
  return (data ?? []) as T[];
}

/** Nieuw (geen id) of update (met id). Payload wordt door de tab voorbereid. */
export async function saveRegel(
  tabel: RegelTabel,
  regel: { id?: string } & Record<string, unknown>,
): Promise<void> {
  if (regel.id) {
    const { error } = await supabase
      .from(tabel as never)
      .update(regel as never)
      .eq("id", regel.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from(tabel as never).insert(regel as never);
    if (error) throw error;
  }
}

export async function deleteRegel(tabel: RegelTabel, id: string): Promise<void> {
  const { error } = await supabase
    .from(tabel as never)
    .delete()
    .eq("id", id);
  if (error) throw error;
}
