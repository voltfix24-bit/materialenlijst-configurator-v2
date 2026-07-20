import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Field } from "@/components/ui-prim/Field";
import { PillGroup } from "@/components/ui-prim/PillGroup";
import { Stepper } from "@/components/ui-prim/Stepper";
import type { MaterialenConfig } from "@/lib/configurator/types";
import type { UpdateFn } from "./shared";

function useLsBeveiligingOpties() {
  return useQuery({
    queryKey: ["ls_beveiliging_opties"],
    queryFn: async () => {
      // Handmatige join: er staat (nog) geen FK van ls_beveiliging_opties.artikel_id
      // naar artikelen.id, dus de PostgREST-embed `artikel:artikel_id(*)` levert
      // altijd null op en alle opties zouden weggefilterd worden in de UI.
      const { data: opties, error } = await supabase
        .from("ls_beveiliging_opties")
        .select("*")
        .eq("actief", true)
        .order("sort_order");
      if (error) throw error;
      const ids = [...new Set((opties ?? []).map((o) => o.artikel_id).filter(Boolean) as string[])];
      let byId = new Map<
        string,
        { id: string; artikel_nummer: string; korte_omschrijving: string; actief: boolean }
      >();
      if (ids.length > 0) {
        const { data: arts } = await supabase
          .from("artikelen")
          .select("id, artikel_nummer, korte_omschrijving, actief")
          .in("id", ids);
        byId = new Map((arts ?? []).map((a) => [a.id as string, a as never]));
      }
      return (opties ?? []).map((o) => ({
        ...o,
        artikel: o.artikel_id ? (byId.get(o.artikel_id as string) ?? null) : null,
      }));
    },
  });
}

export function LsRichtingBeveiliging({
  config,
  update,
}: {
  config: MaterialenConfig;
  update: UpdateFn;
}) {
  const aantal = config.lsRekAantalBeveiligingen ?? 0;
  const { data: optiesData = [] } = useLsBeveiligingOpties();
  const opties = (
    optiesData as Array<{ artikel: { artikel_nummer?: string } | null; label: string }>
  )
    .map((o) => ({
      value: o.artikel?.artikel_nummer ?? "",
      label: o.label,
    }))
    .filter((o) => o.value);
  return (
    <>
      <Field label="Hoeveel LS richtingen beveiliging aanpassen?">
        <Stepper
          value={aantal}
          onChange={(v) => {
            const arr = (config.lsRekBeveiligingen ?? []).slice(0, v);
            update({ lsRekAantalBeveiligingen: v, lsRekBeveiligingen: arr });
          }}
          min={0}
          max={24}
        />
      </Field>

      {aantal > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Mespatroon per richting (3 stuks per richting)
          </div>
          {opties.length === 0 && (
            <div className="text-xs text-muted-foreground italic">
              Geen beveiligingsopties geconfigureerd — voeg ze toe via Beheer → Hardware → LS
              beveiligingsopties.
            </div>
          )}
          {Array.from({ length: aantal }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-16 flex-shrink-0">
                Richting {i + 1}
              </span>
              <PillGroup
                value={config.lsRekBeveiligingen?.[i] ?? ""}
                onChange={(v) => {
                  const arr = [...(config.lsRekBeveiligingen ?? [])];
                  arr[i] = v;
                  update({ lsRekBeveiligingen: arr });
                }}
                options={opties}
                size="sm"
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
