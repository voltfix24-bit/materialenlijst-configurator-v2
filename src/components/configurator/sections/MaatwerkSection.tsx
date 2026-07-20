import { PillGroup } from "@/components/ui-prim/PillGroup";
import { Stepper } from "@/components/ui-prim/Stepper";
import type { MaterialenConfig } from "@/lib/configurator/types";
import type { MaatwerkVraag } from "@/lib/configurator/berekenen/maatwerk";
import type { UpdateFn } from "./shared";

/**
 * Eigen (via Beheer → Automations → Eigen vragen aangemaakte) vragen.
 * Antwoorden landen in config.maatwerkAntwoorden onder de vraag_key en de
 * gekoppelde artikelen komen via berekenMaatwerk in de winkelwagen.
 */
export function MaatwerkSection({
  vragen,
  config,
  update,
}: {
  vragen: MaatwerkVraag[];
  config: MaterialenConfig;
  update: UpdateFn;
}) {
  const zetAntwoord = (key: string, waarde: string) =>
    update({ maatwerkAntwoorden: { ...(config.maatwerkAntwoorden ?? {}), [key]: waarde } });

  return (
    <div className="space-y-3">
      {vragen.map((v) => {
        const antwoord = config.maatwerkAntwoorden?.[v.vraag_key] ?? "";
        return (
          <div
            key={v.vraag_key}
            className="rounded-lg border border-border bg-background/60 p-4 flex flex-col gap-2"
          >
            <label className="text-sm font-medium text-foreground">{v.label}</label>
            {v.type === "ja_nee" && (
              <PillGroup
                value={antwoord}
                onChange={(w) => zetAntwoord(v.vraag_key, w)}
                options={[
                  { value: "ja", label: "Ja" },
                  { value: "nee", label: "Nee" },
                ]}
              />
            )}
            {v.type === "keuze" && (
              <PillGroup
                value={antwoord}
                onChange={(w) => zetAntwoord(v.vraag_key, w)}
                options={(v.opties ?? []).map((o) => ({ value: o, label: o }))}
              />
            )}
            {v.type === "aantal" && (
              <Stepper
                value={Number(antwoord) || 0}
                onChange={(w) => zetAntwoord(v.vraag_key, String(w))}
                min={0}
                max={999}
              />
            )}
            {v.uitleg && <p className="text-xs text-muted-foreground">{v.uitleg}</p>}
          </div>
        );
      })}
    </div>
  );
}
