// Generieke data-access voor de beheer-CRUD-tabs. De meeste tabs doen een
// vergelijkbare lijst/insert/update/delete op één tabel; die Supabase-mechaniek
// zit hier op één plek zodat de tabs de client niet hoeven te kennen (DIP).
// `as never` op .from(): de Supabase-generics kunnen geen generieke tabelnaam
// resolven — de aanroeper typt het resultaat via de generic <T>.
import { supabase } from "@/integrations/supabase/client";

interface ListOpts {
  /** PostgREST select-string (incl. embeds). Default "*". */
  select?: string;
  /** Kolom(men) om op te sorteren, in volgorde. */
  orderBy?: string | string[];
  /** Filter op actief = true. */
  activeOnly?: boolean;
  /** Losse gelijkheidsfilter [kolom, waarde]. */
  eq?: [string, unknown];
}

export async function listRows<T>(tabel: string, opts: ListOpts = {}): Promise<T[]> {
  const base = supabase.from(tabel as never).select(opts.select ?? "*");
  const withActief = opts.activeOnly ? base.eq("actief", true) : base;
  let q = opts.eq ? withActief.eq(opts.eq[0], opts.eq[1] as never) : withActief;
  const orderCols = opts.orderBy
    ? Array.isArray(opts.orderBy)
      ? opts.orderBy
      : [opts.orderBy]
    : [];
  for (const col of orderCols) q = q.order(col) as typeof q;
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as T[];
}

/** Nieuw (geen id) of update (met id). Payload wordt door de tab voorbereid. */
export async function saveRow(
  tabel: string,
  row: { id?: string } & Record<string, unknown>,
): Promise<void> {
  if (row.id) {
    const { error } = await supabase
      .from(tabel as never)
      .update(row as never)
      .eq("id", row.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from(tabel as never).insert(row as never);
    if (error) throw error;
  }
}

export async function deleteRow(tabel: string, id: string): Promise<void> {
  const { error } = await supabase
    .from(tabel as never)
    .delete()
    .eq("id", id);
  if (error) throw error;
}
