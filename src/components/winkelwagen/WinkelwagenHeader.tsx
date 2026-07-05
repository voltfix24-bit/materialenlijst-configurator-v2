import { Maximize2, Plus, Search, X } from "lucide-react";

interface WinkelwagenHeaderProps {
  totaal: number;
  teBestellen: number;
  filter: string;
  onFilterChange: (filter: string) => void;
  onOpenVolledig: () => void;
  onOpenZoeker: () => void;
}

export function WinkelwagenHeader({
  totaal,
  teBestellen,
  filter,
  onFilterChange,
  onOpenVolledig,
  onOpenZoeker,
}: WinkelwagenHeaderProps) {
  return (
    <div className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
            Winkelwagen
          </div>
          <div className="text-2xl font-bold text-[color:var(--navy)] leading-none">
            {totaal}{" "}
            <span className="text-base font-semibold text-muted-foreground">
              artikel{totaal === 1 ? "" : "en"}
            </span>
          </div>
          {totaal > 0 && (
            <div className="text-[11px] text-muted-foreground mt-1">{teBestellen} te bestellen</div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onOpenVolledig}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-semibold px-1.5 py-1 rounded hover:bg-muted"
            title="Volledige materialenlijst openen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Volledig
          </button>
          <button
            type="button"
            onClick={onOpenZoeker}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-semibold px-1.5 py-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Toevoegen
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Materialen zoeken…"
          className="w-full pl-9 pr-8 py-2 text-sm rounded-lg bg-muted border border-transparent focus:outline-none focus:border-primary/40 focus:bg-card transition-colors"
        />
        {filter && (
          <button
            type="button"
            onClick={() => onFilterChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted-foreground/10"
            aria-label="Filter wissen"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}
