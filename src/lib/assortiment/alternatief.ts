import { supabase } from "@/integrations/supabase/client";
import { ARTIKEL_REFS, berekenImpact, type ImpactPerArtikel } from "./impact";

/** Splits "20039090 20041319" → ["20039090","20041319"]. Negeert lege tokens. */
export function splitAlternatieven(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tok of raw.split(/\s+/)) {
    const t = tok.trim();
    if (!t || seen.has(t)) continue;
    if (!/^\d{6,}$/.test(t)) continue; // alleen artikelnummer-achtige tokens
    seen.add(t);
    out.push(t);
  }
  return out;
}

export interface AlternatiefKandidaat {
  artikel_nummer: string;
  /** null als kandidaat niet in DB voorkomt. */
  artikel_id: string | null;
  actief: boolean;
  omschrijving: string | null;
}

export interface AlternatiefVoorstel {
  oud_id: string;
  oud_nummer: string;
  oud_omschrijving: string;
  /** Alle kandidaten uit het `alternatief_artikel_nummer`-veld (kan 0, 1 of meer zijn). */
  kandidaten: AlternatiefKandidaat[];
  /** Default gekozen kandidaat: enige actieve. null als 0 of >1 actief. */
  gekozen_nummer: string | null;
  impact: ImpactPerArtikel;
}

/**
 * Verzamel alle inactieve artikelen die een alternatief_artikel_nummer hebben
 * en bouw per voorstel een impact-overzicht + kandidaten-lijst. Doet géén
 * database-writes.
 *
 * Bij meerdere kandidaten:
 *  - precies 1 actief → `gekozen_nummer` wordt die kandidaat (auto-keuze)
 *  - 0 of >1 actief → `gekozen_nummer` = null; UI moet de engineer laten kiezen
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

  // Verzamel alle unieke kandidaat-nummers over alle voorstellen.
  const alleNummers = new Set<string>();
  for (const k of list) {
    for (const n of splitAlternatieven(k.alternatief_artikel_nummer as string)) {
      alleNummers.add(n);
    }
  }
  const altByNr = new Map<string, AlternatiefKandidaat>();
  if (alleNummers.size > 0) {
    const { data: alts } = await supabase
      .from("artikelen")
      .select("id, artikel_nummer, korte_omschrijving, actief")
      .in("artikel_nummer", [...alleNummers]);
    for (const a of alts ?? []) {
      altByNr.set(a.artikel_nummer as string, {
        artikel_nummer: a.artikel_nummer as string,
        artikel_id: a.id as string,
        actief: !!a.actief,
        omschrijving: a.korte_omschrijving as string,
      });
    }
  }

  const impactList = await berekenImpact(list.map((k) => k.id as string));
  const impactById = new Map(impactList.map((i) => [i.artikel_id, i]));

  const voorstellen: AlternatiefVoorstel[] = [];
  for (const k of list) {
    const nummers = splitAlternatieven(k.alternatief_artikel_nummer as string);
    const kand: AlternatiefKandidaat[] = nummers.map(
      (n) =>
        altByNr.get(n) ?? {
          artikel_nummer: n,
          artikel_id: null,
          actief: false,
          omschrijving: null,
        },
    );
    const actieve = kand.filter((c) => c.artikel_id && c.actief);
    const gekozen = actieve.length === 1 ? actieve[0].artikel_nummer : null;
    const impact = impactById.get(k.id as string);
    if (!impact) continue;
    voorstellen.push({
      oud_id: k.id as string,
      oud_nummer: k.artikel_nummer as string,
      oud_omschrijving: k.korte_omschrijving as string,
      kandidaten: kand,
      gekozen_nummer: gekozen,
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
 * Voer migratie uit voor één voorstel met expliciet gekozen kandidaat.
 * Roeper is verantwoordelijk voor het bepalen van `gekozen_nummer` —
 * dit kan de auto-keuze zijn (1 actief kandidaat) of een UI-keuze.
 */
export async function voerAlternatiefMigratieDoor(
  voorstel: AlternatiefVoorstel,
  gekozen_nummer: string,
): Promise<MigratieResultaat> {
  const kandidaat = voorstel.kandidaten.find((c) => c.artikel_nummer === gekozen_nummer);
  if (!kandidaat || !kandidaat.artikel_id) {
    throw new Error(
      `Alternatief ${gekozen_nummer} bestaat niet in de database — migratie geblokkeerd.`,
    );
  }
  if (!kandidaat.actief) {
    throw new Error(
      `Alternatief ${gekozen_nummer} is zelf inactief — migratie geblokkeerd.`,
    );
  }
  const stappen: MigratieStapResultaat[] = [];
  let totaal = 0;
  for (const ref of ARTIKEL_REFS) {
    const { error, count } = await supabase
      .from(ref.tabel as never)
      .update({ [ref.kolom]: kandidaat.artikel_id } as never, { count: "exact" })
      .eq(ref.kolom, voorstel.oud_id);
    if (error) {
      stappen.push({ tabel: ref.tabel, kolom: ref.kolom, success_count: 0, error: error.message });
    } else if ((count ?? 0) > 0) {
      stappen.push({ tabel: ref.tabel, kolom: ref.kolom, success_count: count ?? 0 });
      totaal += count ?? 0;
    }
  }
  try {
    const stamp = new Date().toISOString();
    await supabase.from("app_instellingen").upsert({
      sleutel: "laatste_alternatief_migratie",
      waarde: JSON.stringify({
        timestamp: stamp,
        oud_nummer: voorstel.oud_nummer,
        nieuw_nummer: gekozen_nummer,
        totaal_geupdate: totaal,
        stappen,
      }),
      updated_at: stamp,
    });
  } catch {
    /* best-effort logging */
  }
  // Persisteer keuze in alternatief_keuzes — gebruikt door impact- en winkelwagen-UI
  // om later te tonen welk alternatief er bij welk oud nummer is gekozen.
  try {
    await supabase.from("alternatief_keuzes").insert({
      oud_artikel_id: voorstel.oud_id,
      oud_artikel_nummer: voorstel.oud_nummer,
      oud_omschrijving: voorstel.oud_omschrijving,
      nieuw_artikel_id: kandidaat.artikel_id,
      nieuw_artikel_nummer: gekozen_nummer,
      totaal_geupdate: totaal,
      kandidaten: JSON.parse(JSON.stringify(voorstel.kandidaten)),
      stappen: JSON.parse(JSON.stringify(stappen)),
    });
  } catch {
    /* best-effort — keuze persist mag sync niet blokkeren */
  }
  return {
    oud_nummer: voorstel.oud_nummer,
    nieuw_nummer: gekozen_nummer,
    totaal_geupdate: totaal,
    stappen,
  };
}

/** Eén persistente keuze uit `alternatief_keuzes`. */
export interface AlternatiefKeuze {
  oud_artikel_nummer: string;
  nieuw_artikel_nummer: string;
  totaal_geupdate: number;
  created_at: string;
  gekozen_door: string | null;
}

/**
 * Haal de meest recente keuze per oud artikelnummer op. Wordt gebruikt in de
 * impact-tabel (beheer) en de winkelwagen-export-waarschuwing om terug te
 * tonen welk alternatief eerder is gekozen.
 */
export async function getAlternatiefKeuzes(): Promise<Map<string, AlternatiefKeuze>> {
  const { data, error } = await supabase
    .from("alternatief_keuzes")
    .select("oud_artikel_nummer, nieuw_artikel_nummer, totaal_geupdate, created_at, gekozen_door")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) {
    console.warn("[alternatief_keuzes] fetch faalde:", error.message);
    return new Map();
  }
  const out = new Map<string, AlternatiefKeuze>();
  for (const r of data ?? []) {
    const nr = r.oud_artikel_nummer as string;
    if (!out.has(nr)) out.set(nr, r as AlternatiefKeuze);
  }
  return out;
}

/**
 * Handmatige (engineer-gestuurde) vervanging: vervang álle of een subset van
 * verwijzingen naar `oud_id` door `nieuw_id`. Werkt onafhankelijk van het
 * `alternatief_artikel_nummer`-veld — voor de "Zoek & vervang"-workflow in
 * het beheeroverzicht. Persisteert resultaat in `alternatief_keuzes`.
 */
export async function voerHandmatigeVervangingDoor(params: {
  oud_id: string;
  oud_nummer: string;
  oud_omschrijving: string;
  nieuw_id: string;
  nieuw_nummer: string;
  /** Subset van ARTIKEL_REFS; default alle. */
  refs?: { tabel: string; kolom: string }[];
  gekozen_door?: string | null;
  notitie?: string | null;
}): Promise<MigratieResultaat> {
  const refs = params.refs && params.refs.length > 0 ? params.refs : ARTIKEL_REFS;
  const stappen: MigratieStapResultaat[] = [];
  let totaal = 0;
  for (const ref of refs) {
    const { error, count } = await supabase
      .from(ref.tabel as never)
      .update({ [ref.kolom]: params.nieuw_id } as never, { count: "exact" })
      .eq(ref.kolom, params.oud_id);
    if (error) {
      stappen.push({ tabel: ref.tabel, kolom: ref.kolom, success_count: 0, error: error.message });
    } else if ((count ?? 0) > 0) {
      stappen.push({ tabel: ref.tabel, kolom: ref.kolom, success_count: count ?? 0 });
      totaal += count ?? 0;
    }
  }
  try {
    await supabase.from("alternatief_keuzes").insert({
      oud_artikel_id: params.oud_id,
      oud_artikel_nummer: params.oud_nummer,
      oud_omschrijving: params.oud_omschrijving,
      nieuw_artikel_id: params.nieuw_id,
      nieuw_artikel_nummer: params.nieuw_nummer,
      totaal_geupdate: totaal,
      kandidaten: null,
      stappen: JSON.parse(JSON.stringify(stappen)),
      gekozen_door: params.gekozen_door ?? null,
      notitie: params.notitie ?? "handmatige vervanging via beheer-overzicht",
    });
  } catch {
    /* best-effort */
  }
  return {
    oud_nummer: params.oud_nummer,
    nieuw_nummer: params.nieuw_nummer,
    totaal_geupdate: totaal,
    stappen,
  };
}
