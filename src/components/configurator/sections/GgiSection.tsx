import { Field, InfoBox } from "@/components/ui-prim/Field";
import { PillGroup } from "@/components/ui-prim/PillGroup";
import type { MaterialenConfig } from "@/lib/configurator/types";
import type { UpdateFn } from "./shared";

export function GgiSection({ config, update }: { config: MaterialenConfig; update: UpdateFn }) {
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
          installatiebuis (4×), klemzadels (100×), kabellasdozen (4×), YMvK kabel (10m) en
          lasklemmen.
        </InfoBox>
      )}
    </div>
  );
}
