import { supabase } from "@/integrations/supabase/client";
import type { ParsedArtikel, ParsedVerwijderd, ParseResult } from "./excel";

export interface BestaandArtikel {
  id: string;
  artikel_nummer: string;
  korte_omschrijving: string;
  eenheid: string;
  categorie: string | null;
  actief: boolean;
  basis_eenheid?: string | null;
  aantal_in_verpakking?: number | null;
  status?: string | null;
  alternatief_artikel_nummer?: string | null;
}

/** Eén regel uit "Lijst verwijderd" gekoppeld aan wat we al in de DB hebben. */
export interface VerwijderdMatch {
  parsed: ParsedVerwijderd;
  /** null als artikel niet in DB voorkomt (= alleen registreren, geen DB-actie nodig). */
  huidig: BestaandArtikel | null;
  /** Voorgesteld nieuw alternatief-veld. null = leeg laten. */
  voorgesteld_alternatief: string | null;
  /** True = opvolger uit Lijst verwijderd verschilt van wat al in DB stond. */
  conflict_met_huidig_alt: boolean;
}

export interface DiffResultaat {
  nieuw: ParsedArtikel[];
  gewijzigd: { huidig: BestaandArtikel; nieuw: ParsedArtikel; veranderingen: string[] }[];
  /** Artikelen die in Verbruik ontbreken maar in DB nog actief staan. */
  uitgelopen: BestaandArtikel[];
  /** Artikelen uit sheet "Lijst verwijderd". */
  verwijderd: VerwijderdMatch[];
  ongewijzigd: number;
}

export interface SyncStapFout {
  stap: "insert" | "update" | "deactivate" | "verwijderd" | "logging";
  detail: string;
  artikel_nummer?: string;
}

export interface SyncResult {
  inserted: number;
  updated: number;
  deactivated: number;
  verwijderd_verwerkt: number;
  errors: SyncStapFout[];
}

const ACTIEVE = (s: string | null | undefined) => (s || "").toLowerCase() === "actief";

function vergelijk(huidig: BestaandArtikel, nw: ParsedArtikel): string[] {
  const veld: string[] = [];
  if ((huidig.korte_omschrijving || "") !== nw.korte_omschrijving) veld.push("omschrijving");
  if ((huidig.eenheid || "") !== nw.eenheid) veld.push("eenheid");
  if ((huidig.categorie || "") !== (nw.categorie || "")) veld.push("categorie");
  if ((huidig.status || "") !== nw.status) veld.push("status");
  if ((huidig.basis_eenheid || "") !== (nw.basis_eenheid || "")) veld.push("basis eenheid");
  if ((huidig.aantal_in_verpakking ?? null) !== (nw.aantal_in_verpakking ?? null)) veld.push("verpakking");
  if ((huidig.alternatief_artikel_nummer || "") !== (nw.alternatief_artikel_nummer || "")) veld.push("alternatief");
  const moetActief = ACTIEVE(nw.status);
  if (huidig.actief !== moetActief) veld.push(moetActief ? "weer actief" : "inactief");
  return veld;
}

export async function berekenDiff(parsed: ParseResult): Promise<DiffResultaat> {
  const { data: huidig, error } = await supabase
    .from("artikelen")
    .select("id, artikel_nummer, korte_omschrijving, eenheid, categorie, actief, basis_eenheid, aantal_in_verpakking, status, alternatief_artikel_nummer")
    .limit(20000);
  if (error) throw error;
  const byNum = new Map<string, BestaandArtikel>();
  for (const a of huidig ?? []) byNum.set(a.artikel_nummer, a as BestaandArtikel);

  const nieuw: ParsedArtikel[] = [];
  const gewijzigd: DiffResultaat["gewijzigd"] = [];
  let ongewijzigd = 0;
  const seen = new Set<string>();

  for (const p of parsed.artikelen) {
    seen.add(p.artikel_nummer);
    const h = byNum.get(p.artikel_nummer);
    if (!h) {
      nieuw.push(p);
      continue;
    }
    const v = vergelijk(h, p);
    if (v.length > 0) gewijzigd.push({ huidig: h, nieuw: p, veranderingen: v });
    else ongewijzigd++;
  }

  const verwijderdNummers = new Set(parsed.verwijderd.map((v) => v.artikel_nummer));
  const uitgelopen: BestaandArtikel[] = [];
  for (const a of huidig ?? []) {
    // Artikelen die in Lijst verwijderd staan, vallen onder "verwijderd" — niet onder "uitgelopen".
    if (verwijderdNummers.has(a.artikel_nummer)) continue;
    if (!seen.has(a.artikel_nummer) && a.actief) uitgelopen.push(a as BestaandArtikel);
  }

  const verwijderd: VerwijderdMatch[] = parsed.verwijderd.map((p) => {
    const h = byNum.get(p.artikel_nummer) ?? null;
    const voorgesteld = p.opvolger_nummers.length > 0 ? p.opvolger_nummers.join(" ") : null;
    const huidigAlt = h?.alternatief_artikel_nummer ?? null;
    const conflict =
      !!voorgesteld && !!huidigAlt && huidigAlt.trim() !== voorgesteld.trim();
    return {
      parsed: p,
      huidig: h,
      voorgesteld_alternatief: voorgesteld,
      conflict_met_huidig_alt: conflict,
    };
  });

  return { nieuw, gewijzigd, uitgelopen, verwijderd, ongewijzigd };
}

export async function voerSyncDoor(diff: DiffResultaat, bestandsnaam: string): Promise<SyncResult> {
  const result: SyncResult = {
    inserted: 0,
    updated: 0,
    deactivated: 0,
    verwijderd_verwerkt: 0,
    errors: [],
  };

  // 1. nieuwe artikelen invoegen — per chunk om partial-success te isoleren
  if (diff.nieuw.length > 0) {
    const rows = diff.nieuw.map((p) => ({
      artikel_nummer: p.artikel_nummer,
      korte_omschrijving: p.korte_omschrijving,
      eenheid: p.eenheid,
      categorie: p.categorie,
      basis_eenheid: p.basis_eenheid,
      aantal_in_verpakking: p.aantal_in_verpakking,
      status: p.status,
      alternatief_artikel_nummer: p.alternatief_artikel_nummer,
      actief: ACTIEVE(p.status),
    }));
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { error, count } = await supabase
        .from("artikelen")
        .insert(slice, { count: "exact" });
      if (error) {
        result.errors.push({ stap: "insert", detail: error.message });
      } else {
        result.inserted += count ?? slice.length;
      }
    }
  }

  // 2. wijzigingen — per rij; één rij-failure blokkeert de rest niet
  for (const g of diff.gewijzigd) {
    const { error } = await supabase
      .from("artikelen")
      .update({
        korte_omschrijving: g.nieuw.korte_omschrijving,
        eenheid: g.nieuw.eenheid,
        categorie: g.nieuw.categorie,
        basis_eenheid: g.nieuw.basis_eenheid,
        aantal_in_verpakking: g.nieuw.aantal_in_verpakking,
        status: g.nieuw.status,
        alternatief_artikel_nummer: g.nieuw.alternatief_artikel_nummer,
        actief: ACTIEVE(g.nieuw.status),
      })
      .eq("id", g.huidig.id);
    if (error) {
      result.errors.push({
        stap: "update",
        detail: error.message,
        artikel_nummer: g.huidig.artikel_nummer,
      });
    } else {
      result.updated++;
    }
  }

  // 3. uitgelopen -> inactief + status="Uitgelopen"
  if (diff.uitgelopen.length > 0) {
    const ids = diff.uitgelopen.map((a) => a.id);
    const { error, count } = await supabase
      .from("artikelen")
      .update({ actief: false, status: "Uitgelopen" }, { count: "exact" })
      .in("id", ids);
    if (error) {
      result.errors.push({ stap: "deactivate", detail: error.message });
    } else {
      result.deactivated = count ?? ids.length;
    }
  }

  // 4. verwijderd -> status="Verwijderd", actief=false, alternatief overschrijven
  //    alleen als er nog géén alternatief was OF de waarde uit Lijst verwijderd identiek is.
  //    Conflicten worden in de UI getoond zodat de beheerder een keuze maakt.
  for (const v of diff.verwijderd) {
    if (!v.huidig) continue; // artikel niet in DB — niets te updaten
    const patch: Record<string, unknown> = {
      actief: false,
      status: "Verwijderd",
    };
    const huidigAlt = (v.huidig.alternatief_artikel_nummer ?? "").trim();
    if (v.voorgesteld_alternatief && (!huidigAlt || huidigAlt === v.voorgesteld_alternatief)) {
      patch.alternatief_artikel_nummer = v.voorgesteld_alternatief;
    }
    const { error } = await supabase
      .from("artikelen")
      .update(patch)
      .eq("id", v.huidig.id);
    if (error) {
      result.errors.push({
        stap: "verwijderd",
        detail: error.message,
        artikel_nummer: v.parsed.artikel_nummer,
      });
    } else {
      result.verwijderd_verwerkt++;
    }
  }

  // 5. logging — best-effort
  try {
    const stamp = new Date().toISOString();
    const waarde = `${stamp} | ${bestandsnaam}`;
    await supabase
      .from("app_instellingen")
      .upsert({ sleutel: "laatste_assortiment_sync", waarde, updated_at: stamp });
    await supabase.from("app_instellingen").upsert({
      sleutel: "laatste_assortiment_sync_resultaat",
      waarde: JSON.stringify({
        bestandsnaam,
        timestamp: stamp,
        inserted: result.inserted,
        updated: result.updated,
        deactivated: result.deactivated,
        verwijderd_verwerkt: result.verwijderd_verwerkt,
        errors: result.errors,
      }),
      updated_at: stamp,
    });
  } catch (e) {
    result.errors.push({
      stap: "logging",
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  return result;
}
