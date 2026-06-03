import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LOG_ACTIE_LABEL, type LogActie, type LogResultaat } from "@/lib/beheer/log";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";

interface LogRow {
  id: string;
  created_at: string;
  actie: LogActie;
  omschrijving: string;
  artikel_nummer: string | null;
  tabel: string | null;
  rij_id: string | null;
  oude_waarde: unknown;
  nieuwe_waarde: unknown;
  aantal_aangepast: number;
  resultaat: LogResultaat;
  details: unknown;
  uitgevoerd_door: string | null;
}

const RESULTAAT_BADGE: Record<LogResultaat, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  ok: { label: "Gelukt", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", Icon: CheckCircle2 },
  gedeeltelijk: { label: "Gedeeltelijk", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30", Icon: AlertTriangle },
  fout: { label: "Fout", cls: "bg-destructive/15 text-destructive border-destructive/30", Icon: XCircle },
};

export function WijzigingenTab() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["beheer-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beheer_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
    staleTime: 0,
  });

  const [actieFilter, setActieFilter] = useState<LogActie | "alle">("alle");
  const [resultaatFilter, setResultaatFilter] = useState<LogResultaat | "alle">("alle");
  const [artikelFilter, setArtikelFilter] = useState("");
  const [geopend, setGeopend] = useState<Set<string>>(new Set());

  const rijen = data ?? [];
  const gefilterd = useMemo(() => {
    const q = artikelFilter.trim().toLowerCase();
    return rijen.filter((r) => {
      if (actieFilter !== "alle" && r.actie !== actieFilter) return false;
      if (resultaatFilter !== "alle" && r.resultaat !== resultaatFilter) return false;
      if (q) {
        const hay = `${r.artikel_nummer ?? ""} ${r.omschrijving}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rijen, actieFilter, resultaatFilter, artikelFilter]);

  const acties = Object.keys(LOG_ACTIE_LABEL) as LogActie[];

  function toggle(id: string) {
    setGeopend((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Wijzigingen / historie</h2>
          <p className="text-sm text-muted-foreground">
            Log van beheeracties: assortimentsyncs, vervangingen, alternatieven. Nieuwste bovenaan, maximaal 500.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          Verversen
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="inline-flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Type</span>
          <select
            value={actieFilter}
            onChange={(e) => setActieFilter(e.target.value as LogActie | "alle")}
            className="px-2 py-1 rounded-md border border-border bg-background text-xs"
          >
            <option value="alle">Alle</option>
            {acties.map((a) => (
              <option key={a} value={a}>{LOG_ACTIE_LABEL[a]}</option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Resultaat</span>
          <select
            value={resultaatFilter}
            onChange={(e) => setResultaatFilter(e.target.value as LogResultaat | "alle")}
            className="px-2 py-1 rounded-md border border-border bg-background text-xs"
          >
            <option value="alle">Alle</option>
            <option value="ok">Gelukt</option>
            <option value="gedeeltelijk">Gedeeltelijk</option>
            <option value="fout">Fout</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Artikel / tekst</span>
          <input
            value={artikelFilter}
            onChange={(e) => setArtikelFilter(e.target.value)}
            placeholder="20020033 of vrije tekst"
            className="px-2 py-1 rounded-md border border-border bg-background text-xs w-48"
          />
        </label>
        <div className="text-xs text-muted-foreground ml-auto">
          {gefilterd.length} van {rijen.length} regels
        </div>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Log laden…</div>}
      {error && <div className="text-sm text-destructive">Fout: {(error as Error).message}</div>}

      {!isLoading && gefilterd.length === 0 && (
        <div className="rounded-md border border-border p-6 text-sm text-muted-foreground text-center">
          Geen log-regels die aan de filters voldoen.
        </div>
      )}

      <div className="border border-border rounded-md divide-y divide-border">
        {gefilterd.map((r) => {
          const open = geopend.has(r.id);
          const cfg = RESULTAAT_BADGE[r.resultaat];
          const Icon = cfg.Icon;
          return (
            <div key={r.id} className="p-3">
              <button onClick={() => toggle(r.id)} className="w-full flex items-start gap-3 text-left">
                <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", toneText(r.resultaat))} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{LOG_ACTIE_LABEL[r.actie] ?? r.actie}</span>
                    <span className={cn("text-[10px] uppercase tracking-wider border rounded px-1.5 py-0.5", cfg.cls)}>
                      {cfg.label}
                    </span>
                    {r.artikel_nummer && (
                      <span className="text-[11px] font-mono text-muted-foreground">{r.artikel_nummer}</span>
                    )}
                    {r.aantal_aangepast > 0 && (
                      <span className="text-[11px] text-muted-foreground">{r.aantal_aangepast}× aangepast</span>
                    )}
                    <span className="text-[11px] text-muted-foreground ml-auto">
                      {new Date(r.created_at).toLocaleString("nl-NL")}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{r.omschrijving}</div>
                </div>
                {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>
              {open && (
                <div className="mt-3 ml-7 space-y-2 text-xs">
                  {(r.oude_waarde !== null || r.nieuwe_waarde !== null) && (
                    <div className="grid grid-cols-2 gap-2">
                      <Block label="Oude waarde" value={r.oude_waarde} />
                      <Block label="Nieuwe waarde" value={r.nieuwe_waarde} />
                    </div>
                  )}
                  {(r.tabel || r.rij_id) && (
                    <div className="text-muted-foreground">
                      {r.tabel && <>Tabel: <span className="font-mono">{r.tabel}</span> </>}
                      {r.rij_id && <>· rij <span className="font-mono">{r.rij_id}</span></>}
                    </div>
                  )}
                  {r.uitgevoerd_door && (
                    <div className="text-muted-foreground">Door: {r.uitgevoerd_door}</div>
                  )}
                  {r.details !== null && (
                    <details>
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Technische details
                      </summary>
                      <pre className="mt-1 p-2 rounded bg-muted text-[11px] overflow-auto max-h-64">
                        {JSON.stringify(r.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Block({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <pre className="p-2 rounded bg-muted text-[11px] overflow-auto max-h-40">
        {value === null || value === undefined ? "—" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function toneText(r: LogResultaat) {
  if (r === "fout") return "text-destructive";
  if (r === "gedeeltelijk") return "text-amber-600";
  return "text-emerald-600";
}
