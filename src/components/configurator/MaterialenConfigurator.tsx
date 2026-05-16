import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ClipboardList, Info, Layers, Cable, Zap, Box, Plug, Package, Plus, Trash2, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PillGroup } from "@/components/ui-prim/PillGroup";
import { Stepper } from "@/components/ui-prim/Stepper";
import { Field, FieldRow, InfoBox } from "@/components/ui-prim/Field";
import { useStamdata } from "@/lib/configurator/queries";
import { berekenPreview, VULT_KABEL_SPECS } from "@/lib/configurator/berekenen";
import {
  buildRmuVelden,
  DEFAULT_INET_ARTIKELEN,
  emptyConfig,
  emptyMofConfig,
  newLsMof,
  newRichting,
  PREVIEW_SECTIE_DEFS,
  RINGKLEM_SPECS,
  zoekRingklem,
  type LsKabelType,
  type LsMof,
  type LsMofType,
  type MaterialenConfig,
  type MsKabelTrace,
  type MsKabelType,
  type PreviewItem,
  type PreviewSectie,
  type RmuVeldConfig,
  type SubType,
} from "@/lib/configurator/types";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Winkelwagen } from "@/components/winkelwagen/Winkelwagen";

interface Props {
  caseId: string;
  caseType: string;
  initialConfig?: MaterialenConfig | null;
  onDirtyChange?: (isDirty: boolean) => void;
  onProgressChange?: (completed: number, total: number) => void;
  onSavingChange?: (saving: boolean) => void;
  onPreviewCountChange?: (count: number) => void;
  onWinkelwagenItemsChange?: (items: PreviewItem[]) => void;
  saveSignal?: number;
  mobileTab?: "config" | "preview";
  onExport?: () => void;
  exportDisabled?: boolean;
  exportPending?: boolean;
}

// Nieuwe gegroepeerde sectievolgorde (TerreVolt redesign)
//  1 Type opdracht (navy)
//  2 Provisorium (blauw)        — alleen bij cs_met_prov / renovatie_prov
//  3 MS — Middenspanning (oranje) bevat RMU + I-Net + Veldinstellingen + traces + moffen
//  4 Trafo & Vult kabel (amber) — alleen renovatie
//  5 LS — Laagspanning (paars)  bevat LS-rek + OV-stuurpunt + LS moffen
//  6 Overig (grijs)             bevat GGI + standaard materialen
const SECTIONS = [
  { key: "project",     label: "Type opdracht",       color: "var(--color-section-project)",     icon: Layers },
  { key: "provisorium", label: "Provisorium",         color: "var(--color-section-provisorium)", icon: Cable },
  { key: "ms",          label: "MS — Middenspanning", color: "var(--color-section-ms)",          icon: Zap },
  { key: "trafo",       label: "Trafo & Vult kabel",  color: "var(--color-section-trafo)",       icon: Box },
  { key: "ls",          label: "LS — Laagspanning",   color: "var(--color-section-ls)",          icon: Plug },
  { key: "overig",      label: "Overig",              color: "var(--color-section-overig)",      icon: Package },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const RENOVATIE = (s: string) => s === "renovatie_prov" || s === "renovatie_nsa";

export function MaterialenConfigurator({
  caseId,
  caseType,
  initialConfig,
  onDirtyChange,
  onProgressChange,
  onSavingChange,
  onPreviewCountChange,
  onWinkelwagenItemsChange,
  saveSignal,
  mobileTab = "config",
  onExport,
  exportDisabled,
  exportPending,
}: Props) {
  const isCompact = caseType === "compact" || caseType === "compact_prov";
  const isCompactProv = caseType === "compact_prov";
  const initial = useMemo(() => {
    const base = initialConfig ?? emptyConfig();
    if (isCompactProv) {
      return { ...base, isCompactStation: true, subType: "cs_met_prov" as SubType };
    }
    if (isCompact) {
      return { ...base, isCompactStation: true, subType: "cs_zonder_prov" as SubType };
    }
    return { ...base, isCompactStation: false };
  }, [initialConfig, isCompact, isCompactProv]);
  const [config, setConfig] = useState<MaterialenConfig>(initial);

  // Nieuwe lege case → alleen eerste sectie open. Bestaande config → alles open.
  // Secties openen/sluiten daarna alleen nog door expliciet op de header te klikken.
  const isNewCase = !initialConfig || !initialConfig.subType;
  const [open, setOpen] = useState<Record<SectionKey, boolean>>(() =>
    isNewCase
      ? { project: true, provisorium: false, ms: false, trafo: false, ls: false, overig: false }
      : { project: true, provisorium: true, ms: true, trafo: true, ls: true, overig: true },
  );
  // Welke configurator sectie is als laatst door de engineer geopend → winkelwagen synchroniseert mee
  const [activeSectie, setActiveSectie] = useState<SectionKey | null>("project");
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [debounced, setDebounced] = useState(config);

  // Dirty tracking — skip de eerste render (initialConfig hydratie)
  const skipDirty = useRef(true);
  useEffect(() => {
    if (skipDirty.current) {
      skipDirty.current = false;
      return;
    }
    onDirtyChange?.(true);
  }, [config, onDirtyChange]);

  useEffect(() => {
    // SubType direct doorrekenen (geen debounce) — andere wijzigingen wel debouncen
    if (config.subType !== debounced.subType) {
      setDebounced(config);
      return;
    }
    const t = setTimeout(() => setDebounced(config), 300);
    return () => clearTimeout(t);
  }, [config, debounced.subType]);

  const sd = useStamdata(caseType);
  const preview = useMemo<PreviewItem[]>(
    () => (sd.isLoading ? [] : berekenPreview(debounced, sd, caseType)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debounced, sd.isLoading, caseType, sd.artikelen.data, sd.rmuConfigs.data, sd.rmuVeldArtikelen.data, sd.rmuZekeringen.data, sd.msMofTypes.data, sd.msMofMaterialen.data, sd.lsMofTypes.data, sd.lsMofMaterialen.data, sd.standaardTemplates.data, sd.stationVaste.data],
  );
  // Effectieve winkelwagen-items (na overrides / verwijderingen / handmatig toegevoegde)
  const winkelwagenItemsRef = useRef<PreviewItem[]>([]);

  const showTrafo = !isCompact && RENOVATIE(config.subType);
  const showLsRek = !isCompact && RENOVATIE(config.subType);
  const showVultKabel = !isCompact && RENOVATIE(config.subType);

  const isProvisorum = config.subType === "cs_met_prov" || config.subType === "renovatie_prov";
  const richtingComplete = (r: MaterialenConfig["msRichtingen"][number]): boolean => {
    if (isProvisorum) {
      if (r.kanZwaaien === null) return false;
      if (r.kanZwaaien === true) return true;
      if (!r.mofDefinitief?.mofTypeId) return false;
    }
    if (!r.mofTijdelijk.mofTypeId) return false;
    return true;
  };
  const isRenovatie = config.subType === "renovatie_prov" || config.subType === "renovatie_nsa";
  // Sub-completion (per onderdeel) — gegroepeerd in supergroepen hieronder
  const rmuOk = !!config.rmuConfig && (!isCompact || !!config.trafoKva);
  const trafoOk = isCompact ? true : (!showTrafo || (!!config.trafoActie && !!config.trafoKva));
  const vultKabelOk = isCompact ? true : (!isRenovatie || config.vultKabelAfstand > 0);
  const lsRekOk = isCompact
    ? true
    : (!isRenovatie ||
      (!!config.lsRekActie && (config.lsRekActie === "gehandhaafd" || !!config.lsRekType)));
  const msMoffenOk = config.msRichtingen.length === 0 || config.msRichtingen.every(richtingComplete);
  const lsMoffenOk =
    !config.lsMoffenActief ||
    (config.lsMoffen.length > 0 &&
      config.lsMoffen.every((m) => !!m.type && !!m.bestaandType));

  const completion: Record<SectionKey, boolean> = {
    project: !!config.subType,
    provisorium:
      !isProvisorum ||
      (!!config.provRmuMerk && !!config.provRmuConfig && !!config.provZekeringKva),
    // MS supergroep: RMU + alle MS verbindingen
    ms: rmuOk && msMoffenOk,
    // Trafo supergroep: trafo + vult kabel
    trafo: trafoOk && vultKabelOk,
    // LS supergroep: LS-rek + LS moffen
    ls: lsRekOk && lsMoffenOk,
    // Overig (GGI + standaard) — informatief, altijd compleet
    overig: true,
  };
  const visibleKeys: SectionKey[] = SECTIONS.map((s) => s.key).filter((k) => {
    if (k === "provisorium") return isProvisorum && (!isCompact || isCompactProv);
    if (k === "trafo") return showTrafo || showVultKabel;
    if (k === "overig") return true;
    return true;
  });
  const totalVisible = visibleKeys.length;
  const completedCount = visibleKeys.filter((k) => completion[k]).length;
  const allComplete = completedCount === totalVisible;

  const update = (patch: Partial<MaterialenConfig>) => setConfig((c) => ({ ...c, ...patch }));

  // State doorgeven aan parent (header)
  useEffect(() => { onProgressChange?.(completedCount, totalVisible); }, [completedCount, totalVisible, onProgressChange]);
  useEffect(() => { onPreviewCountChange?.(preview.length); }, [preview.length, onPreviewCountChange]);

  const opslaan = useMutation({
    mutationFn: async () => {
      // Waarschuw maar blokkeer niet bij onvolledige secties
      if (!allComplete) {
        const missing = totalVisible - completedCount;
        toast.warning(`${missing} sectie${missing === 1 ? "" : "s"} nog niet volledig — toch opgeslagen`);
      }
      // Volledige config opslaan als JSON. rmuConfig wordt afgeslankt tot {id};
      // bij rehydratie wordt het volledige object opgezocht in de stamdata.
      const configToSave = {
        ...config,
        rmuConfig: config.rmuConfig ? { id: config.rmuConfig.id } : null,
        provRmuConfig: config.provRmuConfig ? { id: config.provRmuConfig.id } : null,
      };

      const { error: caseErr } = await supabase
        .from("cases")
        .update({
          sub_type: config.subType || null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config_json: configToSave as any,
        })
        .eq("id", caseId);
      if (caseErr) throw caseErr;

      // case_materialen vervangen — gebruik de effectieve winkelwagen-items
      // (incl. overrides, excl. verwijderde, incl. handmatig toegevoegde)
      const effectief = winkelwagenItemsRef.current.length > 0 || preview.length === 0
        ? winkelwagenItemsRef.current
        : preview;
      await supabase.from("case_materialen").delete().eq("case_id", caseId);
      if (effectief.length > 0) {
        const rows = effectief.map((p) => ({
          case_id: caseId,
          artikel_id: p.artikel_id,
          gewenste_hoeveelheid: p.hoeveelheid,
          niet_bestellen: p.niet_bestellen,
          herkomst_label: p.herkomst.join(", "),
        }));
        const { error } = await supabase.from("case_materialen").insert(rows);
        if (error) throw error;
      }

      // ms moffen — één rij per richting met alle definitief-velden ingebed
      await supabase.from("case_ms_moffen").delete().eq("case_id", caseId);
      if (config.msRichtingen.length > 0) {
        const rows = config.msRichtingen.map((r, i) => ({
          case_id: caseId,
          positie: i + 1,
          zwaaien: r.kanZwaaien === true,
          fase: isProvisorum ? "tijdelijk" : "enkel",
          bestaand_type: r.mofTijdelijk.bestaandType || null,
          doorsnede: r.mofTijdelijk.bestaandDoorsnede,
          nieuw_type: r.mofTijdelijk.nieuwType || null,
          nieuw_doorsnede: r.mofTijdelijk.nieuwDoorsnede,
          mof_type_id: r.mofTijdelijk.mofTypeId,
          mof_handmatig: r.mofTijdelijk.mofHandmatig,
          is_eindmof: r.mofTijdelijk.isEindmof ?? false,
          mof_definitief_type_id: r.mofDefinitief?.mofTypeId ?? null,
          def_bestaand_type: r.mofDefinitief?.bestaandType ?? null,
          def_doorsnede: r.mofDefinitief?.bestaandDoorsnede ?? null,
          def_nieuw_type: r.mofDefinitief?.nieuwType ?? null,
          def_nieuw_doorsnede: r.mofDefinitief?.nieuwDoorsnede ?? null,
          def_mof_handmatig: r.mofDefinitief?.mofHandmatig ?? false,
          def_is_eindmof: r.mofDefinitief?.isEindmof ?? false,
        }));
        const { error } = await supabase.from("case_ms_moffen").insert(rows);
        if (error) throw error;
      }

      // ls moffen
      await supabase.from("case_ls_moffen").delete().eq("case_id", caseId);
      if (config.lsMoffenActief && config.lsMoffen.length > 0) {
        const rows = config.lsMoffen.map((m, i) => ({
          case_id: caseId,
          positie: i + 1,
          type: m.type || "verbinding",
          bestaand_type: m.bestaandType || "GPLK",
          hoofdkabel_doorsnede: m.hoofdkabelDoorsnede,
          hoofdkabel_materiaal: m.hoofdkabelMateriaal || null,
          aantal_aftakken: m.aantalAftakken,
          aftak_doorsnede: m.aftakDoorsnede,
          ringklem_artikel_nummer: m.ringklemArtikelNummer,
          ringklem_handmatig: m.ringklemHandmatig,
          aantal: m.aantal,
          kan_zwaaien: m.kanZwaaien,
          kabel_lengte_meters: m.kabelLengteMeters,
          overzettingen: 0,
        }));
        const { error } = await supabase.from("case_ls_moffen").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      onDirtyChange?.(false);
      toast.success("Materiaallijst opgeslagen");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Saving status doorgeven
  useEffect(() => { onSavingChange?.(opslaan.isPending); }, [opslaan.isPending, onSavingChange]);

  // Save trigger vanuit de header
  const lastSaveSignalRef = useRef(saveSignal ?? 0);
  useEffect(() => {
    if (saveSignal === undefined) return;
    if (saveSignal !== lastSaveSignalRef.current) {
      lastSaveSignalRef.current = saveSignal;
      if (!opslaan.isPending) opslaan.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSignal]);

  // ---- Render ----
  const stamErrors = [
    sd.artikelen.error,
    sd.rmuConfigs.error,
    sd.msMofTypes.error,
    sd.lsMofTypes.error,
  ].filter(Boolean) as Error[];

  if (stamErrors.length > 0) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-destructive">Stamdata kon niet worden geladen</div>
          <div className="text-xs text-destructive/80 mt-1 break-words">
            {stamErrors[0]?.message ?? "Onbekende fout"}
          </div>
          <button
            type="button"
            onClick={() => {
              sd.artikelen.refetch();
              sd.rmuConfigs.refetch();
              sd.msMofTypes.refetch();
              sd.lsMofTypes.refetch();
            }}
            className="mt-2 text-xs underline hover:no-underline text-destructive"
          >
            Opnieuw proberen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-0 lg:gap-0">
      <div className={cn("space-y-6 max-w-4xl w-full mx-auto px-2 sm:px-4 py-2", mobileTab === "preview" && "hidden lg:block")}>
        {SECTIONS.map((sec, idx) => {
          if (sec.key === "provisorium" && (!isProvisorum || (isCompact && !isCompactProv))) return null;
          if (sec.key === "trafo" && !(showTrafo || showVultKabel)) return null;
          return (
            <div
              key={sec.key}
              ref={(el) => { sectionRefs.current[sec.key] = el; }}
              className="scroll-mt-20"
            >
              <SectionCard
                color={sec.color}
                title={sec.label}
                index={idx + 1}
                Icon={sec.icon}
                isOpen={open[sec.key]}
                isComplete={completion[sec.key]}
                summary={sectionSummary(sec.key, config, sd)}
                onToggle={() => {
                  const willOpen = !open[sec.key];
                  setOpen({ ...open, [sec.key]: willOpen });
                  if (willOpen) setActiveSectie(sec.key);
                }}
              >
                {sec.key === "project" && <ProjectSection config={config} update={update} isCompact={isCompact} isCompactProv={isCompactProv} />}
                {sec.key === "provisorium" && <ProvisoriumSection config={config} update={update} sd={sd} />}
                {sec.key === "ms" && (
                  <div className="space-y-6">
                    <RmuSection config={config} update={update} sd={sd} isCompact={isCompact} />
                    <div className="border-t border-border pt-5">
                      <MsSection config={config} update={update} sd={sd} />
                    </div>
                  </div>
                )}
                {sec.key === "trafo" && (
                  <div className="space-y-6">
                    {showTrafo && <TrafoSection config={config} update={update} sd={sd} />}
                    {showVultKabel && (
                      <div className={cn(showTrafo && "border-t border-border pt-5")}>
                        <VultKabelSection config={config} update={update} />
                      </div>
                    )}
                  </div>
                )}
                {sec.key === "ls" && (
                  <div className="space-y-6">
                    {showLsRek && <LsRekSection config={config} update={update} />}
                    <div className={cn(showLsRek && "border-t border-border pt-5")}>
                      <LsSection config={config} update={update} />
                    </div>
                  </div>
                )}
                {sec.key === "overig" && (
                  <div className="space-y-6">
                    {isRenovatie && <GgiSection config={config} update={update} />}
                    <div className={cn(isRenovatie && "border-t border-border pt-5", "text-xs text-muted-foreground")}>
                      <div className="font-semibold text-foreground mb-1">Standaard materialen</div>
                      Worden automatisch toegevoegd op basis van case type en sub type. Zichtbaar in de winkelwagen rechts.
                    </div>
                  </div>
                )}
              </SectionCard>
            </div>
          );
        })}
      </div>

      {/* Live winkelwagen — sticky op lg, mobiel via tab-toggle */}
      <div className={cn(
        mobileTab === "config" && "hidden lg:block",
        "lg:sticky lg:top-0 lg:h-screen lg:overflow-hidden",
      )}>
        <Winkelwagen
          items={preview}
          caseId={caseId}
          caseType={caseType}
          subType={config.subType}
          hasSubType={!!config.subType}
          saving={opslaan.isPending}
          onSave={() => opslaan.mutate()}
          onItemsChange={(eff) => { winkelwagenItemsRef.current = eff; onWinkelwagenItemsChange?.(eff); }}
          artikelen={sd.artikelen.data ?? []}
          activeSectie={activeSectie ?? undefined}
        />
      </div>
    </div>
  );
}

function SectionCard({
  color, title, summary, index, Icon, isOpen, isComplete, onToggle, children,
}: {
  color: string;
  title: string;
  summary: string;
  index: number;
  Icon: React.ComponentType<{ className?: string }>;
  isOpen: boolean;
  isComplete: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <button onClick={onToggle} className="w-full flex items-center gap-4 px-6 py-5 hover:bg-accent/20 transition-colors text-left">
        <span
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white"
          style={{ background: color }}
        >
          <Icon className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-0.5">
            Sectie {index}
          </div>
          <div className="font-bold text-lg text-[color:var(--navy)] truncate leading-tight">{title}</div>
          {!isOpen && summary && summary !== "Nog in te vullen" && (
            <div className="text-xs text-muted-foreground mt-1 truncate">{summary}</div>
          )}
        </div>
        {isComplete && (
          <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
        )}
        <ChevronDown className={cn("w-5 h-5 transition-transform text-muted-foreground", isOpen && "rotate-180")} />
      </button>
      {isOpen && <div className="px-8 pb-8 pt-2 border-t border-border">{children}</div>}
    </div>
  );
}

function sectionSummary(key: SectionKey, c: MaterialenConfig, _sd: ReturnType<typeof useStamdata>): string {
  switch (key) {
    case "project":
      return c.subType ? subTypeLabel(c.subType) : "Nog in te vullen";
    case "provisorium":
      if (!c.provRmuConfig) return "Nog in te vullen";
      return `${c.provRmuMerk} ${c.provRmuConfig.code}${c.provZekeringKva ? ` — ${c.provZekeringKva} kVA` : ""}`;
    case "ms": {
      const rmu = c.rmuConfig ? `${c.rmuConfig.merk} ${c.rmuConfig.aantal_velden}V` : "RMU?";
      const n = c.msRichtingen.length;
      return `${rmu} · ${n} richting${n === 1 ? "" : "en"}`;
    }
    case "trafo": {
      const t = c.trafoActie && c.trafoKva ? `${c.trafoActie} ${c.trafoKva}kVA` : "Trafo?";
      const v = c.vultKabelAfstand > 0 ? ` · ${c.vultKabelAfstand}m` : "";
      return `${t}${v}`;
    }
    case "ls": {
      const rek = c.lsRekActie ? `LS-rek ${c.lsRekActie}` : "LS-rek?";
      const m = c.lsMoffenActief ? `${c.lsMoffen.length} mof${c.lsMoffen.length === 1 ? "" : "fen"}` : "geen moffen";
      return `${rek} · ${m}`;
    }
    case "overig":
      return c.ggiVervangen ? "GGI wordt vervangen" : "Standaard materialen";
  }
}

const subTypeLabel = (s: SubType) => ({
  cs_zonder_prov: "CS direct",
  cs_met_prov: "CS via provisorium",
  renovatie_prov: "Renovatie prov.",
  renovatie_nsa: "Renovatie NSA",
  "": "",
}[s]);

// ---------- Sections ----------

function ProjectSection({ config, update, isCompact, isCompactProv }: { config: MaterialenConfig; update: (p: Partial<MaterialenConfig>) => void; isCompact: boolean; isCompactProv?: boolean }) {
  if (isCompact) {
    const lockedSub: SubType = isCompactProv ? "cs_met_prov" : "cs_zonder_prov";
    const lockedLabel = isCompactProv ? "CS via provisorium" : "CS direct";
    return (
      <div className="space-y-3">
        <InfoBox type="info">
          {isCompactProv
            ? "Compact station via provisorium — prefab compact kist met tijdelijke provisorium-verbinding."
            : "Compact station — prefab. RMU, trafo, telcon, vult kabel en LS-rek zijn aanwezig."}
        </InfoBox>
        <Field label="Sub-type">
          <PillGroup
            value={config.subType}
            onChange={() => { /* vergrendeld */ }}
            options={[{ value: lockedSub, label: lockedLabel }]}
          />
        </Field>
      </div>
    );
  }
  return (
    <Field label="Sub-type">
      <PillGroup
        value={config.subType}
        onChange={(v) => {
          const next = v as SubType;
          const isProv = next === "cs_met_prov" || next === "renovatie_prov";
          update({
            subType: next,
            msRichtingen: isProv
              ? config.msRichtingen
              : config.msRichtingen.map((r) => ({ ...r, kanZwaaien: null, mofDefinitief: null })),
          });
        }}
        options={[
          { value: "cs_zonder_prov", label: "CS direct" },
          { value: "cs_met_prov", label: "CS via provisorium" },
          { value: "renovatie_prov", label: "Renovatie prov." },
          { value: "renovatie_nsa", label: "Renovatie NSA" },
        ]}
      />
    </Field>
  );
}

function RmuSection({ config, update, sd, isCompact }: { config: MaterialenConfig; update: (p: Partial<MaterialenConfig>) => void; sd: ReturnType<typeof useStamdata>; isCompact: boolean }) {
  const merken = isCompact ? ["ABB", "Siemens"] : ["ABB", "Siemens", "Magnefix"];
  // Bij compact: i-Net altijd "nee"
  const effectiveInet = isCompact ? "nee" : config.rmuInet;
  const isInet = effectiveInet === "ja";
  const filteredConfigs = (sd.rmuConfigs.data ?? []).filter(
    (c) =>
      c.merk === config.rmuMerk &&
      (config.rmuMerk === "Magnefix" ? true : c.is_inet === isInet),
  );

  const pickConfig = (c: typeof filteredConfigs[number]) => {
    update({
      rmuConfig: c,
      rmuVelden: buildRmuVelden(c),
      iNetArtikelen:
        c.is_inet && config.iNetArtikelen.length === 0
          ? DEFAULT_INET_ARTIKELEN.map((x) => ({ ...x }))
          : config.iNetArtikelen,
    });
  };

  const setVeld = (id: string, patch: Partial<RmuVeldConfig>) => {
    update({ rmuVelden: config.rmuVelden.map((v) => (v.id === id ? { ...v, ...patch } : v)) });
  };

  const showVeldKaartjes = !!config.rmuConfig && config.rmuVelden.length > 0;
  const isMagnefix = config.rmuMerk === "Magnefix";
  const showConfigPicker = !!config.rmuMerk && (isCompact || isMagnefix || !!config.rmuInet);

  return (
    <div className="space-y-4">
      {isCompact && (
        <InfoBox type="info">
          RMU is aanwezig — wordt niet besteld. Keuze bepaalt buispatronen en eindsluitingen.
        </InfoBox>
      )}
      <Field label="Merk">
        <PillGroup
          value={config.rmuMerk}
          onChange={(v) => update({
            rmuMerk: v as MaterialenConfig["rmuMerk"],
            rmuConfig: null,
            rmuVelden: [],
            rmuInet: isCompact ? "nee" : (v === "Magnefix" ? "" : config.rmuInet),
          })}
          options={merken.map((m) => ({ value: m, label: m }))}
        />
      </Field>
      {!isCompact && config.rmuMerk && config.rmuMerk !== "Magnefix" && (
        <Field label="I-Net">
          <PillGroup
            value={config.rmuInet}
            onChange={(v) => {
              const next = v as "ja" | "nee";
              update({
                rmuInet: next,
                rmuConfig: null,
                rmuVelden: [],
                iNetArtikelen:
                  next === "ja" && config.iNetArtikelen.length === 0
                    ? DEFAULT_INET_ARTIKELEN.map((x) => ({ ...x }))
                    : config.iNetArtikelen,
              });
            }}
            options={[{ value: "nee", label: "Nee" }, { value: "ja", label: "Ja (DA)" }]}
          />
        </Field>
      )}
      {showConfigPicker && (
        <Field label="Configuratie">
          {filteredConfigs.length === 0 ? (
            <p className="text-xs text-muted-foreground">Geen configuraties gevonden voor deze combinatie.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {filteredConfigs.map((c) => {
                const active = config.rmuConfig?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    data-active={active}
                    onClick={() => pickConfig(c)}
                    className="border border-border bg-surface rounded-md px-3 py-1.5 text-sm hover:bg-accent data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:border-primary"
                  >
                    {c.code}
                  </button>
                );
              })}
            </div>
          )}
        </Field>
      )}
      {config.rmuConfig && (
        <InfoBox type="info">
          <span className="font-mono text-xs">
            {config.rmuConfig.aantal_velden} velden · {config.rmuConfig.aantal_f}F / {config.rmuConfig.aantal_c}C / {config.rmuConfig.aantal_v}V
          </span>
        </InfoBox>
      )}

      {isCompact && config.rmuConfig && (
        <>
          <Field label="Trafo vermogen (kVA) — bepaalt buispatronen en LS-rek beveiliging">
            <PillGroup
              value={config.trafoKva}
              onChange={(v) => update({ trafoKva: v as MaterialenConfig["trafoKva"] })}
              options={[
                { value: "250", label: "250 kVA" },
                { value: "400", label: "400 kVA" },
                { value: "630", label: "630 kVA" },
                { value: "1000", label: "1000 kVA" },
              ]}
            />
          </Field>
          {config.trafoKva && (
            <InfoBox type="info">
              LS-rek beveiliging: mespatroon {config.trafoKva} kVA wordt automatisch toegevoegd (3×)
            </InfoBox>
          )}
          <Field label="Aantal aan te sluiten LS-kabels">
            <Stepper
              value={config.lsRekAanSluitenKabels}
              onChange={(v) => update({ lsRekAanSluitenKabels: v })}
              min={0}
              max={99}
            />
          </Field>
          {config.lsRekAanSluitenKabels > 0 && (
            <InfoBox type="info">
              K56 U bevestigingsklem ({config.lsRekAanSluitenKabels * 2}×) + kabelinlegklem ({config.lsRekAanSluitenKabels}×)
            </InfoBox>
          )}
        </>
      )}

      {showVeldKaartjes && (
        <div className="space-y-3 pt-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Veldinstellingen</div>
          {config.rmuVelden.map((veld) =>
            isMagnefix ? (
              <MagnefixVeldKaart key={veld.id} veld={veld} config={config} update={update} />
            ) : (
              <VeldKaart
                key={veld.id}
                veld={veld}
                setVeld={setVeld}
                config={config}
                update={update}
                isInet={isInet}
                merk={config.rmuMerk}
                isCompact={isCompact}
              />
            ),
          )}
        </div>
      )}

      {showVeldKaartjes && isInet && (
        <INetArtikelenSection config={config} update={update} sd={sd} />
      )}
    </div>
  );
}

function veldLabel(merk: string, veldType: "F" | "C" | "V", veldNummer: number): string {
  if (merk === "Siemens") {
    if (veldType === "F") return "T-veld — Trafo richting";
    if (veldType === "C") return `R-veld ${veldNummer} — Kabelrichting`;
    return `R-veld ${veldNummer} — Vermogensveld`;
  }
  if (veldType === "F") return "F-veld — Trafo richting";
  if (veldType === "C") return `C-veld ${veldNummer} — Kabelrichting`;
  return `V-veld ${veldNummer} — Vermogensveld`;
}

function veldBadge(merk: string, veldType: "F" | "C" | "V"): string {
  if (merk === "Siemens") return veldType === "F" ? "T" : "R";
  return veldType;
}

function VeldKaart({
  veld,
  setVeld,
  config,
  update,
  isInet,
  merk,
  isCompact,
}: {
  veld: RmuVeldConfig;
  setVeld: (id: string, patch: Partial<RmuVeldConfig>) => void;
  config: MaterialenConfig;
  update: (p: Partial<MaterialenConfig>) => void;
  isInet: boolean;
  merk: string;
  isCompact: boolean;
}) {
  const reserveLocked = (veld.veldType === "C" || veld.veldType === "V") && veld.veldNummer <= 2;
  const kabelOpties = [
    { value: "240AL", label: "3x1x240AL singels" },
    { value: "630AL", label: "3x1x630AL singels" },
  ];
  const badge = veldBadge(merk, veld.veldType);
  const label = veldLabel(merk, veld.veldType, veld.veldNummer);

  if (veld.veldType === "F") {
    return (
      <div className="rounded-md border border-border bg-background/40 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className="rounded bg-secondary text-secondary-foreground text-xs font-mono px-1.5 py-0.5">{badge}</span>
          <span className="text-sm font-medium">{label}</span>
        </div>
        {!isCompact && (
          <Field label="Trafo kabel lengte">
            <PillGroup
              value={config.trafoKabelLengte}
              onChange={(v) => update({ trafoKabelLengte: v as MaterialenConfig["trafoKabelLengte"] })}
              options={[
                { value: "7.25", label: "7,25 m" },
                { value: "10", label: "10 m" },
              ]}
            />
          </Field>
        )}
        {config.trafoKva ? (
          <InfoBox type="info">
            Vermogen: {config.trafoKva} kVA — buispatroon wordt automatisch bepaald
          </InfoBox>
        ) : (
          <InfoBox type="warning">
            ⚠ Vul het trafo vermogen in {isCompact ? "hierboven" : "bij de Trafo-sectie"}
          </InfoBox>
        )}
      </div>
    );
  }

  // C of V
  const aangesloten = !veld.isReserve;
  return (
    <div className="rounded-md border border-border bg-background/40 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="rounded bg-secondary text-secondary-foreground text-xs font-mono px-1.5 py-0.5">{badge}</span>
        <span className="text-sm font-medium">{label}</span>
        {reserveLocked && (
          <span className="text-[10px] text-muted-foreground ml-auto">altijd aangesloten</span>
        )}
      </div>
      {!reserveLocked && (
        <Field label="Status">
          <PillGroup
            value={veld.isReserve ? "reserve" : "aan"}
            onChange={(v) => setVeld(veld.id, { isReserve: v === "reserve", kabelType: v === "reserve" ? "" : veld.kabelType })}
            options={[
              { value: "aan", label: "Aangesloten", color: "green" },
              { value: "reserve", label: "Reserve", color: "amber" },
            ]}
          />
        </Field>
      )}
      {aangesloten && (
        <Field label="Kabeltype">
          <PillGroup
            value={veld.kabelType}
            onChange={(v) => setVeld(veld.id, { kabelType: v as RmuVeldConfig["kabelType"] })}
            options={kabelOpties}
          />
        </Field>
      )}
      {aangesloten && veld.veldType === "V" && veld.kabelType === "630AL" && (
        <InfoBox type="info">
          {isInet
            ? "Ombouwset iMSR (20043486) wordt toegevoegd"
            : "Ombouwset W4 regMSR (20043756) wordt toegevoegd"}
        </InfoBox>
      )}
    </div>
  );
}

function MagnefixVeldKaart({
  veld,
  config,
  update,
}: {
  veld: RmuVeldConfig;
  config: MaterialenConfig;
  update: (p: Partial<MaterialenConfig>) => void;
}) {
  if (veld.veldType === "F") {
    return (
      <div className="rounded-md border border-border bg-background/40 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className="rounded bg-secondary text-secondary-foreground text-xs font-mono px-1.5 py-0.5">T</span>
          <span className="text-sm font-medium">T-veld — Trafo richting</span>
        </div>
        <Field label="Trafo kabel lengte">
          <PillGroup
            value={config.trafoKabelLengte}
            onChange={(v) => update({ trafoKabelLengte: v as MaterialenConfig["trafoKabelLengte"] })}
            options={[
              { value: "7.25", label: "7,25 m" },
              { value: "10", label: "10 m" },
            ]}
          />
        </Field>
        {config.trafoKva ? (
          <InfoBox type="info">
            Vermogen: {config.trafoKva} kVA — Magnefix buispatroon wordt automatisch bepaald
          </InfoBox>
        ) : (
          <InfoBox type="warning">
            ⚠ Vul het trafo vermogen in bij de Trafo-sectie
          </InfoBox>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-background/40 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="rounded bg-secondary text-secondary-foreground text-xs font-mono px-1.5 py-0.5">K</span>
        <span className="text-sm font-medium">K-veld {veld.veldNummer} — Kabelrichting</span>
        <span className="text-[10px] text-muted-foreground ml-auto">materialen automatisch bepaald</span>
      </div>
      <InfoBox type="info">
        Eindsluiting 240AL + afschermset worden automatisch toegevoegd
      </InfoBox>
    </div>
  );
}

function INetArtikelenSection({
  config,
  update,
  sd,
}: {
  config: MaterialenConfig;
  update: (p: Partial<MaterialenConfig>) => void;
  sd: ReturnType<typeof useStamdata>;
}) {
  const setQty = (artikel_nummer: string, hoeveelheid: number) => {
    update({
      iNetArtikelen: config.iNetArtikelen.map((ia) =>
        ia.artikel_nummer === artikel_nummer ? { ...ia, hoeveelheid } : ia,
      ),
    });
  };
  const findArt = (nr: string) =>
    (sd.artikelen.data ?? []).find((a) => a.artikel_nummer === nr);
  return (
    <div className="space-y-2 pt-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">I-Net vaste artikelen</div>
      <div className="rounded-md border border-border bg-background/40 p-3 space-y-2">
        {config.iNetArtikelen.map((ia) => {
          const art = findArt(ia.artikel_nummer);
          return (
            <div key={ia.artikel_nummer} className="flex items-center gap-2 text-sm">
              <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">{ia.artikel_nummer}</span>
              <span className="flex-1 truncate">{art?.korte_omschrijving ?? "—"}</span>
              <Stepper value={ia.hoeveelheid} onChange={(v) => setQty(ia.artikel_nummer, v)} min={0} max={50} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrafoSection({ config, update }: { config: MaterialenConfig; update: (p: Partial<MaterialenConfig>) => void; sd: ReturnType<typeof useStamdata> }) {
  return (
    <div className="space-y-4">
      <Field label="Actie">
        <PillGroup
          value={config.trafoActie}
          onChange={(v) => update({ trafoActie: v as MaterialenConfig["trafoActie"] })}
          options={[
            { value: "nieuw", label: "Nieuw", color: "green" },
            { value: "blijft", label: "Blijft", color: "amber" },
            { value: "draaien", label: "Draaien", color: "blue" },
          ]}
        />
      </Field>
      <Field label="Vermogen">
        <PillGroup
          value={config.trafoKva}
          onChange={(v) => update({ trafoKva: v as MaterialenConfig["trafoKva"] })}
          options={["250", "400", "630", "1000"].map((k) => ({ value: k, label: `${k} kVA` }))}
        />
      </Field>
      {config.trafoActie && config.trafoKva && (
        <InfoBox type="info">
          {config.trafoActie === "nieuw" && (
            <>
              {config.trafoKva !== "1000" ? `Trafo ${config.trafoKva} kVA wordt besteld · ` : ""}
              U-profielen (2×) · Afschermplaat · Afschermkappen (3×) · Soepele verbinding
            </>
          )}
          {(config.trafoActie === "draaien" || config.trafoActie === "blijft") && config.trafoKva !== "1000" && (
            <>
              Aansluitvlag {config.trafoKva === "630" ? "630kVA set" : "200-400kVA"} wordt toegevoegd
            </>
          )}
        </InfoBox>
      )}
    </div>
  );
}

function VultKabelSection({ config, update }: { config: MaterialenConfig; update: (p: Partial<MaterialenConfig>) => void }) {
  const spec = config.trafoKva ? VULT_KABEL_SPECS[config.trafoKva] : null;
  const totaalMeters = spec ? Math.ceil(config.vultKabelAfstand * spec.aantalKabels) : 0;
  return (
    <div className="space-y-4">
      {!config.trafoKva && (
        <InfoBox type="warning">⚠ Vul eerst het trafo vermogen in bij de Trafo-sectie</InfoBox>
      )}
      {spec && (
        <InfoBox type="info">
          {spec.omschrijving} · Afstand × {spec.aantalKabels} = totaal kabelmeters
        </InfoBox>
      )}
      <Field label="Afstand trafo → LS-rek (meter)">
        <div className="flex items-center gap-3">
          <Stepper
            value={config.vultKabelAfstand}
            onChange={(v) => update({ vultKabelAfstand: v })}
            min={0}
            max={50}
            suffix="m"
          />
          {spec && config.vultKabelAfstand > 0 && (
            <span className="text-sm text-muted-foreground">
              = {totaalMeters} m kabel totaal
              {spec.aantalKabels >= 8 && " (dubbel uitgevoerd)"}
            </span>
          )}
        </div>
      </Field>
      {spec && config.vultKabelAfstand > 0 && (
        <InfoBox type="success">
          Wordt toegevoegd: {totaalMeters}m {spec.kabelArtNr} · {spec.aantalPers}× perskabelschoen · 1× muurbeugel
        </InfoBox>
      )}
    </div>
  );
}

function OvStuurpuntVragen({ config, update }: { config: MaterialenConfig; update: (p: Partial<MaterialenConfig>) => void }) {
  return (
    <>
      <Field label="OV-stuurpunt installeren?">
        <PillGroup
          value={config.lsRekOvStuurpunt ? "ja" : "nee"}
          onChange={(v) =>
            update({
              lsRekOvStuurpunt: v === "ja",
              lsRekSchroefpatroon: v === "nee" ? "" : config.lsRekSchroefpatroon,
            })
          }
          options={[
            { value: "ja", label: "Ja", color: "green" },
            { value: "nee", label: "Nee", color: "amber" },
          ]}
        />
      </Field>
      {config.lsRekOvStuurpunt && (
        <Field label="Schroefpatroon type">
          <PillGroup
            value={config.lsRekSchroefpatroon}
            onChange={(v) => update({ lsRekSchroefpatroon: v as "35A" | "50A" })}
            options={[
              { value: "35A", label: "35A (20001107)" },
              { value: "50A", label: "50A (20001108)" },
            ]}
          />
        </Field>
      )}
    </>
  );
}

function LsRekSection({ config, update }: { config: MaterialenConfig; update: (p: Partial<MaterialenConfig>) => void }) {
  const maxStroken = config.lsRekType === "8" ? 8 : config.lsRekType === "12" ? 12 : null;
  return (
    <div className="space-y-4">
      <Field label="LS-rek">
        <PillGroup
          value={config.lsRekActie}
          onChange={(v) =>
            update({
              lsRekActie: v as MaterialenConfig["lsRekActie"],
              lsRekType: "",
              lsRekExtraStroken: 0,
              lsRekAanSluitenKabels: 0,
              lsRekBeveiligingAanpassen: false,
              lsRekOvStuurpunt: false,
              lsRekSchroefpatroon: "",
            })
          }
          options={[
            { value: "vervangen", label: "Vervangen", color: "green" },
            { value: "gehandhaafd", label: "Gehandhaafd", color: "amber" },
          ]}
        />
      </Field>

      {config.lsRekActie === "vervangen" && (
        <>
          <Field label="Aantal richtingen">
            <PillGroup
              value={config.lsRekType}
              onChange={(v) => update({ lsRekType: v as "8" | "12", lsRekExtraStroken: 0 })}
              options={[
                { value: "8", label: "8 richtingen — 20050813" },
                { value: "12", label: "12 richtingen — 20050761" },
              ]}
            />
          </Field>

          {config.lsRekType && (
            <Field label="Extra stroken benodigd?">
              <div className="flex items-center gap-3">
                <Stepper value={config.lsRekExtraStroken} onChange={(v) => update({ lsRekExtraStroken: v })} min={0} max={99} />
                {config.lsRekExtraStroken > 0 && maxStroken && config.lsRekExtraStroken > maxStroken && (
                  <InfoBox type="warning">
                    ⚠ {config.lsRekExtraStroken} stroken overschrijdt de maximale capaciteit van dit rek ({maxStroken} richtingen)
                  </InfoBox>
                )}
              </div>
            </Field>
          )}

          <Field label="Aantal aan te sluiten LS-kabels">
            <div className="flex items-center gap-3 flex-wrap">
              <Stepper
                value={config.lsRekAanSluitenKabels}
                onChange={(v) => update({ lsRekAanSluitenKabels: v })}
                min={0}
                max={99}
              />
              {config.lsRekAanSluitenKabels > 0 && config.lsRekType && (() => {
                const max = config.lsRekType === "8" ? 8 : 12;
                if (config.lsRekAanSluitenKabels > max) {
                  return (
                    <InfoBox type="warning">
                      ⚠ {config.lsRekAanSluitenKabels} kabels op een {max}-richtingen rek — klopt dit? Maximum is {max} richtingen.
                    </InfoBox>
                  );
                }
                return null;
              })()}
            </div>
          </Field>

          {config.trafoKva ? (
            <InfoBox type="info">
              Beveiliging voedende strook: mespatroon voor {config.trafoKva} kVA wordt automatisch toegevoegd
            </InfoBox>
          ) : (
            <InfoBox type="warning">⚠ Vul het trafo vermogen in bij de Trafo-sectie voor de juiste beveiliging</InfoBox>
          )}

          <OvStuurpuntVragen config={config} update={update} />
        </>
      )}

      {config.lsRekActie === "gehandhaafd" && (
        <>
          <Field label="Beveiliging aanpassen?">
            <PillGroup
              value={config.lsRekBeveiligingAanpassen ? "ja" : "nee"}
              onChange={(v) => update({ lsRekBeveiligingAanpassen: v === "ja" })}
              options={[
                { value: "ja", label: "Ja — nieuwe mespatronen", color: "green" },
                { value: "nee", label: "Nee", color: "amber" },
              ]}
            />
          </Field>

          {config.lsRekBeveiligingAanpassen && !config.trafoKva && (
            <InfoBox type="warning">⚠ Vul het trafo vermogen in bij de Trafo-sectie</InfoBox>
          )}
          {config.lsRekBeveiligingAanpassen && config.trafoKva && (
            <InfoBox type="info">Mespatroon voor {config.trafoKva} kVA wordt toegevoegd</InfoBox>
          )}

          <OvStuurpuntVragen config={config} update={update} />
        </>
      )}
    </div>
  );
}

const MOF_DOORSNEDES: Record<string, number[]> = {
  GPLK: [35, 70, 95, 120, 150, 185, 240],
  XLPE: [95, 150, 240],
  XLPE_singel: [240, 400, 630],
};

function MofFormulier({
  label,
  config: mof,
  onChange,
  msMofTypes,
}: {
  label: string;
  config: import("@/lib/configurator/types").MsMofConfig;
  onChange: (patch: Partial<import("@/lib/configurator/types").MsMofConfig>) => void;
  msMofTypes: any[];
}) {
  const eindmofType = useMemo(
    () => msMofTypes.find((mt) => mt.code === "EINDMOF") ?? null,
    [msMofTypes],
  );
  const eindmofTypeId: string | null = eindmofType?.id ?? null;

  const gevondenMoffen = useMemo(() => {
    if (mof.isEindmof) return [];
    if (!mof.bestaandType || mof.bestaandDoorsnede == null ||
        !mof.nieuwType || mof.nieuwDoorsnede == null) return [];
    return msMofTypes.filter((mt) =>
      mt.code !== "EINDMOF" &&
      mt.bestaand_type === mof.bestaandType &&
      mof.bestaandDoorsnede! >= (mt.bestaand_doorsnede_min ?? 0) &&
      mof.bestaandDoorsnede! <= (mt.bestaand_doorsnede_max ?? 9999) &&
      (mt.nieuwe_type === mof.nieuwType || mt.nieuwe_type === "beide") &&
      mof.nieuwDoorsnede! >= (mt.nieuwe_doorsnede_min ?? 0) &&
      mof.nieuwDoorsnede! <= (mt.nieuwe_doorsnede_max ?? 9999),
    );
  }, [mof, msMofTypes]);

  // Auto-select de unieke match
  useEffect(() => {
    if (!mof.isEindmof && gevondenMoffen.length === 1 && !mof.mofHandmatig && mof.mofTypeId !== gevondenMoffen[0].id) {
      onChange({ mofTypeId: gevondenMoffen[0].id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gevondenMoffen, mof.isEindmof]);

  // Sync eindmof mofTypeId zodra type beschikbaar
  useEffect(() => {
    if (mof.isEindmof && eindmofTypeId && mof.mofTypeId !== eindmofTypeId) {
      onChange({ mofTypeId: eindmofTypeId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mof.isEindmof, eindmofTypeId]);

  const kabelOpties = [
    { value: "GPLK", label: "GPLK" },
    { value: "XLPE", label: "XLPE 3-aderig" },
    { value: "XLPE_singel", label: "XLPE singel" },
  ] as const;

  return (
    <div className="space-y-3 border-l-2 border-border pl-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>

      <Field label="Type verbinding">
        <PillGroup
          value={mof.isEindmof ? "eindmof" : "verbinding"}
          onChange={(v) =>
            onChange({
              isEindmof: v === "eindmof",
              bestaandType: "",
              bestaandDoorsnede: null,
              nieuwType: "",
              nieuwDoorsnede: null,
              mofTypeId: v === "eindmof" ? eindmofTypeId : null,
              mofHandmatig: false,
            })
          }
          options={[
            { value: "verbinding", label: "Verbinding" },
            { value: "eindmof", label: "Eindmof" },
          ]}
        />
      </Field>

      {mof.isEindmof ? (
        <InfoBox type="info">MS eindmof materialen worden automatisch toegevoegd</InfoBox>
      ) : (
        <>
          <Field label="Bestaande kabel — type">
            <PillGroup
              value={mof.bestaandType}
              onChange={(v) => onChange({ bestaandType: v as any, bestaandDoorsnede: null, mofTypeId: null, mofHandmatig: false })}
              options={kabelOpties.map((o) => ({ value: o.value, label: o.label }))}
            />
          </Field>
          {mof.bestaandType && (
            <Field label="Bestaande kabel — doorsnede (mm²)">
              <PillGroup
                value={mof.bestaandDoorsnede?.toString() ?? ""}
                onChange={(v) => onChange({ bestaandDoorsnede: Number(v), mofTypeId: null, mofHandmatig: false })}
                options={(MOF_DOORSNEDES[mof.bestaandType] ?? []).map((d) => ({
                  value: d.toString(),
                  label: `${d} mm²`,
                }))}
              />
            </Field>
          )}

          <Field label="Nieuwe kabel — type">
            <PillGroup
              value={mof.nieuwType}
              onChange={(v) => onChange({ nieuwType: v as any, nieuwDoorsnede: null, mofTypeId: null, mofHandmatig: false })}
              options={kabelOpties.map((o) => ({ value: o.value, label: o.label }))}
            />
          </Field>
          {mof.nieuwType && (
            <Field label="Nieuwe kabel — doorsnede (mm²)">
              <PillGroup
                value={mof.nieuwDoorsnede?.toString() ?? ""}
                onChange={(v) => onChange({ nieuwDoorsnede: Number(v), mofTypeId: null, mofHandmatig: false })}
                options={(MOF_DOORSNEDES[mof.nieuwType] ?? []).map((d) => ({
                  value: d.toString(),
                  label: `${d} mm²`,
                }))}
              />
            </Field>
          )}

          {mof.bestaandType && mof.bestaandDoorsnede && mof.nieuwType && mof.nieuwDoorsnede ? (
            <>
              {gevondenMoffen.length === 1 && !mof.mofHandmatig && (
                <InfoBox type="success">
                  ✓ Gevonden: <span className="font-mono">{gevondenMoffen[0].code}</span>
                  {gevondenMoffen[0].omschrijving ? ` — ${gevondenMoffen[0].omschrijving}` : ""}
                </InfoBox>
              )}
              {gevondenMoffen.length > 1 && (
                <Field label="Meerdere moffen passen — kies:">
                  <div className="flex flex-wrap gap-1.5">
                    {gevondenMoffen.map((mt) => (
                      <button
                        key={mt.id}
                        type="button"
                        data-active={mof.mofTypeId === mt.id}
                        onClick={() => onChange({ mofTypeId: mt.id, mofHandmatig: false })}
                        className="border border-border bg-surface rounded-md px-2.5 py-1 text-xs hover:bg-accent data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:border-primary"
                      >
                        {mt.code}
                      </button>
                    ))}
                  </div>
                </Field>
              )}
              {gevondenMoffen.length === 0 && (
                <div className="space-y-2">
                  <InfoBox type="warning">⚠ Geen mof gevonden voor deze combinatie — kies handmatig:</InfoBox>
                  <select
                    className="w-full text-xs p-1.5 rounded border border-border bg-input text-foreground"
                    value={mof.mofTypeId ?? ""}
                    onChange={(e) => onChange({ mofTypeId: e.target.value || null, mofHandmatig: true })}
                  >
                    <option value="">Kies mof…</option>
                    {msMofTypes.filter((mt) => mt.code !== "EINDMOF").map((mt) => (
                      <option key={mt.id} value={mt.id}>
                        {mt.code}{mt.omschrijving ? ` — ${mt.omschrijving}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function MsSection({ config, update, sd }: { config: MaterialenConfig; update: (p: Partial<MaterialenConfig>) => void; sd: ReturnType<typeof useStamdata> }) {
  const isProvisorum = config.subType === "cs_met_prov" || config.subType === "renovatie_prov";
  const removeRicht = (id: string) => update({ msRichtingen: config.msRichtingen.filter((r) => r.id !== id) });
  const addRicht = () => update({ msRichtingen: [...config.msRichtingen, newRichting()] });
  const updateTrace = (id: string, patch: Partial<MsKabelTrace>) => {
    update({ msKabelTraces: config.msKabelTraces.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  };
  const updateMof = (id: string, fase: "tijdelijk" | "definitief", patch: Partial<import("@/lib/configurator/types").MsMofConfig>) => {
    update({
      msRichtingen: config.msRichtingen.map((r) => {
        if (r.id !== id) return r;
        if (fase === "tijdelijk") return { ...r, mofTijdelijk: { ...r.mofTijdelijk, ...patch } };
        return { ...r, mofDefinitief: { ...(r.mofDefinitief ?? emptyMofConfig()), ...patch } };
      }),
    });
  };
  const setZwaaien = (id: string, kan: boolean) => {
    update({
      msRichtingen: config.msRichtingen.map((r) =>
        r.id === id ? { ...r, kanZwaaien: kan, mofDefinitief: kan ? null : (r.mofDefinitief ?? emptyMofConfig()) } : r,
      ),
    });
  };

  return (
    <div className="space-y-3">
      {config.msRichtingen.map((r, idx) => (
        <div key={r.id} className="rounded-md border border-border bg-background/40 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="rounded bg-secondary text-secondary-foreground text-xs font-mono px-1.5 py-0.5">{idx + 1}</span>
            <span className="text-sm font-medium flex-1">MS-richting {idx + 1}</span>
            {config.msRichtingen.length > 1 && (
              <button onClick={() => removeRicht(r.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <MofFormulier
            label={isProvisorum ? "Tijdelijke verbinding" : "MS verbinding"}
            config={r.mofTijdelijk}
            onChange={(p) => updateMof(r.id, "tijdelijk", p)}
            msMofTypes={sd.msMofTypes.data ?? []}
          />

          {isProvisorum && (
            <Field label="Kan kabel worden omgezwaaid?">
              <PillGroup
                value={r.kanZwaaien === true ? "ja" : r.kanZwaaien === false ? "nee" : ""}
                onChange={(v) => setZwaaien(r.id, v === "ja")}
                options={[
                  { value: "ja", label: "Ja — zwaaien (geen nieuwe mof)", color: "green" },
                  { value: "nee", label: "Nee — nieuwe verbinding nodig", color: "amber" },
                ]}
              />
            </Field>
          )}

          {isProvisorum && r.kanZwaaien === false && r.mofDefinitief && (
            <MofFormulier
              label="Definitieve verbinding"
              config={r.mofDefinitief}
              onChange={(p) => updateMof(r.id, "definitief", p)}
              msMofTypes={sd.msMofTypes.data ?? []}
            />
          )}
        </div>
      ))}
      <button onClick={addRicht} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <Plus className="w-4 h-4" /> MS-richting toevoegen
      </button>

      {/* MS-kabel traces */}
      <div className="space-y-2 pt-2">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          MS-kabels
        </div>

        {config.msKabelTraces.map((trace, i) => (
          <div key={trace.id} className="rounded-md border border-border bg-background/40 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <span className="rounded bg-secondary text-secondary-foreground text-xs font-mono px-1.5 py-0.5">
                Trace {i + 1}
              </span>
              <span className="flex-1 text-sm font-medium">
                {trace.kabelType && trace.lengteMeters > 0
                  ? `${KABEL_LABEL[trace.kabelType]} — ${trace.lengteMeters}m`
                  : "Nog in te vullen"}
              </span>
              <button
                type="button"
                onClick={() =>
                  update({ msKabelTraces: config.msKabelTraces.filter((t) => t.id !== trace.id) })
                }
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <Field label="Kabeltype">
              <PillGroup
                value={trace.kabelType}
                onChange={(v) => updateTrace(trace.id, { kabelType: v as MsKabelType })}
                options={[
                  { value: "240AL_singel", label: "3× 1x240AL singel (standaard)" },
                  { value: "630AL_singel", label: "3× 1x630AL singel" },
                  { value: "3x240AL", label: "1× 3x240AL (3-aderig)" },
                ]}
              />
            </Field>

            <Field label="Lengte trace (meter)">
              <div className="flex items-center gap-3">
                <Stepper
                  value={trace.lengteMeters}
                  onChange={(v) => updateTrace(trace.id, { lengteMeters: v })}
                  min={0}
                  max={999}
                  suffix=" m"
                />
                {trace.kabelType && trace.lengteMeters > 0 && (
                  <span className="text-xs text-muted-foreground">{kabelSamenvatting(trace)}</span>
                )}
              </div>
            </Field>

            {trace.kabelType && trace.lengteMeters > 0 && (
              <InfoBox type="info">{kabelSamenvatting(trace)}</InfoBox>
            )}

            <Field label="Oversteek (weg/watergang)?">
              <PillGroup
                value={trace.heeftOversteek ? "ja" : "nee"}
                onChange={(v) =>
                  updateTrace(trace.id, {
                    heeftOversteek: v === "ja",
                    aantalOversteken: v === "ja" ? trace.aantalOversteken || 1 : 0,
                    oversteekMeters: v === "ja" ? trace.oversteekMeters : 0,
                  })
                }
                options={[
                  { value: "ja", label: "Ja" },
                  { value: "nee", label: "Nee" },
                ]}
              />
            </Field>

            {trace.heeftOversteek && (
              <>
                <Field label="Aantal oversteken">
                  <Stepper
                    value={trace.aantalOversteken}
                    onChange={(v) => updateTrace(trace.id, { aantalOversteken: v })}
                    min={1}
                    max={10}
                  />
                </Field>
                <Field label="Lengte per oversteek (meter)">
                  <div className="flex items-center gap-3">
                    <Stepper
                      value={trace.oversteekMeters}
                      onChange={(v) => updateTrace(trace.id, { oversteekMeters: v })}
                      min={1}
                      max={200}
                      suffix=" m"
                    />
                    {trace.oversteekMeters > 0 && (
                      <span className="text-xs text-muted-foreground">
                        = {Math.ceil(trace.oversteekMeters / 6)} buizen per oversteek · totaal{" "}
                        {Math.ceil(trace.oversteekMeters / 6) * trace.aantalOversteken} stuks
                      </span>
                    )}
                  </div>
                </Field>
                <InfoBox type="info">
                  {trace.kabelType === "240AL_singel" || trace.kabelType === "630AL_singel"
                    ? `PVC 160mm beschermbuis (20036049) — ${Math.ceil(trace.oversteekMeters / 6) * trace.aantalOversteken} stuks`
                    : `PVC 110mm beschermbuis (20028640) — ${Math.ceil(trace.oversteekMeters / 6) * trace.aantalOversteken} stuks`}
                  {` | Geotextiel — ${trace.aantalOversteken * 2} stuks`}
                </InfoBox>
              </>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            update({
              msKabelTraces: [
                ...config.msKabelTraces,
                {
                  id: crypto.randomUUID(),
                  kabelType: "240AL_singel",
                  lengteMeters: 0,
                  heeftOversteek: false,
                  aantalOversteken: 1,
                  oversteekMeters: 0,
                },
              ],
            })
          }
          className="w-full py-2 flex items-center justify-center gap-1.5 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <Plus className="h-3 w-3" /> MS-kabel trace toevoegen
        </button>
      </div>
    </div>
  );
}

const KABEL_LABEL: Record<MsKabelType, string> = {
  "240AL_singel": "3× 1x240AL singel",
  "630AL_singel": "3× 1x630AL singel",
  "3x240AL": "1× 3x240AL 3-aderig",
  "": "",
};

function kabelSamenvatting(trace: MsKabelTrace): string {
  if (!trace.kabelType || !trace.lengteMeters) return "";
  const isSingel = trace.kabelType === "240AL_singel" || trace.kabelType === "630AL_singel";
  const kabelMeters = isSingel ? trace.lengteMeters * 3 : trace.lengteMeters;
  const rollen = Math.ceil(trace.lengteMeters / 40);
  return `${kabelMeters}m kabel bestellen · ${rollen}× beschermband`;
}

function LsSection({ config, update }: { config: MaterialenConfig; update: (p: Partial<MaterialenConfig>) => void }) {
  const isProv = config.subType === "cs_met_prov" || config.subType === "renovatie_prov";
  const setMof = (id: string, patch: Partial<LsMof>) =>
    update({ lsMoffen: config.lsMoffen.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const removeMof = (id: string) => update({ lsMoffen: config.lsMoffen.filter((m) => m.id !== id) });
  const addMof = () => update({ lsMoffen: [...config.lsMoffen, newLsMof()] });

  return (
    <div className="space-y-3">
      <Field label="Worden er LS-moffen gemaakt?">
        <PillGroup
          value={config.lsMoffenActief ? "ja" : "nee"}
          onChange={(v) =>
            update({
              lsMoffenActief: v === "ja",
              lsMoffen: v === "ja" ? config.lsMoffen : [],
            })
          }
          options={[
            { value: "ja", label: "Ja", color: "green" },
            { value: "nee", label: "Nee", color: "amber" },
          ]}
        />
      </Field>

      {config.lsMoffenActief && (
        <>
          {config.lsMoffen.length === 0 && (
            <p className="text-xs text-muted-foreground">Nog geen LS-moffen toegevoegd.</p>
          )}
          {config.lsMoffen.map((m, idx) => (
            <LsMofKaart
              key={m.id}
              mof={m}
              index={idx}
              isProv={isProv}
              onChange={(patch) => setMof(m.id, patch)}
              onRemove={() => removeMof(m.id)}
            />
          ))}
          <button
            onClick={addMof}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Plus className="w-4 h-4" /> LS-mof toevoegen
          </button>
        </>
      )}
    </div>
  );
}

function LsMofKaart({
  mof,
  index,
  isProv,
  onChange,
  onRemove,
}: {
  mof: LsMof;
  index: number;
  isProv: boolean;
  onChange: (patch: Partial<LsMof>) => void;
  onRemove: () => void;
}) {
  const gevondenRingklemmen = useMemo(() => {
    if (!mof.hoofdkabelDoorsnede || !mof.hoofdkabelMateriaal || !mof.aftakDoorsnede) return [];
    return zoekRingklem(mof.hoofdkabelDoorsnede, mof.hoofdkabelMateriaal, mof.aftakDoorsnede);
  }, [mof.hoofdkabelDoorsnede, mof.hoofdkabelMateriaal, mof.aftakDoorsnede]);

  // auto-select als er exact 1 match is
  useEffect(() => {
    if (
      mof.type === "aftakmof" &&
      gevondenRingklemmen.length === 1 &&
      !mof.ringklemHandmatig &&
      mof.ringklemArtikelNummer !== gevondenRingklemmen[0].artikel_nummer
    ) {
      onChange({ ringklemArtikelNummer: gevondenRingklemmen[0].artikel_nummer });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gevondenRingklemmen.length, mof.type]);

  return (
    <div className="rounded-md border border-border bg-background/40 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="rounded bg-secondary text-xs font-mono px-1.5 py-0.5">{index + 1}</span>
        <span className="text-sm font-medium flex-1">LS-mof {index + 1}</span>
        <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
          <X className="w-4 h-4" />
        </button>
      </div>

      <Field label="Type mof">
        <PillGroup
          value={mof.type}
          onChange={(v) => onChange({ type: v as LsMofType })}
          options={[
            { value: "verbinding", label: "Verbindingsmof" },
            { value: "aftakmof", label: "Aftakmof" },
            { value: "eindmof", label: "Eindmof" },
          ]}
        />
      </Field>

      {mof.type && (
        <Field label="Bestaande kabel">
          <PillGroup
            value={mof.bestaandType}
            onChange={(v) => onChange({ bestaandType: v as LsKabelType })}
            options={[
              { value: "GPLK", label: "GPLK" },
              { value: "kunststof", label: "Kunststof" },
            ]}
          />
        </Field>
      )}

      {mof.type === "eindmof" && mof.bestaandType && (
        <InfoBox type="info">
          Eindmof materialen worden automatisch toegevoegd incl. aftakklem aarde
        </InfoBox>
      )}

      {mof.bestaandType && mof.type !== "eindmof" && (
        <FieldRow>
          <Field label="Hoofdkabel doorsnede (mm²)">
            <Stepper
              value={mof.hoofdkabelDoorsnede ?? 0}
              onChange={(v) =>
                onChange({ hoofdkabelDoorsnede: v || null, ringklemArtikelNummer: null, ringklemHandmatig: false })
              }
              min={0}
              max={999}
              suffix=" mm²"
            />
          </Field>
          <Field label="Materiaal">
            <PillGroup
              value={mof.hoofdkabelMateriaal}
              onChange={(v) =>
                onChange({
                  hoofdkabelMateriaal: v as "Al" | "Cu",
                  ringklemArtikelNummer: null,
                  ringklemHandmatig: false,
                })
              }
              options={[
                { value: "Al", label: "Aluminium" },
                { value: "Cu", label: "Koper" },
              ]}
            />
          </Field>
        </FieldRow>
      )}

      {mof.type === "aftakmof" && mof.bestaandType && (
        <>
          <FieldRow>
            <Field label="Aantal aftakken">
              <Stepper
                value={mof.aantalAftakken}
                onChange={(v) => onChange({ aantalAftakken: v })}
                min={1}
                max={20}
              />
            </Field>
            <Field label="Aftakkabel doorsnede (mm²)">
              <Stepper
                value={mof.aftakDoorsnede ?? 0}
                onChange={(v) =>
                  onChange({ aftakDoorsnede: v || null, ringklemArtikelNummer: null, ringklemHandmatig: false })
                }
                min={0}
                max={999}
                suffix=" mm²"
              />
            </Field>
          </FieldRow>

          {mof.hoofdkabelDoorsnede && mof.aftakDoorsnede && mof.hoofdkabelMateriaal && (
            <>
              {gevondenRingklemmen.length === 1 && (
                <InfoBox type="success">
                  ✓ Ringklem: <span className="font-mono">{gevondenRingklemmen[0].artikel_nummer}</span>
                  {" — "}
                  {gevondenRingklemmen[0].omschrijving}
                </InfoBox>
              )}
              {gevondenRingklemmen.length > 1 && (
                <Field label="Meerdere ringklemmen passen — kies:">
                  <div className="flex flex-wrap gap-1.5">
                    {gevondenRingklemmen.map((r) => (
                      <button
                        key={r.artikel_nummer}
                        onClick={() =>
                          onChange({ ringklemArtikelNummer: r.artikel_nummer, ringklemHandmatig: true })
                        }
                        className={cn(
                          "border px-2 py-1 rounded text-[11px] font-mono",
                          mof.ringklemArtikelNummer === r.artikel_nummer
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-surface border-border hover:bg-accent",
                        )}
                        title={r.omschrijving}
                      >
                        {r.artikel_nummer}
                      </button>
                    ))}
                  </div>
                </Field>
              )}
              {gevondenRingklemmen.length === 0 && (
                <InfoBox type="warning">
                  ⚠ Geen ringklem gevonden — kies handmatig:
                  <select
                    className="mt-1 w-full text-[11px] p-1.5 rounded border border-border bg-muted"
                    value={mof.ringklemArtikelNummer ?? ""}
                    onChange={(e) =>
                      onChange({ ringklemArtikelNummer: e.target.value || null, ringklemHandmatig: true })
                    }
                  >
                    <option value="">Kies ringklem...</option>
                    {RINGKLEM_SPECS.map((r) => (
                      <option key={r.artikel_nummer} value={r.artikel_nummer}>
                        {r.omschrijving}
                      </option>
                    ))}
                  </select>
                </InfoBox>
              )}
            </>
          )}
        </>
      )}

      <Field label="Aantal moffen">
        <Stepper value={mof.aantal} onChange={(v) => onChange({ aantal: v })} min={1} max={99} />
      </Field>

      <Field label="LS-kabel lengte (meter)">
        <div className="flex items-center gap-3">
          <Stepper
            value={mof.kabelLengteMeters}
            onChange={(v) => onChange({ kabelLengteMeters: v })}
            min={0}
            max={999}
            suffix=" m"
          />
          {mof.kabelLengteMeters > 0 && (() => {
            const fases = isProv && mof.kanZwaaien === false ? 2 : 1;
            const totaal = mof.kabelLengteMeters * mof.aantal * fases;
            return (
              <span className="text-xs text-muted-foreground">
                = {totaal}m kabel totaal{fases === 2 ? " (tijdelijk + definitief)" : ""}
              </span>
            );
          })()}
        </div>
      </Field>

      {mof.kabelLengteMeters > 0 && (
        <>
          <Field label="Oversteek (weg/watergang)?">
            <PillGroup
              value={mof.heeftOversteek ? "ja" : "nee"}
              onChange={(v) =>
                onChange({
                  heeftOversteek: v === "ja",
                  aantalOversteken: v === "ja" ? mof.aantalOversteken || 1 : 0,
                  oversteekMeters: v === "ja" ? mof.oversteekMeters : 0,
                })
              }
              options={[
                { value: "ja", label: "Ja" },
                { value: "nee", label: "Nee" },
              ]}
            />
          </Field>
          {mof.heeftOversteek && (
            <>
              <Field label="Aantal oversteken">
                <Stepper
                  value={mof.aantalOversteken}
                  onChange={(v) => onChange({ aantalOversteken: v })}
                  min={1}
                  max={10}
                />
              </Field>
              <Field label="Lengte per oversteek (meter)">
                <Stepper
                  value={mof.oversteekMeters}
                  onChange={(v) => onChange({ oversteekMeters: v })}
                  min={1}
                  max={200}
                  suffix=" m"
                />
              </Field>
              <InfoBox type="info">
                {`PVC 110mm beschermbuis (20028640) — ${Math.ceil(mof.oversteekMeters / 6) * mof.aantalOversteken} stuks`}
                {` | Geotextiel — ${mof.aantalOversteken * 2} stuks`}
              </InfoBox>
            </>
          )}
        </>
      )}

      {isProv && (
        <Field label="Kan kabel worden omgezwaaid?">
          <PillGroup
            value={mof.kanZwaaien === true ? "ja" : mof.kanZwaaien === false ? "nee" : ""}
            onChange={(v) => onChange({ kanZwaaien: v === "ja" })}
            options={[
              { value: "ja", label: "Ja — zwaaien", color: "green" },
              { value: "nee", label: "Nee — opnieuw", color: "amber" },
            ]}
          />
        </Field>
      )}
    </div>
  );
}

// ---------- Provisorium ----------

function ProvisoriumSection({
  config,
  update,
  sd,
}: {
  config: MaterialenConfig;
  update: (p: Partial<MaterialenConfig>) => void;
  sd: ReturnType<typeof useStamdata>;
}) {
  const filtered = (sd.rmuConfigs.data ?? []).filter(
    (c) => c.merk === config.provRmuMerk && c.is_inet === false,
  );
  const setVeld = (id: string, patch: Partial<RmuVeldConfig>) => {
    update({ provRmuVelden: config.provRmuVelden.map((v) => (v.id === id ? { ...v, ...patch } : v)) });
  };
  const setMof = (id: string, patch: Partial<LsMof>) =>
    update({ provLsMoffen: config.provLsMoffen.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const removeMof = (id: string) =>
    update({ provLsMoffen: config.provLsMoffen.filter((m) => m.id !== id) });
  const addMof = () => update({ provLsMoffen: [...config.provLsMoffen, newLsMof()] });

  return (
    <div className="space-y-4">
      <InfoBox type="info">
        De provisorium zorgt voor spanning tijdens de renovatie. Vul hieronder de RMU en zekeringen
        van de provisorium in. RMU, frame en bodemplaat worden niet besteld.
      </InfoBox>

      <Field label="Provisorium RMU merk">
        <PillGroup
          value={config.provRmuMerk}
          onChange={(v) =>
            update({
              provRmuMerk: v as MaterialenConfig["provRmuMerk"],
              provRmuConfig: null,
              provRmuVelden: [],
            })
          }
          options={[
            { value: "ABB", label: "ABB" },
            { value: "Siemens", label: "Siemens" },
            { value: "Magnefix", label: "Magnefix" },
          ]}
        />
      </Field>

      {config.provRmuMerk && (
        <Field label="Provisorium RMU configuratie">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground">Geen configuraties gevonden.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {filtered.map((c) => {
                const active = config.provRmuConfig?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    data-active={active}
                    onClick={() => update({ provRmuConfig: c, provRmuVelden: buildRmuVelden(c) })}
                    className="border border-border bg-surface rounded-md px-3 py-1.5 text-sm hover:bg-accent data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:border-primary"
                  >
                    {c.code}
                  </button>
                );
              })}
            </div>
          )}
        </Field>
      )}

      {config.provRmuConfig && (
        <InfoBox type="info">
          <span className="font-mono text-xs">
            {config.provRmuConfig.aantal_velden} velden · {config.provRmuConfig.aantal_f}F /{" "}
            {config.provRmuConfig.aantal_c}C / {config.provRmuConfig.aantal_v}V
          </span>
        </InfoBox>
      )}

      {config.provRmuConfig && config.provRmuVelden.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Provisorium veldinstellingen
          </div>
          {config.provRmuVelden.map((veld) => (
            <ProvVeldKaart key={veld.id} veld={veld} merk={config.provRmuMerk} setVeld={setVeld} />
          ))}
        </div>
      )}

      <Field label="Provisorium trafo vermogen (kVA)">
        <PillGroup
          value={config.provZekeringKva}
          onChange={(v) => update({ provZekeringKva: v as MaterialenConfig["provZekeringKva"] })}
          options={[
            { value: "250", label: "250 kVA" },
            { value: "400", label: "400 kVA" },
            { value: "630", label: "630 kVA" },
            { value: "1000", label: "1000 kVA" },
          ]}
        />
      </Field>

      <Field label="LS-moffen op provisorium?">
        <PillGroup
          value={config.provLsMoffenActief ? "ja" : "nee"}
          onChange={(v) =>
            update({
              provLsMoffenActief: v === "ja",
              provLsMoffen: v === "ja" ? config.provLsMoffen : [],
            })
          }
          options={[
            { value: "ja", label: "Ja", color: "green" },
            { value: "nee", label: "Nee", color: "amber" },
          ]}
        />
      </Field>

      {config.provLsMoffenActief && (
        <div className="space-y-3">
          {config.provLsMoffen.length === 0 && (
            <p className="text-xs text-muted-foreground">Nog geen provisorium LS-moffen toegevoegd.</p>
          )}
          {config.provLsMoffen.map((m, idx) => (
            <LsMofKaart
              key={m.id}
              mof={m}
              index={idx}
              isProv={false}
              onChange={(patch) => setMof(m.id, patch)}
              onRemove={() => removeMof(m.id)}
            />
          ))}
          <button
            onClick={addMof}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Plus className="w-4 h-4" /> Provisorium LS-mof toevoegen
          </button>
        </div>
      )}
    </div>
  );
}

function ProvVeldKaart({
  veld,
  merk,
  setVeld,
}: {
  veld: RmuVeldConfig;
  merk: string;
  setVeld: (id: string, patch: Partial<RmuVeldConfig>) => void;
}) {
  const badge = veldBadge(merk, veld.veldType);
  const label = veldLabel(merk, veld.veldType, veld.veldNummer);
  const isMagnefix = merk === "Magnefix";

  if (veld.veldType === "F") {
    return (
      <div className="rounded-md border border-border bg-background/40 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="rounded bg-secondary text-secondary-foreground text-xs font-mono px-1.5 py-0.5">{badge}</span>
          <span className="text-sm font-medium">{label}</span>
        </div>
        <InfoBox type="info">
          Provisorium eindsluiting + buispatroon (3×) worden automatisch toegevoegd op basis van het provisorium kVA.
        </InfoBox>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-background/40 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="rounded bg-secondary text-secondary-foreground text-xs font-mono px-1.5 py-0.5">{badge}</span>
        <span className="text-sm font-medium">{label}</span>
        <span className="text-[10px] text-muted-foreground ml-auto">altijd aangesloten</span>
      </div>
      {!isMagnefix && (
        <Field label="Kabeltype">
          <PillGroup
            value={veld.kabelType}
            onChange={(v) => setVeld(veld.id, { kabelType: v as RmuVeldConfig["kabelType"] })}
            options={[
              { value: "240AL", label: "3x1x240AL singels" },
              { value: "630AL", label: "3x1x630AL singels" },
            ]}
          />
        </Field>
      )}
      {isMagnefix && (
        <InfoBox type="info">
          K-veld eindsluiting + afschermset worden automatisch toegevoegd
        </InfoBox>
      )}
    </div>
  );
}

// ---------- GGI ----------

function GgiSection({
  config,
  update,
}: {
  config: MaterialenConfig;
  update: (p: Partial<MaterialenConfig>) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="Wordt GGI vervangen?">
        <PillGroup
          value={config.ggiVervangen ? "ja" : "nee"}
          onChange={(v) => update({ ggiVervangen: v === "ja" })}
          options={[
            { value: "ja", label: "Ja", color: "green" },
            { value: "nee", label: "Nee", color: "amber" },
          ]}
        />
      </Field>
      {config.ggiVervangen && (
        <InfoBox type="info">
          Vaste GGI materialen worden automatisch toegevoegd: armatuur LED-TL (2×), TL-buizen (4×),
          installatiebuis (4×), klemzadels (100×), kabellasdozen (4×), YMvK kabel (10m) en lasklemmen.
        </InfoBox>
      )}
    </div>
  );
}

// ---------- Preview ----------



interface SectieGroep {
  key: PreviewSectie;
  label: string;
  color: string;
  items: PreviewItem[];
  verwijderdeItems: PreviewItem[];
  isNieuw: boolean;
}

const HIGHLIGHT_MS = 1500;
const REMOVED_MS = 2000;

function PreviewPanel({ preview, onSave, saving, hasSubType }: { preview: PreviewItem[]; onSave: () => void; saving: boolean; hasSubType: boolean }) {
  // Vorige snapshot van id → hoeveelheid voor diff
  const vorigeItemsRef = useRef<Map<string, { item: PreviewItem; hoeveelheid: number }>>(new Map());
  const bekendeSectiesRef = useRef<Set<PreviewSectie>>(new Set());
  const eersteRunRef = useRef(true);

  const [nieuwIds, setNieuwIds] = useState<Set<string>>(new Set());
  const [verwijderdItems, setVerwijderdItems] = useState<PreviewItem[]>([]);
  const [nieuweSecties, setNieuweSecties] = useState<Set<PreviewSectie>>(new Set());

  // Diff bij elke nieuwe preview-berekening (na debounce)
  useEffect(() => {
    const huidig = new Map<string, { item: PreviewItem; hoeveelheid: number }>();
    for (const p of preview) huidig.set(p.artikel_id, { item: p, hoeveelheid: p.hoeveelheid });

    const eersteRun = eersteRunRef.current;
    eersteRunRef.current = false;

    // Nieuwe / gewijzigde items
    const nIds = new Set<string>();
    if (!eersteRun) {
      for (const [id, { hoeveelheid }] of huidig) {
        const vorig = vorigeItemsRef.current.get(id);
        if (vorig === undefined || vorig.hoeveelheid !== hoeveelheid) nIds.add(id);
      }
    }

    // Verwijderde items
    const verwijderd: PreviewItem[] = [];
    for (const [id, { item }] of vorigeItemsRef.current) {
      if (!huidig.has(id)) verwijderd.push(item);
    }

    // Nieuwe secties (die nu items hebben en eerder niet)
    const huidigeSecties = new Set<PreviewSectie>();
    for (const p of preview) huidigeSecties.add(p.sectie);
    const nieuwS = new Set<PreviewSectie>();
    if (!eersteRun) {
      for (const s of huidigeSecties) {
        if (!bekendeSectiesRef.current.has(s)) nieuwS.add(s);
      }
    }
    bekendeSectiesRef.current = huidigeSecties;

    vorigeItemsRef.current = huidig;
    setNieuwIds(nIds);
    setVerwijderdItems(verwijderd);
    if (nieuwS.size > 0) setNieuweSecties(nieuwS);

    const t1 = nIds.size > 0 ? setTimeout(() => setNieuwIds(new Set()), HIGHLIGHT_MS) : null;
    const t2 = verwijderd.length > 0 ? setTimeout(() => setVerwijderdItems([]), REMOVED_MS) : null;
    const t3 = nieuwS.size > 0 ? setTimeout(() => setNieuweSecties(new Set()), 400) : null;
    return () => {
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
      if (t3) clearTimeout(t3);
    };
  }, [preview]);

  // Groeperen op sectie in vaste volgorde
  const sectieGroepen: SectieGroep[] = useMemo(() => {
    const map = new Map<PreviewSectie, PreviewItem[]>();
    for (const p of preview) {
      const arr = map.get(p.sectie) ?? [];
      arr.push(p);
      map.set(p.sectie, arr);
    }
    const verwijderdPerSectie = new Map<PreviewSectie, PreviewItem[]>();
    for (const v of verwijderdItems) {
      const arr = verwijderdPerSectie.get(v.sectie) ?? [];
      arr.push(v);
      verwijderdPerSectie.set(v.sectie, arr);
    }
    return PREVIEW_SECTIE_DEFS
      .map((def) => ({
        key: def.key,
        label: def.label,
        color: def.color,
        items: map.get(def.key) ?? [],
        verwijderdeItems: verwijderdPerSectie.get(def.key) ?? [],
        isNieuw: nieuweSecties.has(def.key),
      }))
      .filter((g) => g.items.length > 0 || g.verwijderdeItems.length > 0);
  }, [preview, verwijderdItems, nieuweSecties]);

  const teBestellen = preview.filter((p) => !p.niet_bestellen).length;
  const totaalArtikelen = preview.length;

  return (
    <div className="rounded-lg border border-border bg-surface flex flex-col h-fit lg:sticky lg:top-4 max-h-[calc(100vh-2rem)]">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Live materiaallijst</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totaalArtikelen === 0 ? "Nog leeg" : `${totaalArtikelen} artikelen · ${sectieGroepen.length} secties`}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {sectieGroepen.length === 0 && (
          <div className="px-4 py-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
              <ClipboardList className="w-6 h-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Nog geen materialen</p>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px] mx-auto">
              {hasSubType
                ? "Vul de configuratie in — de materiaallijst bouwt zich automatisch op."
                : "Kies eerst het projecttype om de materiaallijst op te bouwen."}
            </p>
          </div>
        )}

        {sectieGroepen.map((sec) => (
          <div
            key={sec.key}
            className={cn("animate-fade-in", sec.isNieuw && "preview-sectie-nieuw")}
          >
            <div className="flex items-center gap-2 px-2 py-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: sec.color }} />
              <span className="text-[11px] font-mono uppercase tracking-wider text-foreground/80">{sec.label}</span>
              <span className="text-[10px] font-mono text-muted-foreground ml-auto">{sec.items.length} art.</span>
            </div>
            <div className="space-y-0.5">
              {sec.items.map((it) => (
                <PreviewRij key={it.artikel_id} item={it} isNieuw={nieuwIds.has(it.artikel_id)} isVerwijderd={false} />
              ))}
              {sec.verwijderdeItems.map((it) => (
                <PreviewRij key={`del-${it.artikel_id}`} item={it} isNieuw={false} isVerwijderd={true} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border px-4 py-3 space-y-2">
        {sectieGroepen.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 pb-1">
            {sectieGroepen.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-mono text-foreground/80">{s.items.length}</span>
              </div>
            ))}
          </div>
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
    </div>
  );
}

function PreviewRij({ item, isNieuw, isVerwijderd }: {
  item: PreviewItem;
  isNieuw: boolean;
  isVerwijderd: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors duration-300",
        !isVerwijderd && "hover:bg-accent/40",
        item.niet_bestellen && !isVerwijderd && "opacity-50 line-through",
        isNieuw && !isVerwijderd && "bg-success/10 ring-1 ring-success/30",
        isVerwijderd && "bg-destructive/10 ring-1 ring-destructive/30 line-through opacity-70 animate-fade-out",
      )}
      title={item.herkomst.join(", ")}
    >
      <span
        className={cn(
          "w-3 text-center text-[11px] font-bold shrink-0",
          isNieuw && !isVerwijderd ? "text-success" : isVerwijderd ? "text-destructive" : "text-transparent",
        )}
      >
        {isVerwijderd ? "−" : isNieuw ? "+" : ""}
      </span>
      <span className="font-mono text-xs text-muted-foreground w-20 shrink-0 truncate">{item.artikel_nummer}</span>
      <span className="flex-1 truncate">{item.korte_omschrijving}</span>
      <span className="font-mono text-xs tabular-nums">{item.hoeveelheid}{item.eenheid}</span>
      {item.herkomst.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "shrink-0 inline-flex items-center justify-center rounded-full w-5 h-5 text-[10px] font-semibold transition-colors",
                item.herkomst.length > 1
                  ? "bg-primary/15 text-primary hover:bg-primary/25"
                  : "text-muted-foreground/60 hover:text-foreground hover:bg-accent",
              )}
              aria-label={`Toon ${item.herkomst.length} herkomst${item.herkomst.length > 1 ? "en" : ""}`}
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
    </div>
  );
}
