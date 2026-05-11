import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MaterialenConfigurator } from "@/components/configurator/MaterialenConfigurator";
import { PillGroup } from "@/components/ui-prim/PillGroup";

export const Route = createFileRoute("/cases/$id")({
  component: CaseDetailPage,
});

const STATUSSEN = [
  { value: "concept", label: "Concept" },
  { value: "gepland", label: "Gepland" },
  { value: "in_uitvoering", label: "In uitvoering" },
  { value: "afgerond", label: "Afgerond" },
];

function CaseDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data: caseRow, isLoading } = useQuery({
    queryKey: ["case", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cases").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const [naam, setNaam] = useState("");
  useEffect(() => { if (caseRow?.station_naam) setNaam(caseRow.station_naam); }, [caseRow?.station_naam]);

  const updateCase = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase.from("cases").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case", id] }),
  });

  if (isLoading || !caseRow) {
    return <div className="px-8 py-6 text-sm text-muted-foreground">Laden…</div>;
  }

  return (
    <div className="px-6 py-5 max-w-[1500px] mx-auto">
      <div className="flex items-center gap-4 mb-5 pb-4 border-b border-border">
        <Link to="/cases" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="font-mono text-xs text-muted-foreground">{caseRow.case_nummer ?? "—"}</span>
          <input
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            onBlur={() => naam !== caseRow.station_naam && updateCase.mutate({ station_naam: naam || null })}
            placeholder="Stationsnaam"
            className="bg-transparent text-lg font-semibold focus:outline-none focus:bg-input rounded-md px-2 py-0.5 min-w-0 flex-1"
          />
        </div>
        <PillGroup
          size="sm"
          value={caseRow.status}
          onChange={(v) => updateCase.mutate({ status: v })}
          options={STATUSSEN}
        />
      </div>

      <MaterialenConfigurator
        caseId={id}
        caseType={caseRow.case_type}
      />
    </div>
  );
}
