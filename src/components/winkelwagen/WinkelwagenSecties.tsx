import type { RefObject } from "react";
import { ChevronDown, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PreviewItem, PreviewSectie, ToegevoegdArtikel } from "@/lib/configurator/types";
import { WinkelwagenRij } from "./WinkelwagenRij";

interface SectieGroep {
  key: PreviewSectie;
  label: string;
  color: string;
  items: PreviewItem[];
  verwijderdeItems: PreviewItem[];
}

interface WinkelwagenSectiesProps {
  lijstRef: RefObject<HTMLDivElement | null>;
  hasSubType: boolean;
  sectieGroepen: SectieGroep[];
  toegevoegd: ToegevoegdArtikel[];
  zichtbareToegevoegd: ToegevoegdArtikel[];
  openSecties: Set<string>;
  sectiesMetNieuw: Set<string>;
  nieuwNrs: Set<string>;
  overrides: Map<string, number>;
  onToggleSectie: (key: string) => void;
  onWijzigHoeveelheid: (item: PreviewItem, hoeveelheid: number) => void;
  onVerwijderItem: (item: PreviewItem) => void;
  onWijzigToegevoegd: (artikelNummer: string, hoeveelheid: number) => void;
}

export function WinkelwagenSecties({
  lijstRef,
  hasSubType,
  sectieGroepen,
  toegevoegd,
  zichtbareToegevoegd,
  openSecties,
  sectiesMetNieuw,
  nieuwNrs,
  overrides,
  onToggleSectie,
  onWijzigHoeveelheid,
  onVerwijderItem,
  onWijzigToegevoegd,
}: WinkelwagenSectiesProps) {
  return (
    <div ref={lijstRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
      {sectieGroepen.length === 0 && toegevoegd.length === 0 && (
        <div className="px-4 py-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
            <ClipboardList className="w-6 h-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium mb-1">Nog geen materialen</p>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px] mx-auto">
            {hasSubType
              ? "Vul de configuratie in — de winkelwagen bouwt zich automatisch op."
              : "Kies eerst het projecttype om de winkelwagen op te bouwen."}
          </p>
        </div>
      )}

      {sectieGroepen.map((sec) => {
        const isOpen = openSecties.has(sec.key);
        const heeftPuls = !isOpen && sectiesMetNieuw.has(sec.key);
        return (
          <div key={sec.key} data-sectie={sec.key} className="scroll-mt-2">
            <button
              type="button"
              onClick={() => onToggleSectie(sec.key)}
              className="w-full flex items-center gap-1.5 mb-1 pb-1 border-b border-border/30 hover:bg-muted/30 rounded-sm px-1 transition-colors"
            >
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: sec.color }}
              />
              <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground flex-1 text-left">
                {sec.label}
              </span>
              {heeftPuls && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"
                  aria-label="nieuwe artikelen"
                />
              )}
              <span className="text-[9px] text-muted-foreground/70 font-mono">
                {sec.items.length} art.
              </span>
              <ChevronDown
                className={cn(
                  "w-3 h-3 text-muted-foreground transition-transform",
                  isOpen && "rotate-180",
                )}
              />
            </button>
            {isOpen && (
              <div className="space-y-0.5">
                {sec.items.map((it) => (
                  <WinkelwagenRij
                    key={it.artikel_nummer}
                    item={it}
                    color={sec.color}
                    isNieuw={nieuwNrs.has(it.artikel_nummer)}
                    isVerwijderd={false}
                    isOverride={overrides.has(it.artikel_nummer)}
                    onChange={(v) => onWijzigHoeveelheid(it, v)}
                    onDelete={() => onVerwijderItem(it)}
                  />
                ))}
                {sec.verwijderdeItems.map((it) => (
                  <WinkelwagenRij
                    key={`del-${it.artikel_nummer}`}
                    item={it}
                    color={sec.color}
                    isNieuw={false}
                    isVerwijderd={true}
                    isOverride={false}
                    onChange={() => {}}
                    onDelete={() => {}}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {zichtbareToegevoegd.length > 0 && (
        <div data-sectie="__handmatig" className="scroll-mt-2">
          <button
            type="button"
            onClick={() => onToggleSectie("__handmatig")}
            className="w-full flex items-center gap-1.5 mb-1 pb-1 border-b border-border/30 hover:bg-muted/30 rounded-sm px-1 transition-colors"
          >
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-primary" />
            <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground flex-1 text-left">
              Handmatig toegevoegd
            </span>
            {!openSecties.has("__handmatig") && sectiesMetNieuw.has("__handmatig") && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"
                aria-label="nieuwe artikelen"
              />
            )}
            <span className="text-[9px] text-muted-foreground/70 font-mono">
              {zichtbareToegevoegd.length} art.
            </span>
            <ChevronDown
              className={cn(
                "w-3 h-3 text-muted-foreground transition-transform",
                openSecties.has("__handmatig") && "rotate-180",
              )}
            />
          </button>
          {openSecties.has("__handmatig") && (
            <div className="space-y-0.5">
              {zichtbareToegevoegd.map((t) => {
                const item: PreviewItem = {
                  artikel_id: t.artikel_id,
                  artikel_nummer: t.artikel_nummer,
                  korte_omschrijving: t.korte_omschrijving,
                  eenheid: t.eenheid,
                  categorie: "",
                  hoeveelheid: t.hoeveelheid,
                  niet_bestellen: false,
                  herkomst: ["Handmatig toegevoegd"],
                  sectie: "standaard",
                  bijdragen: [
                    {
                      herkomst: "Handmatig toegevoegd",
                      sectie: "standaard",
                      hoeveelheid: t.hoeveelheid,
                    },
                  ],
                };
                return (
                  <WinkelwagenRij
                    key={t.artikel_nummer}
                    item={item}
                    color="var(--color-primary, #3b82f6)"
                    isNieuw={nieuwNrs.has(t.artikel_nummer)}
                    isVerwijderd={false}
                    isOverride={false}
                    onChange={(v) => onWijzigToegevoegd(t.artikel_nummer, v)}
                    onDelete={() => onVerwijderItem(item)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
