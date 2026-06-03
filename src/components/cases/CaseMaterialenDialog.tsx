import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Stepper } from "@/components/ui-prim/Stepper";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  caseId: string;
  caseLabel?: string;
}

interface MateriaalRij {
  id: string;
  artikel_id: string;
  artikel_nummer: string;
  korte_omschrijving: string;
  eenheid: string;
  categorie: string | null;
  status: string | null;
  actief: boolean | null;
  gewenste_hoeveelheid: number;
  niet_bestellen: boolean;
  herkomst_label: string | null;
}

export function CaseMaterialenDialog({ open, onClose, caseId, caseLabel }: Props) {
  const qc = useQueryClient();
  const [zoek, setZoek] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["case-materialen-full", caseId],
    enabled: open,
    queryFn: async (): Promise<MateriaalRij[]> => {
      const { data, error } = await supabase
        .from("case_materialen")
        .select(
          "id, artikel_id, gewenste_hoeveelheid, niet_bestellen, herkomst_label, artikelen(artikel_nummer, korte_omschrijving, eenheid, categorie, status, actief)",
        )
        .eq("case_id", caseId);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        artikel_id: r.artikel_id,
        artikel_nummer: r.artikelen?.artikel_nummer ?? "",
        korte_omschrijving: r.artikelen?.korte_omschrijving ?? "",
        eenheid: r.artikelen?.eenheid ?? "st",
        categorie: r.artikelen?.categorie ?? null,
        status: r.artikelen?.status ?? null,
        actief: r.artikelen?.actief ?? true,
        gewenste_hoeveelheid: Number(r.gewenste_hoeveelheid ?? 0),
        niet_bestellen: !!r.niet_bestellen,
        herkomst_label: r.herkomst_label,
      }));
    },
  });

  const updateRij = useMutation({
    mutationFn: async (vars: { id: string; gewenste_hoeveelheid?: number; niet_bestellen?: boolean }) => {
      const patch: Record<string, unknown> = {};
      if (vars.gewenste_hoeveelheid !== undefined) patch.gewenste_hoeveelheid = vars.gewenste_hoeveelheid;
      if (vars.niet_bestellen !== undefined) patch.niet_bestellen = vars.niet_bestellen;
      const { error } = await supabase.from("case_materialen").update(patch).eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case-materialen-full", caseId] });
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const groepen = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    const map = new Map<string, MateriaalRij[]>();
    for (const r of data ?? []) {
      if (q && !r.artikel_nummer.toLowerCase().includes(q) && !r.korte_omschrijving.toLowerCase().includes(q)) continue;
      const key = r.herkomst_label?.split(" · ")[0] || r.categorie || "Overig";
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, items]) => ({ key, items }));
  }, [data, zoek]);

  const totaal = data?.length ?? 0;
  const teBestellen = (data ?? []).filter((r) => !r.niet_bestellen).length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[88vh] p-0 flex flex-col gap-0">
        <DialogTitle className="sr-only">Materialenlijst case</DialogTitle>
        <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
              Materialenlijst {caseLabel ? `· ${caseLabel}` : ""}
            </div>
            <div className="text-xl font-bold text-[color:var(--navy)] leading-none">
              {totaal} <span className="text-sm font-semibold text-muted-foreground">artikelen</span>
              <span className="ml-3 text-xs text-muted-foreground font-normal">{teBestellen} te bestellen</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-muted" aria-label="Sluiten">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-border flex items-center gap-3 bg-muted/30">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder="Zoek artikelnummer of omschrijving…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-card border border-border focus:outline-none focus:border-primary/40"
            />
          </div>
          <a
            href={`/cases/${caseId}`}
            className="text-xs px-3 py-2 rounded-md border border-border hover:bg-muted font-semibold"
          >
            Open in configurator →
          </a>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Laden…
            </div>
          )}
          {!isLoading && groepen.length === 0 && (
            <div className="text-center py-16 text-sm text-muted-foreground">
              Geen opgeslagen materialen voor deze case. Open de configurator om de materialenlijst op te bouwen.
            </div>
          )}
          <div className="space-y-3">
            {groepen.map((g) => {
              const isCol = collapsed.has(g.key);
              const subtot = g.items.reduce((s, r) => s + (r.niet_bestellen ? 0 : r.gewenste_hoeveelheid), 0);
              return (
                <div key={g.key} className="border border-border rounded-lg bg-card overflow-hidden">
                  <button
                    onClick={() => setCollapsed((p) => { const s = new Set(p); s.has(g.key) ? s.delete(g.key) : s.add(g.key); return s; })}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 border-b border-border"
                  >
                    <span className="font-semibold text-sm flex-1 text-left">{g.key}</span>
                    <span className="text-[11px] font-mono text-muted-foreground">{g.items.length} art. · subtotaal {subtot}</span>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", !isCol && "rotate-180")} />
                  </button>
                  {!isCol && (
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="text-left px-3 py-1.5 w-[100px]">Artikel</th>
                          <th className="text-left px-2 py-1.5">Omschrijving</th>
                          <th className="text-center px-2 py-1.5 w-[140px]">Aantal</th>
                          <th className="text-left px-2 py-1.5 w-[60px]">Eenh.</th>
                          <th className="text-center px-2 py-1.5 w-[120px]">Niet bestellen</th>
                          <th className="text-left px-2 py-1.5 w-[100px]">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {g.items.map((r) => {
                          const probleem = !r.actief || ["uitgelopen", "verwijderd", "geblokkeerd"].includes((r.status ?? "").toLowerCase());
                          return (
                            <tr key={r.id} className={cn("hover:bg-muted/20", probleem && "bg-amber-500/5", r.niet_bestellen && "opacity-60")}>
                              <td className="px-3 py-1.5 font-mono text-xs text-primary">{r.artikel_nummer}</td>
                              <td className="px-2 py-1.5">{r.korte_omschrijving}</td>
                              <td className="px-2 py-1.5 text-center">
                                <div className="inline-flex">
                                  <Stepper
                                    value={r.gewenste_hoeveelheid}
                                    onChange={(v) => updateRij.mutate({ id: r.id, gewenste_hoeveelheid: v })}
                                    min={0}
                                    max={99999}
                                  />
                                </div>
                              </td>
                              <td className="px-2 py-1.5 text-xs text-muted-foreground uppercase">{r.eenheid}</td>
                              <td className="px-2 py-1.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={r.niet_bestellen}
                                  onChange={(e) => updateRij.mutate({ id: r.id, niet_bestellen: e.target.checked })}
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <span className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider",
                                  probleem ? "bg-amber-500/15 text-amber-700" : "bg-success/10 text-success",
                                )}>
                                  {probleem ? (r.status ?? "Inactief") : "Actief"}
                                </span>
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
      </DialogContent>
    </Dialog>
  );
}
