import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect, useRef } from "react";
import { ArrowLeft, Download, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { MaterialenConfigurator } from "@/components/configurator/MaterialenConfigurator";
import { exporteerNaarTemplate, downloadBlob } from "@/lib/assortiment/excel";
import { emptyConfig, type MaterialenConfig, type PreviewItem, type RmuConfig } from "@/lib/configurator/types";
import { setGlobalDirty } from "@/lib/dirty-state";

export const Route = createFileRoute("/cases/$id")({
  component: CaseDetailPage,
});

const STATUS_LABELS: Record<string, string> = {
  concept: "Concept",
  gepland: "Gepland",
  in_uitvoering: "In uitvoering",
  afgerond: "Afgerond",
};
const STATUS_OPTIONS = ["concept", "gepland", "in_uitvoering", "afgerond"] as const;

const CASE_TYPE_LABELS: Record<string, string> = {
  NSA: "NSA",
  provisorium: "Provisorium",
  compact: "Compact",
  compact_prov: "Compact met Prov",
};

function CaseDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: caseRow, isLoading } = useQuery({
    queryKey: ["case", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cases").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const [naam, setNaam] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(1);
  const [saving, setSaving] = useState(false);
  const [previewCount, setPreviewCount] = useState(0);
  const [saveSignal, setSaveSignal] = useState(0);
  const [mobileTab, setMobileTab] = useState<"config" | "preview">("config");
  const winkelwagenItemsRef = useRef<PreviewItem[]>([]);

  // Reset winkelwagen-ref bij wisselen case
  useEffect(() => { winkelwagenItemsRef.current = []; }, [id]);

  // Sync naar globale dirty state (sidebar leest dit) en reset bij unmount
  useEffect(() => {
    setGlobalDirty(isDirty);
  }, [isDirty]);
  useEffect(() => () => setGlobalDirty(false), []);

  // Waarschuw bij tab sluiten / herladen met onopgeslagen wijzigingen
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const goBack = () => {
    if (isDirty && !confirm("Je hebt niet-opgeslagen wijzigingen. Weet je zeker dat je wilt teruggaan?")) {
      return;
    }
    navigate({ to: "/cases" });
  };

  useEffect(() => { if (caseRow?.station_naam) setNaam(caseRow.station_naam); }, [caseRow?.station_naam]);

  const updateCase = useMutation({
    mutationFn: async (patch: { station_naam?: string | null; status?: string }) => {
      const { error } = await supabase.from("cases").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case", id] }),
  });

  const { data: opgeslagen } = useQuery({
    queryKey: ["case-materialen", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_materialen")
        .select("gewenste_hoeveelheid, artikelen:artikel_id(artikel_nummer)")
        .eq("case_id", id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const exporteer = useMutation({
    mutationFn: async () => {
      const winkel = winkelwagenItemsRef.current;
      const items = winkel.length > 0
        ? winkel
            .map((p) => ({
              artikel_nummer: p.artikel_nummer,
              hoeveelheid: Number(p.hoeveelheid) || 0,
            }))
            .filter((i) => i.artikel_nummer && i.hoeveelheid > 0)
        : (opgeslagen ?? [])
            .map((r) => ({
              artikel_nummer: (r.artikelen as { artikel_nummer?: string } | null)?.artikel_nummer ?? "",
              hoeveelheid: Number(r.gewenste_hoeveelheid) || 0,
            }))
            .filter((i) => i.artikel_nummer && i.hoeveelheid > 0);
      const res = await exporteerNaarTemplate(items, caseRow?.case_nummer ?? null);
      downloadBlob(res.blob, res.filename);
      return res;
    },
    onSuccess: (res) => {
      toast.success(`Geëxporteerd · ${res.matched} gematcht${res.unmatched.length ? `, ${res.unmatched.length} zonder Liander-nummer` : ""}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: rmuConfigs, isLoading: rmuLoading, error: rmuError } = useQuery({
    queryKey: ["rmu_configuraties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rmu_configuraties")
        .select("*, rmu_artikel:artikelen!rmu_configuraties_rmu_artikel_id_fkey(*), frame_artikel:artikelen!rmu_configuraties_frame_artikel_id_fkey(*), bodemplaat_artikel:artikelen!rmu_configuraties_bodemplaat_artikel_id_fkey(*)")
        .eq("actief", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const initialConfig = useMemo<MaterialenConfig | null | undefined>(() => {
    if (!caseRow) return undefined;
    const raw = caseRow.config_json as Partial<MaterialenConfig> | null;
    if (!raw || typeof raw !== "object") return null;
    if (!rmuConfigs) return undefined;
    const base: MaterialenConfig = { ...emptyConfig(), ...raw } as MaterialenConfig;
    const oversteekDefaults = { heeftOversteek: false, aantalOversteken: 1, oversteekMeters: 0 };
    base.msKabelTraces = ((raw.msKabelTraces ?? []) as unknown as Record<string, unknown>[]).map(
      (t) => ({ ...oversteekDefaults, ...t }) as MaterialenConfig["msKabelTraces"][number],
    );
    base.lsMoffen = ((raw.lsMoffen ?? []) as unknown as Record<string, unknown>[]).map(
      (m) => ({ ...oversteekDefaults, ...m }) as MaterialenConfig["lsMoffen"][number],
    );
    base.provLsMoffen = ((raw.provLsMoffen ?? []) as unknown as Record<string, unknown>[]).map(
      (m) => ({ ...oversteekDefaults, ...m }) as MaterialenConfig["lsMoffen"][number],
    );
    const savedRmuId = (raw.rmuConfig as { id?: string } | null | undefined)?.id ?? null;
    base.rmuConfig = savedRmuId
      ? ((rmuConfigs.find((c) => c.id === savedRmuId) as RmuConfig | undefined) ?? null)
      : null;
    const savedProvId = (raw.provRmuConfig as { id?: string } | null | undefined)?.id ?? null;
    base.provRmuConfig = savedProvId
      ? ((rmuConfigs.find((c) => c.id === savedProvId) as RmuConfig | undefined) ?? null)
      : null;
    return base;
  }, [caseRow, rmuConfigs]);

  const heeftMateriaal = previewCount > 0 || (opgeslagen?.length ?? 0) > 0;

  if (isLoading || !caseRow) {
    return (
      <div className="px-8 py-6 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Case laden…
      </div>
    );
  }

  const configReady = initialConfig !== undefined;
  const showRehydrationError = !!rmuError && !!caseRow.config_json;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Eén header-rij: identiteit + status tabs links, acties rechts */}
      <div className="flex items-center gap-4 px-4 sm:px-6 py-3 border-b border-border bg-card flex-shrink-0">
        <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Identiteit */}
        <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
          <span className="text-[10px] px-2 py-0.5 rounded bg-[color:var(--navy)] text-white uppercase tracking-wider font-semibold">
            {CASE_TYPE_LABELS[caseRow.case_type] ?? caseRow.case_type}
          </span>
          <div className="flex flex-col min-w-0">
            {caseRow.case_nummer && (
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider leading-none">
                {caseRow.case_nummer}
              </span>
            )}
            <input
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              onBlur={() => naam !== caseRow.station_naam && updateCase.mutate({ station_naam: naam || null })}
              placeholder="Stationsnaam"
              className="bg-transparent text-lg font-bold text-[color:var(--navy)] focus:outline-none focus:bg-input rounded-md -mx-1 px-1 leading-tight min-w-0 max-w-[280px]"
            />
          </div>
        </div>

        {/* Status tabs */}
        <nav className="flex items-end gap-1 self-end h-full flex-shrink min-w-0 overflow-x-auto">
          {STATUS_OPTIONS.map((s) => {
            const isActive = caseRow.status === s;
            return (
              <button
                key={s}
                onClick={() => updateCase.mutate({ status: s })}
                className={cn(
                  "px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap border-b-2 -mb-3",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                {STATUS_LABELS[s]}
              </button>
            );
          })}
        </nav>

        {/* Acties rechts */}
        <div className="ml-auto flex items-center gap-3 flex-shrink-0">
          <div className="hidden md:flex items-center gap-2">
            <div className="w-28 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground font-mono tabular-nums w-8 text-right">
              {progress}%
            </span>
          </div>
          {isDirty && (
            <span className="text-[11px] text-[color:var(--warning)] hidden lg:flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--warning)] animate-pulse" />
              Niet opgeslagen
            </span>
          )}
          <button
            onClick={() => setSaveSignal((c) => c + 1)}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-[color:var(--primary-hover)] shadow-sm transition-opacity disabled:opacity-50 flex items-center gap-1.5"
          >
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">{saving ? "Opslaan…" : "Opslaan"}</span>
          </button>
          <button
            onClick={() => {
              if (isDirty) {
                toast.warning("Je hebt niet-opgeslagen wijzigingen. Sla eerst op voor je exporteert.");
                return;
              }
              if (!heeftMateriaal) {
                toast.warning("Sla eerst de materiaallijst op voor je exporteert.");
                return;
              }
              exporteer.mutate();
            }}
            disabled={exporteer.isPending || isDirty}
            className="px-4 py-2 rounded-lg border border-border text-foreground text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            {exporteer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Mobile tab toggle */}
      <div className="flex lg:hidden border-b border-border bg-card">
        {(["config", "preview"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={cn(
              "flex-1 py-2.5 text-xs font-medium transition-colors",
              mobileTab === tab
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground",
            )}
          >
            {tab === "config" ? "Configuratie" : `Preview${previewCount > 0 ? ` (${previewCount})` : ""}`}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-5">
        <div className="max-w-[1500px] mx-auto">
          {showRehydrationError && (
            <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Opgeslagen configuratie kon niet volledig worden hersteld: {(rmuError as Error).message}
            </div>
          )}

          {!configReady || rmuLoading ? (
            <div className="px-2 py-12 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Configuratie herstellen…
            </div>
          ) : (
            <MaterialenConfigurator
              key={id}
              caseId={id}
              caseType={caseRow.case_type}
              initialConfig={initialConfig}
              onDirtyChange={setIsDirty}
              onProgressChange={(c, t) => { setCompleted(c); setTotal(t); }}
              onSavingChange={setSaving}
              onPreviewCountChange={setPreviewCount}
              onWinkelwagenItemsChange={(items) => { winkelwagenItemsRef.current = items; }}
              saveSignal={saveSignal}
              mobileTab={mobileTab}
            />
          )}
        </div>
      </div>
    </div>
  );
}
