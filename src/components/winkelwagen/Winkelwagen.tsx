import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ClipboardList, Download, Info, Loader2, Maximize2, Plus, Search, Trash2, X } from "lucide-react";
import { VolledigeMaterialenlijst } from "./VolledigeMaterialenlijst";
import { BronOverzichtPopover } from "./BronOverzichtPopover";
import { cn } from "@/lib/utils";
import { Stepper } from "@/components/ui-prim/Stepper";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { BRON_TABEL_DEFS, PREVIEW_SECTIE_DEFS, type PreviewItem, type PreviewSectie } from "@/lib/configurator/types";
import { useSlaCorrectieOp } from "@/lib/leersysteem/hooks";
import type { CorrectieDialoogData, CorrectieScope } from "@/lib/leersysteem/types";
import { CorrectieDialoog } from "./CorrectieDialoog";
import {
  ExportBevestigingDialoog,
  type ExportProbleemArtikel,
} from "./ExportBevestigingDialoog";
import { splitAlternatieven, getAlternatiefKeuzes } from "@/lib/assortiment/alternatief";
import { useQuery } from "@tanstack/react-query";

interface ArtikelStam {
  id: string;
  artikel_nummer: string;
  korte_omschrijving: string;
  eenheid: string;
  actief?: boolean;
  status?: string | null;
  alternatief_artikel_nummer?: string | null;
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
  /** Welke configurator-sectie is actief — winkelwagen synchroniseert open secties hierop. */
  activeSectie?: string;
  onExport?: () => void;
  exportDisabled?: boolean;
  exportPending?: boolean;
  /** Verhoog deze counter om vanuit buiten (bv. case-header) de export-bevestigingscontrole te triggeren. */
  exportSignal?: number;
}

// Mapping: configurator sectie → winkelwagen secties
const CONFIG_SECTIE_NAAR_WINKELWAGEN: Record<string, PreviewSectie[]> = {
  project: ["standaard"],
  provisorium: ["provisorium"],
  ms: ["rmu", "msVerbindingen"],
  trafo: ["trafo", "vultKabel"],
  ls: ["lsVerbindingen", "lsRek"],
  overig: ["ggi", "standaard"],
};

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
  activeSectie,
  onExport,
  exportDisabled,
  exportPending,
  exportSignal,
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
  // Welke winkelwagen-secties zijn opengeklapt — standaard alles ingeklapt
  const [openSecties, setOpenSecties] = useState<Set<string>>(new Set());
  // Lokale filter voor zichtbare artikelen in de winkelwagen
  const [filter, setFilter] = useState("");
  const lijstRef = useRef<HTMLDivElement | null>(null);
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
  const [volledigOpen, setVolledigOpen] = useState(false);




  const slaCorrectieOp = useSlaCorrectieOp();

  // Reset bij wisselen case
  useEffect(() => {
    setOverrides(new Map());
    setVerwijderd(new Set());
    setToegevoegd([]);
    setDialoogData(null);
    setPendingRevert(null);
    setOpenSecties(new Set());
    eersteSyncRef.current = true;
  }, [caseId]);

  // Sync: zodra de engineer een configurator-sectie opent, open de bijbehorende
  // winkelwagen secties (toevoegen aan reeds geopende) + scroll naar de eerste.
  // Eerste mount slaan we over — anders springt de cart bij openen van een case
  // direct naar de "standaard"-sectie zonder dat de gebruiker iets deed.
  const eersteSyncRef = useRef(true);
  useEffect(() => {
    if (!activeSectie) return;
    const mapped = CONFIG_SECTIE_NAAR_WINKELWAGEN[activeSectie];
    if (!mapped || mapped.length === 0) return;
    setOpenSecties((prev) => {
      const s = new Set(prev);
      for (const k of mapped) s.add(k);
      return s;
    });
    if (eersteSyncRef.current) {
      eersteSyncRef.current = false;
      return;
    }
    requestAnimationFrame(() => {
      const root = lijstRef.current;
      if (!root) return;
      for (const k of mapped) {
        const el = root.querySelector<HTMLElement>(`[data-sectie="${k}"]`);
        if (el) {
          // nestedScroll: alleen de winkelwagenlijst zelf scrollen, niet de
          // hoofdpagina. scrollTop berekenen voorkomt smooth-bubbling naar parent.
          root.scrollTo({ top: el.offsetTop - root.offsetTop, behavior: "smooth" });
          break;
        }
      }
    });
  }, [activeSectie]);

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
      bijdragen: [{ herkomst: "Handmatig toegevoegd", sectie: "standaard", hoeveelheid: t.hoeveelheid }],
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
    // Handmatig toegevoegd → ook via dialoog (zelfde flow)
    const isHandmatig = toegevoegd.some((t) => t.artikel_nummer === it.artikel_nummer);
    if (isHandmatig) {
      const snapshot = toegevoegd.find((t) => t.artikel_nummer === it.artikel_nummer)!;
      setToegevoegd((prev) => prev.filter((t) => t.artikel_nummer !== it.artikel_nummer));
      openDialoog(
        {
          artikel_nummer: it.artikel_nummer,
          korte_omschrijving: it.korte_omschrijving,
          actie: "verwijderd",
          oude_hoeveelheid: it.hoeveelheid,
          nieuwe_hoeveelheid: null,
        },
        () => {
          setToegevoegd((prev) =>
            prev.some((t) => t.artikel_nummer === snapshot.artikel_nummer) ? prev : [...prev, snapshot],
          );
        },
      );
      return;
    }
    setVerwijderd((prev) => new Set([...prev, it.artikel_nummer]));
    openDialoog(
      {
        artikel_nummer: it.artikel_nummer,
        korte_omschrijving: it.korte_omschrijving,
        actie: "verwijderd",
        oude_hoeveelheid: it.hoeveelheid,
        nieuwe_hoeveelheid: null,
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

  const voegHandmatigToe = (stam: ArtikelStam, qty: number) => {
    if (!stam || qty <= 0) return;
    const nieuw: ToegevoegdArtikel = {
      artikel_id: stam.id,
      artikel_nummer: stam.artikel_nummer,
      korte_omschrijving: stam.korte_omschrijving,
      eenheid: stam.eenheid || "st",
      hoeveelheid: qty,
    };
    setToegevoegd((prev) => [...prev.filter((t) => t.artikel_nummer !== nieuw.artikel_nummer), nieuw]);
    openDialoog(
      {
        artikel_nummer: nieuw.artikel_nummer,
        korte_omschrijving: nieuw.korte_omschrijving,
        actie: "toegevoegd",
        oude_hoeveelheid: null,
        nieuwe_hoeveelheid: nieuw.hoeveelheid,
      },
      () => {
        setToegevoegd((prev) => prev.filter((t) => t.artikel_nummer !== nieuw.artikel_nummer));
      },
    );
  };

  const voegArtikelToe = () => {
    if (!gekozenArtikel || zoekHoeveelheid <= 0) return;
    voegHandmatigToe(gekozenArtikel, zoekHoeveelheid);
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
    const q = filter.trim().toLowerCase();
    const matches = (p: PreviewItem) =>
      !q ||
      p.artikel_nummer.toLowerCase().includes(q) ||
      p.korte_omschrijving.toLowerCase().includes(q);
    const map = new Map<PreviewSectie, PreviewItem[]>();
    for (const p of effectief) {
      if (toegevoegd.some((t) => t.artikel_nummer === p.artikel_nummer)) continue;
      if (!matches(p)) continue;
      const arr = map.get(p.sectie) ?? [];
      arr.push(p);
      map.set(p.sectie, arr);
    }
    const verwijderdPerSectie = new Map<PreviewSectie, PreviewItem[]>();
    for (const v of verwijderdAnim) {
      if (!matches(v)) continue;
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
  }, [effectief, verwijderdAnim, toegevoegd, filter]);

  const zichtbareToegevoegd = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return toegevoegd;
    return toegevoegd.filter(
      (t) =>
        t.artikel_nummer.toLowerCase().includes(q) ||
        t.korte_omschrijving.toLowerCase().includes(q),
    );
  }, [toegevoegd, filter]);

  const teBestellen = effectief.filter((p) => !p.niet_bestellen).length;
  const totaal = effectief.length;

  const toggleSectie = (key: string) => {
    setOpenSecties((prev) => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key);
      else s.add(key);
      return s;
    });
  };

  // Welke secties hebben nieuwe items terwijl ze ingeklapt zijn → groene puls
  const sectiesMetNieuw = useMemo(() => {
    const s = new Set<string>();
    if (nieuwNrs.size === 0) return s;
    for (const sec of sectieGroepen) {
      if (sec.items.some((it) => nieuwNrs.has(it.artikel_nummer))) s.add(sec.key);
    }
    if (toegevoegd.some((t) => nieuwNrs.has(t.artikel_nummer))) s.add("__handmatig");
    return s;
  }, [nieuwNrs, sectieGroepen, toegevoegd]);

  // ───── Export-bevestiging: verzamel inactieve / uitgelopen / verwijderd / geblokkeerde artikelen ─────
  const { data: alternatiefKeuzes } = useQuery({
    queryKey: ["alternatief-keuzes"],
    queryFn: getAlternatiefKeuzes,
  });

  const exportProblemen = useMemo<ExportProbleemArtikel[]>(() => {
    const artByNr = new Map(artikelen.map((a) => [a.artikel_nummer, a]));
    const keuzes = alternatiefKeuzes ?? new Map();
    const out: ExportProbleemArtikel[] = [];
    for (const it of effectief) {
      if (it.niet_bestellen) continue;
      const stam = artByNr.get(it.artikel_nummer);
      const status = (stam?.status ?? "").trim();
      const statusLower = status.toLowerCase();
      const isInactief =
        !!it.inactief || stam?.actief === false || ["uitgelopen", "verwijderd", "geblokkeerd"].includes(statusLower);
      if (!isInactief) continue;

      const altRaw = (stam?.alternatief_artikel_nummer ?? "").trim();
      const alternatieven = splitAlternatieven(altRaw);
      const geenOpvolger =
        !altRaw ||
        altRaw === "-" ||
        /geen\s*opvolger/i.test(altRaw);
      // Tekst-met-nummer ("GEBR 20036380"): bevat een nummer maar ook niet-numerieke tokens.
      const handmatigBeoordelen =
        !geenOpvolger &&
        alternatieven.length >= 1 &&
        /[a-zA-Z]/.test(altRaw);

      const k = keuzes.get(it.artikel_nummer);
      out.push({
        artikel_nummer: it.artikel_nummer,
        korte_omschrijving: it.korte_omschrijving,
        hoeveelheid: it.hoeveelheid,
        eenheid: it.eenheid,
        status_label: status || "Inactief",
        alternatief_raw: altRaw || null,
        alternatieven,
        geen_opvolger: geenOpvolger,
        handmatig_beoordelen: handmatigBeoordelen,
        eerdere_keuze: k
          ? {
              nieuw_artikel_nummer: k.nieuw_artikel_nummer,
              created_at: k.created_at,
              totaal_geupdate: k.totaal_geupdate,
            }
          : null,
      });
    }
    return out;
  }, [effectief, artikelen, alternatiefKeuzes]);

  const handleExportClick = () => {
    if (!onExport) return;
    if (exportProblemen.length > 0) {
      setExportConfirmOpen(true);
      return;
    }
    onExport();
  };

  // Externe trigger (case-header "Export"-knop) → zelfde bevestigingsflow als de
  // winkelwagen-knop. Skip de eerste mount zodat we niet automatisch openen.
  const exportSignalRef = useRef<number | undefined>(exportSignal);
  useEffect(() => {
    if (exportSignal === undefined) return;
    if (exportSignalRef.current === exportSignal) return;
    exportSignalRef.current = exportSignal;
    handleExportClick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportSignal]);



  return (
    <div className="bg-card flex flex-col h-full max-h-screen">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
              Winkelwagen
            </div>
            <div className="text-2xl font-bold text-[color:var(--navy)] leading-none">
              {totaal} <span className="text-base font-semibold text-muted-foreground">artikel{totaal === 1 ? "" : "en"}</span>
            </div>
            {totaal > 0 && (
              <div className="text-[11px] text-muted-foreground mt-1">{teBestellen} te bestellen</div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setVolledigOpen(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-semibold px-1.5 py-1 rounded hover:bg-muted"
              title="Volledige materialenlijst openen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Volledig
            </button>
            <button
              type="button"
              onClick={() => setShowZoeker(true)}
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
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Materialen zoeken…"
            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg bg-muted border border-transparent focus:outline-none focus:border-primary/40 focus:bg-card transition-colors"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted-foreground/10"
              aria-label="Filter wissen"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

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
                onClick={() => toggleSectie(sec.key)}
                className="w-full flex items-center gap-1.5 mb-1 pb-1 border-b border-border/30 hover:bg-muted/30 rounded-sm px-1 transition-colors"
              >
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sec.color }} />
                <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground flex-1 text-left">
                  {sec.label}
                </span>
                {heeftPuls && (
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" aria-label="nieuwe artikelen" />
                )}
                <span className="text-[9px] text-muted-foreground/70 font-mono">{sec.items.length} art.</span>
                <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
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
              )}
            </div>
          );
        })}

        {zichtbareToegevoegd.length > 0 && (
          <div data-sectie="__handmatig" className="scroll-mt-2">
            <button
              type="button"
              onClick={() => toggleSectie("__handmatig")}
              className="w-full flex items-center gap-1.5 mb-1 pb-1 border-b border-border/30 hover:bg-muted/30 rounded-sm px-1 transition-colors"
            >
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-primary" />
              <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground flex-1 text-left">
                Handmatig toegevoegd
              </span>
              {!openSecties.has("__handmatig") && sectiesMetNieuw.has("__handmatig") && (
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" aria-label="nieuwe artikelen" />
              )}
              <span className="text-[9px] text-muted-foreground/70 font-mono">{zichtbareToegevoegd.length} art.</span>
              <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform", openSecties.has("__handmatig") && "rotate-180")} />
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
                    bijdragen: [{ herkomst: "Handmatig toegevoegd", sectie: "standaard", hoeveelheid: t.hoeveelheid }],
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
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border px-6 py-4 space-y-3 bg-card flex-shrink-0">
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
        ) : null}

        <div className="flex items-center justify-between text-sm pt-1">
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Te bestellen</span>
          <span className="font-mono font-semibold text-foreground">{teBestellen}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={saving}
            onClick={onSave}
            className="flex-shrink-0 px-3 py-2.5 rounded-lg border border-border text-foreground text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-50"
          >
            {saving ? "…" : "Opslaan"}
          </button>
          <button
            type="button"
            onClick={handleExportClick}
            disabled={exportDisabled || exportPending || !onExport}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-semibold py-2.5 text-sm hover:bg-[color:var(--primary-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {exportPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export naar Liander
            {exportProblemen.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                {exportProblemen.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {dialoogData && (
        <CorrectieDialoog data={dialoogData} onBevestig={bevestigDialoog} onAnnuleer={annuleerDialoog} />
      )}

      {exportConfirmOpen && (
        <ExportBevestigingDialoog
          problemen={exportProblemen}
          onBevestig={() => {
            setExportConfirmOpen(false);
            onExport?.();
          }}
          onAnnuleer={() => setExportConfirmOpen(false)}
        />
      )}

      <VolledigeMaterialenlijst
        open={volledigOpen}
        onClose={() => setVolledigOpen(false)}
        effectief={effectief}
        handmatigeNrs={new Set(toegevoegd.map((t) => t.artikel_nummer))}
        overrideNrs={new Set(overrides.keys())}
        artikelen={artikelen}
        exportProblemen={exportProblemen}
        onChangeQty={(it, v) => wijzigHoeveelheid(it, v)}
        onVerwijder={(it) => verwijderItem(it)}
        onVoegToe={(stam, qty) => voegHandmatigToe(stam, qty)}
        onSave={onSave}
        onExport={handleExportClick}
        saving={saving}
        exportPending={exportPending}
        exportDisabled={exportDisabled || !onExport}
      />

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
        isVerwijderd && "bg-destructive/10 ring-1 ring-destructive/30 line-through opacity-70 animate-fade-out",
      )}
      title={isInactief ? "Inactief artikel — komt niet meer voor in de huidige Liander-template" : undefined}
    >
      {/* Sectie kleurblokje */}
      <div className="w-0.5 h-4 rounded-full flex-shrink-0" style={{ background: color }} />

      {/* Artikelnummer — vaste breedte, klikbaar voor kopiëren */}
      <span
        className="font-mono text-[10px] text-primary/80 flex-shrink-0 w-[72px] cursor-pointer hover:text-primary transition-colors truncate"
        onClick={() => navigator.clipboard?.writeText(item.artikel_nummer)}
        title={`${item.artikel_nummer} — ${item.korte_omschrijving}`}
      >
        {item.artikel_nummer}
      </span>

      {/* Omschrijving — truncate, met hover card voor volledige tekst */}
      <HoverCard openDelay={250} closeDelay={80}>
        <HoverCardTrigger asChild>
          <span
            className="text-[11px] text-foreground/85 flex-1 min-w-0 leading-tight cursor-help line-clamp-2 break-words"
          >
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

      {/* Stepper of weergave */}
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

      {/* Eenheid klein */}
      <span className="text-[9px] text-muted-foreground/60 flex-shrink-0 w-6 text-center uppercase">
        {item.eenheid}
      </span>

      {/* Acties — alleen op hover */}
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
