import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import {
  runChecks,
  GROEP_LABEL,
  GROEP_VOLGORDE,
  SEVERITY_ORDER,
  type Beheergebied,
  type Issue,
  type Severity,
} from "@/lib/beheer/dataKwaliteit";

// =====================================================================
// UI
// =====================================================================

const SEVERITY_BADGE: Record<Severity, { label: string; cls: string; icon: typeof Info }> = {
  kritiek: {
    label: "Kritiek",
    cls: "bg-destructive/15 text-destructive border-destructive/30",
    icon: AlertCircle,
  },
  waarschuwing: {
    label: "Waarschuwing",
    cls: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    icon: AlertTriangle,
  },
  info: {
    label: "Info",
    cls: "bg-sky-500/15 text-sky-600 border-sky-500/30",
    icon: Info,
  },
  ok: {
    label: "OK",
    cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    icon: CheckCircle2,
  },
};

export function DataKwaliteitTab() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["data-kwaliteit-v2"],
    queryFn: runChecks,
    staleTime: 0,
  });

  const [ernstFilter, setErnstFilter] = useState<Severity | "alle">("alle");
  const [groepFilter, setGroepFilter] = useState<Beheergebied | "alle">("alle");
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [alternatiefFilter, setAlternatiefFilter] = useState<"alle" | "met" | "zonder">("alle");
  const [alleenActie, setAlleenActie] = useState(false);
  const [geopend, setGeopend] = useState<Set<string>>(new Set());

  const alle = data?.issues ?? [];
  const meta = data?.meta;
  const fouten = data?.fouten ?? [];

  const counts = useMemo(() => {
    const c = { kritiek: 0, waarschuwing: 0, info: 0, ok: 0 };
    for (const i of alle) c[i.severity]++;
    return c;
  }, [alle]);

  const gefilterd = useMemo(() => {
    return alle.filter((i) => {
      if (ernstFilter !== "alle" && i.severity !== ernstFilter) return false;
      if (groepFilter !== "alle" && i.groep !== groepFilter) return false;
      if (statusFilter !== "alle" && (i.artikelStatus ?? "") !== statusFilter) return false;
      if (alternatiefFilter === "met" && !i.heeftAlternatief) return false;
      if (alternatiefFilter === "zonder" && i.heeftAlternatief) return false;
      if (alleenActie && (i.severity === "ok" || i.severity === "info")) return false;
      return true;
    });
  }, [alle, ernstFilter, groepFilter, statusFilter, alternatiefFilter, alleenActie]);

  const gegroepeerd = useMemo(() => {
    const map = new Map<Beheergebied, Issue[]>();
    for (const i of gefilterd) {
      const arr = map.get(i.groep) ?? [];
      arr.push(i);
      map.set(i.groep, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    }
    return GROEP_VOLGORDE.filter((g) => map.has(g)).map((g) => ({ groep: g, items: map.get(g)! }));
  }, [gefilterd]);

  const statusOpties = useMemo(() => {
    const s = new Set<string>();
    for (const i of alle) if (i.artikelStatus) s.add(i.artikelStatus);
    return [...s].sort();
  }, [alle]);

  function toggle(id: string) {
    setGeopend((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Datakwaliteit</h2>
          <p className="text-sm text-muted-foreground">
            Checklist om de configurator, winkelwagen en Liander-export betrouwbaar te houden.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          {isFetching ? "Bezig…" : "Opnieuw controleren"}
        </button>
      </div>

      {/* Samenvatting */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <SummaryCard label="Kritiek" count={counts.kritiek} severity="kritiek" />
        <SummaryCard label="Waarschuwing" count={counts.waarschuwing} severity="waarschuwing" />
        <SummaryCard label="Info" count={counts.info} severity="info" />
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="text-xs text-muted-foreground">Laatste Liander-sync</div>
          <div className="text-sm font-medium mt-1 truncate">
            {meta?.laatsteSyncIso
              ? new Date(meta.laatsteSyncIso).toLocaleDateString("nl-NL")
              : "geen registratie"}
          </div>
          {meta?.laatsteSyncBestand && (
            <div className="text-[11px] text-muted-foreground truncate">
              {meta.laatsteSyncBestand}
            </div>
          )}
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="text-xs text-muted-foreground">Uitloop / inactief</div>
          <div className="text-sm font-medium mt-1">
            {meta?.artikelenUitloopVerwijderd ?? "—"} artikelen
          </div>
          <div className="text-[11px] text-muted-foreground">
            van {meta?.aantalArtikelen ?? "—"} totaal
          </div>
        </div>
      </div>

      {/* Foutmeldingen voor checks die niet konden draaien */}
      {fouten.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm space-y-1">
          <div className="font-medium text-destructive">Sommige checks konden niet draaien:</div>
          <ul className="text-xs text-destructive/80 list-disc list-inside">
            {fouten.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <FilterSelect
          label="Ernst"
          value={ernstFilter}
          onChange={(v) => setErnstFilter(v as Severity | "alle")}
          opties={[
            { value: "alle", label: "Alle" },
            { value: "kritiek", label: "Kritiek" },
            { value: "waarschuwing", label: "Waarschuwing" },
            { value: "info", label: "Info" },
            { value: "ok", label: "OK" },
          ]}
        />
        <FilterSelect
          label="Gebied"
          value={groepFilter}
          onChange={(v) => setGroepFilter(v as Beheergebied | "alle")}
          opties={[
            { value: "alle", label: "Alle" },
            ...GROEP_VOLGORDE.map((g) => ({ value: g, label: GROEP_LABEL[g] })),
          ]}
        />
        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          opties={[
            { value: "alle", label: "Alle" },
            ...statusOpties.map((s) => ({ value: s, label: s })),
          ]}
        />
        <FilterSelect
          label="Alternatief"
          value={alternatiefFilter}
          onChange={(v) => setAlternatiefFilter(v as "alle" | "met" | "zonder")}
          opties={[
            { value: "alle", label: "Alle" },
            { value: "met", label: "Met alternatief" },
            { value: "zonder", label: "Zonder alternatief" },
          ]}
        />
        <label className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border cursor-pointer hover:bg-muted">
          <input
            type="checkbox"
            checked={alleenActie}
            onChange={(e) => setAlleenActie(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          <span className="text-xs">Alleen actie nodig</span>
        </label>
        <div className="text-xs text-muted-foreground ml-auto">
          {gefilterd.length} van {alle.length} meldingen
        </div>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Controles uitvoeren…</div>}
      {error && <div className="text-sm text-destructive">Fout: {(error as Error).message}</div>}

      {!isLoading && gegroepeerd.length === 0 && (
        <div className="rounded-md border border-border p-6 text-sm text-muted-foreground text-center">
          Geen meldingen die aan de filters voldoen.
        </div>
      )}

      <div className="space-y-4">
        {gegroepeerd.map(({ groep, items }) => (
          <section key={groep} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold tracking-tight">{GROEP_LABEL[groep]}</h3>
              <span className="text-xs text-muted-foreground">{items.length} melding(en)</span>
            </div>
            <div className="border border-border rounded-md divide-y divide-border">
              {items.map((i) => {
                const open = geopend.has(i.id);
                const cfg = SEVERITY_BADGE[i.severity];
                const Icon = cfg.icon;
                return (
                  <div key={i.id} className="p-3">
                    <button
                      onClick={() => toggle(i.id)}
                      className="w-full flex items-start gap-3 text-left"
                    >
                      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", toneText(i.severity))} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{i.titel}</span>
                          <span
                            className={cn(
                              "text-[10px] uppercase tracking-wider border rounded px-1.5 py-0.5",
                              cfg.cls,
                            )}
                          >
                            {cfg.label}
                          </span>
                          {i.artikelStatus && (
                            <span className="text-[10px] uppercase tracking-wider border rounded px-1.5 py-0.5 bg-muted text-muted-foreground border-border">
                              {i.artikelStatus}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{i.probleem}</div>
                      </div>
                      {open ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    {open && (
                      <div className="mt-3 ml-7 space-y-2 text-xs">
                        <div>
                          <span className="font-medium">Risico: </span>
                          <span className="text-muted-foreground">{i.risico}</span>
                        </div>
                        <div>
                          <span className="font-medium">Actie: </span>
                          <span className="text-muted-foreground">{i.actie}</span>
                        </div>
                        {i.details && i.details.length > 0 && (
                          <details className="text-muted-foreground">
                            <summary className="cursor-pointer hover:text-foreground">
                              Details
                            </summary>
                            <ul className="mt-1 list-disc list-inside space-y-0.5">
                              {i.details.map((d, idx) => (
                                <li key={idx}>{d}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                        {i.acties.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {i.acties.map((a, idx) => (
                              <Link
                                key={idx}
                                to={a.to}
                                search={a.search as never}
                                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:bg-muted"
                              >
                                {a.icon ? (
                                  <a.icon className="h-3 w-3" />
                                ) : (
                                  <ExternalLink className="h-3 w-3" />
                                )}
                                {a.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  count,
  severity,
}: {
  label: string;
  count: number;
  severity: Severity;
}) {
  const cfg = SEVERITY_BADGE[severity];
  return (
    <div className={cn("rounded-lg border p-3", cfg.cls)}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-2xl font-semibold mt-1">{count}</div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  opties,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  opties: { value: string; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1 rounded-md border border-border bg-background text-xs"
      >
        {opties.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function toneText(s: Severity) {
  if (s === "kritiek") return "text-destructive";
  if (s === "waarschuwing") return "text-amber-600";
  if (s === "info") return "text-sky-600";
  return "text-emerald-600";
}
