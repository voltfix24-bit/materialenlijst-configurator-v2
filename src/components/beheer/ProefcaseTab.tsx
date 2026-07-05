import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { PillGroup } from "@/components/ui-prim/PillGroup";
import { Field, InfoBox } from "@/components/ui-prim/Field";
import { Stepper } from "@/components/ui-prim/Stepper";
import { useStamdata } from "@/lib/configurator/queries";
import { berekenPreview } from "@/lib/configurator/berekenen";
import { useInetDefaultArtikelen } from "@/lib/configurator/extraStamdata";
import {
  BRON_TABEL_DEFS,
  buildRmuVelden,
  CASE_TYPE_LABELS,
  emptyConfig,
  isCompactCaseType,
  PREVIEW_SECTIE_DEFS,
  SUB_TYPE_LABELS,
  subTypeVoorCaseType,
  type MaterialenConfig,
  type MsKabelType,
  type PreviewItem,
  type RmuConfig,
} from "@/lib/configurator/types";

/**
 * Proefcase-simulator: vul de configuratorvragen in en zie direct welke
 * artikelen uit welke beheer-regels komen — zonder een echte case aan te
 * maken of iets op te slaan. Bij elke gewijzigde keuze lichten de artikelen
 * op die daardoor veranderen, zodat de keten (bv. trafo 630 kVA → zekering,
 * vultkabel, kabelschoenen) direct zichtbaar is.
 */

// De 4 type cases — het type opdracht (subType) volgt hier 1-op-1 uit.
const CASE_TYPES = ["NSA", "provisorium", "compact", "compact_prov"].map((v) => ({
  value: v,
  label: CASE_TYPE_LABELS[v] ?? v,
}));

interface Antwoorden {
  rmuMerk: string;
  rmuInet: "ja" | "nee" | "";
  rmuConfigId: string;
  veldKabelType: "" | "240AL" | "630AL";
  trafoActie: string;
  trafoKva: string;
  trafoKabelLengte: "" | "7.25" | "10";
  vultKabelAfstand: number;
  lsRekActie: string;
  lsRekType: string;
  lsRekSchroefpatroon: string;
  lsRekBeveiligingAanpassen: boolean;
  lsRekOvStuurpunt: boolean;
  lsRekAanSluitenKabels: number;
  ggiVervangen: boolean;
  provRmuMerk: string;
  provRmuConfigId: string;
  provZekeringKva: string;
  msKabelType: MsKabelType;
  msKabelLengte: number;
}

const LEEG: Antwoorden = {
  rmuMerk: "",
  rmuInet: "",
  rmuConfigId: "",
  veldKabelType: "",
  trafoActie: "",
  trafoKva: "",
  trafoKabelLengte: "",
  vultKabelAfstand: 0,
  lsRekActie: "",
  lsRekType: "",
  lsRekSchroefpatroon: "",
  lsRekBeveiligingAanpassen: false,
  lsRekOvStuurpunt: false,
  lsRekAanSluitenKabels: 0,
  ggiVervangen: false,
  provRmuMerk: "",
  provRmuConfigId: "",
  provZekeringKva: "",
  msKabelType: "",
  msKabelLengte: 0,
};

const HIGHLIGHT_MS = 2500;

export function ProefcaseTab() {
  const [caseType, setCaseType] = useState("NSA");
  const [a, setA] = useState<Antwoorden>(LEEG);
  const sd = useStamdata(caseType);
  const inetDefaults = useInetDefaultArtikelen();
  const [sectieFilter, setSectieFilter] = useState<string>("alle");

  const isCompact = isCompactCaseType(caseType);
  const subType = subTypeVoorCaseType(caseType);
  const isRenovatie = subType === "renovatie_prov" || subType === "renovatie_nsa";
  const isProv = subType === "cs_met_prov" || subType === "renovatie_prov";

  const zet = (patch: Partial<Antwoorden>) => setA((p) => ({ ...p, ...patch }));

  const rmuConfigs = (sd.rmuConfigs.data ?? []) as RmuConfig[];
  const rmuOpties = rmuConfigs.filter(
    (c) =>
      c.merk === a.rmuMerk &&
      (a.rmuMerk === "Magnefix" ? true : c.is_inet === (isCompact ? false : a.rmuInet === "ja")),
  );
  const provRmuOpties = rmuConfigs.filter((c) => c.merk === a.provRmuMerk);
  const rmuConfig = rmuOpties.find((c) => c.id === a.rmuConfigId) ?? null;
  const provRmuConfig = provRmuOpties.find((c) => c.id === a.provRmuConfigId) ?? null;

  // Volledige MaterialenConfig opbouwen uit de antwoorden — zelfde vorm als
  // een echte case, zodat berekenPreview identiek gedrag vertoont.
  const config = useMemo<MaterialenConfig>(() => {
    const velden = buildRmuVelden(rmuConfig).map((v) =>
      v.veldType === "V" && a.veldKabelType ? { ...v, kabelType: a.veldKabelType } : v,
    );
    return {
      ...emptyConfig(),
      subType,
      isCompactStation: isCompact,
      rmuMerk: a.rmuMerk as MaterialenConfig["rmuMerk"],
      rmuInet: isCompact ? "nee" : a.rmuInet,
      rmuConfig,
      rmuVelden: velden,
      iNetArtikelen: !isCompact && a.rmuInet === "ja" ? inetDefaults.map((x) => ({ ...x })) : [],
      trafoActie: a.trafoActie as MaterialenConfig["trafoActie"],
      trafoKva: a.trafoKva as MaterialenConfig["trafoKva"],
      trafoKabelLengte: a.trafoKabelLengte,
      vultKabelAfstand: a.vultKabelAfstand,
      lsRekActie: a.lsRekActie as MaterialenConfig["lsRekActie"],
      lsRekType: a.lsRekType as MaterialenConfig["lsRekType"],
      lsRekSchroefpatroon: a.lsRekSchroefpatroon as MaterialenConfig["lsRekSchroefpatroon"],
      lsRekBeveiligingAanpassen: a.lsRekBeveiligingAanpassen,
      lsRekOvStuurpunt: a.lsRekOvStuurpunt,
      lsRekAanSluitenKabels: a.lsRekAanSluitenKabels,
      ggiVervangen: a.ggiVervangen,
      provRmuMerk: a.provRmuMerk as MaterialenConfig["provRmuMerk"],
      provRmuConfig,
      provRmuVelden: buildRmuVelden(provRmuConfig),
      provZekeringKva: a.provZekeringKva as MaterialenConfig["provZekeringKva"],
      msKabelTraces:
        a.msKabelType && a.msKabelLengte > 0
          ? [
              {
                id: "proefcase-trace",
                kabelType: a.msKabelType,
                lengteMeters: a.msKabelLengte,
                heeftOversteek: false,
                aantalOversteken: 1,
                oversteekMeters: 0,
              },
            ]
          : [],
    };
  }, [a, subType, isCompact, rmuConfig, provRmuConfig, inetDefaults]);

  const preview = useMemo<PreviewItem[]>(
    () => (sd.isLoading ? [] : berekenPreview(config, sd, caseType)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      config,
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
      sd.ggiRegels.data,
      sd.trafoRegels.data,
      sd.lsRekRegels.data,
      sd.provRegels.data,
      sd.msKabelRegels.data,
      sd.rmuVeldRegels.data,
      sd.trafoVultKabelSpecs.data,
    ],
  );

  // Diff-highlight: artikelen die door de laatste keuze veranderen lichten op.
  const vorigeRef = useRef<Map<string, number>>(new Map());
  const [gewijzigd, setGewijzigd] = useState<Set<string>>(new Set());
  useEffect(() => {
    const huidig = new Map(preview.map((p) => [p.artikel_nummer, p.hoeveelheid]));
    const changed = new Set<string>();
    if (vorigeRef.current.size > 0) {
      for (const [nr, q] of huidig) {
        const v = vorigeRef.current.get(nr);
        if (v === undefined || v !== q) changed.add(nr);
      }
    }
    vorigeRef.current = huidig;
    if (changed.size === 0) return;
    setGewijzigd(changed);
    const t = setTimeout(() => setGewijzigd(new Set()), HIGHLIGHT_MS);
    return () => clearTimeout(t);
  }, [preview]);

  const groepen = useMemo(() => {
    const map = new Map<string, PreviewItem[]>();
    for (const p of preview) {
      const arr = map.get(p.sectie) ?? [];
      arr.push(p);
      map.set(p.sectie, arr);
    }
    return PREVIEW_SECTIE_DEFS.map((def) => ({
      def,
      items: map.get(def.key) ?? [],
    })).filter((g) => g.items.length > 0);
  }, [preview]);

  const zichtbareGroepen =
    sectieFilter === "alle" ? groepen : groepen.filter((g) => g.def.key === sectieFilter);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <FlaskConical className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <div className="text-sm space-y-1">
            <p className="font-medium">Proefcase — test je regels zonder een echte case</p>
            <p className="text-muted-foreground text-xs">
              Vul keuzes in en zie direct de volledige materiaallijst zoals de configurator die zou
              berekenen, mét de bronregel achter elk artikel. Wijzig je een keuze (bv. trafo 400 →
              630 kVA), dan lichten de artikelen op die daardoor veranderen. Er wordt niets
              opgeslagen. MS/LS-moffen vallen buiten deze simulator — die zijn per case te
              specifiek.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 items-start">
        {/* Antwoorden */}
        <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
          <Field label="Case type">
            <PillGroup
              value={caseType}
              onChange={(v) => {
                setCaseType(v);
                setA(LEEG);
              }}
              options={CASE_TYPES}
            />
          </Field>
          <InfoBox type="info">
            Type opdracht volgt uit het case type: <strong>{SUB_TYPE_LABELS[subType]}</strong>
            {isCompact && " (compactstation)"}.
          </InfoBox>

          <div className="border-t border-border pt-3 space-y-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              RMU
            </p>
            <Field label="Merk">
              <PillGroup
                value={a.rmuMerk}
                onChange={(v) =>
                  zet({ rmuMerk: v, rmuConfigId: "", rmuInet: v === "Magnefix" ? "" : a.rmuInet })
                }
                options={(isCompact ? ["ABB", "Siemens"] : ["ABB", "Siemens", "Magnefix"]).map(
                  (m) => ({ value: m, label: m }),
                )}
              />
            </Field>
            {!isCompact && a.rmuMerk && a.rmuMerk !== "Magnefix" && (
              <Field label="I-Net">
                <PillGroup
                  value={a.rmuInet}
                  onChange={(v) => zet({ rmuInet: v as "ja" | "nee", rmuConfigId: "" })}
                  options={[
                    { value: "nee", label: "Nee" },
                    { value: "ja", label: "Ja (DA)" },
                  ]}
                />
              </Field>
            )}
            {a.rmuMerk && (
              <Field label="Configuratie">
                <select
                  value={a.rmuConfigId}
                  onChange={(e) => zet({ rmuConfigId: e.target.value })}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                >
                  <option value="">— kies —</option>
                  {rmuOpties.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} ({c.aantal_velden} velden)
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {rmuConfig && (
              <Field label="KV-veld kabeltype (alle velden)">
                <PillGroup
                  value={a.veldKabelType}
                  onChange={(v) => zet({ veldKabelType: v as Antwoorden["veldKabelType"] })}
                  options={[
                    { value: "240AL", label: "240 AL" },
                    { value: "630AL", label: "630 AL" },
                  ]}
                />
              </Field>
            )}
          </div>

          {isProv && (
            <div className="border-t border-border pt-3 space-y-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Provisorium
              </p>
              <Field label="Prov. RMU merk">
                <PillGroup
                  value={a.provRmuMerk}
                  onChange={(v) => zet({ provRmuMerk: v, provRmuConfigId: "" })}
                  options={["ABB", "Siemens", "Magnefix"].map((m) => ({ value: m, label: m }))}
                />
              </Field>
              {a.provRmuMerk && (
                <Field label="Prov. configuratie">
                  <select
                    value={a.provRmuConfigId}
                    onChange={(e) => zet({ provRmuConfigId: e.target.value })}
                    className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                  >
                    <option value="">— kies —</option>
                    {provRmuOpties.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} ({c.aantal_velden} velden)
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Zekering (kVA)">
                <PillGroup
                  value={a.provZekeringKva}
                  onChange={(v) => zet({ provZekeringKva: v })}
                  options={["250", "400", "630", "1000"].map((k) => ({ value: k, label: k }))}
                />
              </Field>
            </div>
          )}

          {!isCompact && isRenovatie && (
            <div className="border-t border-border pt-3 space-y-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Trafo & Vult kabel
              </p>
              <Field label="Trafo actie">
                <PillGroup
                  value={a.trafoActie}
                  onChange={(v) => zet({ trafoActie: v })}
                  options={[
                    { value: "nieuw", label: "Nieuw" },
                    { value: "blijft", label: "Blijft" },
                    { value: "draaien", label: "Draaien" },
                  ]}
                />
              </Field>
              <Field label="Vermogen (kVA)">
                <PillGroup
                  value={a.trafoKva}
                  onChange={(v) => zet({ trafoKva: v })}
                  options={["250", "400", "630", "1000"].map((k) => ({ value: k, label: k }))}
                />
              </Field>
              <Field label="Trafo kabellengte">
                <PillGroup
                  value={a.trafoKabelLengte}
                  onChange={(v) => zet({ trafoKabelLengte: v as Antwoorden["trafoKabelLengte"] })}
                  options={[
                    { value: "7.25", label: "7,25 m" },
                    { value: "10", label: "10 m" },
                  ]}
                />
              </Field>
              <Field label="Vult kabel afstand (meter)">
                <Stepper
                  value={a.vultKabelAfstand}
                  onChange={(v) => zet({ vultKabelAfstand: v })}
                  min={0}
                  max={100}
                  suffix=" m"
                />
              </Field>
            </div>
          )}

          {!isCompact && isRenovatie && (
            <div className="border-t border-border pt-3 space-y-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                LS-rek
              </p>
              <Field label="Actie">
                <PillGroup
                  value={a.lsRekActie}
                  onChange={(v) => zet({ lsRekActie: v })}
                  options={[
                    { value: "vervangen", label: "Vervangen" },
                    { value: "gehandhaafd", label: "Gehandhaafd" },
                  ]}
                />
              </Field>
              {a.lsRekActie === "vervangen" && (
                <>
                  <Field label="Type">
                    <PillGroup
                      value={a.lsRekType}
                      onChange={(v) => zet({ lsRekType: v })}
                      options={[
                        { value: "8", label: "8 velden" },
                        { value: "12", label: "12 velden" },
                      ]}
                    />
                  </Field>
                  <Field label="Aan te sluiten kabels">
                    <Stepper
                      value={a.lsRekAanSluitenKabels}
                      onChange={(v) => zet({ lsRekAanSluitenKabels: v })}
                      min={0}
                      max={12}
                    />
                  </Field>
                </>
              )}
              <Field label="Schroefpatroon">
                <PillGroup
                  value={a.lsRekSchroefpatroon}
                  onChange={(v) => zet({ lsRekSchroefpatroon: v })}
                  options={[
                    { value: "35A", label: "35A" },
                    { value: "50A", label: "50A" },
                  ]}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={a.lsRekBeveiligingAanpassen}
                  onChange={(e) => zet({ lsRekBeveiligingAanpassen: e.target.checked })}
                />
                Beveiliging aanpassen
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={a.lsRekOvStuurpunt}
                  onChange={(e) => zet({ lsRekOvStuurpunt: e.target.checked })}
                />
                OV-stuurpunt aanwezig
              </label>
            </div>
          )}

          <div className="border-t border-border pt-3 space-y-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              MS kabel
            </p>
            <Field label="Kabeltype">
              <PillGroup
                value={a.msKabelType}
                onChange={(v) => zet({ msKabelType: v as MsKabelType })}
                options={[
                  { value: "240AL_singel", label: "240AL singel" },
                  { value: "630AL_singel", label: "630AL singel" },
                  { value: "3x240AL", label: "3x240AL" },
                ]}
              />
            </Field>
            {a.msKabelType && (
              <Field label="Lengte (meter)">
                <Stepper
                  value={a.msKabelLengte}
                  onChange={(v) => zet({ msKabelLengte: v })}
                  min={0}
                  max={500}
                  suffix=" m"
                />
              </Field>
            )}
          </div>

          {isRenovatie && (
            <div className="border-t border-border pt-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={a.ggiVervangen}
                  onChange={(e) => zet({ ggiVervangen: e.target.checked })}
                />
                GGI vervangen
              </label>
            </div>
          )}
        </div>

        {/* Resultaat */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setSectieFilter("alle")}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                sectieFilter === "alle"
                  ? "border-primary bg-primary/10"
                  : "border-border bg-surface text-muted-foreground hover:bg-accent/40",
              )}
            >
              Alle ({preview.length})
            </button>
            {groepen.map((g) => (
              <button
                key={g.def.key}
                onClick={() => setSectieFilter(sectieFilter === g.def.key ? "alle" : g.def.key)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs transition-colors flex items-center gap-1.5",
                  sectieFilter === g.def.key
                    ? "border-primary bg-primary/10"
                    : "border-border bg-surface text-muted-foreground hover:bg-accent/40",
                )}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: g.def.color }} />
                {g.def.label} ({g.items.length})
              </button>
            ))}
          </div>

          {sd.isLoading && (
            <p className="text-sm text-muted-foreground py-8 text-center">Stamdata laden…</p>
          )}
          {!sd.isLoading && preview.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center rounded-lg border border-border bg-surface">
              Nog geen artikelen — kies eerst een type opdracht.
            </p>
          )}

          {zichtbareGroepen.map((g) => (
            <section
              key={g.def.key}
              className="rounded-lg border border-border bg-surface overflow-hidden"
            >
              <header
                className="px-3 py-2 border-b border-border flex items-center gap-2"
                style={{ borderLeft: `3px solid ${g.def.color}` }}
              >
                <h3 className="text-sm font-semibold">{g.def.label}</h3>
                <span className="text-[11px] text-muted-foreground">
                  {g.items.length} artikel(en)
                </span>
                <span
                  className="text-[11px] text-muted-foreground ml-auto hidden xl:inline max-w-[50%] truncate"
                  title={g.def.uitleg}
                >
                  {g.def.uitleg}
                </span>
              </header>
              <ul className="divide-y divide-border">
                {g.items.map((it) => {
                  const isNieuw = gewijzigd.has(it.artikel_nummer);
                  return (
                    <li
                      key={it.artikel_nummer}
                      className={cn("px-3 py-2 transition-colors", isNieuw && "bg-emerald-500/15")}
                    >
                      <div className="flex items-start gap-3">
                        <span className="font-mono text-xs text-muted-foreground w-20 shrink-0 pt-0.5">
                          {it.artikel_nummer}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-snug">{it.korte_omschrijving}</p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
                            {it.bijdragen.map((b, i) => {
                              const def = b.bronTabel ? BRON_TABEL_DEFS[b.bronTabel] : null;
                              return (
                                <span key={i} className="flex items-center gap-1">
                                  {b.herkomst}
                                  {b.hoeveelheid !== it.hoeveelheid && ` (${b.hoeveelheid})`}
                                  {def && (
                                    <Link
                                      to="/beheer"
                                      search={{
                                        groep: def.beheerGroep,
                                        tab: def.beheerTab,
                                        ...(b.bronId ? { row: b.bronId } : {}),
                                        artikel: it.artikel_nummer,
                                      }}
                                      className="text-primary hover:underline inline-flex items-center gap-0.5"
                                      title={`Bewerk deze regel in ${def.label}`}
                                    >
                                      {def.label} <ExternalLink className="h-2.5 w-2.5" />
                                    </Link>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <span
                          className={cn(
                            "text-sm font-semibold tabular-nums shrink-0",
                            isNieuw && "text-emerald-600",
                          )}
                        >
                          {it.hoeveelheid} {it.eenheid}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
