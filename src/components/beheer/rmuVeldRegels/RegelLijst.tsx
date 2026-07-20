import { useState } from "react";
import { ChevronDown, Pencil, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Regel } from "./types";

/** Zet condities om in een vlot leesbare zin. */
function regelZin(r: Regel): { wanneer: string[]; dan: string } {
  const wanneer: string[] = [];
  if (r.conditie_veld_type) wanneer.push(`veldtype = ${r.conditie_veld_type}`);
  if (r.conditie_kabel_type) wanneer.push(`kabel = ${r.conditie_kabel_type}`);
  if (r.conditie_kva) wanneer.push(`trafo = ${r.conditie_kva} kVA`);
  if (r.conditie_trafo_kabel_lengte)
    wanneer.push(`trafokabel = ${r.conditie_trafo_kabel_lengte} m`);
  if (r.conditie_is_inet !== null)
    wanneer.push(r.conditie_is_inet ? "I-Net uitvoering" : "geen I-Net");
  if (r.conditie_veld_nummer_is_1 === true) wanneer.push("alleen 1e veld");
  if (r.conditie_is_reserve !== null)
    wanneer.push(r.conditie_is_reserve ? "reserve-veld" : "geen reserve");
  if (r.conditie_aantal_kv_min !== null || r.conditie_aantal_kv_max !== null) {
    const min = r.conditie_aantal_kv_min ?? "?";
    const max = r.conditie_aantal_kv_max ?? "?";
    wanneer.push(`aantal C+V velden ${min}–${max}`);
  }
  const dan = `+ ${r.hoeveelheid}× artikel`;
  return { wanneer, dan };
}

function RegelRij({
  regel,
  artikel,
  onEdit,
  onDelete,
}: {
  regel: Regel;
  artikel?: { artikel_nummer: string; korte_omschrijving: string };
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { wanneer } = regelZin(regel);
  return (
    <div
      data-row-id={regel.id}
      className={cn(
        "px-4 py-3 flex items-start gap-4 hover:bg-accent/30",
        "data-[highlight=true]:bg-primary/10 data-[highlight=true]:ring-2 data-[highlight=true]:ring-primary data-[highlight=true]:ring-inset",
        !regel.actief && "opacity-50",
      )}
    >
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase font-mono text-muted-foreground">Als</span>
          {wanneer.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">altijd (geen voorwaarden)</span>
          ) : (
            wanneer.map((w, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded bg-surface-2 border border-border text-xs"
              >
                {w}
              </span>
            ))
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase font-mono text-muted-foreground">Dan</span>
          <span className="px-2 py-0.5 rounded bg-primary/10 border border-primary/30 text-xs font-medium">
            + {regel.hoeveelheid}×
          </span>
          {artikel ? (
            <span className="text-sm">
              <span className="font-mono text-xs text-muted-foreground">
                {artikel.artikel_nummer}
              </span>{" "}
              {artikel.korte_omschrijving}
            </span>
          ) : (
            <span className="text-xs text-destructive">⚠ artikel ontbreekt</span>
          )}
          <span
            className={cn(
              "ml-auto px-2 py-0.5 rounded text-[10px] font-mono uppercase",
              regel.sectie === "trafo"
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : "bg-blue-500/10 text-blue-700 dark:text-blue-300",
            )}
          >
            {regel.sectie}
          </span>
          {!regel.actief && (
            <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-mono uppercase">
              inactief
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">
          Label: <span className="font-mono">{regel.herkomst_label}</span>
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function MerkGroep({
  merk,
  regels,
  artMap,
  onEdit,
  onDelete,
}: {
  merk: string;
  regels: Regel[];
  artMap: Map<string, { artikel_nummer: string; korte_omschrijving: string }>;
  onEdit: (r: Regel) => void;
  onDelete: (r: Regel) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 hover:bg-accent/40">
          <div className="flex items-center gap-3">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">{merk}</span>
            <span className="text-xs text-muted-foreground">
              {regels.length} regel{regels.length === 1 ? "" : "s"}
            </span>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="divide-y divide-border">
            {regels.map((r) => (
              <RegelRij
                key={r.id}
                regel={r}
                artikel={artMap.get(r.artikel_id)}
                onEdit={() => onEdit(r)}
                onDelete={() => onDelete(r)}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
