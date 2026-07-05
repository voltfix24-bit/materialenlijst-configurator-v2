import { Trash2 } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import type { PreviewItem } from "@/lib/configurator/types";
import { BronOverzichtPopover } from "./BronOverzichtPopover";

interface WinkelwagenRijProps {
  item: PreviewItem;
  color: string;
  isNieuw: boolean;
  isVerwijderd: boolean;
  isOverride: boolean;
  onChange: (v: number) => void;
  onDelete: () => void;
}

export function WinkelwagenRij({
  item,
  color,
  isNieuw,
  isVerwijderd,
  isOverride,
  onChange,
  onDelete,
}: WinkelwagenRijProps) {
  const minHoeveelheid = 0;
  const isInactief = !!item.inactief;
  return (
    <div
      className={cn(
        "flex items-center gap-2 py-1 px-1.5 rounded-md transition-all duration-500 group",
        !isVerwijderd && "hover:bg-muted/40",
        item.niet_bestellen && !isVerwijderd && "opacity-50 line-through",
        isNieuw && !isVerwijderd && "bg-success/10 ring-1 ring-success/30",
        isOverride && !isVerwijderd && !isNieuw && "bg-primary/5 ring-1 ring-primary/30",
        isInactief && !isVerwijderd && "bg-amber-500/10 ring-1 ring-amber-500/40",
        isVerwijderd &&
          "bg-destructive/10 ring-1 ring-destructive/30 line-through opacity-70 animate-fade-out",
      )}
      title={
        isInactief
          ? "Inactief artikel — komt niet meer voor in de huidige Liander-template"
          : undefined
      }
    >
      <div className="w-0.5 h-4 rounded-full flex-shrink-0" style={{ background: color }} />

      <span
        className="font-mono text-[10px] text-primary/80 flex-shrink-0 w-[72px] cursor-pointer hover:text-primary transition-colors truncate"
        onClick={() => navigator.clipboard?.writeText(item.artikel_nummer)}
        title={`${item.artikel_nummer} — ${item.korte_omschrijving}`}
      >
        {item.artikel_nummer}
      </span>

      <HoverCard openDelay={250} closeDelay={80}>
        <HoverCardTrigger asChild>
          <span className="text-[11px] text-foreground/85 flex-1 min-w-0 leading-tight cursor-help line-clamp-2 break-words">
            {isInactief && (
              <span className="inline-flex items-center px-1 mr-1 rounded text-[9px] font-semibold uppercase tracking-wide bg-amber-500/20 text-amber-700 align-middle">
                inactief
              </span>
            )}
            {item.korte_omschrijving}
          </span>
        </HoverCardTrigger>
        <HoverCardContent
          side="top"
          align="start"
          className="w-auto max-w-xs p-2 text-xs leading-snug"
        >
          <div className="font-mono text-[10px] text-primary mb-1">{item.artikel_nummer}</div>
          <div className="text-foreground">{item.korte_omschrijving}</div>
          {isInactief && (
            <div className="mt-1.5 text-amber-700 text-[11px]">
              Dit artikel komt niet meer voor in de huidige Liander-template. Vervang via Beheer →
              Assortiment.
            </div>
          )}
        </HoverCardContent>
      </HoverCard>

      {isVerwijderd ? (
        <span className="font-mono text-[12px] tabular-nums text-destructive flex-shrink-0">
          {item.hoeveelheid}
        </span>
      ) : (
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => onChange(Math.max(minHoeveelheid, item.hoeveelheid - 1))}
            disabled={item.hoeveelheid <= minHoeveelheid}
            className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs font-bold"
            aria-label="Verlaag"
          >
            −
          </button>
          <span className="w-8 text-center text-[12px] font-mono font-medium tabular-nums">
            {item.hoeveelheid}
          </span>
          <button
            type="button"
            onClick={() => onChange(item.hoeveelheid + 1)}
            className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-xs font-bold"
            aria-label="Verhoog"
          >
            +
          </button>
        </div>
      )}

      <span className="text-[9px] text-muted-foreground/60 flex-shrink-0 w-6 text-center uppercase">
        {item.eenheid}
      </span>

      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isVerwijderd && <BronOverzichtPopover item={item} side="left" />}
        {!isVerwijderd && (
          <button
            type="button"
            onClick={onDelete}
            className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label="Verwijder artikel"
            title="Verwijder artikel"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
