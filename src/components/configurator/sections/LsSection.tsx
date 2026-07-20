import { Plus, X } from "lucide-react";
import { Field, InfoBox } from "@/components/ui-prim/Field";
import { PillGroup } from "@/components/ui-prim/PillGroup";
import { Stepper } from "@/components/ui-prim/Stepper";
import {
  newLsKabelTrace,
  newLsMof,
  type LsKabelTrace,
  type LsMof,
  type MaterialenConfig,
} from "@/lib/configurator/types";
import type { UpdateFn } from "./shared";
import { LsMofKaart } from "./LsMofKaart";

export function LsSection({ config, update }: { config: MaterialenConfig; update: UpdateFn }) {
  const isProv = config.subType === "cs_met_prov" || config.subType === "renovatie_prov";
  const setMof = (id: string, patch: Partial<LsMof>) =>
    update({ lsMoffen: config.lsMoffen.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const removeMof = (id: string) =>
    update({ lsMoffen: config.lsMoffen.filter((m) => m.id !== id) });
  const addMof = () => update({ lsMoffen: [...config.lsMoffen, newLsMof()] });

  const updateTrace = (id: string, patch: Partial<LsKabelTrace>) =>
    update({
      lsKabelTraces: (config.lsKabelTraces ?? []).map((t) =>
        t.id === id ? { ...t, ...patch } : t,
      ),
    });
  const removeTrace = (id: string) =>
    update({ lsKabelTraces: (config.lsKabelTraces ?? []).filter((t) => t.id !== id) });
  const addTrace = () =>
    update({ lsKabelTraces: [...(config.lsKabelTraces ?? []), newLsKabelTrace()] });

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

      {/* LS-kabel traces — identiek aan MS-trace, vast artikel 20009692 (4x150AL) */}
      <div className="space-y-2 pt-4 border-t border-border">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          LS-kabels (trace zonder mof)
        </div>
        <p className="text-[11px] text-muted-foreground">
          Vast artikel <span className="font-mono">20009692</span> — Kabel V-VMvKhsas 4x150Al + 4x6
          + sas50. Vul alleen lengte (en eventueel oversteek) in.
        </p>

        {(config.lsKabelTraces ?? []).map((trace, i) => (
          <div
            key={trace.id}
            className="rounded-md border border-border bg-background/40 p-3 space-y-3"
          >
            <div className="flex items-center gap-2">
              <span className="rounded bg-secondary text-secondary-foreground text-xs font-mono px-1.5 py-0.5">
                LS-trace {i + 1}
              </span>
              <span className="flex-1 text-sm font-medium">
                {trace.lengteMeters > 0 ? `4x150AL — ${trace.lengteMeters}m` : "Nog in te vullen"}
              </span>
              <button
                type="button"
                onClick={() => removeTrace(trace.id)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <Field label="Lengte trace (meter)">
              <div className="flex items-center gap-3">
                <Stepper
                  value={trace.lengteMeters}
                  onChange={(v) => updateTrace(trace.id, { lengteMeters: v })}
                  min={0}
                  max={999}
                  suffix=" m"
                />
                {trace.lengteMeters > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {trace.lengteMeters}m kabel bestellen (20009692)
                  </span>
                )}
              </div>
            </Field>

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
                  <Stepper
                    value={trace.oversteekMeters}
                    onChange={(v) => updateTrace(trace.id, { oversteekMeters: v })}
                    min={1}
                    max={200}
                    suffix=" m"
                  />
                </Field>
                <InfoBox type="info">
                  {`PVC 110mm beschermbuis (20028640) — ${Math.ceil(trace.oversteekMeters / 6) * trace.aantalOversteken} stuks`}
                  {` | Geotextiel (20043703) — ${trace.aantalOversteken * 2} stuks`}
                </InfoBox>
              </>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addTrace}
          className="w-full py-2 flex items-center justify-center gap-1.5 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <Plus className="h-3 w-3" /> LS-kabel trace toevoegen
        </button>
      </div>
    </div>
  );
}
