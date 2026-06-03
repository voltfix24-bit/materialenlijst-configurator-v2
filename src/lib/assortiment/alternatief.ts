import { supabase } from "@/integrations/supabase/client";
import { ARTIKEL_REFS, berekenImpact, type ImpactPerArtikel } from "./impact";

export interface AlternatiefVoorstel {
  oud_id: string;
  oud_nummer: string;
  oud_omschrijving: string;
  nieuw_nummer: string;
  /** null als alternatief niet bestaat in DB. */
  nieuw_id: string | null;
  nieuw_actief: boolean;
  nieuw_omschrijving: string | null;
  impact: ImpactPerArtikel;
}

/**
 * Verzamel alle inactieve artikelen die een alternatief_artikel_nummer hebben
 * en bouw per voorstel een impact-overzicht. Doet géén database-writes — dit
 * is de "preview"-stap voor de migratie-UI.
 */
export async function voorbereidAlternatiefMigratie(): Promise<AlternatiefVoorstel[]> {
  const { data: kandidaten, error } = await supabase
    .from("artikelen")
    .select("id, artikel_nummer, korte_omschrijving, alternatief_artikel_nummer, actief")
    .not("alternatief_artikel_nummer", "is", null)
    .eq("actief", false)
    .limit(5000);
  if (error) throw error;
  const list = kandidaten ?? [];
  if (list.length === 0) return [];

  const altNummers = [
    ...new Set(list.map((k) => k.alternatief_artikel_nummer as string).filter(Boolean)),
  ];
  const { data: alts } = await supabase
    .from("artikelen")
    .select("id, artikel_nummer, korte_omschrijving, actief")
    .in("artikel_nummer", altNummers);
  const altByNr = new Map(
    (alts ?? []).map((a) => [
      a.artikel_nummer as string,
      { id: a.id as string, actief: !!a.actief, omschrijving: a.korte_omschrijving as string },
    ]),
  );

  const impactList = await berekenImpact(list.map((k) => k.id as string));
  const impactById = new Map(impactList.map((i) => [i.artikel_id, i]));

  const voorstellen: AlternatiefVoorstel[] = [];
  for (const k of list) {
    const altNr = k.alternatief_artikel_nummer as string;
    const alt = altByNr.get(altNr);
    const impact = impactById.get(k.id as string);
    if (!impact) continue;
    voorstellen.push({
      oud_id: k.id as string,
      oud_nummer: k.artikel_nummer as string,
      oud_omschrijving: k.korte_omschrijving as string,
      nieuw_nummer: altNr,
      nieuw_id: alt?.id ?? null,
      nieuw_actief: alt?.actief ?? false,
      nieuw_omschrijving: alt?.omschrijving ?? null,
      impact,
    });
  }
  return voorstellen.sort((a, b) => b.impact.totaal - a.impact.totaal);
}

export interface MigratieStapResultaat {
  tabel: string;
  kolom: string;
  success_count: number;
  error?: string;
}

export interface MigratieResultaat {
  oud_nummer: string;
  nieuw_nummer: string;
  totaal_geupdate: number;
  stappen: MigratieStapResultaat[];
}

/**
 * Voer de daadwerkelijke migratie uit voor één voorstel: update in elke
 * bekende referentie-tabel/kolom waar `oud_id` voorkomt naar `nieuw_id`.
 * Per (tabel,kolom) wordt fouten apart vastgelegd zodat één gefaalde tabel
 * de rest niet blokkeert.
 */
export async function voerAlternatiefMigratieDoor(
  voorstel: AlternatiefVoorstel,
): Promise<MigratieResultaat> {
  if (!voorstel.nieuw_id) {
    throw new Error(
      `Alternatief ${voorstel.nieuw_nummer} bestaat niet in de database — migratie geblokkeerd.`,
    );
  }
  const stappen: MigratieStapResultaat[] = [];
  let totaal = 0;
  for (const ref of ARTIKEL_REFS) {
    const { error, count } = await supabase
      .from(ref.tabel as never)
      .update({ [ref.kolom]: voorstel.nieuw_id } as never, { count: "exact" })
      .eq(ref.kolom, voorstel.oud_id);
    if (error) {
      stappen.push({ tabel: ref.tabel, kolom: ref.kolom, success_count: 0, error: error.message });
    } else if ((count ?? 0) > 0) {
      stappen.push({ tabel: ref.tabel, kolom: ref.kolom, success_count: count ?? 0 });
      totaal += count ?? 0;
    }
  }
  // Log naar app_instellingen — laatste run blijft beschikbaar.
  try {
    const stamp = new Date().toISOString();
    await supabase.from("app_instellingen").upsert({
      sleutel: "laatste_alternatief_migratie",
      waarde: JSON.stringify({
        timestamp: stamp,
        oud_nummer: voorstel.oud_nummer,
        nieuw_nummer: voorstel.nieuw_nummer,
        totaal_geupdate: totaal,
        stappen,
      }),
      updated_at: stamp,
    });
  } catch {
    /* best-effort logging */
  }
  return {
    oud_nummer: voorstel.oud_nummer,
    nieuw_nummer: voorstel.nieuw_nummer,
    totaal_geupdate: totaal,
    stappen,
  };
}
