import { useMemo, useState } from "react";
import { ChevronDown, Download, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Stepper } from "@/components/ui-prim/Stepper";
import { cn } from "@/lib/utils";
import {
  PREVIEW_SECTIE_DEFS,
  type PreviewItem,
} from "@/lib/configurator/types";
import type { ExportProbleemArtikel } from "./ExportBevestigingDialoog";
import { BronOverzichtPopover } from "./BronOverzichtPopover";

interface ArtikelStam {
  id: string;
  artikel_nummer: string;
  korte_omschrijving: string;
  eenheid: string;
  actief?: boolean;
  status?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  effectief: PreviewItem[];
  /** Welke artikel_nummers zijn handmatig toegevoegd. */
  handmatigeNrs: Set<string>;
  /** Welke artikel_nummers hebben een hoeveelheid-override. */
  overrideNrs: Set<string>;
  artikelen: ArtikelStam[];
  exportProblemen: ExportProbleemArtikel[];
  onChangeQty: (item: PreviewItem, nieuw: number) => void;
  onVerwijder: (item: PreviewItem) => void;
  onVoegToe: (stam: ArtikelStam, hoeveelheid: number) => void;
  onSave: () => void;
  onExport: () => void;
  saving: boolean;
  exportPending?: boolean;
  exportDisabled?: boolean;
}

type StatusFilter = "alle" | "actief" | "probleem" | "handmatig" | "override";

const PROBLEEM_STATUSEN = ["uitgelopen", "verwijderd", "geblokkeerd"];

const HANDMATIG_SECTIE_KEY = "__handmatig" as const;

interface Groep {
  key: string;
  label: string;
  color: string;
  items: PreviewItem[];
}

export function VolledigeMaterialenlijst({
  open,
  onClose,
  effectief,
  handmatigeNrs,
  overrideNrs,
  artikelen,
  exportProblemen,
  onChangeQty,
  onVerwijder,
  onVoegToe,
  onSave,
  onExport,
  saving,
  exportPending,
  exportDisabled,
}: Props) {
  const [zoek, setZoek] = useState("");
  const [discFilter, setDiscFilter] = useState<string>("alle");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("alle");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [zoekToev, setZoekToev] = useState("");
  const [gekozen, setGekozen] = useState<ArtikelStam | null>(null);
  const [aantalToev, setAantalToev] = useState(1);
  const [bevestigDubbel, setBevestigDubbel] = useState<{
    stam: ArtikelStam;
    bestaande: PreviewItem;
    nieuw: number;
  } | null>(null);

  const problemenMap = useMemo(() => {
    const m = new Map<string, ExportProbleemArtikel>();
    for (const p of exportProblemen) m.set(p.artikel_nummer, p);
    return m;
  }, [exportProblemen]);

  const artikelByNr = useMemo(() => {
    const m = new Map<string, ArtikelStam>();
    for (const a of artikelen) m.set(a.artikel_nummer, a);
    return m;
  }, [artikelen]);

  const getStatusLabel = (it: PreviewItem): { label: string; tone: "ok" | "warn" | "muted" } => {
    const stam = artikelByNr.get(it.artikel_nummer);
    const status = (stam?.status ?? "").trim().toLowerCase();
    if (PROBLEEM_STATUSEN.includes(status)) {
      return { label: stam?.status ?? "Probleem", tone: "warn" };
    }
    if (it.inactief || stam?.actief === false) return { label: "Inactief", tone: "warn" };
    if (it.niet_bestellen) return { label: "Niet bestellen", tone: "muted" };
    return { label: "Actief", tone: "ok" };
  };

  const groepen = useMemo<Groep[]>(() => {
    const q = zoek.trim().toLowerCase();
    const map = new Map<string, PreviewItem[]>();
    for (const it of effectief) {
      if (q && !it.artikel_nummer.toLowerCase().includes(q) && !it.korte_omschrijving.toLowerCase().includes(q)) {
        continue;
      }
      // Status filter
      if (statusFilter !== "alle") {
        const isProbleem = problemenMap.has(it.artikel_nummer);
        const isHand = handmatigeNrs.has(it.artikel_nummer);
        const isOver = overrideNrs.has(it.artikel_nummer);
        if (statusFilter === "probleem" && !isProbleem) continue;
        if (statusFilter === "handmatig" && !isHand) continue;
        if (statusFilter === "override" && !isOver) continue;
        if (statusFilter === "actief" && (isProbleem || it.inactief)) continue;
      }
      const key = handmatigeNrs.has(it.artikel_nummer) ? HANDMATIG_SECTIE_KEY : it.sectie;
      if (discFilter !== "alle" && key !== discFilter) continue;
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    const result: Groep[] = [];
    for (const def of PREVIEW_SECTIE_DEFS) {
      const items = map.get(def.key);
      if (items && items.length > 0) {
        result.push({ key: def.key, label: def.label, color: def.color, items });
      }
    }
    const hand = map.get(HANDMATIG_SECTIE_KEY);
    if (hand && hand.length > 0) {
      result.push({
        key: HANDMATIG_SECTIE_KEY,
        label: "Handmatig toegevoegd",
        color: "var(--color-primary, #3b82f6)",
        items: hand,
      });
    }
    return result;
  }, [effectief, zoek, statusFilter, discFilter, handmatigeNrs, overrideNrs, problemenMap]);

  const totaal = effectief.length;
  const teBestellen = effectief.filter((p) => !p.niet_bestellen).length;
  const probleemCount = exportProblemen.length;

  const toggleGroep = (key: string) =>
    setCollapsed((prev) => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key);
      else s.add(key);
      return s;
    });

  const suggesties = useMemo(() => {
    const q = zoekToev.trim().toLowerCase();
    if (q.length < 2) return [];
    return artikelen
      .filter(
        (a) =>
          a.artikel_nummer.toLowerCase().includes(q) ||
          a.korte_omschrijving.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [zoekToev, artikelen]);

  const handleToevoeg = () => {
    if (!gekozen || aantalToev <= 0) return;
    const bestaand = effectief.find((e) => e.artikel_nummer === gekozen.artikel_nummer);
    if (bestaand) {
      setBevestigDubbel({ stam: gekozen, bestaande: bestaand, nieuw: aantalToev });
      return;
    }
    onVoegToe(gekozen, aantalToev);
    setGekozen(null);
    setZoekToev("");
    setAantalToev(1);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] p-0 flex flex-col gap-0">
        <DialogTitle className="sr-only">Volledige materialenlijst</DialogTitle>
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-4 flex-shrink-0">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
              Volledige materialenlijst
            </div>
            <div className="flex items-baseline gap-4">
              <div className="text-2xl font-bold text-[color:var(--navy)] leading-none">
                {totaal} <span className="text-base font-semibold text-muted-foreground">artikelen</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {teBestellen} te bestellen
                {probleemCount > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 font-semibold text-[11px]">
                    {probleemCount} probleem-artikel{probleemCount === 1 ? "" : "en"}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onSave}
              disabled={saving}
              className="px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              {saving ? "…" : "Opslaan"}
            </button>
            <button
              onClick={onExport}
              disabled={exportDisabled || exportPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-[color:var(--primary-hover)] disabled:opacity-40"
            >
              {exportPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export naar Liander
              {probleemCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                  {probleemCount}
                </span>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted"
              aria-label="Sluiten"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filterbar */}
        <div className="px-6 py-3 border-b border-border flex flex-wrap items-center gap-3 flex-shrink-0 bg-muted/30">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder="Zoek op artikelnummer of omschrijving…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-card border border-border focus:outline-none focus:border-primary/40"
            />
          </div>
          <select
            value={discFilter}
            onChange={(e) => setDiscFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:border-primary/40"
          >
            <option value="alle">Alle disciplines</option>
            {PREVIEW_SECTIE_DEFS.map((d) => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
            <option value={HANDMATIG_SECTIE_KEY}>Handmatig toegevoegd</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:border-primary/40"
          >
            <option value="alle">Alle statussen</option>
            <option value="actief">Alleen actief</option>
            <option value="probleem">Alleen problemen</option>
            <option value="handmatig">Alleen handmatig</option>
            <option value="override">Alleen aangepast</option>
          </select>
        </div>

        {/* Toevoegen-balk */}
        <div className="px-6 py-3 border-b border-border flex items-center gap-2 flex-wrap flex-shrink-0">
          <Plus className="w-4 h-4 text-primary" />
          <div className="relative flex-1 min-w-[280px]">
            <input
              value={zoekToev}
              onChange={(e) => { setZoekToev(e.target.value); setGekozen(null); }}
              placeholder="Artikel zoeken om toe te voegen…"
              className="w-full px-3 py-1.5 text-sm rounded-md bg-card border border-border focus:outline-none focus:border-primary/40"
            />
            {!gekozen && suggesties.length > 0 && (
              <ul className="absolute z-10 mt-1 left-0 right-0 max-h-56 overflow-y-auto rounded-md border border-border bg-card shadow-lg divide-y divide-border">
                {suggesties.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => { setGekozen(a); setZoekToev(`${a.artikel_nummer} — ${a.korte_omschrijving}`); }}
                      className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
                    >
                      <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">{a.artikel_nummer}</span>
                      <span className="flex-1 truncate">{a.korte_omschrijving}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Stepper value={aantalToev} onChange={setAantalToev} min={1} max={9999} />
          <button
            type="button"
            onClick={handleToevoeg}
            disabled={!gekozen}
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40"
          >
            Toevoegen
          </button>
        </div>

        {/* Lijst */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {groepen.length === 0 && (
            <div className="text-center py-16 text-sm text-muted-foreground">
              Geen artikelen gevonden voor deze filters.
            </div>
          )}
          <div className="space-y-3">
            {groepen.map((g) => {
              const isCollapsed = collapsed.has(g.key);
              const subtotaal = g.items.reduce((s, i) => s + (i.niet_bestellen ? 0 : i.hoeveelheid), 0);
              return (
                <div key={g.key} className="border border-border rounded-lg bg-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleGroep(g.key)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 border-b border-border"
                  >
                    <div className="w-2 h-2 rounded-full" style={{ background: g.color }} />
                    <span className="font-semibold text-sm flex-1 text-left">{g.label}</span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {g.items.length} art. · subtotaal {subtotaal}
                    </span>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", !isCollapsed && "rotate-180")} />
                  </button>
                  {!isCollapsed && (
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="text-left px-3 py-1.5 font-semibold w-[100px]">Artikel</th>
                          <th className="text-left px-2 py-1.5 font-semibold">Omschrijving</th>
                          <th className="text-left px-2 py-1.5 font-semibold w-[180px]">Herkomst</th>
                          <th className="text-center px-2 py-1.5 font-semibold w-[140px]">Aantal</th>
                          <th className="text-left px-2 py-1.5 font-semibold w-[60px]">Eenh.</th>
                          <th className="text-left px-2 py-1.5 font-semibold w-[110px]">Status</th>
                          <th className="px-2 py-1.5 w-[40px]"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {g.items.map((it) => {
                          const status = getStatusLabel(it);
                          const isHand = handmatigeNrs.has(it.artikel_nummer);
                          const isOver = overrideNrs.has(it.artikel_nummer);
                          return (
                            <tr key={it.artikel_nummer} className={cn(
                              "hover:bg-muted/20",
                              status.tone === "warn" && "bg-amber-500/5",
                              it.niet_bestellen && "opacity-60",
                            )}>
                              <td className="px-3 py-1.5 font-mono text-xs text-primary">{it.artikel_nummer}</td>
                              <td className="px-2 py-1.5">
                                <div className="text-sm leading-snug">{it.korte_omschrijving}</div>
                                {(isHand || isOver) && (
                                  <div className="flex gap-1 mt-0.5">
                                    {isHand && (
                                      <span className="text-[9px] px-1 py-px rounded bg-primary/15 text-primary font-semibold uppercase tracking-wider">
                                        handmatig
                                      </span>
                                    )}
                                    {isOver && !isHand && (
                                      <span className="text-[9px] px-1 py-px rounded bg-primary/15 text-primary font-semibold uppercase tracking-wider">
                                        aangepast
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-xs text-muted-foreground">
                                {it.herkomst.slice(0, 2).join(" · ")}
                                {it.herkomst.length > 2 && ` +${it.herkomst.length - 2}`}
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <div className="inline-flex">
                                  <Stepper value={it.hoeveelheid} onChange={(v) => onChangeQty(it, v)} min={0} max={99999} />
                                </div>
                              </td>
                              <td className="px-2 py-1.5 text-xs text-muted-foreground uppercase">{it.eenheid}</td>
                              <td className="px-2 py-1.5">
                                <span className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider",
                                  status.tone === "ok" && "bg-success/10 text-success",
                                  status.tone === "warn" && "bg-amber-500/15 text-amber-700",
                                  status.tone === "muted" && "bg-muted text-muted-foreground",
                                )}>
                                  {status.label}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => onVerwijder(it)}
                                  className="p-1 rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
                                  aria-label="Verwijder"
                                  title={isHand ? "Verwijderen" : "Markeren als niet bestellen"}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {bevestigDubbel && (
          <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
            <div className="bg-card rounded-lg shadow-xl border border-border max-w-md w-full p-5 space-y-3">
              <h3 className="text-base font-semibold">Artikel bestaat al</h3>
              <p className="text-sm text-muted-foreground">
                <span className="font-mono">{bevestigDubbel.stam.artikel_nummer}</span> staat al in de lijst
                met hoeveelheid {bevestigDubbel.bestaande.hoeveelheid}. Wat wil je doen?
              </p>
              <div className="flex flex-wrap gap-2 justify-end pt-2">
                <button
                  onClick={() => setBevestigDubbel(null)}
                  className="px-3 py-1.5 text-sm rounded border border-border hover:bg-muted"
                >
                  Annuleren
                </button>
                <button
                  onClick={() => {
                    onChangeQty(bevestigDubbel.bestaande, bevestigDubbel.bestaande.hoeveelheid + bevestigDubbel.nieuw);
                    setBevestigDubbel(null);
                    setGekozen(null); setZoekToev(""); setAantalToev(1);
                  }}
                  className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground font-semibold"
                >
                  Hoeveelheid +{bevestigDubbel.nieuw}
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
