import { Field, InfoBox } from "@/components/ui-prim/Field";
import { PillGroup } from "@/components/ui-prim/PillGroup";
import { Stepper } from "@/components/ui-prim/Stepper";
import type { MaterialenConfig } from "@/lib/configurator/types";
import type { UpdateFn } from "./shared";
import { LsRichtingBeveiliging } from "./LsRichtingBeveiliging";

function OvStuurpuntVragen({ config, update }: { config: MaterialenConfig; update: UpdateFn }) {
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

export function LsRekSection({ config, update }: { config: MaterialenConfig; update: UpdateFn }) {
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
              lsRekAantalBeveiligingen: 0,
              lsRekBeveiligingen: [],
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
                <Stepper
                  value={config.lsRekExtraStroken}
                  onChange={(v) => update({ lsRekExtraStroken: v })}
                  min={0}
                  max={99}
                />
                {config.lsRekExtraStroken > 0 &&
                  maxStroken &&
                  config.lsRekExtraStroken > maxStroken && (
                    <InfoBox type="warning">
                      ⚠ {config.lsRekExtraStroken} stroken overschrijdt de maximale capaciteit van
                      dit rek ({maxStroken} richtingen)
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
              {config.lsRekAanSluitenKabels > 0 &&
                config.lsRekType &&
                (() => {
                  const max = config.lsRekType === "8" ? 8 : 12;
                  if (config.lsRekAanSluitenKabels > max) {
                    return (
                      <InfoBox type="warning">
                        ⚠ {config.lsRekAanSluitenKabels} kabels op een {max}-richtingen rek — klopt
                        dit? Maximum is {max} richtingen.
                      </InfoBox>
                    );
                  }
                  return null;
                })()}
            </div>
          </Field>

          {config.trafoKva ? (
            <InfoBox type="info">
              Beveiliging voedende strook: mespatroon voor {config.trafoKva} kVA wordt automatisch
              toegevoegd
            </InfoBox>
          ) : (
            <InfoBox type="warning">
              ⚠ Vul het trafo vermogen in bij de Trafo-sectie voor de juiste beveiliging
            </InfoBox>
          )}

          <LsRichtingBeveiliging config={config} update={update} />

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

          {config.lsRekBeveiligingAanpassen && (
            <LsRichtingBeveiliging config={config} update={update} />
          )}

          <OvStuurpuntVragen config={config} update={update} />
        </>
      )}
    </div>
  );
}
