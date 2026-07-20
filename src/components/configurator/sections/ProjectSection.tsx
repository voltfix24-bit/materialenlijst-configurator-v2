import { Field, InfoBox } from "@/components/ui-prim/Field";
import { PillGroup } from "@/components/ui-prim/PillGroup";
import { CASE_TYPE_BESCHRIJVINGEN, SUB_TYPE_LABELS, type SubType } from "@/lib/configurator/types";

/**
 * Type opdracht wordt niet meer gevraagd: er bestaan precies 4 type cases en
 * het opdrachttype volgt 1-op-1 uit het case type dat bij het aanmaken is
 * gekozen. Deze sectie toont alleen wat er vastligt.
 */
export function ProjectSection({ caseType, subType }: { caseType: string; subType: SubType }) {
  return (
    <div className="space-y-3">
      <Field label="Type opdracht (volgt uit het case type)">
        <PillGroup
          value={subType}
          onChange={() => {
            /* vergrendeld — bepaald door case type */
          }}
          options={[{ value: subType, label: SUB_TYPE_LABELS[subType] || "—" }]}
        />
      </Field>
      <InfoBox type="info">
        {CASE_TYPE_BESCHRIJVINGEN[caseType] ?? "Onbekend case type."} Wil je een ander type
        opdracht, maak dan een nieuwe case aan met het juiste case type.
      </InfoBox>
    </div>
  );
}
