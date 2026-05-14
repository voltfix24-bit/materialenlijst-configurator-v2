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
  newLsMof,
  newRichting,
  type MaterialenConfig,
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

  const completion: Record<SectionKey, boolean> = {
    project: !!config.subType,
    rmu: !!config.rmuConfig,
    trafo: !showTrafo || (!!config.trafoActie && !!config.trafoKva),
    vultkabel: !showTrafo || config.vultKabelAfstand >= 0,
    lsrek: !showLsRek || !!config.lsRekActie,
    ms: config.msRichtingen.every((r) => r.zwaaien === true || (r.zwaaien === false && !!r.mof_type_id)),
    ls: true,
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
      // sub_type bijwerken
      await supabase.from("cases").update({ sub_type: config.subType || null }).eq("id", caseId);

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

      // ms moffen
      await supabase.from("case_ms_moffen").delete().eq("case_id", caseId);
      if (config.msRichtingen.length > 0) {
        const rows = config.msRichtingen.map((r, i) => ({
          case_id: caseId,
          positie: i + 1,
          zwaaien: r.zwaaien === true,
          bestaand_type: r.bestaand_type || null,
          doorsnede: r.doorsnede,
          mof_type_id: r.mof_type_id,
          mof_handmatig: r.mof_handmatig,
        }));
        const { error } = await supabase.from("case_ms_moffen").insert(rows);
        if (error) throw error;
      }

      // ls moffen
      await supabase.from("case_ls_moffen").delete().eq("case_id", caseId);
      if (config.lsMoffen.length > 0) {
        const rows = config.lsMoffen.map((l, i) => ({
          case_id: caseId,
          positie: i + 1,
          type: l.type || "verbinding",
          bestaand_type: l.bestaand_type || "GPLK",
          aantal: l.aantal,
          overzettingen: l.overzettingen,
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
      const ok = c.msRichtingen.every((r) => r.zwaaien === true || (r.zwaaien === false && !!r.mof_type_id));
      return `${n} richting${n === 1 ? "" : "en"}${ok ? "" : " — onvolledig"}`;
    }
    case "ls":
      return c.lsMoffen.length === 0 ? "Geen LS moffen" : `${c.lsMoffen.length} LS mof${c.lsMoffen.length === 1 ? "" : "fen"}`;
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
        onChange={(v) => update({ subType: v as SubType })}
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
  const reserveLocked = veld.veldNummer <= 2;
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

function MsSection({ config, update, sd }: { config: MaterialenConfig; update: (p: Partial<MaterialenConfig>) => void; sd: ReturnType<typeof useStamdata> }) {
  const setRicht = (id: string, patch: Partial<MaterialenConfig["msRichtingen"][0]>) => {
    update({ msRichtingen: config.msRichtingen.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  };
  const removeRicht = (id: string) => update({ msRichtingen: config.msRichtingen.filter((r) => r.id !== id) });
  const addRicht = () => update({ msRichtingen: [...config.msRichtingen, newRichting()] });

  const findMof = (r: MaterialenConfig["msRichtingen"][0]) => {
    if (!r.bestaand_type || r.doorsnede == null) return null;
    return (sd.msMofTypes.data ?? []).find(
      (m) =>
        m.bestaand_type === r.bestaand_type &&
        (m.bestaand_doorsnede_min ?? 0) <= r.doorsnede! &&
        (m.bestaand_doorsnede_max ?? 9999) >= r.doorsnede!,
    );
  };

  return (
    <div className="space-y-3">
      {config.msRichtingen.map((r, idx) => {
        const auto = findMof(r);
        const status = r.zwaaien === true
          ? "Zwaaien"
          : r.bestaand_type && r.doorsnede
            ? `${r.bestaand_type} ${r.doorsnede}mm²`
            : "Niet ingevuld";
        return (
          <div key={r.id} className="rounded-md border border-border bg-background/40 p-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="rounded bg-secondary text-secondary-foreground text-xs font-mono px-1.5 py-0.5">{idx + 1}</span>
              <span className="text-xs text-muted-foreground">{status}</span>
              {config.msRichtingen.length > 1 && (
                <button onClick={() => removeRicht(r.id)} className="ml-auto text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <Field label="Optie">
              <PillGroup
                value={r.zwaaien === null ? "" : r.zwaaien ? "zwaaien" : "mof"}
                onChange={(v) => setRicht(r.id, { zwaaien: v === "zwaaien", bestaand_type: v === "zwaaien" ? "" : r.bestaand_type, doorsnede: v === "zwaaien" ? null : r.doorsnede, mof_type_id: v === "zwaaien" ? null : r.mof_type_id })}
                options={[
                  { value: "zwaaien", label: "Zwaaien mogelijk", color: "green" },
                  { value: "mof", label: "Nieuwe mof nodig", color: "amber" },
                ]}
              />
            </Field>
            {r.zwaaien === false && (
              <div className="mt-3 space-y-3">
                <Field label="Bestaand kabeltype">
                  <PillGroup
                    value={r.bestaand_type}
                    onChange={(v) => {
                      const next = { ...r, bestaand_type: v as "GPLK" | "XLPE" | "XLPE_singel" };
                      const m = findMof(next);
                      setRicht(r.id, { bestaand_type: next.bestaand_type, mof_type_id: m?.id ?? null, mof_handmatig: false });
                    }}
                    options={[
                      { value: "GPLK", label: "GPLK" },
                      { value: "XLPE", label: "XLPE 3-aderig" },
                      { value: "XLPE_singel", label: "XLPE singels" },
                    ]}
                  />
                </Field>
                <Field label="Doorsnede (mm²)">
                  <PillGroup
                    value={r.doorsnede ? String(r.doorsnede) : ""}
                    onChange={(v) => {
                      const next = { ...r, doorsnede: Number(v) };
                      const m = findMof(next);
                      setRicht(r.id, { doorsnede: next.doorsnede, mof_type_id: m?.id ?? null, mof_handmatig: false });
                    }}
                    options={["50", "70", "95", "120", "150", "240"].map((d) => ({ value: d, label: d }))}
                  />
                </Field>
                {r.bestaand_type && r.doorsnede && (
                  auto ? (
                    <InfoBox type="success">
                      Mof gevonden: <span className="font-mono">{auto.code}</span>{auto.omschrijving ? ` — ${auto.omschrijving}` : ""}
                    </InfoBox>
                  ) : (
                    <div className="space-y-2">
                      <InfoBox type="warning">Geen automatische match. Kies handmatig:</InfoBox>
                      <select
                        value={r.mof_type_id ?? ""}
                        onChange={(e) => setRicht(r.id, { mof_type_id: e.target.value || null, mof_handmatig: true })}
                        className="bg-input border border-border rounded-md px-3 py-1.5 text-sm w-full"
                      >
                        <option value="">— kies mof —</option>
                        {(sd.msMofTypes.data ?? []).map((m) => (
                          <option key={m.id} value={m.id}>{m.code}{m.omschrijving ? ` — ${m.omschrijving}` : ""}</option>
                        ))}
                      </select>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        );
      })}
      <button onClick={addRicht} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <Plus className="w-4 h-4" /> MS-richting toevoegen
      </button>
    </div>
  );
}

function LsSection({ config, update }: { config: MaterialenConfig; update: (p: Partial<MaterialenConfig>) => void }) {
  const setMof = (id: string, patch: Partial<MaterialenConfig["lsMoffen"][0]>) =>
    update({ lsMoffen: config.lsMoffen.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const removeMof = (id: string) => update({ lsMoffen: config.lsMoffen.filter((m) => m.id !== id) });
  const addMof = () => update({ lsMoffen: [...config.lsMoffen, newLsMof()] });

  return (
    <div className="space-y-3">
      {config.lsMoffen.length === 0 && <p className="text-xs text-muted-foreground">Nog geen LS moffen toegevoegd.</p>}
      {config.lsMoffen.map((m) => (
        <div key={m.id} className="rounded-md border border-border bg-background/40 p-3 space-y-3">
          <div className="flex justify-end">
            <button onClick={() => removeMof(m.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <Field label="Type">
            <PillGroup
              value={m.type}
              onChange={(v) => setMof(m.id, { type: v as "verbinding" | "aftakmof" | "eindmof" })}
              options={[
                { value: "verbinding", label: "Verbinding" },
                { value: "aftakmof", label: "Aftakmof" },
                { value: "eindmof", label: "Eindmof" },
              ]}
            />
          </Field>
          <Field label="Bestaande kabel">
            <PillGroup
              value={m.bestaand_type}
              onChange={(v) => setMof(m.id, { bestaand_type: v as "GPLK" | "kunststof" })}
              options={[{ value: "GPLK", label: "GPLK" }, { value: "kunststof", label: "Kunststof" }]}
            />
          </Field>
          <FieldRow>
            <Field label="Aantal moffen">
              <Stepper value={m.aantal} onChange={(v) => setMof(m.id, { aantal: v })} min={1} max={20} />
            </Field>
            {m.type === "aftakmof" && (
              <Field label="Overzettingen">
                <Stepper value={m.overzettingen} onChange={(v) => setMof(m.id, { overzettingen: v })} max={20} />
              </Field>
            )}
          </FieldRow>
        </div>
      ))}
      <button onClick={addMof} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <Plus className="w-4 h-4" /> LS-mof toevoegen
      </button>
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
