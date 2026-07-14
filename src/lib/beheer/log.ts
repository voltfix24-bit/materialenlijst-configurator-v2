import { supabase } from "@/integrations/supabase/client";

export type LogResultaat = "ok" | "gedeeltelijk" | "fout";

export type LogActie =
  | "assortiment_sync"
  | "vertaaltabel_import"
  | "alternatief_migratie"
  | "handmatige_vervanging"
  | "artikel_aangepast"
  | "regel_aangepast"
  | "standaardmateriaal_aangepast"
  | "alternatief_gekozen"
  | "datakwaliteit_genegeerd"
  | "datakwaliteit_opgelost";

export interface LogInvoer {
  actie: LogActie;
  omschrijving: string;
  artikel_nummer?: string | null;
  tabel?: string | null;
  rij_id?: string | null;
  oude_waarde?: unknown;
  nieuwe_waarde?: unknown;
  aantal_aangepast?: number;
  resultaat?: LogResultaat;
  details?: unknown;
  uitgevoerd_door?: string | null;
}

/**
 * Schrijf een regel naar `beheer_log`. Best-effort: faalt nooit hard, want
 * logging mag de eigenlijke beheeractie nooit blokkeren. Fouten gaan naar
 * de console zodat ze in dev zichtbaar zijn.
 */
export async function logActie(invoer: LogInvoer): Promise<void> {
  try {
    const { error } = await supabase.from("beheer_log").insert({
      actie: invoer.actie,
      omschrijving: invoer.omschrijving,
      artikel_nummer: invoer.artikel_nummer ?? null,
      tabel: invoer.tabel ?? null,
      rij_id: invoer.rij_id ?? null,
      oude_waarde: invoer.oude_waarde === undefined ? null : (invoer.oude_waarde as never),
      nieuwe_waarde: invoer.nieuwe_waarde === undefined ? null : (invoer.nieuwe_waarde as never),
      aantal_aangepast: invoer.aantal_aangepast ?? 0,
      resultaat: invoer.resultaat ?? "ok",
      details: invoer.details === undefined ? null : (invoer.details as never),
      uitgevoerd_door: invoer.uitgevoerd_door ?? null,
    });
    if (error) console.warn("[beheer_log] insert faalde:", error.message);
  } catch (e) {
    console.warn("[beheer_log] onverwachte fout:", e);
  }
}

export const LOG_ACTIE_LABEL: Record<LogActie, string> = {
  assortiment_sync: "Assortimentslijst gesynchroniseerd",
  vertaaltabel_import: "Vertaaltabel geïmporteerd",
  alternatief_migratie: "Alternatief-migratie uitgevoerd",
  handmatige_vervanging: "Artikel handmatig vervangen",
  artikel_aangepast: "Artikel aangepast",
  regel_aangepast: "Regel aangepast",
  standaardmateriaal_aangepast: "Standaardmateriaal aangepast",
  alternatief_gekozen: "Alternatief gekozen",
  datakwaliteit_genegeerd: "Datakwaliteit-melding genegeerd",
  datakwaliteit_opgelost: "Datakwaliteit-melding opgelost",
};
