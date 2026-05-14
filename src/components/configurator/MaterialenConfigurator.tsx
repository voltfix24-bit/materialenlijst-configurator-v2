import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, Trash2, X } from "lucide-react";
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
  RINGKLEM_SPECS,
  zoekRingklem,
  type LsKabelType,
  type LsMof,
  type LsMofType,
  type MaterialenConfig,
  type MsKabelTrace,
  type MsKabelType,
  type PreviewItem,
  type RmuVeldConfig,
  type SubType,
} from "@/lib/configurator/types";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  caseId: string;
  caseType: string;
  initialConfig?: MaterialenConfig | null;
}

const SECTIONS = [
  { key: "project", label: "Projecttype", color: "var(--color-section-project)" },
  { key: "rmu", label: "RMU configuratie", color: "var(--color-section-rmu)" },
  { key: "trafo", label: "Trafo", color: "var(--color-section-trafo)" },
  { key: "vultkabel", label: "Vult kabel", color: "var(--color-section-vultkabel)" },
  { key: "lsrek", label: "LS-rek", color: "var(--color-section-lsrek)" },
  { key: "ms", label: "MS verbindingen", color: "var(--color-section-ms)" },
  { key: "ls", label: "LS verbindingen", color: "var(--color-section-ls)" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const RENOVATIE = (s: string) => s === "renovatie_prov" || s === "renovatie_nsa";

export function MaterialenConfigurator({ caseId, caseType, initialConfig }: Props) {
  const [config, setConfig] = useState<MaterialenConfig>(initialConfig ?? emptyConfig());
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    project: true, rmu: true, trafo: true, vultkabel: true, lsrek: true, ms: true, ls: true,
  });
  const [debounced, setDebounced] = useState(config);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(config), 300);
    return () => clearTimeout(t);
  }, [config]);

  const sd = useStamdata(caseType);
  const preview = useMemo<PreviewItem[]>(
    () => (sd.isLoading ? [] : berekenPreview(debounced, sd, caseType)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debounced, sd.isLoading, caseType, sd.artikelen.data, sd.rmuConfigs.data, sd.rmuVeldArtikelen.data, sd.rmuZekeringen.data, sd.trafoVultKabel.data, sd.msMofTypes.data, sd.msMofMaterialen.data, sd.lsMofTypes.data, sd.lsMofMaterialen.data, sd.standaardTemplates.data, sd.stationVaste.data],
  );

  const showTrafo = RENOVATIE(config.subType);
  const showLsRek = RENOVATIE(config.subType);

  const isProvisorum = config.subType === "cs_met_prov" || config.subType === "renovatie_prov";
  const richtingComplete = (r: MaterialenConfig["msRichtingen"][number]): boolean => {
    if (!r.mofTijdelijk.mofTypeId) return false;
    if (isProvisorum) {
      if (r.kanZwaaien === null) return false;
      if (r.kanZwaaien === false && !r.mofDefinitief?.mofTypeId) return false;
    }
    return true;
  };
  const isRenovatie = config.subType === "renovatie_prov" || config.subType === "renovatie_nsa";
  const completion: Record<SectionKey, boolean> = {
    project: !!config.subType,
    rmu: !!config.rmuConfig,
    trafo: !showTrafo || (!!config.trafoActie && !!config.trafoKva),
    vultkabel: !isRenovatie || config.vultKabelAfstand > 0,
    lsrek:
      !isRenovatie ||
      (!!config.lsRekActie && (config.lsRekActie === "gehandhaafd" || !!config.lsRekType)),
    ms: config.msRichtingen.every(richtingComplete),
    ls:
      !config.lsMoffenActief ||
      (config.lsMoffen.length > 0 &&
        config.lsMoffen.every((m) => !!m.type && !!m.bestaandType)),
  };
  const visibleKeys: SectionKey[] = SECTIONS.map((s) => s.key).filter((k) => {
    if (k === "trafo") return showTrafo;
    if (k === "vultkabel") return showTrafo;
    if (k === "lsrek") return showLsRek;
    return true;
  });
  const totalVisible = visibleKeys.length;
  const completedCount = visibleKeys.filter((k) => completion[k]).length;
  const allComplete = completedCount === totalVisible;

  const update = (patch: Partial<MaterialenConfig>) => setConfig((c) => ({ ...c, ...patch }));

  const opslaan = useMutation({
    mutationFn: async () => {
      // Volledige config opslaan als JSON. rmuConfig wordt afgeslankt tot {id};
      // bij rehydratie wordt het volledige object opgezocht in de stamdata.
      const configToSave = {
        ...config,
        rmuConfig: config.rmuConfig ? { id: config.rmuConfig.id } : null,
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

      // case_materialen vervangen
      await supabase.from("case_materialen").delete().eq("case_id", caseId);
      if (preview.length > 0) {
        const rows = preview.map((p) => ({
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
    onSuccess: () => toast.success("Materiaallijst opgeslagen"),
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- Render ----
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-6">
      <div className="space-y-3">
        {/* Voortgang */}
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Voortgang</span>
            <span className="text-xs font-mono">{completedCount}/{totalVisible} ingevuld</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${(completedCount / totalVisible) * 100}%` }} />
          </div>
        </div>

        {SECTIONS.map((sec) => {
          if (sec.key === "trafo" && !showTrafo) return null;
          if (sec.key === "vultkabel" && !showTrafo) return null;
          if (sec.key === "lsrek" && !showLsRek) return null;
          return (
            <SectionCard
              key={sec.key}
              color={sec.color}
              title={sec.label}
              isOpen={open[sec.key]}
              isComplete={completion[sec.key]}
              summary={sectionSummary(sec.key, config, sd)}
              onToggle={() => setOpen({ ...open, [sec.key]: !open[sec.key] })}
            >
              {sec.key === "project" && <ProjectSection config={config} update={update} />}
              {sec.key === "rmu" && <RmuSection config={config} update={update} sd={sd} />}
              {sec.key === "trafo" && <TrafoSection config={config} update={update} sd={sd} />}
              {sec.key === "vultkabel" && <VultKabelSection config={config} update={update} />}
              {sec.key === "lsrek" && <LsRekSection config={config} update={update} />}
              {sec.key === "ms" && <MsSection config={config} update={update} sd={sd} />}
              {sec.key === "ls" && <LsSection config={config} update={update} />}
            </SectionCard>
          );
        })}
      </div>

      {/* Live preview */}
      <PreviewPanel
        preview={preview}
        canSave={allComplete}
        onSave={() => opslaan.mutate()}
        saving={opslaan.isPending}
      />
    </div>
  );
}

function SectionCard({
  color, title, summary, isOpen, isComplete, onToggle, children,
}: {
  color: string;
  title: string;
  summary: string;
  isOpen: boolean;
  isComplete: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="font-medium">{title}</span>
        <span className={cn("text-xs ml-2 truncate", isComplete ? "text-success" : "text-muted-foreground")}>
          {isComplete ? "✓ " : ""}{summary}
        </span>
        <ChevronDown className={cn("ml-auto w-4 h-4 transition-transform text-muted-foreground", isOpen && "rotate-180")} />
      </button>
      {isOpen && <div className="px-4 pb-4 pt-1 border-t border-border">{children}</div>}
    </div>
  );
}

function sectionSummary(key: SectionKey, c: MaterialenConfig, sd: ReturnType<typeof useStamdata>): string {
  switch (key) {
    case "project":
      return c.subType ? subTypeLabel(c.subType) : "Nog in te vullen";
    case "rmu":
      return c.rmuConfig ? `${c.rmuConfig.merk} ${c.rmuConfig.code} — ${c.rmuConfig.aantal_velden}-velds` : "Nog in te vullen";
    case "trafo":
      return c.trafoActie && c.trafoKva ? `${c.trafoActie} — ${c.trafoKva} kVA` : "Nog in te vullen";
    case "vultkabel":
      return c.vultKabelAfstand > 0 ? `${c.vultKabelAfstand} m afstand` : "Nog in te vullen";
    case "lsrek":
      return c.lsRekActie ? c.lsRekActie : "Nog in te vullen";
    case "ms": {
      const n = c.msRichtingen.length;
      const isProv = c.subType === "cs_met_prov" || c.subType === "renovatie_prov";
      const ok = c.msRichtingen.every((r) => {
        if (!r.mofTijdelijk.mofTypeId) return false;
        if (isProv) {
          if (r.kanZwaaien === null) return false;
          if (r.kanZwaaien === false && !r.mofDefinitief?.mofTypeId) return false;
        }
        return true;
      });
      return `${n} richting${n === 1 ? "" : "en"}${ok ? "" : " — onvolledig"}`;
    }
    case "ls":
      if (!c.lsMoffenActief) return "Geen LS-moffen";
      return c.lsMoffen.length === 0 ? "0 LS-moffen" : `${c.lsMoffen.length} LS-mof${c.lsMoffen.length === 1 ? "" : "fen"}`;
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

function ProjectSection({ config, update }: { config: MaterialenConfig; update: (p: Partial<MaterialenConfig>) => void }) {
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

function RmuSection({ config, update, sd }: { config: MaterialenConfig; update: (p: Partial<MaterialenConfig>) => void; sd: ReturnType<typeof useStamdata> }) {
  const merken = ["ABB", "Siemens", "Magnefix"];
  const isInet = config.rmuInet === "ja";
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

  return (
    <div className="space-y-4">
      <Field label="Merk">
        <PillGroup
          value={config.rmuMerk}
          onChange={(v) => update({ rmuMerk: v as MaterialenConfig["rmuMerk"], rmuConfig: null, rmuVelden: [], rmuInet: v === "Magnefix" ? "" : config.rmuInet })}
          options={merken.map((m) => ({ value: m, label: m }))}
        />
      </Field>
      {config.rmuMerk && config.rmuMerk !== "Magnefix" && (
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
      {config.rmuMerk && (config.rmuMerk === "Magnefix" || config.rmuInet) && (
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
}: {
  veld: RmuVeldConfig;
  setVeld: (id: string, patch: Partial<RmuVeldConfig>) => void;
  config: MaterialenConfig;
  update: (p: Partial<MaterialenConfig>) => void;
  isInet: boolean;
  merk: string;
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
            Vermogen: {config.trafoKva} kVA — buispatroon wordt automatisch bepaald
          </InfoBox>
        ) : (
          <InfoBox type="warning">
            ⚠ Vul het trafo vermogen in bij de Trafo-sectie
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
      )}
    </div>
  );
}

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
              onChange={(v) => onChange({ bestaandType: v as any, mofTypeId: null, mofHandmatig: false })}
              options={kabelOpties.map((o) => ({ value: o.value, label: o.label }))}
            />
          </Field>
          {mof.bestaandType && (
            <Field label="Bestaande kabel — doorsnede (mm²)">
              <Stepper
                value={mof.bestaandDoorsnede ?? 0}
                onChange={(v) => onChange({ bestaandDoorsnede: v, mofTypeId: null, mofHandmatig: false })}
                min={0}
                max={999}
                suffix=" mm²"
              />
            </Field>
          )}

          <Field label="Nieuwe kabel — type">
            <PillGroup
              value={mof.nieuwType}
              onChange={(v) => onChange({ nieuwType: v as any, mofTypeId: null, mofHandmatig: false })}
              options={kabelOpties.map((o) => ({ value: o.value, label: o.label }))}
            />
          </Field>
          {mof.nieuwType && (
            <Field label="Nieuwe kabel — doorsnede (mm²)">
              <Stepper
                value={mof.nieuwDoorsnede ?? 0}
                onChange={(v) => onChange({ nieuwDoorsnede: v, mofTypeId: null, mofHandmatig: false })}
                min={0}
                max={999}
                suffix=" mm²"
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
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            update({
              msKabelTraces: [
                ...config.msKabelTraces,
                { id: crypto.randomUUID(), kabelType: "240AL_singel", lengteMeters: 0 },
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
                = {totaal}m kabel totaal{fases === 2 ? " (×2 fasen: tijdelijk + definitief)" : ""}
              </span>
            );
          })()}
        </div>
      </Field>

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

// ---------- Preview ----------

function PreviewPanel({ preview, canSave, onSave, saving }: { preview: PreviewItem[]; canSave: boolean; onSave: () => void; saving: boolean }) {
  const grouped = useMemo(() => {
    const m = new Map<string, PreviewItem[]>();
    for (const p of preview) {
      const arr = m.get(p.categorie) ?? [];
      arr.push(p);
      m.set(p.categorie, arr);
    }
    return Array.from(m.entries());
  }, [preview]);

  const teBestellen = preview.filter((p) => !p.niet_bestellen).length;
  const informatief = preview.length - teBestellen;

  return (
    <div className="rounded-lg border border-border bg-surface flex flex-col h-fit lg:sticky lg:top-4 max-h-[calc(100vh-2rem)]">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Live materiaallijst</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{preview.length} artikelen</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {grouped.length === 0 && (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">Nog niets te tonen.</p>
        )}
        {grouped.map(([cat, items]) => (
          <div key={cat}>
            <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{cat}</div>
            <div className="space-y-0.5">
              {items.map((it) => (
                <div
                  key={it.artikel_id}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-accent/40",
                    it.niet_bestellen && "opacity-50 line-through",
                  )}
                  title={it.herkomst.join(", ")}
                >
                  <span className="font-mono text-xs text-muted-foreground w-20 shrink-0 truncate">{it.artikel_nummer}</span>
                  <span className="flex-1 truncate">{it.korte_omschrijving}</span>
                  <span className="font-mono text-xs tabular-nums">{it.hoeveelheid}{it.eenheid}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border px-4 py-3 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Te bestellen</span>
          <span className="font-mono">{teBestellen}</span>
        </div>
        {informatief > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Informatief</span>
            <span className="font-mono">{informatief}</span>
          </div>
        )}
        <button
          disabled={!canSave || saving}
          onClick={onSave}
          className="w-full rounded-md bg-primary text-primary-foreground font-medium py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
        >
          {saving ? "Opslaan..." : canSave ? "Lijst opslaan" : "Vul alle secties in"}
        </button>
      </div>
    </div>
  );
}
