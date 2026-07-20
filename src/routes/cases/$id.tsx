import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect, useRef } from "react";
import { ArrowLeft, Download, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { MaterialenConfigurator } from "@/components/configurator/MaterialenConfigurator";
import { exporteerNaarTemplate, downloadBlob } from "@/lib/assortiment/excel";
import {
  CASE_TYPE_LABELS,
  emptyConfig,
  type MaterialenConfig,
  type PreviewItem,
  type RmuConfig,
  type WinkelwagenAanpassingen,
} from "@/lib/configurator/types";
import { setGlobalDirty } from "@/lib/dirty-state";
import { ExportHistoriePopover } from "@/components/cases/ExportHistoriePopover";

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

  const headerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const apply = () => {
      const h = Math.round(el.getBoundingClientRect().height);
      document.documentElement.style.setProperty("--app-header-h", `${h}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, []);

  const [naam, setNaam] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(1);
  const [saving, setSaving] = useState(false);
  const [previewCount, setPreviewCount] = useState(0);
  const [saveSignal, setSaveSignal] = useState(0);
  const [exportSignal, setExportSignal] = useState(0);
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
        .select("gewenste_hoeveelheid, niet_bestellen, artikelen:artikel_id(artikel_nummer)")
        .eq("case_id", id);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Laatste export = laatst geplaatste bestelling. Wijzigingen daarna wijken
  // af van een bestelling — de correctiedialoog waarschuwt daar dan voor.
  const { data: laatsteExport } = useQuery({
    queryKey: ["case-exporten", id, "laatste"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_exporten")
        .select("id, created_at, bestand_naam")
        .eq("case_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    retry: false,
  });

  const exporteer = useMutation({
    mutationFn: async () => {
      const winkel = winkelwagenItemsRef.current;
      // Artikelen gemarkeerd als "niet bestellen" horen níet in de export —
      // de Excel gaat direct als bestelling naar Liander.
      const items = winkel.length > 0
        ? winkel
            .filter((p) => !p.niet_bestellen)
            .map((p) => ({
              artikel_nummer: p.artikel_nummer,
              hoeveelheid: Number(p.hoeveelheid) || 0,
              actief: !p.inactief,
              korte_omschrijving: p.korte_omschrijving,
            }))
            .filter((i) => i.artikel_nummer && i.hoeveelheid > 0)
        : (opgeslagen ?? [])
            .filter((r) => !r.niet_bestellen)
            .map((r) => ({
              artikel_nummer: (r.artikelen as { artikel_nummer?: string } | null)?.artikel_nummer ?? "",
              hoeveelheid: Number(r.gewenste_hoeveelheid) || 0,
            }))
            .filter((i) => i.artikel_nummer && i.hoeveelheid > 0);
      const res = await exporteerNaarTemplate(items, caseRow?.case_nummer ?? null, caseRow?.station_naam ?? null);
      downloadBlob(res.blob, res.filename);

      // Bevroren momentopname van deze bestelling. Mag de export zelf nooit
      // blokkeren — bij een fout waarschuwen we alleen.
      let snapshotOk = true;
      try {
        const { error: snapErr } = await supabase.from("case_exporten").insert({
          case_id: id,
          bestand_naam: res.filename,
          case_nummer: caseRow?.case_nummer ?? null,
          station_naam: caseRow?.station_naam ?? null,
          aantal_artikelen: items.length,
          matched: res.matched,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          unmatched: res.unmatched as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          inactief: res.inactief as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          items: items as any,
        });
        if (snapErr) throw snapErr;
        qc.invalidateQueries({ queryKey: ["case-exporten", id] });
      } catch (snapE) {
        snapshotOk = false;
        console.warn("[export] Snapshot kon niet worden opgeslagen:", snapE);
      }
      return { ...res, snapshotOk };
    },
    onSuccess: (res) => {
      if (!res.snapshotOk) {
        toast.warning(
          "Export gelukt, maar de bestelling kon niet in de exporthistorie worden vastgelegd. " +
            "Controleer of de laatste database-migratie (case_exporten) is uitgevoerd.",
        );
      }
      const stukken: string[] = [`${res.matched} gematcht`];
      if (res.unmatched.length) stukken.push(`${res.unmatched.length} zonder Liander-nummer`);
      if (res.inactief.length) stukken.push(`${res.inactief.length} inactief`);
      toast.success(`Geëxporteerd · ${stukken.join(", ")}`);
      if (res.inactief.length > 0) {
        const eersten = res.inactief.slice(0, 5).map((i) => i.artikel_nummer).join(", ");
        const meer = res.inactief.length > 5 ? ` (+${res.inactief.length - 5})` : "";
        toast.warning(
          `Let op: ${res.inactief.length} artikel(en) in deze export zijn inactief in de Liander-template: ${eersten}${meer}. Overweeg ze te migreren naar hun alternatief via Beheer → Assortiment.`,
          { duration: 10000 },
        );
      }
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
    // winkelwagen-aanpassingen zitten in dezelfde JSON maar horen niet in de
    // config-state — die gaan apart via initialAanpassingen naar de winkelwagen.
    delete (base as unknown as { winkelwagen?: unknown }).winkelwagen;
    const oversteekDefaults = { heeftOversteek: false, aantalOversteken: 1, oversteekMeters: 0 };
    base.msKabelTraces = ((raw.msKabelTraces ?? []) as unknown as Record<string, unknown>[]).map(
      (t) => ({ ...oversteekDefaults, ...t }) as MaterialenConfig["msKabelTraces"][number],
    );
    base.lsKabelTraces = ((raw.lsKabelTraces ?? []) as unknown as Record<string, unknown>[]).map(
      (t) => ({ ...oversteekDefaults, lengteMeters: 0, ...t }) as MaterialenConfig["lsKabelTraces"][number],
    );
    base.lsMoffen = ((raw.lsMoffen ?? []) as unknown as Record<string, unknown>[]).map(
      (m) => ({ ...oversteekDefaults, opnieuwAantal: 1, ...m }) as MaterialenConfig["lsMoffen"][number],
    );
    base.provLsMoffen = ((raw.provLsMoffen ?? []) as unknown as Record<string, unknown>[]).map(
      (m) => ({ ...oversteekDefaults, opnieuwAantal: 1, ...m }) as MaterialenConfig["lsMoffen"][number],
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

  // Eerder opgeslagen winkelwagen-correcties (overrides/verwijderd/toegevoegd)
  const initialAanpassingen = useMemo<WinkelwagenAanpassingen | null>(() => {
    const raw = caseRow?.config_json as { winkelwagen?: WinkelwagenAanpassingen } | null;
    return raw?.winkelwagen ?? null;
  }, [caseRow]);

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
    <div className="flex flex-col h-[100svh]">
      {/* Eén header-rij: identiteit + status tabs links, acties rechts */}
      <div ref={headerRef} className="flex items-center gap-4 px-4 sm:px-6 py-3 border-b border-border bg-card flex-shrink-0">
        <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Identiteit */}
        <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
          <span className="text-[10px] px-2 py-0.5 rounded bg-[color:var(--navy)] text-[color:var(--background)] uppercase tracking-wider font-semibold">
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
              // Triggert de winkelwagen-bevestigingsmodal als er inactieve/uitgelopen/
              // geblokkeerde/verwijderde artikelen in de export zitten. De winkelwagen
              // roept zelf onExport (→ exporteer.mutate) aan na bevestiging.
              setExportSignal((c) => c + 1);
            }}
            disabled={exporteer.isPending || isDirty}
            className="px-4 py-2 rounded-lg border border-border text-foreground text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            {exporteer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="hidden sm:inline">Export</span>
          </button>
          <ExportHistoriePopover caseId={id} />
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

      <div className="flex-1 overflow-y-auto">
        <div>
          {showRehydrationError && (
            <div className="mx-6 mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Opgeslagen configuratie kon niet volledig worden hersteld: {(rmuError as Error).message}
            </div>
          )}

          {!configReady || rmuLoading ? (
            <div className="px-6 py-12 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Configuratie herstellen…
            </div>
          ) : (
            <MaterialenConfigurator
              key={id}
              caseId={id}
              caseType={caseRow.case_type}
              initialConfig={initialConfig}
              initialAanpassingen={initialAanpassingen}
              besteldOp={laatsteExport?.created_at ?? null}
              onDirtyChange={setIsDirty}
              onStatusChange={(s) => {
                setCompleted(s.completed);
                setTotal(s.total);
                setSaving(s.saving);
                setPreviewCount(s.previewCount);
              }}
              onWinkelwagenItemsChange={(items) => { winkelwagenItemsRef.current = items; }}
              saveSignal={saveSignal}
              mobileTab={mobileTab}
              onExport={() => {
                if (isDirty) { toast.warning("Sla eerst op voor je exporteert."); return; }
                if (!heeftMateriaal) { toast.warning("Geen materialen om te exporteren."); return; }
                exporteer.mutate();
              }}
              exportDisabled={isDirty || !heeftMateriaal}
              exportPending={exporteer.isPending}
              exportSignal={exportSignal}
            />
          )}
        </div>
      </div>
    </div>
  );
}
