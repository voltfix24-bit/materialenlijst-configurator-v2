import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useNotificaties, useVerwerkNotificatie } from "@/lib/leersysteem/hooks";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, Bell, AlertTriangle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { BRON_TABEL_DEFS, type BronTabel } from "@/lib/configurator/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { BeheerNotificatie } from "@/lib/leersysteem/types";

export const Route = createFileRoute("/notificaties")({
  component: NotificatiesPage,
});

const ACTIE_LABELS: Record<string, string> = {
  hoeveelheid_gewijzigd: "Hoeveelheid gewijzigd",
  verwijderd: "Verwijderd",
  toegevoegd: "Toegevoegd",
};

const ACTIE_KLEUREN: Record<string, { border: string; badge: string }> = {
  hoeveelheid_gewijzigd: { border: "border-l-info", badge: "bg-info/10 text-info" },
  verwijderd: { border: "border-l-destructive", badge: "bg-destructive/10 text-destructive" },
  toegevoegd: { border: "border-l-success", badge: "bg-success/10 text-success" },
};

const CASE_TYPE_LABELS: Record<string, string> = {
  NSA: "NSA",
  provisorium: "Provisorium",
  compact: "Compact",
  compact_prov: "Compact met Prov",
};

function NotificatiesPage() {
  const { data: notificaties, isLoading } = useNotificaties();
  const verwerk = useVerwerkNotificatie();
  const [bevestigen, setBevestigen] = useState<BeheerNotificatie | null>(null);

  return (
    <div className="px-8 py-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--navy)]">
              Notificaties
            </h1>
            {notificaties && notificaties.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-semibold">
                <Bell className="w-3 h-3" /> {notificaties.length} open
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Suggesties voor aanpassingen aan standaard materialen op basis van correcties door engineers.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Notificaties laden…
        </div>
      )}

      {!isLoading && (!notificaties || notificaties.length === 0) && (
        <div className="rounded-xl border border-border bg-card px-6 py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-success" />
          </div>
          <h2 className="text-lg font-semibold text-[color:var(--navy)] mb-1">Alles up-to-date</h2>
          <p className="text-sm text-muted-foreground">Er zijn momenteel geen openstaande suggesties.</p>
        </div>
      )}

      <div className="space-y-3">
        {notificaties?.map((n) => (
          <NotificatieKaart
            key={n.id}
            notificatie={n}
            onAfwijzen={() => verwerk.mutate({ notificatie: n, status: "afgewezen" })}
            onDoorvoeren={() => setBevestigen(n)}
            bezig={verwerk.isPending}
          />
        ))}
      </div>

      <Dialog open={!!bevestigen} onOpenChange={(o) => !o && setBevestigen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wijziging doorvoeren?</DialogTitle>
            <DialogDescription>
              Weet je zeker dat je deze aanpassing wil doorvoeren in de standaard materialen voor{" "}
              <span className="font-semibold text-foreground">
                {bevestigen ? CASE_TYPE_LABELS[bevestigen.case_type] ?? bevestigen.case_type : ""}
              </span>
              ? Dit beïnvloedt alle toekomstige cases van dit type.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setBevestigen(null)}
              className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted"
            >
              Annuleer
            </button>
            <button
              type="button"
              onClick={() => {
                if (bevestigen) {
                  verwerk.mutate({ notificatie: bevestigen, status: "goedgekeurd" });
                  setBevestigen(null);
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              Doorvoeren
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NotificatieKaart({
  notificatie,
  onDoorvoeren,
  onAfwijzen,
  bezig,
}: {
  notificatie: BeheerNotificatie;
  onDoorvoeren: () => void;
  onAfwijzen: () => void;
  bezig: boolean;
}) {
  const [open, setOpen] = useState(false);
  const kleur = ACTIE_KLEUREN[notificatie.actie] ?? ACTIE_KLEUREN.hoeveelheid_gewijzigd;

  const { data: redenen } = useQuery({
    queryKey: ["correctie_redenen", notificatie.correctie_ids],
    queryFn: async () => {
      if (!notificatie.correctie_ids?.length) return [];
      const { data } = await supabase
        .from("winkelwagen_correcties")
        .select("reden, scope, created_at")
        .in("id", notificatie.correctie_ids)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const eersteDrie = (redenen ?? []).slice(0, 3);
  const rest = (redenen ?? []).slice(3);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card border-l-4 p-4 shadow-sm hover:shadow-md transition-shadow",
        kleur.border,
      )}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-foreground">
              {notificatie.artikel_nummer}
            </span>
            <span className={cn("text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full", kleur.badge)}>
              {ACTIE_LABELS[notificatie.actie] ?? notificatie.actie}
            </span>
            <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {CASE_TYPE_LABELS[notificatie.case_type] ?? notificatie.case_type}
              {notificatie.sub_type ? ` · ${notificatie.sub_type}` : ""}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            {notificatie.korte_omschrijving ?? "Geen omschrijving"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {notificatie.aantal_correcties} engineer{notificatie.aantal_correcties === 1 ? "" : "s"} hebben dit aangepast
            {notificatie.gemiddelde_wijziging != null && (
              <>
                {" "}· Gemiddeld naar{" "}
                <span className="font-semibold text-foreground">
                  {Math.round(notificatie.gemiddelde_wijziging)}
                </span>{" "}
                stuks
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onAfwijzen}
            disabled={bezig}
            className="px-3 py-1.5 rounded-lg border border-destructive/40 text-destructive text-sm font-medium hover:bg-destructive/5 disabled:opacity-50"
          >
            Afwijzen
          </button>
          <button
            type="button"
            onClick={onDoorvoeren}
            disabled={bezig}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            Doorvoeren
          </button>
        </div>
      </div>

      {eersteDrie.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
            Redenen
          </div>
          {eersteDrie.map((r, i) => (
            <div key={i} className="text-xs text-foreground bg-muted/50 rounded-md px-2.5 py-1.5">
              <span className="text-muted-foreground">[{r.scope}]</span> {r.reden}
            </div>
          ))}
          {rest.length > 0 && (
            <>
              {open &&
                rest.map((r, i) => (
                  <div key={i} className="text-xs text-foreground bg-muted/50 rounded-md px-2.5 py-1.5">
                    <span className="text-muted-foreground">[{r.scope}]</span> {r.reden}
                  </div>
                ))}
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                {open ? (
                  <>
                    <ChevronUp className="w-3 h-3" /> Inklappen
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" /> {rest.length} meer redenen
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
