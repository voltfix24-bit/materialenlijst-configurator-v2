import { supabase } from "@/integrations/supabase/client";
import { splitAlternatieven } from "./alternatief";

/**
 * Definities van alle plekken in de database waar naar een artikel verwezen wordt.
 * Gebruikt voor impactanalyse vóór een assortiment-sync en voor de
 * alternatief-migratie.
 */
export interface ArtikelRef {
  tabel: string;
  kolom: string;
  /** Beheer-tab-deeplink hint. */
  beheerGroep?: string;
  beheerTab?: string;
}

export const ARTIKEL_REFS: ArtikelRef[] = [
  { tabel: "ggi_artikelen", kolom: "artikel_id", beheerGroep: "standaard", beheerTab: "ggi" },
  { tabel: "trafo_regels", kolom: "artikel_id", beheerGroep: "automations", beheerTab: "trafo_regels" },
  { tabel: "ls_rek_regels", kolom: "artikel_id", beheerGroep: "automations", beheerTab: "lsrek_regels" },
  { tabel: "prov_regels", kolom: "artikel_id", beheerGroep: "automations", beheerTab: "prov_regels" },
  { tabel: "ms_kabel_regels", kolom: "artikel_id", beheerGroep: "automations", beheerTab: "ms_kabel_regels" },
  { tabel: "rmu_veld_regels", kolom: "artikel_id", beheerGroep: "automations", beheerTab: "rmu_veld_regels" },
  { tabel: "rmu_veld_artikelen", kolom: "artikel_id", beheerGroep: "hardware", beheerTab: "rmu" },
  { tabel: "rmu_zekeringen", kolom: "artikel_id", beheerGroep: "hardware", beheerTab: "rmu" },
  { tabel: "ms_mof_materialen", kolom: "artikel_id", beheerGroep: "hardware", beheerTab: "ms_mof" },
  { tabel: "ls_mof_materialen", kolom: "artikel_id", beheerGroep: "hardware", beheerTab: "ls_mof" },
  { tabel: "ms_mof_types", kolom: "artikel_id", beheerGroep: "hardware", beheerTab: "ms_mof" },
  { tabel: "standaard_materialen_templates", kolom: "artikel_id", beheerGroep: "standaard", beheerTab: "standaard" },
  { tabel: "station_vaste_artikelen", kolom: "artikel_id", beheerGroep: "standaard", beheerTab: "vast" },
  { tabel: "rmu_configuraties", kolom: "rmu_artikel_id", beheerGroep: "hardware", beheerTab: "rmu" },
  { tabel: "rmu_configuraties", kolom: "frame_artikel_id", beheerGroep: "hardware", beheerTab: "rmu" },
  { tabel: "rmu_configuraties", kolom: "bodemplaat_artikel_id", beheerGroep: "hardware", beheerTab: "rmu" },
  { tabel: "trafo_vult_kabel", kolom: "kabel_artikel_id", beheerGroep: "automations", beheerTab: "trafo_regels" },
  { tabel: "trafo_vult_kabel", kolom: "perskabelschoen_artikel_id", beheerGroep: "automations", beheerTab: "trafo_regels" },
  { tabel: "trafo_vult_kabel", kolom: "muurbeugel_artikel_id", beheerGroep: "automations", beheerTab: "trafo_regels" },
  // Opgeslagen cases — geen beheer-tab; alleen ter info.
  { tabel: "case_materialen", kolom: "artikel_id" },
];

export interface ImpactGebruik {
  tabel: string;
  kolom: string;
  count: number;
  beheerGroep?: string;
  beheerTab?: string;
}

export interface ImpactPerArtikel {
  artikel_id: string;
  artikel_nummer: string;
  korte_omschrijving: string;
  alternatief_artikel_nummer: string | null;
  /** Of het alternatief in de DB bestaat én actief is. null als geen alternatief. */
  alternatiefBeschikbaar: boolean | null;
  totaal: number;
  gebruikt_in: ImpactGebruik[];
}

interface ArtikelInfo {
  id: string;
  artikel_nummer: string;
  korte_omschrijving: string;
  alternatief_artikel_nummer: string | null;
  actief: boolean;
}

/**
 * Tel per artikel hoeveel rijen in elk van de bekende tabellen/kolommen naar
 * dit artikel verwijzen. Voert per (tabel,kolom) één count-query uit met
 * `.in("kolom", ids)` en haalt dan per artikel-id de exacte breakdown op.
 */
export async function berekenImpact(artikelIds: string[]): Promise<ImpactPerArtikel[]> {
  if (artikelIds.length === 0) return [];

  // Haal artikel-info zodat we artikel_nummer + alternatief kunnen tonen.
  const { data: artikelen, error: artErr } = await supabase
    .from("artikelen")
    .select("id, artikel_nummer, korte_omschrijving, alternatief_artikel_nummer, actief")
    .in("id", artikelIds);
  if (artErr) throw artErr;
  const byId = new Map<string, ArtikelInfo>(
    (artikelen ?? []).map((a) => [a.id as string, a as ArtikelInfo]),
  );

  // Voor alternatief-check: laad alle alternatief-nummers in één query.
  const altNummers = [
    ...new Set(
      (artikelen ?? [])
        .map((a) => a.alternatief_artikel_nummer)
        .filter((s): s is string => !!s),
    ),
  ];
  let altByNr = new Map<string, { id: string; actief: boolean }>();
  if (altNummers.length > 0) {
    const { data: alts } = await supabase
      .from("artikelen")
      .select("id, artikel_nummer, actief")
      .in("artikel_nummer", altNummers);
    altByNr = new Map(
      (alts ?? []).map((a) => [a.artikel_nummer as string, { id: a.id as string, actief: !!a.actief }]),
    );
  }

  // Initialiseer per-artikel buckets
  const out = new Map<string, ImpactPerArtikel>();
  for (const id of artikelIds) {
    const a = byId.get(id);
    if (!a) continue;
    const altNr = a.alternatief_artikel_nummer;
    const altInfo = altNr ? altByNr.get(altNr) : undefined;
    out.set(id, {
      artikel_id: id,
      artikel_nummer: a.artikel_nummer,
      korte_omschrijving: a.korte_omschrijving,
      alternatief_artikel_nummer: altNr,
      alternatiefBeschikbaar: altNr ? !!(altInfo && altInfo.actief) : null,
      totaal: 0,
      gebruikt_in: [],
    });
  }

  // Per (tabel,kolom) één SELECT die alle verwijzende rijen ophaalt, en tel
  // dan in JS per artikel-id. Eén query per kolom houdt totaal aantal queries
  // klein (~19) ongeacht hoeveel artikelen we checken.
  await Promise.all(
    ARTIKEL_REFS.map(async (ref) => {
      const { data, error } = await supabase
        .from(ref.tabel as never)
        .select(ref.kolom)
        .in(ref.kolom, artikelIds);
      if (error) {
        // Niet hard falen — registreer als 0 hits zodat impactanalyse niet stopt.
        console.warn(`[impact] ${ref.tabel}.${ref.kolom}: ${error.message}`);
        return;
      }
      const counts = new Map<string, number>();
      for (const row of (data ?? []) as Array<Record<string, unknown>>) {
        const v = row[ref.kolom];
        if (typeof v !== "string") continue;
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      for (const [id, c] of counts) {
        const bucket = out.get(id);
        if (!bucket) continue;
        bucket.gebruikt_in.push({
          tabel: ref.tabel,
          kolom: ref.kolom,
          count: c,
          beheerGroep: ref.beheerGroep,
          beheerTab: ref.beheerTab,
        });
        bucket.totaal += c;
      }
    }),
  );

  return [...out.values()].sort((a, b) => b.totaal - a.totaal);
}
