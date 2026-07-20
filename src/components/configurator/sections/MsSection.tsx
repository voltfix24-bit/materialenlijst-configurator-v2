import { useEffect, useMemo } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Field, InfoBox } from "@/components/ui-prim/Field";
import { PillGroup } from "@/components/ui-prim/PillGroup";
import { Stepper } from "@/components/ui-prim/Stepper";
import { useStamdata } from "@/lib/configurator/queries";
import {
  emptyMofConfig,
  newRichting,
  type MaterialenConfig,
  type MsKabelTrace,
  type MsKabelType,
  type MsMofConfig,
} from "@/lib/configurator/types";
import type { UpdateFn } from "./shared";

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
  config: MsMofConfig;
  onChange: (patch: Partial<MsMofConfig>) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  msMofTypes: any[];
}) {
  const eindmofType = useMemo(
    () => msMofTypes.find((mt) => mt.code === "EINDMOF") ?? null,
    [msMofTypes],
  );
  const eindmofTypeId: string | null = eindmofType?.id ?? null;

  const gevondenMoffen = useMemo(() => {
    if (mof.isEindmof) return [];
    if (
      !mof.bestaandType ||
      mof.bestaandDoorsnede == null ||
      !mof.nieuwType ||
      mof.nieuwDoorsnede == null
    )
      return [];
    return msMofTypes.filter(
      (mt) =>
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
    if (
      !mof.isEindmof &&
      gevondenMoffen.length === 1 &&
      !mof.mofHandmatig &&
      mof.mofTypeId !== gevondenMoffen[0].id
    ) {
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
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </div>

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

              onChange={(v) =>
                onChange({
                  bestaandType: v as MsMofConfig["bestaandType"],
                  bestaandDoorsnede: null,
                  mofTypeId: null,
                  mofHandmatig: false,
                })
              }
              options={kabelOpties.map((o) => ({ value: o.value, label: o.label }))}
            />
          </Field>
          {mof.bestaandType && (
            <Field label="Bestaande kabel — doorsnede (mm²)">
              <PillGroup
                value={mof.bestaandDoorsnede?.toString() ?? ""}
                onChange={(v) =>
                  onChange({ bestaandDoorsnede: Number(v), mofTypeId: null, mofHandmatig: false })
                }
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

              onChange={(v) =>
                onChange({
                  nieuwType: v as MsMofConfig["nieuwType"],
                  nieuwDoorsnede: null,
                  mofTypeId: null,
                  mofHandmatig: false,
                })
              }
              options={kabelOpties.map((o) => ({ value: o.value, label: o.label }))}
            />
          </Field>
          {mof.nieuwType && (
            <Field label="Nieuwe kabel — doorsnede (mm²)">
              <PillGroup
                value={mof.nieuwDoorsnede?.toString() ?? ""}
                onChange={(v) =>
                  onChange({ nieuwDoorsnede: Number(v), mofTypeId: null, mofHandmatig: false })
                }
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
                  <InfoBox type="warning">
                    ⚠ Geen mof gevonden voor deze combinatie — kies handmatig:
                  </InfoBox>
                  <select
                    className="w-full text-xs p-1.5 rounded border border-border bg-input text-foreground"
                    value={mof.mofTypeId ?? ""}
                    onChange={(e) =>
                      onChange({ mofTypeId: e.target.value || null, mofHandmatig: true })
                    }
                  >
                    <option value="">Kies mof…</option>
                    {msMofTypes
                      .filter((mt) => mt.code !== "EINDMOF")
                      .map((mt) => (
                        <option key={mt.id} value={mt.id}>
                          {mt.code}
                          {mt.omschrijving ? ` — ${mt.omschrijving}` : ""}
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

export function MsSection({
  config,
  update,
  sd,
}: {
  config: MaterialenConfig;
  update: UpdateFn;
  sd: ReturnType<typeof useStamdata>;
}) {
  const isProvisorum = config.subType === "cs_met_prov" || config.subType === "renovatie_prov";
  const removeRicht = (id: string) =>
    update({ msRichtingen: config.msRichtingen.filter((r) => r.id !== id) });
  const addRicht = () => update({ msRichtingen: [...config.msRichtingen, newRichting()] });
  const updateTrace = (id: string, patch: Partial<MsKabelTrace>) => {
    update({
      msKabelTraces: config.msKabelTraces.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
  };
  const updateMof = (id: string, fase: "tijdelijk" | "definitief", patch: Partial<MsMofConfig>) => {
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
        r.id === id
          ? {
              ...r,
              kanZwaaien: kan,
              mofDefinitief: kan ? null : (r.mofDefinitief ?? emptyMofConfig()),
            }
          : r,
      ),
    });
  };

  return (
    <div className="space-y-3">
      {config.msRichtingen.map((r, idx) => (
        <div key={r.id} className="rounded-md border border-border bg-background/40 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="rounded bg-secondary text-secondary-foreground text-xs font-mono px-1.5 py-0.5">
              {idx + 1}
            </span>
            <span className="text-sm font-medium flex-1">MS-richting {idx + 1}</span>
            {config.msRichtingen.length > 1 && (
              <button
                onClick={() => removeRicht(r.id)}
                className="text-muted-foreground hover:text-destructive"
              >
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
      <button
        onClick={addRicht}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <Plus className="w-4 h-4" /> MS-richting toevoegen
      </button>

      {/* MS-kabel traces */}
      <div className="space-y-2 pt-2">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          MS-kabels
        </div>

        {config.msKabelTraces.map((trace, i) => (
          <div
            key={trace.id}
            className="rounded-md border border-border bg-background/40 p-3 space-y-3"
          >
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
