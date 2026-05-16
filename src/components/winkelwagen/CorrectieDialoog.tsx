import { useState } from "react";
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

const SCOPES: { value: CorrectieScope; label: string }[] = [
  { value: "eenmalig", label: "Alleen deze keer" },
  { value: "soms", label: "Vaker bij dit type case" },
  { value: "altijd", label: "Altijd bij dit type case" },
];

export function CorrectieDialoog({ data, onBevestig, onAnnuleer }: Props) {
  const [reden, setReden] = useState("");
  const [scope, setScope] = useState<CorrectieScope>("eenmalig");
  const [bezig, setBezig] = useState(false);

  const wijziging =
    data.actie === "hoeveelheid_gewijzigd"
      ? `${data.oude_hoeveelheid ?? "?"} → ${data.nieuwe_hoeveelheid ?? "?"}`
      : data.actie === "verwijderd"
        ? `Verwijderd (was ${data.oude_hoeveelheid ?? "?"})`
        : `Toegevoegd (${data.nieuwe_hoeveelheid ?? "?"})`;

  const bevestig = () => {
    if (!reden.trim() || bezig) return;
    setBezig(true);
    onBevestig(reden.trim(), scope);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onAnnuleer(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{TITELS[data.actie]}</DialogTitle>
          <DialogDescription className="text-xs">
            <span className="font-mono">{data.artikel_nummer}</span> · {data.korte_omschrijving}
            <br />
            <span className="text-foreground/80">{wijziging}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <textarea
            value={reden}
            onChange={(e) => setReden(e.target.value)}
            placeholder="Beschrijf kort de reden voor deze aanpassing..."
            className="w-full min-h-[80px] rounded-md border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            autoFocus
          />

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
            disabled={!reden.trim() || bezig}
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            Bevestigen
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
