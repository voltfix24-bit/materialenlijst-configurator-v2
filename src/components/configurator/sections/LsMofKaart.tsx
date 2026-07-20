import { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Field, FieldRow, InfoBox } from "@/components/ui-prim/Field";
import { PillGroup } from "@/components/ui-prim/PillGroup";
import { Stepper } from "@/components/ui-prim/Stepper";
import { useRingklemSpecs } from "@/lib/configurator/extraStamdata";
import {
  zoekRingklem,
  type LsKabelType,
  type LsMof,
  type LsMofType,
} from "@/lib/configurator/types";

export function LsMofKaart({
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
  const ringklemSpecs = useRingklemSpecs();
  const gevondenRingklemmen = useMemo(() => {
    if (!mof.hoofdkabelDoorsnede || !mof.hoofdkabelMateriaal || !mof.aftakDoorsnede) return [];
    return zoekRingklem(
      ringklemSpecs,
      mof.hoofdkabelDoorsnede,
      mof.hoofdkabelMateriaal,
      mof.aftakDoorsnede,
    );
  }, [ringklemSpecs, mof.hoofdkabelDoorsnede, mof.hoofdkabelMateriaal, mof.aftakDoorsnede]);

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
                onChange({
                  hoofdkabelDoorsnede: v || null,
                  ringklemArtikelNummer: null,
                  ringklemHandmatig: false,
                })
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
                  onChange({
                    aftakDoorsnede: v || null,
                    ringklemArtikelNummer: null,
                    ringklemHandmatig: false,
                  })
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
                  ✓ Ringklem:{" "}
                  <span className="font-mono">{gevondenRingklemmen[0].artikel_nummer}</span>
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
                          onChange({
                            ringklemArtikelNummer: r.artikel_nummer,
                            ringklemHandmatig: true,
                          })
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
                      onChange({
                        ringklemArtikelNummer: e.target.value || null,
                        ringklemHandmatig: true,
                      })
                    }
                  >
                    <option value="">Kies ringklem...</option>
                    {ringklemSpecs.map((r) => (
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
          {mof.kabelLengteMeters > 0 &&
            (() => {
              const extra = mof.kanZwaaien === false ? Math.max(1, mof.opnieuwAantal ?? 1) : 0;
              const fases = 1 + extra;
              const totaal = mof.kabelLengteMeters * mof.aantal * fases;
              return (
                <span className="text-xs text-muted-foreground">
                  = {totaal}m kabel totaal{fases > 1 ? ` (1 tijdelijk + ${extra}× opnieuw)` : ""}
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

      {isProv && mof.kanZwaaien === false && (
        <Field label="Hoeveel keer opnieuw?">
          <div className="flex items-center gap-3">
            <Stepper
              value={mof.opnieuwAantal ?? 1}
              onChange={(v) => onChange({ opnieuwAantal: Math.max(1, v) })}
              min={1}
              max={10}
            />
            <span className="text-xs text-muted-foreground">
              → mofset × {1 + Math.max(1, mof.opnieuwAantal ?? 1)} (1 tijdelijk +{" "}
              {Math.max(1, mof.opnieuwAantal ?? 1)} opnieuw)
            </span>
          </div>
        </Field>
      )}
    </div>
  );
}
