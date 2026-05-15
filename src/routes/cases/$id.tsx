import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { ArrowLeft, Download, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { MaterialenConfigurator } from "@/components/configurator/MaterialenConfigurator";
import { exporteerNaarTemplate, downloadBlob } from "@/lib/assortiment/excel";
import { emptyConfig, type MaterialenConfig, type RmuConfig } from "@/lib/configurator/types";

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

const STATUS_COLORS_ACTIVE: Record<string, string> = {
  concept: "bg-muted text-foreground",
  gepland: "bg-blue-500/15 text-blue-500 dark:text-blue-400",
  in_uitvoering: "bg-amber-500/15 text-amber-500 dark:text-amber-400",
  afgerond: "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400",
};

const CASE_TYPE_LABELS: Record<string, string> = {
  NSA: "NSA",
  provisorium: "Provisorium",
  compact: "Compact",
  custom: "Custom",
};

function CaseDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

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
  const [canSave, setCanSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewCount, setPreviewCount] = useState(0);
  const [saveSignal, setSaveSignal] = useState(0);
  const [mobileTab, setMobileTab] = useState<"config" | "preview">("config");

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
      const items = (opgeslagen ?? [])
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
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-border bg-card flex-shrink-0">
        <Link to="/cases" className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Link>

        <div className="w-px h-5 bg-border" />

        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wider">
            {CASE_TYPE_LABELS[caseRow.case_type] ?? caseRow.case_type}
          </span>
          {caseRow.case_nummer && (
            <span className="text-xs font-mono text-primary">{caseRow.case_nummer}</span>
          )}
          <input
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            onBlur={() => naam !== caseRow.station_naam && updateCase.mutate({ station_naam: naam || null })}
            placeholder="Stationsnaam"
            className="bg-transparent text-sm font-semibold focus:outline-none focus:bg-input rounded-md px-2 py-0.5 min-w-0 flex-1"
          />
        </div>

        {/* Voortgang */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-xs text-muted-foreground font-mono tabular-nums">
            {completed}/{total}
          </div>
          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Status pills */}
        <div className="flex items-center gap-1">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => updateCase.mutate({ status: s })}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all",
                caseRow.status === s
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Acties */}
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-[11px] text-amber-500 dark:text-amber-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse" />
              Niet opgeslagen
            </span>
          )}
          <button
            onClick={() => setSaveSignal((c) => c + 1)}
            disabled={saving || !canSave}
            title={!canSave ? "Vul alle secties in" : "Opslaan"}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Opslaan…" : "Opslaan"}
          </button>
          <button
            onClick={() => exporteer.mutate()}
            disabled={isDirty || !heeftMateriaal || exporteer.isPending}
            title={isDirty ? "Sla eerst op voor je exporteert" : heeftMateriaal ? "Exporteren naar Excel" : "Sla eerst de materiaallijst op"}
            className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {exporteer.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export
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

      <div className="flex-1 overflow-y-auto px-6 py-5">
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
              onCanSaveChange={setCanSave}
              onSavingChange={setSaving}
              onPreviewCountChange={setPreviewCount}
              saveSignal={saveSignal}
              mobileTab={mobileTab}
            />
          )}
        </div>
      </div>
    </div>
  );
}
