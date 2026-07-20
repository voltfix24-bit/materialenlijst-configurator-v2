// Datakwaliteit-engine: verzamelt alle configuratie-/catalogus-checks en
// levert een lijst issues op. Bevat geen React — puur data + logica, zodat de
// DataKwaliteitTab-component enkel presenteert (SRP) en dit los testbaar is.
import { supabase } from "@/integrations/supabase/client";
import { ARTIKEL_REFS } from "@/lib/assortiment/impact";
import { splitAlternatieven } from "@/lib/assortiment/alternatief";
import { ArrowRightLeft, Search } from "lucide-react";

// =====================================================================
// Types
// =====================================================================

export type Severity = "kritiek" | "waarschuwing" | "info" | "ok";
export type Beheergebied =
  "catalogus" | "automations" | "hardware" | "standaard" | "cases" | "liander";

interface Actie {
  label: string;
  icon?: typeof Search;
  to: string;
  search?: Record<string, string>;
}

export interface Issue {
  id: string;
  severity: Severity;
  groep: Beheergebied;
  titel: string;
  probleem: string;
  risico: string;
  actie: string;
  /** Optioneel: artikel-context voor filtering. */
  artikelNummer?: string;
  artikelStatus?: string | null;
  heeftAlternatief?: boolean;
  /** Inklap-details (regel-IDs, telling, etc.). */
  details?: string[];
  acties: Actie[];
}

interface CheckOutput {
  issues: Issue[];
  meta: {
    aantalArtikelen: number;
    laatsteSyncIso: string | null;
    laatsteSyncBestand: string | null;
    artikelenUitloopVerwijderd: number;
  };
  fouten: string[]; // checks die niet uitgevoerd konden worden
}

// =====================================================================
// Helpers
// =====================================================================

export const GROEP_LABEL: Record<Beheergebied, string> = {
  catalogus: "Catalogus",
  automations: "Automations",
  hardware: "Hardware",
  standaard: "Standaard & GGI",
  cases: "Cases / export",
  liander: "Liander sync",
};

export const GROEP_VOLGORDE: Beheergebied[] = [
  "catalogus",
  "automations",
  "hardware",
  "standaard",
  "cases",
  "liander",
];

export const SEVERITY_ORDER: Record<Severity, number> = {
  kritiek: 0,
  waarschuwing: 1,
  info: 2,
  ok: 3,
};

/** Map tabel → (groep, tab) voor deeplinks naar de bestaande beheer-tabs. */
const TABEL_DEEPLINK: Record<string, { groep: string; tab: string }> = {};
for (const ref of ARTIKEL_REFS) {
  if (ref.beheerGroep && ref.beheerTab && !TABEL_DEEPLINK[ref.tabel]) {
    TABEL_DEEPLINK[ref.tabel] = { groep: ref.beheerGroep, tab: ref.beheerTab };
  }
}

const TABEL_LABEL: Record<string, string> = {
  ggi_artikelen: "GGI-artikelen",
  trafo_regels: "Trafo-regels",
  ls_rek_regels: "LS-rek regels",
  prov_regels: "Provisorium-regels",
  ms_kabel_regels: "MS-kabel regels",
  rmu_veld_regels: "RMU-veld regels",
  rmu_veld_artikelen: "RMU-veld artikelen",
  rmu_zekeringen: "RMU-zekeringen",
  ms_mof_materialen: "MS-mof materialen",
  ls_mof_materialen: "LS-mof materialen",
  ms_mof_types: "MS-moftypes",
  standaard_materialen_templates: "Standaard materialen",
  station_vaste_artikelen: "Vaste artikelen per subtype",
  rmu_configuraties: "RMU-configuraties",
  trafo_vult_kabel: "Trafo vult-kabel",
  case_materialen: "Opgeslagen cases (materialen)",
};

interface ArtikelRow {
  id: string;
  artikel_nummer: string;
  korte_omschrijving: string | null;
  actief: boolean;
  status: string | null;
  alternatief_artikel_nummer: string | null;
}

interface RefRow {
  id: string;
  artikel_id: string | null;
  [k: string]: unknown;
}

function statusLabel(status: string | null | undefined, actief: boolean): string {
  if (!actief) return "Inactief";
  const s = (status ?? "").trim();
  return s || "Actief";
}

// =====================================================================
// Checks
// =====================================================================

export async function runChecks(): Promise<CheckOutput> {
  const issues: Issue[] = [];
  const fouten: string[] = [];

  // ---- Artikelen index ----------------------------------------------------
  const { data: artikelen, error: artErr } = await supabase
    .from("artikelen")
    .select("id, artikel_nummer, korte_omschrijving, actief, status, alternatief_artikel_nummer");
  if (artErr) {
    throw new Error(`Kan tabel 'artikelen' niet lezen: ${artErr.message}`);
  }
  const artLijst = (artikelen ?? []) as ArtikelRow[];
  const byId = new Map(artLijst.map((a) => [a.id, a]));
  const byNr = new Map(artLijst.map((a) => [a.artikel_nummer, a]));

  // ---- Dubbele artikelnummers --------------------------------------------
  const nrCounts = new Map<string, number>();
  for (const a of artLijst) {
    nrCounts.set(a.artikel_nummer, (nrCounts.get(a.artikel_nummer) ?? 0) + 1);
  }
  const dupes = [...nrCounts.entries()].filter(([, n]) => n > 1);
  if (dupes.length > 0) {
    issues.push({
      id: "artikelen-dupes",
      severity: "kritiek",
      groep: "catalogus",
      titel: `${dupes.length} dubbel artikelnummer`,
      probleem: "Eén artikelnummer komt meerdere keren voor in de catalogus.",
      risico:
        "De winkelwagen kan het verkeerde artikel kiezen — export naar Liander kan fout gaan.",
      actie: "Open Artikelen-beheer en verwijder of corrigeer de duplicaten.",
      details: dupes.slice(0, 10).map(([nr, n]) => `${nr} (${n}×)`),
      acties: [
        {
          label: "Open Artikelen",
          to: "/beheer",
          search: { groep: "catalogus", tab: "artikelen" },
        },
      ],
    });
  }

  // ---- Per-tabel referentie-checks ---------------------------------------
  // Aggregeer per artikel: in welke tabellen wordt het gebruikt?
  type GebruikPerArt = Map<string, { tabel: string; rowIds: string[] }[]>;
  const gebruikInactief: GebruikPerArt = new Map();
  const gebruikUitgelopen: GebruikPerArt = new Map();
  const gebruikGeblokkeerd: GebruikPerArt = new Map();

  // Unieke (tabel) lijst voor null/dangling checks.
  const tabellen = [...new Set(ARTIKEL_REFS.map((r) => r.tabel))];

  for (const tabel of tabellen) {
    const refs = ARTIKEL_REFS.filter((r) => r.tabel === tabel);
    const cols = ["id", ...refs.map((r) => r.kolom)];
    // ms_mof_types extra kolom om EINDMOF-uitzondering te kunnen filteren.
    if (tabel === "ms_mof_types") cols.push("code");
    const { data, error } = await supabase.from(tabel as never).select(cols.join(","));
    if (error) {
      fouten.push(`${TABEL_LABEL[tabel] ?? tabel}: ${error.message}`);
      continue;
    }
    const rows = (data ?? []) as unknown as RefRow[];

    const nullRows: string[] = [];
    const danglingRows: string[] = [];

    for (const row of rows) {
      for (const ref of refs) {
        const val = row[ref.kolom] as string | null;
        if (!val) {
          // ms_mof_types: EINDMOF mag null hebben.
          if (tabel === "ms_mof_types" && (row.code as string) === "EINDMOF") continue;
          // rmu_configuraties.frame/bodem optioneel voor niet-ABB — laat staan.
          if (tabel === "rmu_configuraties" && ref.kolom !== "rmu_artikel_id") continue;
          nullRows.push(row.id);
          continue;
        }
        const art = byId.get(val);
        if (!art) {
          danglingRows.push(row.id);
          continue;
        }
        // Bucket per artikel-status
        const bucket = !art.actief
          ? gebruikInactief
          : (art.status ?? "").toLowerCase() === "geblokkeerd"
            ? gebruikGeblokkeerd
            : ["uitgelopen", "uitloop"].includes((art.status ?? "").toLowerCase())
              ? gebruikUitgelopen
              : null;
        if (bucket) {
          const list = bucket.get(art.id) ?? [];
          const bestaand = list.find((x) => x.tabel === tabel);
          if (bestaand) bestaand.rowIds.push(row.id);
          else list.push({ tabel, rowIds: [row.id] });
          bucket.set(art.id, list);
        }
      }
    }

    const deeplink = TABEL_DEEPLINK[tabel];
    if (nullRows.length > 0) {
      issues.push({
        id: `${tabel}-null`,
        severity: "kritiek",
        groep: groepVanTabel(tabel),
        titel: `${TABEL_LABEL[tabel] ?? tabel}: ${nullRows.length} regel(s) zonder artikel`,
        probleem: "Eén of meer regels hebben geen artikel_id ingevuld.",
        risico:
          "De configurator/winkelwagen krijgt geen artikel uit deze regels — bestelling is onvolledig.",
        actie: "Open de regel en koppel een geldig artikel.",
        details: nullRows.slice(0, 8).map((id) => `regel ${id.slice(0, 8)}…`),
        acties: deeplink
          ? [
              {
                label: "Open beheer-tab",
                to: "/beheer",
                search: { groep: deeplink.groep, tab: deeplink.tab },
              },
            ]
          : [],
      });
    }
    if (danglingRows.length > 0) {
      issues.push({
        id: `${tabel}-dangling`,
        severity: "kritiek",
        groep: groepVanTabel(tabel),
        titel: `${TABEL_LABEL[tabel] ?? tabel}: ${danglingRows.length} verwijzing(en) naar onbekend artikel`,
        probleem: "Regels verwijzen naar een artikel-id dat niet meer in de catalogus staat.",
        risico: "Berekeningen overslaan deze regels stilzwijgend — onvolledige winkelwagen.",
        actie: "Vervang de verwijzing of verwijder de regel.",
        details: danglingRows.slice(0, 8).map((id) => `regel ${id.slice(0, 8)}…`),
        acties: deeplink
          ? [
              {
                label: "Open beheer-tab",
                to: "/beheer",
                search: { groep: deeplink.groep, tab: deeplink.tab },
              },
            ]
          : [],
      });
    }
  }

  // ---- Artikelen met problematische status, per artikel samengevoegd -----
  function uitlegArtikel(
    art: ArtikelRow,
    gebruikt: { tabel: string; rowIds: string[] }[],
  ): { tekst: string; totaal: number; details: string[] } {
    const totaal = gebruikt.reduce((n, g) => n + g.rowIds.length, 0);
    const details = gebruikt.map(
      (g) => `${TABEL_LABEL[g.tabel] ?? g.tabel}: ${g.rowIds.length} regel(s)`,
    );
    return {
      tekst: `Artikel ${art.artikel_nummer}${art.korte_omschrijving ? ` (${art.korte_omschrijving})` : ""}`,
      totaal,
      details,
    };
  }

  function vervangActies(art: ArtikelRow): Actie[] {
    return [
      {
        label: "Zoek & vervang",
        icon: ArrowRightLeft,
        to: "/beheer",
        search: { groep: "overzicht", tab: "overzicht", artikel: art.artikel_nummer },
      },
      {
        label: "Open Artikel",
        icon: Search,
        to: "/beheer",
        search: { groep: "catalogus", tab: "artikelen", artikel: art.artikel_nummer },
      },
    ];
  }

  for (const [artId, gebruikt] of gebruikInactief) {
    const art = byId.get(artId);
    if (!art) continue;
    const heeftAlt = splitAlternatieven(art.alternatief_artikel_nummer).length > 0;
    const u = uitlegArtikel(art, gebruikt);
    issues.push({
      id: `art-inactief-${artId}`,
      severity: heeftAlt ? "waarschuwing" : "kritiek",
      groep: dominanteGroep(gebruikt.map((g) => groepVanTabel(g.tabel))),
      titel: `${u.tekst} is inactief en wordt nog gebruikt`,
      probleem: `${u.tekst} is inactief, maar staat nog in ${u.totaal} regel(s).`,
      risico: heeftAlt
        ? "Berekenlogica slaat dit artikel over of vervangt het stilzwijgend — winkelwagen kan onverwacht zijn."
        : "Er is geen opvolger; deze regels leveren niets meer op in de winkelwagen.",
      actie: heeftAlt
        ? "Open Zoek & vervang om de regels naar het opvolgartikel te migreren."
        : "Kies handmatig een vervanger of pas de regels aan.",
      artikelNummer: art.artikel_nummer,
      artikelStatus: statusLabel(art.status, art.actief),
      heeftAlternatief: heeftAlt,
      details: u.details,
      acties: vervangActies(art),
    });
  }

  for (const [artId, gebruikt] of gebruikUitgelopen) {
    const art = byId.get(artId);
    if (!art) continue;
    const heeftAlt = splitAlternatieven(art.alternatief_artikel_nummer).length > 0;
    const u = uitlegArtikel(art, gebruikt);
    issues.push({
      id: `art-uitgelopen-${artId}`,
      severity: "waarschuwing",
      groep: dominanteGroep(gebruikt.map((g) => groepVanTabel(g.tabel))),
      titel: `${u.tekst} is uitgelopen en wordt nog gebruikt`,
      probleem: `${u.tekst} staat op 'Uitgelopen' en komt voor in ${u.totaal} regel(s).`,
      risico:
        "Liander levert dit artikel nog wel, maar het verdwijnt binnenkort. Tijdig migreren voorkomt verrassingen.",
      actie: heeftAlt
        ? "Migreer naar het opvolgartikel via Zoek & vervang."
        : "Zoek een alternatief en update de regels.",
      artikelNummer: art.artikel_nummer,
      artikelStatus: "Uitgelopen",
      heeftAlternatief: heeftAlt,
      details: u.details,
      acties: vervangActies(art),
    });
  }

  for (const [artId, gebruikt] of gebruikGeblokkeerd) {
    const art = byId.get(artId);
    if (!art) continue;
    const heeftAlt = splitAlternatieven(art.alternatief_artikel_nummer).length > 0;
    const u = uitlegArtikel(art, gebruikt);
    issues.push({
      id: `art-geblokkeerd-${artId}`,
      severity: "kritiek",
      groep: dominanteGroep(gebruikt.map((g) => groepVanTabel(g.tabel))),
      titel: `${u.tekst} is geblokkeerd en wordt nog gebruikt`,
      probleem: `${u.tekst} mag niet besteld worden, maar wordt nog gebruikt in ${u.totaal} regel(s).`,
      risico: "Bestellingen via deze regels worden door Liander afgekeurd.",
      actie: "Vervang het artikel direct of zet de regels op inactief.",
      artikelNummer: art.artikel_nummer,
      artikelStatus: "Geblokkeerd",
      heeftAlternatief: heeftAlt,
      details: u.details,
      acties: vervangActies(art),
    });
  }

  // ---- Alternatief-keten checks ------------------------------------------
  const { data: keuzeRows, error: keuzeErr } = await supabase
    .from("alternatief_keuzes")
    .select("oud_artikel_nummer");
  const keuzeNummers = new Set<string>();
  if (keuzeErr) {
    fouten.push(`alternatief_keuzes: ${keuzeErr.message}`);
  } else {
    for (const k of keuzeRows ?? []) keuzeNummers.add(k.oud_artikel_nummer as string);
  }

  for (const art of artLijst) {
    if (art.actief) continue;
    const nummers = splitAlternatieven(art.alternatief_artikel_nummer);
    if (nummers.length === 0) continue;
    const actieveKand = nummers.filter((n) => {
      const a = byNr.get(n);
      return a && a.actief;
    });
    if (actieveKand.length === 0) {
      issues.push({
        id: `alt-geen-actief-${art.id}`,
        severity: "waarschuwing",
        groep: "catalogus",
        titel: `${art.artikel_nummer}: geen bruikbaar alternatief`,
        probleem: `Artikel is inactief en verwijst naar ${nummers.join(" / ")}, maar geen van die kandidaten is actief.`,
        risico: "Migratie naar opvolger is geblokkeerd — engineer moet handmatig kiezen.",
        actie: "Kies handmatig een alternatief of corrigeer de opvolger in de catalogus.",
        artikelNummer: art.artikel_nummer,
        artikelStatus: statusLabel(art.status, art.actief),
        heeftAlternatief: true,
        acties: vervangActies(art),
      });
    } else if (nummers.length > 1 && !keuzeNummers.has(art.artikel_nummer)) {
      issues.push({
        id: `alt-keuze-${art.id}`,
        severity: "info",
        groep: "catalogus",
        titel: `${art.artikel_nummer}: meerdere kandidaten, geen keuze gemaakt`,
        probleem: `Artikel heeft ${nummers.length} mogelijke opvolgers (${nummers.join(", ")}).`,
        risico: "Auto-migratie gebeurt pas als er expliciet één is gekozen.",
        actie: "Open Zoek & vervang en bevestig welk alternatief je wilt gebruiken.",
        artikelNummer: art.artikel_nummer,
        artikelStatus: statusLabel(art.status, art.actief),
        heeftAlternatief: true,
        acties: vervangActies(art),
      });
    }
  }

  // ---- Case-materialen → inactieve / dangling artikelen ------------------
  const { data: cm, error: cmErr } = await supabase
    .from("case_materialen")
    .select("id, case_id, artikel_id");
  if (cmErr) {
    fouten.push(`case_materialen: ${cmErr.message}`);
  } else {
    const inactRefs = new Map<string, number>(); // artikelNr → aantal cases
    let dangling = 0;
    for (const row of cm ?? []) {
      const a = byId.get(row.artikel_id as string);
      if (!a) {
        dangling++;
        continue;
      }
      if (!a.actief) {
        inactRefs.set(a.artikel_nummer, (inactRefs.get(a.artikel_nummer) ?? 0) + 1);
      }
    }
    if (dangling > 0) {
      issues.push({
        id: "cm-dangling",
        severity: "kritiek",
        groep: "cases",
        titel: `${dangling} opgeslagen case-regel(s) verwijzen naar onbekend artikel`,
        probleem: "Cases bevatten artikel_id's die niet meer in de catalogus staan.",
        risico: "Bij heropenen of exporteren krijg je lege/foute regels.",
        actie: "Open de betreffende cases en vervang of verwijder de regels.",
        acties: [],
      });
    }
    if (inactRefs.size > 0) {
      const totaalRegels = [...inactRefs.values()].reduce((n, x) => n + x, 0);
      issues.push({
        id: "cm-inactief",
        severity: "waarschuwing",
        groep: "cases",
        titel: `${inactRefs.size} inactief artikel(en) in opgeslagen cases`,
        probleem: `In opgeslagen cases staan ${totaalRegels} regel(s) met een inactief artikel.`,
        risico: "Heropende cases tonen oude artikelen die niet meer besteld kunnen worden.",
        actie: "Vervang het artikel in de catalogus of corrigeer de case handmatig.",
        details: [...inactRefs.entries()].slice(0, 8).map(([nr, n]) => `${nr} — ${n} regel(s)`),
        acties: [],
      });
    }
  }

  // ---- Liander sync meta -------------------------------------------------
  const { data: syncRow, error: syncErr } = await supabase
    .from("app_instellingen")
    .select("waarde, updated_at")
    .eq("sleutel", "laatste_assortiment_sync")
    .maybeSingle();
  if (syncErr) fouten.push(`app_instellingen: ${syncErr.message}`);

  const laatsteSyncIso = (syncRow?.updated_at as string | null) ?? null;
  const laatsteSyncBestand = (syncRow?.waarde as string | null) ?? null;
  const artikelenUitloopVerwijderd = artLijst.filter((a) => {
    const s = (a.status ?? "").toLowerCase();
    return !a.actief || s === "uitgelopen" || s === "uitloop" || s === "verwijderd";
  }).length;

  if (!laatsteSyncIso) {
    issues.push({
      id: "liander-geen-sync",
      severity: "info",
      groep: "liander",
      titel: "Nog geen Liander-sync uitgevoerd",
      probleem: "Er is geen registratie van een eerdere assortiment-upload gevonden.",
      risico: "Statusinformatie (Uitgelopen/Geblokkeerd) kan verouderd zijn.",
      actie: "Upload de laatste Liander Verbruik-template via Catalogus → Assortimentslijst.",
      acties: [
        {
          label: "Open Assortiment",
          to: "/beheer",
          search: { groep: "catalogus", tab: "assortiment" },
        },
      ],
    });
  } else {
    const dagen = Math.floor((Date.now() - new Date(laatsteSyncIso).getTime()) / 86_400_000);
    if (dagen > 45) {
      issues.push({
        id: "liander-oude-sync",
        severity: "waarschuwing",
        groep: "liander",
        titel: `Liander-sync is ${dagen} dagen oud`,
        probleem: `Laatste upload was ${laatsteSyncBestand ?? "onbekend"} op ${new Date(laatsteSyncIso).toLocaleDateString("nl-NL")}.`,
        risico: "Nieuwe Uitgelopen/Verwijderd-meldingen van Liander mis je tot je opnieuw uploadt.",
        actie: "Upload de meest recente Liander-template.",
        acties: [
          {
            label: "Open Assortiment",
            to: "/beheer",
            search: { groep: "catalogus", tab: "assortiment" },
          },
        ],
      });
    }
  }

  // Export-template-check vereist een upload — kunnen we niet stil doen.
  issues.push({
    id: "liander-template-check",
    severity: "info",
    groep: "liander",
    titel: "Controle export-artikelen tegen Liander-template",
    probleem:
      "Of alle gebruikte artikelen in de huidige Verbruik-template staan kan alleen worden bepaald met de template zelf.",
    risico: "Een artikel dat uit het template verdwijnt valt bij export weg zonder waarschuwing.",
    actie:
      "Upload de Liander-template in Catalogus → Assortimentslijst — die toont automatisch welke artikelen niet meer matchen.",
    acties: [
      {
        label: "Open Assortiment",
        to: "/beheer",
        search: { groep: "catalogus", tab: "assortiment" },
      },
    ],
  });

  return {
    issues,
    meta: {
      aantalArtikelen: artLijst.length,
      laatsteSyncIso,
      laatsteSyncBestand,
      artikelenUitloopVerwijderd,
    },
    fouten,
  };
}

function groepVanTabel(tabel: string): Beheergebied {
  const dl = TABEL_DEEPLINK[tabel];
  if (!dl) return "catalogus";
  if (dl.groep === "automations") return "automations";
  if (dl.groep === "hardware") return "hardware";
  if (dl.groep === "standaard") return "standaard";
  if (dl.groep === "catalogus") return "catalogus";
  return "catalogus";
}

function dominanteGroep(groepen: Beheergebied[]): Beheergebied {
  if (groepen.length === 0) return "catalogus";
  const counts = new Map<Beheergebied, number>();
  for (const g of groepen) counts.set(g, (counts.get(g) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
