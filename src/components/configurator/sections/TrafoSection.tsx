import { Field, InfoBox } from "@/components/ui-prim/Field";
import { PillGroup } from "@/components/ui-prim/PillGroup";
import { Stepper } from "@/components/ui-prim/Stepper";
import { vultKabelSpecsFromStamdata } from "@/lib/configurator/berekenen";
import { useStamdata } from "@/lib/configurator/queries";
import type { MaterialenConfig } from "@/lib/configurator/types";
import type { UpdateFn } from "./shared";

export function TrafoSection({
  config,
  update,
}: {
  config: MaterialenConfig;
  update: UpdateFn;
  sd: ReturnType<typeof useStamdata>;
}) {
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
          {(config.trafoActie === "draaien" || config.trafoActie === "blijft") &&
            config.trafoKva !== "1000" && (
              <>
                Aansluitvlag {config.trafoKva === "630" ? "630kVA set" : "200-400kVA"} wordt
                toegevoegd
              </>
            )}
        </InfoBox>
      )}
    </div>
  );
}

export function VultKabelSection({
  config,
  update,
  sd,
}: {
  config: MaterialenConfig;
  update: UpdateFn;
  sd: ReturnType<typeof useStamdata>;
}) {
  const specs = vultKabelSpecsFromStamdata(sd);
  const spec = config.trafoKva ? specs[config.trafoKva] : null;
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
          Wordt toegevoegd: {totaalMeters}m {spec.kabelArtNr} · {spec.aantalPers}× perskabelschoen ·
          1× muurbeugel
        </InfoBox>
      )}
    </div>
  );
}
