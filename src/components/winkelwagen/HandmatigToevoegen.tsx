import { Search, X } from "lucide-react";
import { Stepper } from "@/components/ui-prim/Stepper";
import type { ArtikelStam } from "@/lib/configurator/artikelTypes";

interface HandmatigToevoegenProps {
  open: boolean;
  zoek: string;
  zoekHoeveelheid: number;
  gekozenArtikel: ArtikelStam | null;
  suggesties: ArtikelStam[];
  onZoekChange: (zoek: string) => void;
  onZoekHoeveelheidChange: (hoeveelheid: number) => void;
  onKiesArtikel: (artikel: ArtikelStam) => void;
  onSluiten: () => void;
  onToevoegen: () => void;
}

export function HandmatigToevoegen({
  open,
  zoek,
  zoekHoeveelheid,
  gekozenArtikel,
  suggesties,
  onZoekChange,
  onZoekHoeveelheidChange,
  onKiesArtikel,
  onSluiten,
  onToevoegen,
}: HandmatigToevoegenProps) {
  if (!open) return null;

  return (
    <div className="space-y-2 rounded-md border border-border p-2 bg-background">
      <div className="flex items-center gap-2">
        <Search className="w-3.5 h-3.5 text-muted-foreground" />
        <input
          autoFocus
          value={zoek}
          onChange={(e) => onZoekChange(e.target.value)}
          placeholder="Artikelnr of omschrijving…"
          className="flex-1 bg-transparent text-sm focus:outline-none"
        />
        <button type="button" onClick={onSluiten} className="p-1 rounded hover:bg-accent">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {gekozenArtikel ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono text-xs text-muted-foreground">
            {gekozenArtikel.artikel_nummer}
          </span>
          <span className="flex-1 truncate">{gekozenArtikel.korte_omschrijving}</span>
          <Stepper value={zoekHoeveelheid} onChange={onZoekHoeveelheidChange} min={1} max={9999} />
          <button
            type="button"
            onClick={onToevoegen}
            className="px-2 py-1 rounded bg-primary text-primary-foreground text-xs font-medium"
          >
            Toevoegen
          </button>
        </div>
      ) : suggesties.length > 0 ? (
        <ul className="max-h-48 overflow-y-auto rounded border border-border divide-y divide-border">
          {suggesties.map((artikel) => (
            <li key={artikel.id}>
              <button
                type="button"
                onClick={() => onKiesArtikel(artikel)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left hover:bg-accent"
              >
                <span className="font-mono text-xs text-muted-foreground w-20 shrink-0 truncate">
                  {artikel.artikel_nummer}
                </span>
                <span className="flex-1 truncate">{artikel.korte_omschrijving}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : zoek.length >= 2 ? (
        <p className="text-xs text-muted-foreground px-1">Geen resultaten</p>
      ) : (
        <p className="text-xs text-muted-foreground px-1">Typ minimaal 2 tekens…</p>
      )}
    </div>
  );
}
