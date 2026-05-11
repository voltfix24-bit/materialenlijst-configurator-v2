import { supabase } from "@/integrations/supabase/client";
import type { ParsedArtikel } from "./excel";

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

export interface DiffResultaat {
  nieuw: ParsedArtikel[];
  gewijzigd: { huidig: BestaandArtikel; nieuw: ParsedArtikel; veranderingen: string[] }[];
  uitgelopen: BestaandArtikel[]; // staan in DB met actief=true maar niet in nieuwe lijst OF status niet meer Actief
  ongewijzigd: number;
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

export async function berekenDiff(parsed: ParsedArtikel[]): Promise<DiffResultaat> {
  const { data: huidig, error } = await supabase
    .from("artikelen")
    .select("id, artikel_nummer, korte_omschrijving, eenheid, categorie, actief, basis_eenheid, aantal_in_verpakking, status, alternatief_artikel_nummer")
    .limit(10000);
  if (error) throw error;
  const byNum = new Map<string, BestaandArtikel>();
  for (const a of huidig ?? []) byNum.set(a.artikel_nummer, a as BestaandArtikel);

  const nieuw: ParsedArtikel[] = [];
  const gewijzigd: DiffResultaat["gewijzigd"] = [];
  let ongewijzigd = 0;
  const seen = new Set<string>();

  for (const p of parsed) {
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

  // Niet meer in lijst -> markeer inactief (alleen wanneer nu nog actief)
  const uitgelopen: BestaandArtikel[] = [];
  for (const a of huidig ?? []) {
    if (!seen.has(a.artikel_nummer) && a.actief) uitgelopen.push(a as BestaandArtikel);
  }
  return { nieuw, gewijzigd, uitgelopen, ongewijzigd };
}

export async function voerSyncDoor(diff: DiffResultaat, bestandsnaam: string) {
  // 1. nieuwe artikelen invoegen
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
    const { error } = await supabase.from("artikelen").insert(rows);
    if (error) throw error;
  }

  // 2. wijzigingen
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
    if (error) throw error;
  }

  // 3. uitgelopen -> inactief
  if (diff.uitgelopen.length > 0) {
    const ids = diff.uitgelopen.map((a) => a.id);
    const { error } = await supabase
      .from("artikelen")
      .update({ actief: false })
      .in("id", ids);
    if (error) throw error;
  }

  // 4. instelling
  const waarde = `${new Date().toISOString()} | ${bestandsnaam}`;
  await supabase
    .from("app_instellingen")
    .upsert({ sleutel: "laatste_assortiment_sync", waarde, updated_at: new Date().toISOString() });
}
