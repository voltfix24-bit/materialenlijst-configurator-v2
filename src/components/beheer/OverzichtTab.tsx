import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { berekenImpact, ARTIKEL_REFS } from "@/lib/assortiment/impact";
import { voerHandmatigeVervangingDoor, getAlternatiefKeuzes } from "@/lib/assortiment/alternatief";
import { ArtikelZoeker, type ArtikelMini } from "./ArtikelZoeker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, CheckCircle2, Search, ShieldCheck, History, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

/** Vriendelijke labels per tabel — komen overeen met beheer-tabs. */
const TABEL_LABELS: Record<string, string> = {
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
  trafo_vult_kabel: "Trafo vult kabel",
  case_materialen: "Opgeslagen cases (materialen)",
};

function statusBadge(status: string | null | undefined, actief: boolean | undefined) {
  if (actief === false) return { label: "Inactief / verwijderd", cls: "bg-destructive/15 text-destructive border-destructive/30" };
  if (status === "Uitgelopen" || status === "Uitloop") return { label: "Uitgelopen", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" };
  if (status === "Geblokkeerd") return { label: "Geblokkeerd", cls: "bg-destructive/15 text-destructive border-destructive/30" };
  return { label: "Actief", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" };
}

export function OverzichtTab() {
  const qc = useQueryClient();
  const [oudId, setOudId] = useState<string | null>(null);
  const [oudArtikel, setOudArtikel] = useState<ArtikelMini | null>(null);
  const [nieuwId, setNieuwId] = useState<string | null>(null);
  const [nieuwArtikel, setNieuwArtikel] = useState<ArtikelMini | null>(null);
  const [gekozenRefs, setGekozenRefs] = useState<Set<string>>(new Set());
  const [bevestigOpen, setBevestigOpen] = useState(false);

  // Volledig artikel (incl. actief) voor de status-badge.
  const { data: oudFull } = useQuery({
    queryKey: ["overzicht-artikel-full", oudId],
    enabled: !!oudId,
    queryFn: async () => {
      const { data } = await supabase
        .from("artikelen")
        .select("id, artikel_nummer, korte_omschrijving, status, actief, alternatief_artikel_nummer, categorie")
        .eq("id", oudId!)
        .maybeSingle();
      return data;
    },
  });
  const { data: nieuwFull } = useQuery({
    queryKey: ["overzicht-artikel-full", nieuwId],
    enabled: !!nieuwId,
    queryFn: async () => {
      const { data } = await supabase
        .from("artikelen")
        .select("id, artikel_nummer, korte_omschrijving, status, actief")
        .eq("id", nieuwId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: impact, isLoading: impactLoading } = useQuery({
    queryKey: ["overzicht-impact", oudId],
    enabled: !!oudId,
    queryFn: async () => {
      const r = await berekenImpact([oudId!]);
      return r[0] ?? null;
    },
  });

  const { data: keuzes } = useQuery({
    queryKey: ["alternatief-keuzes-overzicht"],
    queryFn: () => getAlternatiefKeuzes(),
  });

  // Bij wisselen van oud artikel: reset selectie en preselecteer alle refs die hits hebben.
  const refsMetHits = impact?.gebruikt_in.filter((g) => g.count > 0) ?? [];
  const hitKey = (g: { tabel: string; kolom: string }) => `${g.tabel}.${g.kolom}`;
  const allHitKeys = useMemo(() => refsMetHits.map(hitKey), [impact]);
  // Sync default-selectie zodra impact verandert.
  useMemo(() => {
    setGekozenRefs(new Set(allHitKeys));
  }, [oudId, impact?.totaal]);

  const eerdereKeuze = oudArtikel ? keuzes?.get(oudArtikel.artikel_nummer) : undefined;

  const mut = useMutation({
    mutationFn: async () => {
      if (!oudArtikel || !nieuwArtikel || !oudId || !nieuwId) throw new Error("Onvolledig");
      const refs = gekozenRefs.size > 0
        ? [...gekozenRefs].map((k) => {
            const [tabel, kolom] = k.split(".");
            return { tabel, kolom };
          })
        : [];
      return voerHandmatigeVervangingDoor({
        oud_id: oudId,
        oud_nummer: oudArtikel.artikel_nummer,
        oud_omschrijving: oudArtikel.korte_omschrijving,
        nieuw_id: nieuwId,
        nieuw_nummer: nieuwArtikel.artikel_nummer,
        refs,
      });
    },
    onSuccess: (res) => {
      toast.success(`Vervangen: ${res.totaal_geupdate} verwijzing(en) bijgewerkt`);
      setBevestigOpen(false);
      qc.invalidateQueries({ queryKey: ["overzicht-impact"] });
      qc.invalidateQueries({ queryKey: ["alternatief-keuzes-overzicht"] });
      qc.invalidateQueries({ queryKey: ["alternatief-keuzes"] });
      // Vorig oud artikel wissen — de gebruiker mag desgewenst de oude regel verifiëren.
    },
    onError: (e: Error) => toast.error(`Mislukt: ${e.message}`),
  });

  const oudStatus = statusBadge(oudFull?.status as string | null, oudFull?.actief as boolean | undefined);
  const nieuwStatus = nieuwFull ? statusBadge(nieuwFull.status as string | null, nieuwFull.actief as boolean | undefined) : null;
  const nieuwGeldig = nieuwFull?.actief !== false && nieuwFull?.status !== "Geblokkeerd";

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <div className="text-sm space-y-1">
            <p className="font-medium">Veilig zoeken, vervangen en vrijgeven</p>
            <p className="text-muted-foreground text-xs">
              Zoek een artikel om te zien waar het overal gebruikt wordt. Kies een vervanger en zie eerst exact welke regels
              geraakt worden — pas na bevestiging worden artikelkoppelingen aangepast. Voor controle op brede datakwaliteit (regels
              zonder geldig artikel, uitloop met alternatief, etc.) zie de tab <strong>Datakwaliteit</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Stap 1: zoek artikel */}
      <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">1</span>
          <h2 className="text-sm font-semibold">Artikel zoeken & impact bekijken</h2>
        </div>
        <ArtikelZoeker
          value={oudId}
          onChange={(id, a) => {
            setOudId(id);
            setOudArtikel(a ?? null);
            setNieuwId(null);
            setNieuwArtikel(null);
          }}
          placeholder="Zoek op artikelnummer of omschrijving…"
        />

        {oudId && oudFull && (
          <div className="rounded-md border border-border bg-surface-2 p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs">{oudFull.artikel_nummer}</span>
              <span className="text-sm">{oudFull.korte_omschrijving}</span>
              <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", oudStatus.cls)}>{oudStatus.label}</span>
              {oudFull.alternatief_artikel_nummer && (
                <span className="text-[10px] text-muted-foreground">
                  Alternatief in DB-veld: <span className="font-mono">{oudFull.alternatief_artikel_nummer}</span>
                </span>
              )}
            </div>

            {eerdereKeuze && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
                <History className="h-3.5 w-3.5" />
                Eerder vervangen door{" "}
                <span className="font-mono">{eerdereKeuze.nieuw_artikel_nummer}</span> op{" "}
                {new Date(eerdereKeuze.created_at).toLocaleDateString("nl-NL")} ({eerdereKeuze.totaal_geupdate} verwijzing
                {eerdereKeuze.totaal_geupdate === 1 ? "" : "en"})
              </div>
            )}

            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Waar wordt dit artikel gebruikt?</p>
              {impactLoading && <p className="text-xs text-muted-foreground">Impact berekenen…</p>}
              {!impactLoading && impact && impact.totaal === 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Geen actieve verwijzingen — dit artikel is veilig te muteren of te verwijderen.
                </p>
              )}
              {!impactLoading && impact && impact.totaal > 0 && (
                <ul className="space-y-1">
                  {refsMetHits.map((g) => {
                    const label = TABEL_LABELS[g.tabel] ?? g.tabel;
                    return (
                      <li key={hitKey(g)} className="flex items-center justify-between gap-3 text-xs border-b border-border last:border-b-0 py-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-muted-foreground">{g.count}×</span>
                          <span className="truncate">{label}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">({g.kolom})</span>
                        </div>
                        {g.beheerGroep && g.beheerTab && (
                          <Link
                            to="/beheer"
                            search={{ groep: g.beheerGroep, tab: g.beheerTab, artikel: oudFull.artikel_nummer }}
                            className="text-primary hover:underline flex items-center gap-1 shrink-0"
                          >
                            Bekijk <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {!oudId && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5" />
            Start met een artikelnummer of omschrijving om de impact te zien.
          </p>
        )}
      </section>

      {/* Stap 2: vervanger kiezen */}
      {oudId && impact && (
        <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">2</span>
            <h2 className="text-sm font-semibold">Vervanger kiezen</h2>
          </div>
          <ArtikelZoeker
            value={nieuwId}
            onChange={(id, a) => {
              setNieuwId(id);
              setNieuwArtikel(a ?? null);
            }}
            placeholder="Zoek vervangend artikel…"
          />
          {nieuwFull && nieuwStatus && (
            <div className="rounded-md border border-border bg-surface-2 p-3 flex flex-wrap items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              <span className="font-mono text-xs">{nieuwFull.artikel_nummer}</span>
              <span className="text-sm">{nieuwFull.korte_omschrijving}</span>
              <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", nieuwStatus.cls)}>{nieuwStatus.label}</span>
              {!nieuwGeldig && (
                <span className="text-[10px] text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Vervanger is zelf inactief/geblokkeerd — niet aan te raden.
                </span>
              )}
              {nieuwId === oudId && (
                <span className="text-[10px] text-destructive">Vervanger is gelijk aan het oude artikel.</span>
              )}
            </div>
          )}
        </section>
      )}

      {/* Stap 3: preview + selectie */}
      {oudId && nieuwId && impact && impact.totaal > 0 && nieuwId !== oudId && (
        <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">3</span>
            <h2 className="text-sm font-semibold">Preview & bevestigen</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Selecteer welke verwijzingen vervangen mogen worden. Alleen aangevinkte regels worden bijgewerkt. Niets wijzigt vóór bevestiging.
          </p>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => setGekozenRefs(new Set(allHitKeys))}
            >
              Alles selecteren
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => setGekozenRefs(new Set())}
            >
              Niets
            </button>
          </div>
          <ul className="space-y-1">
            {refsMetHits.map((g) => {
              const k = hitKey(g);
              const checked = gekozenRefs.has(k);
              const label = TABEL_LABELS[g.tabel] ?? g.tabel;
              return (
                <li key={k} className="flex items-center gap-3 text-xs border-b border-border last:border-b-0 py-1.5">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => {
                      setGekozenRefs((prev) => {
                        const next = new Set(prev);
                        if (v) next.add(k);
                        else next.delete(k);
                        return next;
                      });
                    }}
                  />
                  <span className="font-mono text-muted-foreground w-10">{g.count}×</span>
                  <span className="flex-1 truncate">{label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{g.kolom}</span>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
              {gekozenRefs.size === 0
                ? "Niets geselecteerd."
                : `${[...gekozenRefs].reduce((sum, k) => {
                    const hit = refsMetHits.find((h) => hitKey(h) === k);
                    return sum + (hit?.count ?? 0);
                  }, 0)} verwijzing(en) worden bijgewerkt.`}
            </span>
            <Button
              size="sm"
              disabled={gekozenRefs.size === 0 || !nieuwGeldig}
              onClick={() => setBevestigOpen(true)}
            >
              Vervangen…
            </Button>
          </div>
        </section>
      )}

      <AlertDialog open={bevestigOpen} onOpenChange={setBevestigOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vervanging bevestigen</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono">{oudArtikel?.artikel_nummer}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span className="font-mono">{nieuwArtikel?.artikel_nummer}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {gekozenRefs.size} tabel(len) worden bijgewerkt. Deze actie past artikelkoppelingen direct aan en is niet via één
                  knop terug te draaien — een terugdraaiing vereist een nieuwe vervanging in omgekeerde richting.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mut.isPending}>Annuleren</AlertDialogCancel>
            <AlertDialogAction disabled={mut.isPending} onClick={(e) => { e.preventDefault(); mut.mutate(); }}>
              {mut.isPending ? "Bezig…" : "Ja, vervangen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Korte navigatie naar andere taakgerichte hulpmiddelen die al bestaan. */}
      <div className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Andere veiligheidstools</p>
        <ul className="space-y-0.5 list-disc list-inside">
          <li>
            <Link to="/beheer" search={{ groep: "kwaliteit", tab: "datakwaliteit" }} className="text-primary hover:underline">
              Datakwaliteit
            </Link>{" "}
            — verwijzingen zonder geldig artikel, uitloop met/zonder alternatief, ongebruikte mappings.
          </li>
          <li>
            <Link to="/beheer" search={{ groep: "catalogus", tab: "assortiment" }} className="text-primary hover:underline">
              Assortimentslijst (Liander)
            </Link>{" "}
            — maandelijkse sync met preview, impact en alternatief-keuzes.
          </li>
          <li>
            <Link to="/beheer" search={{ groep: "automations", tab: "lsrek_regels" }} className="text-primary hover:underline">
              LS-rek regels
            </Link>{" "}
            — bevat testpaneel om te zien welke regels bij voorbeeldkeuzes actief worden.
          </li>
        </ul>
        <p className="mt-2 text-[11px]">
          Voor één-op-één detailbeheer (rijen aanpassen, regels schrijven) blijven de bestaande tabs beschikbaar — er is niets verplaatst.
        </p>
      </div>
    </div>
  );
}

// ARTIKEL_REFS wordt geïmporteerd om het bundle-tree-shaking te behouden ondanks dynamische selectie.
void ARTIKEL_REFS;
