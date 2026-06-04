import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BRON_TABEL_DEFS,
  PREVIEW_SECTIE_DEFS,
  type PreviewItem,
} from "@/lib/configurator/types";

interface Props {
  item: PreviewItem;
  /** "icon" voor de kleine i-knop (compacte cart), "tekst" voor de volledige materialenlijst-tekstknop. */
  trigger?: "icon" | "tekst";
  side?: "left" | "right" | "top" | "bottom";
  className?: string;
}

/**
 * Toont een herbruikbare popover met:
 *  - bron-bijdragen (regel, sectie, aantal)
 *  - directe deep-link naar de beheerregel
 *  - "let op: meerdere bronnen" waarschuwing bij mogelijke dubbeltelling
 *
 * Gebruikt dezelfde data (`item.bijdragen`) als de compacte winkelwagen,
 * dus geen aparte logica of staat — single source of truth.
 */
export function BronOverzichtPopover({
  item,
  trigger = "icon",
  side = "left",
  className,
}: Props) {
  if (item.bijdragen.length === 0) return null;

  const triggerEl =
    trigger === "icon" ? (
      <button
        type="button"
        onClick={(e) => e.stopPropagation()}
        className={
          className ??
          "w-5 h-5 rounded flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
        }
        aria-label="Toon bronoverzicht"
      >
        {item.bijdragen.length > 1 ? (
          <span className="text-[10px] font-mono">{item.bijdragen.length}</span>
        ) : (
          <Info className="w-3 h-3" />
        )}
      </button>
    ) : (
      <button
        type="button"
        onClick={(e) => e.stopPropagation()}
        className={
          className ??
          "inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary hover:underline"
        }
      >
        <Info className="w-3 h-3" />
        {item.bijdragen.length > 1
          ? `${item.bijdragen.length} bronnen`
          : "Bron tonen"}
      </button>
    );

  const uniekeBronnen = new Set(
    item.bijdragen.map((b) => `${b.bronTabel ?? "?"}:${b.bronId ?? b.herkomst}`),
  );

  return (
    <Popover>
      <PopoverTrigger asChild>{triggerEl}</PopoverTrigger>
      <PopoverContent side={side} align="start" className="w-80 p-3">
        <div className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide flex items-center justify-between">
          <span>Bronoverzicht</span>
          <span className="font-mono text-foreground">
            Σ {item.hoeveelheid} {item.eenheid}
          </span>
        </div>
        <ul className="space-y-2.5">
          {item.bijdragen.map((b, i) => {
            const def = PREVIEW_SECTIE_DEFS.find((d) => d.key === b.sectie);
            const bronDef = b.bronTabel ? BRON_TABEL_DEFS[b.bronTabel] : null;
            const groep = bronDef?.beheerGroep ?? def?.beheerGroep;
            const tab = bronDef?.beheerTab ?? def?.beheerTab;
            const linkParams = new URLSearchParams();
            if (groep) linkParams.set("groep", groep);
            if (tab) linkParams.set("tab", tab);
            linkParams.set("artikel", item.artikel_nummer);
            if (b.bronId) linkParams.set("row", b.bronId);
            return (
              <li key={i} className="text-xs flex items-start gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                  style={{ background: def?.color ?? "#999" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium break-words">{b.herkomst}</span>
                    <span className="font-mono tabular-nums text-foreground shrink-0">
                      {b.hoeveelheid} {item.eenheid}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 mb-1">
                    {def?.label ?? b.sectie}
                    {bronDef && (
                      <span className="ml-1 text-muted-foreground/50 normal-case">
                        · {bronDef.label}
                      </span>
                    )}
                  </div>
                  {def?.uitleg && (
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {def.uitleg}
                    </p>
                  )}
                  {(groep || tab) && (
                    <a
                      href={`/beheer?${linkParams.toString()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline mt-1"
                    >
                      {b.bronId ? "Open exacte regel →" : "Open beheer →"}
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {uniekeBronnen.size > 1 && (
          <div className="mt-3 pt-2 border-t border-border text-[10px] text-muted-foreground leading-snug">
            <strong className="text-foreground">Let op:</strong> dit artikel komt uit{" "}
            {uniekeBronnen.size} verschillende regels — controleer of dat klopt of dat er
            sprake is van dubbeltelling.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
