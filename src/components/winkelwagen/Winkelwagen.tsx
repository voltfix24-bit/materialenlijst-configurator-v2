import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList, Info, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Stepper } from "@/components/ui-prim/Stepper";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PREVIEW_SECTIE_DEFS, type PreviewItem, type PreviewSectie } from "@/lib/configurator/types";
import { useSlaCorrectieOp } from "@/lib/leersysteem/hooks";
import type { CorrectieDialoogData, CorrectieScope } from "@/lib/leersysteem/types";
import { CorrectieDialoog } from "./CorrectieDialoog";

interface ArtikelStam {
  id: string;
  artikel_nummer: string;
  korte_omschrijving: string;
  eenheid: string;
}

interface Props {
  items: PreviewItem[]; // berekende items vanuit configurator
  caseId: string;
  caseType: string;
  subType: string;
  hasSubType: boolean;
  saving: boolean;
  onSave: () => void;
  onItemsChange: (effectief: PreviewItem[]) => void;
  artikelen: ArtikelStam[];
}

interface ToegevoegdArtikel {
  artikel_id: string;
  artikel_nummer: string;
  korte_omschrijving: string;
  eenheid: string;
  hoeveelheid: number;
}

const HIGHLIGHT_MS = 1500;
const REMOVED_MS = 2000;

export function Winkelwagen({
  items,
  caseId,
  caseType,
  subType,
  hasSubType,
  saving,
  onSave,
  onItemsChange,
  artikelen,
}: Props) {
  // Lokale state
  const [overrides, setOverrides] = useState<Map<string, number>>(new Map());
  const [verwijderd, setVerwijderd] = useState<Set<string>>(new Set());
  const [toegevoegd, setToegevoegd] = useState<ToegevoegdArtikel[]>([]);
  const [dialoogData, setDialoogData] = useState<CorrectieDialoogData | null>(null);
  const [pendingRevert, setPendingRevert] = useState<(() => void) | null>(null);
  const [showZoeker, setShowZoeker] = useState(false);
  const [zoek, setZoek] = useState("");
  const [zoekHoeveelheid, setZoekHoeveelheid] = useState(1);
  const [gekozenArtikel, setGekozenArtikel] = useState<ArtikelStam | null>(null);

  const slaCorrectieOp = useSlaCorrectieOp();

  // Reset bij wisselen case
  useEffect(() => {
    setOverrides(new Map());
    setVerwijderd(new Set());
    setToegevoegd([]);
    setDialoogData(null);
    setPendingRevert(null);
  }, [caseId]);

  // Effectieve lijst = items - verwijderd, met overrides toegepast, + handmatig toegevoegd
  const effectief = useMemo<PreviewItem[]>(() => {
    const base = items
      .filter((it) => !verwijderd.has(it.artikel_nummer))
      .map((it) => {
        const ov = overrides.get(it.artikel_nummer);
        return ov !== undefined ? { ...it, hoeveelheid: ov } : it;
      });
    const extra: PreviewItem[] = toegevoegd.map((t) => ({
      artikel_id: t.artikel_id,
      artikel_nummer: t.artikel_nummer,
      korte_omschrijving: t.korte_omschrijving,
      eenheid: t.eenheid,
      categorie: "",
      hoeveelheid: t.hoeveelheid,
      niet_bestellen: false,
      herkomst: ["Handmatig toegevoegd"],
      sectie: "standaard" as PreviewSectie,
    }));
    return [...base, ...extra];
  }, [items, overrides, verwijderd, toegevoegd]);

  // Doorgeven aan parent
  const onItemsChangeRef = useRef(onItemsChange);
  onItemsChangeRef.current = onItemsChange;
  useEffect(() => {
    onItemsChangeRef.current(effectief);
  }, [effectief]);

  // Diff voor animaties (alleen op effectief)
  const vorigeRef = useRef<Map<string, number>>(new Map());
  const eersteRunRef = useRef(true);
  const [nieuwNrs, setNieuwNrs] = useState<Set<string>>(new Set());
  const [verwijderdAnim, setVerwijderdAnim] = useState<PreviewItem[]>([]);

  useEffect(() => {
    const huidig = new Map<string, number>();
    for (const p of effectief) huidig.set(p.artikel_nummer, p.hoeveelheid);
    const eerste = eersteRunRef.current;
    eersteRunRef.current = false;

    const nN = new Set<string>();
    if (!eerste) {
      for (const [nr, qty] of huidig) {
        const v = vorigeRef.current.get(nr);
        if (v === undefined || v !== qty) nN.add(nr);
      }
    }
    const verw: PreviewItem[] = [];
    if (!eerste) {
      const huidigeSet = new Set(effectief.map((p) => p.artikel_nummer));
      for (const p of items) {
        if (!huidigeSet.has(p.artikel_nummer) && vorigeRef.current.has(p.artikel_nummer)) {
          verw.push(p);
        }
      }
    }
    vorigeRef.current = huidig;
    setNieuwNrs(nN);
    if (verw.length > 0) setVerwijderdAnim(verw);

    const t1 = nN.size > 0 ? setTimeout(() => setNieuwNrs(new Set()), HIGHLIGHT_MS) : null;
    const t2 = verw.length > 0 ? setTimeout(() => setVerwijderdAnim([]), REMOVED_MS) : null;
    return () => {
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [effectief, items]);

  // ---- correctie-acties ----

  const openDialoog = (data: CorrectieDialoogData, revert: () => void) => {
    setDialoogData(data);
    setPendingRevert(() => revert);
  };

  const bevestigDialoog = (reden: string, scope: CorrectieScope) => {
    if (!dialoogData) return;
    slaCorrectieOp.mutate({
      case_id: caseId,
      case_type: caseType,
      sub_type: subType,
      artikel_nummer: dialoogData.artikel_nummer,
      korte_omschrijving: dialoogData.korte_omschrijving,
      actie: dialoogData.actie,
      oude_hoeveelheid: dialoogData.oude_hoeveelheid,
      nieuwe_hoeveelheid: dialoogData.nieuwe_hoeveelheid,
      reden,
      scope,
    });
    setDialoogData(null);
    setPendingRevert(null);
  };

  const annuleerDialoog = () => {
    pendingRevert?.();
    setDialoogData(null);
    setPendingRevert(null);
  };

  const wijzigHoeveelheid = (it: PreviewItem, nieuw: number) => {
    const oudOriginal = items.find((x) => x.artikel_nummer === it.artikel_nummer)?.hoeveelheid ?? it.hoeveelheid;
    const huidig = overrides.get(it.artikel_nummer) ?? oudOriginal;
    if (nieuw === huidig) return;
    setOverrides((prev) => {
      const m = new Map(prev);
      m.set(it.artikel_nummer, nieuw);
      return m;
    });
    openDialoog(
      {
        artikel_nummer: it.artikel_nummer,
        korte_omschrijving: it.korte_omschrijving,
        actie: "hoeveelheid_gewijzigd",
        oude_hoeveelheid: oudOriginal,
        nieuwe_hoeveelheid: nieuw,
      },
      () => {
        setOverrides((prev) => {
          const m = new Map(prev);
          m.delete(it.artikel_nummer);
          return m;
        });
      },
    );
  };

  const verwijderItem = (it: PreviewItem) => {
    // Handmatig toegevoegd → direct weg, geen dialoog
    if (toegevoegd.some((t) => t.artikel_nummer === it.artikel_nummer)) {
      setToegevoegd((prev) => prev.filter((t) => t.artikel_nummer !== it.artikel_nummer));
      return;
    }
    setVerwijderd((prev) => new Set([...prev, it.artikel_nummer]));
    openDialoog(
      {
        artikel_nummer: it.artikel_nummer,
        korte_omschrijving: it.korte_omschrijving,
        actie: "verwijderd",
        oude_hoeveelheid: it.hoeveelheid,
        nieuwe_hoeveelheid: 0,
      },
      () => {
        setVerwijderd((prev) => {
          const s = new Set(prev);
          s.delete(it.artikel_nummer);
          return s;
        });
      },
    );
  };

  const voegArtikelToe = () => {
    if (!gekozenArtikel || zoekHoeveelheid <= 0) return;
    const nieuw: ToegevoegdArtikel = {
      artikel_id: gekozenArtikel.id,
      artikel_nummer: gekozenArtikel.artikel_nummer,
      korte_omschrijving: gekozenArtikel.korte_omschrijving,
      eenheid: gekozenArtikel.eenheid || "st",
      hoeveelheid: zoekHoeveelheid,
    };
    setToegevoegd((prev) => [...prev.filter((t) => t.artikel_nummer !== nieuw.artikel_nummer), nieuw]);
    const arNr = nieuw.artikel_nummer;
    const arOms = nieuw.korte_omschrijving;
    const arQty = nieuw.hoeveelheid;
    openDialoog(
      {
        artikel_nummer: arNr,
        korte_omschrijving: arOms,
        actie: "toegevoegd",
        oude_hoeveelheid: null,
        nieuwe_hoeveelheid: arQty,
      },
      () => {
        setToegevoegd((prev) => prev.filter((t) => t.artikel_nummer !== arNr));
      },
    );
    setShowZoeker(false);
    setZoek("");
    setGekozenArtikel(null);
    setZoekHoeveelheid(1);
  };

  // ---- zoek suggesties ----
  const suggesties = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    if (q.length < 2) return [];
    const al = new Set(effectief.map((e) => e.artikel_nummer));
    return artikelen
      .filter(
        (a) =>
          !al.has(a.artikel_nummer) &&
          (a.artikel_nummer.toLowerCase().includes(q) || a.korte_omschrijving.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [zoek, artikelen, effectief]);

  // ---- groepering ----
  const sectieGroepen = useMemo(() => {
    const map = new Map<PreviewSectie, PreviewItem[]>();
    for (const p of effectief) {
      if (toegevoegd.some((t) => t.artikel_nummer === p.artikel_nummer)) continue;
      const arr = map.get(p.sectie) ?? [];
      arr.push(p);
      map.set(p.sectie, arr);
    }
    const verwijderdPerSectie = new Map<PreviewSectie, PreviewItem[]>();
    for (const v of verwijderdAnim) {
      const arr = verwijderdPerSectie.get(v.sectie) ?? [];
      arr.push(v);
      verwijderdPerSectie.set(v.sectie, arr);
    }
    return PREVIEW_SECTIE_DEFS.map((def) => ({
      key: def.key,
      label: def.label,
      color: def.color,
      items: map.get(def.key) ?? [],
      verwijderdeItems: verwijderdPerSectie.get(def.key) ?? [],
    })).filter((g) => g.items.length > 0 || g.verwijderdeItems.length > 0);
  }, [effectief, verwijderdAnim, toegevoegd]);

  const teBestellen = effectief.filter((p) => !p.niet_bestellen).length;
  const totaal = effectief.length;

  return (
    <div className="rounded-lg border border-border bg-surface flex flex-col h-fit lg:sticky lg:top-4 max-h-[calc(100vh-2rem)]">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="font-semibold">Winkelwagen</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {totaal === 0 ? "Nog leeg" : `${totaal} artikelen · ${teBestellen} te bestellen`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
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

        {sectieGroepen.map((sec) => (
          <div key={sec.key}>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: sec.color }} />
              <span className="text-[11px] font-mono uppercase tracking-wider text-foreground/80">{sec.label}</span>
              <span className="text-[10px] font-mono text-muted-foreground ml-auto">{sec.items.length} art.</span>
            </div>
            <div className="space-y-0.5">
              {sec.items.map((it) => (
                <WinkelwagenRij
                  key={it.artikel_nummer}
                  item={it}
                  color={sec.color}
                  isNieuw={nieuwNrs.has(it.artikel_nummer)}
                  isVerwijderd={false}
                  isOverride={overrides.has(it.artikel_nummer)}
                  onChange={(v) => wijzigHoeveelheid(it, v)}
                  onDelete={() => verwijderItem(it)}
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
          </div>
        ))}

        {toegevoegd.length > 0 && (
          <div>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <span className="w-2 h-2 rounded-full shrink-0 bg-primary" />
              <span className="text-[11px] font-mono uppercase tracking-wider text-foreground/80">
                Handmatig toegevoegd
              </span>
              <span className="text-[10px] font-mono text-muted-foreground ml-auto">{toegevoegd.length} art.</span>
            </div>
            <div className="space-y-0.5">
              {toegevoegd.map((t) => {
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
                };
                return (
                  <WinkelwagenRij
                    key={t.artikel_nummer}
                    item={item}
                    color="var(--color-primary, #3b82f6)"
                    isNieuw={nieuwNrs.has(t.artikel_nummer)}
                    isVerwijderd={false}
                    isOverride={false}
                    onChange={(v) =>
                      setToegevoegd((prev) =>
                        prev.map((x) => (x.artikel_nummer === t.artikel_nummer ? { ...x, hoeveelheid: v } : x)),
                      )
                    }
                    onDelete={() => verwijderItem(item)}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border px-3 py-3 space-y-2">
        {showZoeker ? (
          <div className="space-y-2 rounded-md border border-border p-2 bg-background">
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                autoFocus
                value={zoek}
                onChange={(e) => {
                  setZoek(e.target.value);
                  setGekozenArtikel(null);
                }}
                placeholder="Artikelnr of omschrijving…"
                className="flex-1 bg-transparent text-sm focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  setShowZoeker(false);
                  setZoek("");
                  setGekozenArtikel(null);
                }}
                className="p-1 rounded hover:bg-accent"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {gekozenArtikel ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground">{gekozenArtikel.artikel_nummer}</span>
                <span className="flex-1 truncate">{gekozenArtikel.korte_omschrijving}</span>
                <Stepper value={zoekHoeveelheid} onChange={setZoekHoeveelheid} min={1} max={9999} />
                <button
                  type="button"
                  onClick={voegArtikelToe}
                  className="px-2 py-1 rounded bg-primary text-primary-foreground text-xs font-medium"
                >
                  Toevoegen
                </button>
              </div>
            ) : suggesties.length > 0 ? (
              <ul className="max-h-48 overflow-y-auto rounded border border-border divide-y divide-border">
                {suggesties.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setGekozenArtikel(a)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left hover:bg-accent"
                    >
                      <span className="font-mono text-xs text-muted-foreground w-20 shrink-0 truncate">
                        {a.artikel_nummer}
                      </span>
                      <span className="flex-1 truncate">{a.korte_omschrijving}</span>
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
        ) : (
          <button
            type="button"
            onClick={() => setShowZoeker(true)}
            className="w-full rounded-md border border-dashed border-border py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Artikel toevoegen
          </button>
        )}

        <div className="flex justify-between text-sm pt-1 border-t border-border/60">
          <span className="font-medium">Totaal te bestellen</span>
          <span className="font-mono font-semibold">{teBestellen}</span>
        </div>
        <button
          disabled={saving}
          onClick={onSave}
          className="w-full rounded-md bg-primary text-primary-foreground font-medium py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
        >
          {saving ? "Opslaan..." : "Lijst opslaan"}
        </button>
      </div>

      {dialoogData && (
        <CorrectieDialoog data={dialoogData} onBevestig={bevestigDialoog} onAnnuleer={annuleerDialoog} />
      )}
    </div>
  );
}

function WinkelwagenRij({
  item,
  color,
  isNieuw,
  isVerwijderd,
  isOverride,
  onChange,
  onDelete,
}: {
  item: PreviewItem;
  color: string;
  isNieuw: boolean;
  isVerwijderd: boolean;
  isOverride: boolean;
  onChange: (v: number) => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-2 px-2 py-1 rounded text-sm transition-colors duration-300",
        !isVerwijderd && "hover:bg-accent/40",
        item.niet_bestellen && !isVerwijderd && "opacity-50 line-through",
        isNieuw && !isVerwijderd && "bg-success/10 ring-1 ring-success/30",
        isOverride && !isVerwijderd && !isNieuw && "bg-primary/5 ring-1 ring-primary/30",
        isVerwijderd && "bg-destructive/10 ring-1 ring-destructive/30 line-through opacity-70 animate-fade-out",
      )}
      title={item.herkomst.join(", ")}
    >
      <span className="w-1.5 h-5 rounded-sm shrink-0" style={{ background: color }} />
      <span className="font-mono text-xs text-muted-foreground w-20 shrink-0 truncate">{item.artikel_nummer}</span>
      <span className="flex-1 truncate">{item.korte_omschrijving}</span>
      {isVerwijderd ? (
        <span className="font-mono text-xs tabular-nums text-destructive">
          {item.hoeveelheid}
          {item.eenheid}
        </span>
      ) : (
        <Stepper value={item.hoeveelheid} onChange={onChange} min={0} max={9999} suffix={item.eenheid} />
      )}
      {item.herkomst.length > 0 && !isVerwijderd && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 inline-flex items-center justify-center rounded-full w-5 h-5 text-[10px] text-muted-foreground/60 hover:text-foreground hover:bg-accent"
              aria-label="Toon herkomst"
            >
              {item.herkomst.length > 1 ? item.herkomst.length : <Info className="w-3 h-3" />}
            </button>
          </PopoverTrigger>
          <PopoverContent side="left" align="start" className="w-72 p-3">
            <div className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
              Herkomst ({item.herkomst.length})
            </div>
            <ul className="space-y-1.5">
              {item.herkomst.map((h, i) => (
                <li key={i} className="text-sm flex gap-2">
                  <span className="text-muted-foreground font-mono text-xs shrink-0 mt-0.5">{i + 1}.</span>
                  <span className="break-words">{h}</span>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
      {!isVerwijderd && (
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 p-1 rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
          aria-label="Verwijder artikel"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
