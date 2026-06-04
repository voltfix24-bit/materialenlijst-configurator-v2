import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { CorrectieDialoogData, CorrectieScope } from "@/lib/leersysteem/types";

interface Props {
  data: CorrectieDialoogData;
  onBevestig: (reden: string, scope: CorrectieScope) => void;
  onAnnuleer: () => void;
}

const TITELS: Record<CorrectieDialoogData["actie"], string> = {
  hoeveelheid_gewijzigd: "Waarom pas je de hoeveelheid aan?",
  verwijderd: "Waarom verwijder je dit artikel?",
  toegevoegd: "Waarom voeg je dit artikel toe?",
};

interface ScopeOpt {
  value: CorrectieScope;
  label: string;
  uitleg: string;
}

const SCOPES: ScopeOpt[] = [
  {
    value: "eenmalig",
    label: "Alleen deze keer",
    uitleg: "De wijziging geldt alleen voor deze case. Stamdata en regels blijven ongewijzigd.",
  },
  {
    value: "soms",
    label: "Vaker bij dit type case",
    uitleg:
      "We slaan dit op als signaal. Beheer ziet het in Notificaties als voorstel — geen automatische regelwijziging.",
  },
  {
    value: "altijd",
    label: "Altijd bij dit type case",
    uitleg:
      "Verzoek tot structurele aanpassing. Beheer moet dit expliciet goedkeuren vóórdat stamdata of regels wijzigen.",
  },
];

export function CorrectieDialoog({ data, onBevestig, onAnnuleer }: Props) {
  const [reden, setReden] = useState("");
  const [scope, setScope] = useState<CorrectieScope>("eenmalig");
  const [bezig, setBezig] = useState(false);

  const oud = data.oude_hoeveelheid ?? "?";
  const nieuw = data.nieuwe_hoeveelheid ?? "?";
  const scopeDef = SCOPES.find((s) => s.value === scope)!;
  const redenOk = reden.trim().length > 0;

  const bevestig = () => {
    if (!redenOk || bezig) return;
    setBezig(true);
    onBevestig(reden.trim(), scope);
  };

  return (
    <Dialog open onOpenChange={() => { /* sluiten alleen via Annuleer/Bevestigen */ }}>
      <DialogContent
        className="sm:max-w-md [&>button.absolute]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{TITELS[data.actie]}</DialogTitle>
          <DialogDescription className="text-xs">
            <span className="font-mono">{data.artikel_nummer}</span> · {data.korte_omschrijving}
          </DialogDescription>
        </DialogHeader>

        {/* Oud → Nieuw — visueel prominent */}
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 flex items-center justify-center gap-3 text-sm">
          {data.actie === "hoeveelheid_gewijzigd" ? (
            <>
              <span className="font-mono text-muted-foreground tabular-nums">{oud}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-mono font-semibold text-foreground tabular-nums">{nieuw}</span>
            </>
          ) : data.actie === "verwijderd" ? (
            <>
              <span className="font-mono text-muted-foreground tabular-nums">{oud}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-semibold text-destructive">Verwijderd</span>
            </>
          ) : (
            <span className="font-semibold text-foreground">Toegevoegd ({nieuw})</span>
          )}
        </div>

        <div className="space-y-3">
          <textarea
            value={reden}
            onChange={(e) => setReden(e.target.value)}
            placeholder="Beschrijf kort de reden voor deze aanpassing..."
            className="w-full min-h-[80px] rounded-md border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            autoFocus
          />
          {!redenOk && (
            <p className="text-[11px] text-muted-foreground">
              Vul een reden in om te kunnen bevestigen.
            </p>
          )}

          <div>
            <div className="flex flex-wrap gap-1.5">
              {SCOPES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setScope(s.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    scope === s.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-accent",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
              {scopeDef.uitleg}
            </p>
            {scope === "altijd" && (
              <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 flex items-start gap-2 text-[11px] text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 mt-px flex-shrink-0" />
                <span>
                  Dit raakt geen stamdata direct. Beheer moet het voorstel
                  goedkeuren in Notificaties voordat regels of standaardhoeveelheden veranderen.
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onAnnuleer}
            className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-accent"
          >
            Annuleer
          </button>
          <button
            type="button"
            onClick={bevestig}
            disabled={!redenOk || bezig}
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            title={!redenOk ? "Vul eerst een reden in" : undefined}
          >
            Bevestigen
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
