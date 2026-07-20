import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Layers,
  Cable,
  Zap,
  Box,
  Plug,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStamdata } from "@/lib/configurator/queries";
import { berekenPreview } from "@/lib/configurator/berekenen";
import {
  emptyConfig,
  isCompactCaseType,
  legeWinkelwagenAanpassingen,
  SUB_TYPE_LABELS,
  subTypeVoorCaseType,
  type MaterialenConfig,
  type PreviewItem,
  type SubType,
  type WinkelwagenAanpassingen,
} from "@/lib/configurator/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FALLBACK_HOOFDSTUK_ID,
  maatwerkGroepen,
  type MaatwerkVraag,
} from "@/lib/configurator/berekenen/maatwerk";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Winkelwagen } from "@/components/winkelwagen/Winkelwagen";
import { MaatwerkSection } from "./sections/MaatwerkSection";
import { ProjectSection } from "./sections/ProjectSection";
import { ProvisoriumSection } from "./sections/ProvisoriumSection";
import { RmuSection } from "./sections/RmuSection";
import { MsSection } from "./sections/MsSection";
import { TrafoSection, VultKabelSection } from "./sections/TrafoSection";
import { LsRekSection } from "./sections/LsRekSection";
import { LsSection } from "./sections/LsSection";
import { GgiSection } from "./sections/GgiSection";

/** Afgeleide status die de configurator aan zijn parent (de case-header) doorgeeft. */
export interface ConfiguratorStatus {
  completed: number;
  total: number;
  saving: boolean;
  previewCount: number;
}

interface Props {
  caseId: string;
  caseType: string;
  initialConfig?: MaterialenConfig | null;
  /** Opgeslagen winkelwagen-aanpassingen (uit config_json.winkelwagen). */
  initialAanpassingen?: WinkelwagenAanpassingen | null;
  /** Datum van de laatste export (= geplaatste bestelling), of null. */
  besteldOp?: string | null;
  onDirtyChange?: (isDirty: boolean) => void;
  /** Afgeleide status (voortgang, opslaan-bezig, preview-telling) in één callback. */
  onStatusChange?: (status: ConfiguratorStatus) => void;
  onWinkelwagenItemsChange?: (items: PreviewItem[]) => void;
  saveSignal?: number;
  mobileTab?: "config" | "preview";
  onExport?: () => void;
  exportDisabled?: boolean;
  exportPending?: boolean;
  exportSignal?: number;
}

// Nieuwe gegroepeerde sectievolgorde (TerreVolt redesign)
//  1 Type opdracht (navy)
//  2 Provisorium (blauw)        — alleen bij cs_met_prov / renovatie_prov
//  3 MS — Middenspanning (oranje) bevat RMU + I-Net + Veldinstellingen + traces + moffen
//  4 Trafo & Vult kabel (amber) — alleen renovatie
//  5 LS — Laagspanning (paars)  bevat LS-rek + OV-stuurpunt + LS moffen
//  6 Overig (grijs)             bevat GGI + standaard materialen
const SECTIONS = [
  { key: "project", label: "Type opdracht", color: "var(--color-section-project)", icon: Layers },
  {
    key: "provisorium",
    label: "Provisorium",
    color: "var(--color-section-provisorium)",
    icon: Cable,
  },
  { key: "ms", label: "MS — Middenspanning", color: "var(--color-section-ms)", icon: Zap },
  { key: "trafo", label: "Trafo & Vult kabel", color: "var(--color-section-trafo)", icon: Box },
  { key: "ls", label: "LS — Laagspanning", color: "var(--color-section-ls)", icon: Plug },
  { key: "overig", label: "Overig", color: "var(--color-section-overig)", icon: Package },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const RENOVATIE = (s: string) => s === "renovatie_prov" || s === "renovatie_nsa";

export function MaterialenConfigurator({
  caseId,
  caseType,
  initialConfig,
  initialAanpassingen,
  besteldOp,
  onDirtyChange,
  onStatusChange,
  onWinkelwagenItemsChange,
  saveSignal,
  mobileTab = "config",
  onExport,
  exportDisabled,
  exportPending,
  exportSignal,
}: Props) {
  const qc = useQueryClient();
  const isCompact = isCompactCaseType(caseType);
  const isCompactProv = caseType === "compact_prov";
  const initial = useMemo(() => {
    const base = initialConfig ?? emptyConfig();
    // Type opdracht (subType) wordt niet meer gevraagd maar volgt 1-op-1 uit
    // het case type — ook voor bestaande cases geforceerd, zodat een oude
    // afwijkende keuze nooit meer tot een inconsistente combinatie leidt.
    return {
      ...base,
      isCompactStation: isCompact,
      subType: subTypeVoorCaseType(caseType),
    };
  }, [initialConfig, isCompact, caseType]);
  const [config, setConfig] = useState<MaterialenConfig>(initial);

  // Nieuwe lege case → alleen eerste sectie open. Bestaande config → alles open.
  // Secties openen/sluiten daarna alleen nog door expliciet op de header te klikken.
  const isNewCase = !initialConfig;
  // Record<string, boolean> i.p.v. Record<SectionKey, ...>: eigen hoofdstukken
  // (dynamische kaarten uit maatwerk_hoofdstukken) krijgen keys "hoofdstuk:<id>".
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    isNewCase
      ? { project: true, provisorium: false, ms: false, trafo: false, ls: false, overig: false }
      : { project: true, provisorium: true, ms: true, trafo: true, ls: true, overig: true },
  );
  // Welke configurator sectie is als laatst door de engineer geopend → winkelwagen synchroniseert mee
  const [activeSectie, setActiveSectie] = useState<string | null>("project");
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
    [
      debounced,
      sd.isLoading,
      caseType,
      sd.artikelen.data,
      sd.rmuConfigs.data,
      sd.rmuVeldArtikelen.data,
      sd.rmuZekeringen.data,
      sd.msMofTypes.data,
      sd.msMofMaterialen.data,
      sd.lsMofTypes.data,
      sd.lsMofMaterialen.data,
      sd.standaardTemplates.data,
      sd.stationVaste.data,
      // DB-gedreven regels (fase 2 refactor) — zonder deze deps herberekent
      // de preview niet als deze queries later binnenkomen, waardoor o.a.
      // LS-rek keuzes niet in de winkelwagen verschijnen.
      sd.ggiRegels.data,
      sd.trafoRegels.data,
      sd.lsRekRegels.data,
      sd.provRegels.data,
      sd.msKabelRegels.data,
      sd.rmuVeldRegels.data,
      sd.trafoVultKabelSpecs.data,
      sd.maatwerkVragen.data,
    ],
  );
  // Effectieve winkelwagen-items (na overrides / verwijderingen / handmatig toegevoegde)
  const winkelwagenItemsRef = useRef<PreviewItem[]>([]);
  // Handmatige aanpassingen — meegeschreven in config_json zodat ze een herlaad overleven
  const aanpassingenRef = useRef<WinkelwagenAanpassingen>(
    initialAanpassingen ?? legeWinkelwagenAanpassingen(),
  );

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
  const trafoOk = isCompact ? true : !showTrafo || (!!config.trafoActie && !!config.trafoKva);
  const vultKabelOk = isCompact ? true : !isRenovatie || config.vultKabelAfstand > 0;
  const lsRekOk = isCompact
    ? true
    : !isRenovatie ||
      (!!config.lsRekActie && (config.lsRekActie === "gehandhaafd" || !!config.lsRekType));
  const msMoffenOk =
    config.msRichtingen.length === 0 || config.msRichtingen.every(richtingComplete);
  const lsMoffenOk =
    !config.lsMoffenActief ||
    (config.lsMoffen.length > 0 && config.lsMoffen.every((m) => !!m.type && !!m.bestaandType));

  const completion: Record<SectionKey, boolean> = {
    project: !!config.subType,
    provisorium:
      !isProvisorum || (!!config.provRmuMerk && !!config.provRmuConfig && !!config.provZekeringKva),
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

  // Eigen (via Beheer aangemaakte) vragen: per bestaand hoofdstuk (sectie_key)
  // of als eigen hoofdstuk-kaart. Vragen in een hier verborgen sectie (bv.
  // trafo bij compact) verhuizen naar het fallback-hoofdstuk zodat ze altijd
  // invulbaar blijven.
  const groepen = (() => {
    const g = maatwerkGroepen(sd, caseType);
    const zichtbaar = new Set<string>(visibleKeys);
    const perSectie: Record<string, MaatwerkVraag[]> = {};
    const verplaatst: MaatwerkVraag[] = [];
    for (const [k, vs] of Object.entries(g.perSectie)) {
      if (zichtbaar.has(k)) perSectie[k] = vs;
      else verplaatst.push(...vs);
    }
    let hoofdstukken = g.hoofdstukken;
    if (verplaatst.length > 0) {
      const fb = hoofdstukken.find((h) => h.id === FALLBACK_HOOFDSTUK_ID);
      if (fb) {
        hoofdstukken = hoofdstukken.map((h) =>
          h.id === FALLBACK_HOOFDSTUK_ID ? { ...h, vragen: [...h.vragen, ...verplaatst] } : h,
        );
      } else {
        hoofdstukken = [
          ...hoofdstukken,
          { id: FALLBACK_HOOFDSTUK_ID, naam: "Eigen vragen", vragen: verplaatst },
        ];
      }
    }
    return { perSectie, hoofdstukken };
  })();
  const hoofdstukCompleet = (h: { vragen: MaatwerkVraag[] }) =>
    h.vragen.every((v) => (config.maatwerkAntwoorden?.[v.vraag_key] ?? "").trim() !== "");

  const totalVisible = visibleKeys.length + groepen.hoofdstukken.length;
  const completedCount =
    visibleKeys.filter((k) => completion[k]).length +
    groepen.hoofdstukken.filter(hoofdstukCompleet).length;
  const allComplete = completedCount === totalVisible;

  const update = (patch: Partial<MaterialenConfig>) => setConfig((c) => ({ ...c, ...patch }));

  const opslaan = useMutation({
    mutationFn: async () => {
      // Waarschuw maar blokkeer niet bij onvolledige secties
      if (!allComplete) {
        const missing = totalVisible - completedCount;
        toast.warning(
          `${missing} sectie${missing === 1 ? "" : "s"} nog niet volledig — toch opgeslagen`,
        );
      }
      // Volledige config opslaan als JSON. rmuConfig wordt afgeslankt tot {id};
      // bij rehydratie wordt het volledige object opgezocht in de stamdata.
      // De winkelwagen-aanpassingen (overrides/verwijderd/toegevoegd) gaan mee
      // zodat handmatige correcties een herlaad overleven.
      const configToSave = {
        ...config,
        rmuConfig: config.rmuConfig ? { id: config.rmuConfig.id } : null,
        provRmuConfig: config.provRmuConfig ? { id: config.provRmuConfig.id } : null,
        winkelwagen: aanpassingenRef.current,
      };

      // Effectieve winkelwagen-items (incl. overrides, excl. verwijderde,
      // incl. handmatig toegevoegde)
      const effectief =
        winkelwagenItemsRef.current.length > 0 || preview.length === 0
          ? winkelwagenItemsRef.current
          : preview;
      const materiaalRows = effectief.map((p) => ({
        case_id: caseId,
        artikel_id: p.artikel_id,
        gewenste_hoeveelheid: p.hoeveelheid,
        niet_bestellen: p.niet_bestellen,
        herkomst_label: p.herkomst.join(", "),
      }));

      // ms moffen — één rij per richting met alle definitief-velden ingebed
      const msMofRows = config.msRichtingen.map((r, i) => ({
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

      // ls moffen
      const lsMofRows = (config.lsMoffenActief ? config.lsMoffen : []).map((m, i) => ({
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

      // Transactioneel via RPC: alles slaagt of niets wijzigt. De oude
      // client-side delete-dan-insert kon bij een fout halverwege de
      // materiaallijst van de case wissen.
      const { error: rpcError } = await supabase.rpc("sla_case_op", {
        p_case_id: caseId,
        p_sub_type: config.subType ?? "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        p_config_json: configToSave as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        p_materialen: materiaalRows as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        p_ms_moffen: msMofRows as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        p_ls_moffen: lsMofRows as any,
      });
      if (!rpcError) return { configToSave };

      // Fallback zolang de sla_case_op-migratie nog niet is uitgevoerd:
      // sequentieel opslaan, maar mét foutcontrole op elke stap.
      const functieOntbreekt =
        rpcError.code === "PGRST202" ||
        rpcError.code === "42883" ||
        /sla_case_op/i.test(rpcError.message ?? "");
      if (!functieOntbreekt) throw rpcError;

      const { error: caseErr } = await supabase
        .from("cases")
        .update({
          sub_type: config.subType || null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config_json: configToSave as any,
        })
        .eq("id", caseId);
      if (caseErr) throw caseErr;

      const { error: delMatErr } = await supabase
        .from("case_materialen")
        .delete()
        .eq("case_id", caseId);
      if (delMatErr) throw delMatErr;
      if (materiaalRows.length > 0) {
        const { error } = await supabase.from("case_materialen").insert(materiaalRows);
        if (error) throw error;
      }

      const { error: delMsErr } = await supabase
        .from("case_ms_moffen")
        .delete()
        .eq("case_id", caseId);
      if (delMsErr) throw delMsErr;
      if (msMofRows.length > 0) {
        const { error } = await supabase.from("case_ms_moffen").insert(msMofRows);
        if (error) throw error;
      }

      const { error: delLsErr } = await supabase
        .from("case_ls_moffen")
        .delete()
        .eq("case_id", caseId);
      if (delLsErr) throw delLsErr;
      if (lsMofRows.length > 0) {
        const { error } = await supabase.from("case_ls_moffen").insert(lsMofRows);
        if (error) throw error;
      }
      return { configToSave };
    },
    onSuccess: ({ configToSave }) => {
      // Cache van de case direct bijwerken met wat zojuist is opgeslagen.
      // Zonder dit rendert de case-pagina bij terugkeren eerst uit de oude
      // cache (config_json van vóór de save) en initialiseert de configurator
      // + winkelwagen zich op verouderde data — correcties lijken dan verdwenen.
      qc.setQueryData(["case", caseId], (old: Record<string, unknown> | undefined) =>
        old ? { ...old, sub_type: config.subType || null, config_json: configToSave } : old,
      );
      qc.invalidateQueries({ queryKey: ["case-materialen", caseId] });
      qc.invalidateQueries({ queryKey: ["case-materialen-full", caseId] });
      qc.invalidateQueries({ queryKey: ["cases"] });
      onDirtyChange?.(false);
      toast.success("Materiaallijst opgeslagen");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Afgeleide status (voortgang, opslaan-bezig, preview-telling) in één callback
  // naar de parent (header). Eén effect i.p.v. losse callbacks per veld.
  useEffect(() => {
    onStatusChange?.({
      completed: completedCount,
      total: totalVisible,
      saving: opslaan.isPending,
      previewCount: preview.length,
    });
  }, [completedCount, totalVisible, opslaan.isPending, preview.length, onStatusChange]);

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
          <div className="text-sm font-medium text-destructive">
            Stamdata kon niet worden geladen
          </div>
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
      <div
        className={cn(
          "space-y-6 max-w-4xl w-full mx-auto px-2 sm:px-4 py-2",
          mobileTab === "preview" && "hidden lg:block",
        )}
      >
        {SECTIONS.map((sec, idx) => {
          if (sec.key === "provisorium" && (!isProvisorum || (isCompact && !isCompactProv)))
            return null;
          if (sec.key === "trafo" && !(showTrafo || showVultKabel)) return null;
          const extraVragen = groepen.perSectie[sec.key] ?? [];
          return (
            <div
              key={sec.key}
              ref={(el) => {
                sectionRefs.current[sec.key] = el;
              }}
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
                {sec.key === "project" && (
                  <ProjectSection caseType={caseType} subType={config.subType} />
                )}
                {sec.key === "provisorium" && (
                  <ProvisoriumSection config={config} update={update} sd={sd} />
                )}
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
                        <VultKabelSection config={config} update={update} sd={sd} />
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
                    <div
                      className={cn(
                        isRenovatie && "border-t border-border pt-5",
                        "text-xs text-muted-foreground",
                      )}
                    >
                      <div className="font-semibold text-foreground mb-1">Standaard materialen</div>
                      Worden automatisch toegevoegd op basis van case type en sub type. Zichtbaar in
                      de winkelwagen rechts.
                    </div>
                  </div>
                )}
                {extraVragen.length > 0 && (
                  <div className="mt-6 rounded-xl border border-border bg-muted/30 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <ClipboardList className="w-4 h-4 text-muted-foreground" />
                      <div className="text-sm font-semibold text-foreground">Extra vragen</div>
                    </div>
                    <MaatwerkSection vragen={extraVragen} config={config} update={update} />
                  </div>
                )}
              </SectionCard>
            </div>
          );
        })}

        {/* Eigen hoofdstukken (Beheer → Automations → Eigen vragen) — elk een
            eigen sectie-kaart met zelfgekozen naam. */}
        {groepen.hoofdstukken.map((h, i) => {
          const key = `hoofdstuk:${h.id}`;
          const isOpen = open[key] ?? !isNewCase;
          const beantwoord = h.vragen.filter(
            (v) => (config.maatwerkAntwoorden?.[v.vraag_key] ?? "").trim() !== "",
          ).length;
          return (
            <div
              key={key}
              ref={(el) => {
                sectionRefs.current[key] = el;
              }}
              className="scroll-mt-20"
            >
              <SectionCard
                color="#B0578D"
                title={h.naam}
                index={SECTIONS.length + i + 1}
                Icon={ClipboardList}
                isOpen={isOpen}
                isComplete={beantwoord === h.vragen.length}
                summary={
                  beantwoord > 0
                    ? `${beantwoord}/${h.vragen.length} beantwoord`
                    : "Nog in te vullen"
                }
                onToggle={() => {
                  const willOpen = !isOpen;
                  setOpen({ ...open, [key]: willOpen });
                  if (willOpen) setActiveSectie("maatwerk");
                }}
              >
                <MaatwerkSection vragen={h.vragen} config={config} update={update} />
              </SectionCard>
            </div>
          );
        })}
      </div>

      {/* Live winkelwagen — sticky op lg, mobiel via tab-toggle */}
      <div
        className={cn(
          mobileTab === "config" && "hidden lg:block",
          "lg:sticky lg:top-0 lg:self-start lg:h-[calc(100svh-var(--app-header-h,57px))] lg:max-h-[calc(100svh-var(--app-header-h,57px))] lg:overflow-hidden border-l border-border bg-card",
        )}
      >
        <Winkelwagen
          items={preview}
          caseId={caseId}
          caseType={caseType}
          subType={config.subType}
          hasSubType={!!config.subType}
          saving={opslaan.isPending}
          onSave={() => opslaan.mutate()}
          onItemsChange={(eff) => {
            winkelwagenItemsRef.current = eff;
            onWinkelwagenItemsChange?.(eff);
          }}
          artikelen={sd.artikelen.data ?? []}
          activeSectie={activeSectie ?? undefined}
          onExport={onExport}
          exportDisabled={exportDisabled}
          exportPending={exportPending}
          exportSignal={exportSignal}
          configSnapshot={config as unknown as Record<string, unknown>}
          besteldOp={besteldOp ?? null}
          initieleAanpassingen={initialAanpassingen ?? null}
          onAanpassingenChange={(a) => {
            aanpassingenRef.current = a;
            // Correcties zijn wijzigingen die opgeslagen moeten worden
            onDirtyChange?.(true);
          }}
        />
      </div>
    </div>
  );
}

function SectionCard({
  color,
  title,
  summary,
  index,
  Icon,
  isOpen,
  isComplete,
  onToggle,
  children,
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
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-6 py-5 hover:bg-accent/20 transition-colors text-left"
      >
        <span
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
          style={{
            background: `color-mix(in oklab, ${color} 18%, transparent)`,
            borderColor: `color-mix(in oklab, ${color} 40%, transparent)`,
            color: color,
          }}
        >
          <Icon className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-0.5">
            Sectie {index}
          </div>
          <div className="font-bold text-lg text-[color:var(--navy)] truncate leading-tight">
            {title}
          </div>
          {!isOpen && summary && summary !== "Nog in te vullen" && (
            <div className="text-xs text-muted-foreground mt-1 truncate">{summary}</div>
          )}
        </div>
        {isComplete && <CheckCircle2 className="w-5 h-5 text-success shrink-0" />}
        <ChevronDown
          className={cn(
            "w-5 h-5 transition-transform text-muted-foreground",
            isOpen && "rotate-180",
          )}
        />
      </button>
      {isOpen && <div className="px-8 pb-8 pt-2 border-t border-border">{children}</div>}
    </div>
  );
}

function sectionSummary(
  key: SectionKey,
  c: MaterialenConfig,
  _sd: ReturnType<typeof useStamdata>,
): string {
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
      const m = c.lsMoffenActief
        ? `${c.lsMoffen.length} mof${c.lsMoffen.length === 1 ? "" : "fen"}`
        : "geen moffen";
      return `${rek} · ${m}`;
    }
    case "overig":
      return c.ggiVervangen ? "GGI wordt vervangen" : "Standaard materialen";
  }
}

const subTypeLabel = (s: SubType) => SUB_TYPE_LABELS[s];
