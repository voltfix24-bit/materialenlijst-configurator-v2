import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MaterialenConfigurator } from "@/components/configurator/MaterialenConfigurator";
import { PillGroup } from "@/components/ui-prim/PillGroup";
import { exporteerNaarTemplate, downloadBlob } from "@/lib/assortiment/excel";

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
    mutationFn: async (patch: { station_naam?: string | null; status?: string }) => {
      const { error } = await supabase.from("cases").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case", id] }),
  });

  const { data: opgeslagen } = useQuery({
    queryKey: ["case-materialen", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_materialen")
        .select("gewenste_hoeveelheid, artikelen:artikel_id(artikel_nummer)")
        .eq("case_id", id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const exporteer = useMutation({
    mutationFn: async () => {
      const items = (opgeslagen ?? [])
        .map((r) => ({
          artikel_nummer: (r.artikelen as { artikel_nummer?: string } | null)?.artikel_nummer ?? "",
          hoeveelheid: Number(r.gewenste_hoeveelheid) || 0,
        }))
        .filter((i) => i.artikel_nummer && i.hoeveelheid > 0);
      const res = await exporteerNaarTemplate(items, caseRow?.case_nummer ?? null);
      downloadBlob(res.blob, res.filename);
      return res;
    },
    onSuccess: (res) => {
      toast.success(`Geëxporteerd · ${res.matched} gematcht${res.unmatched.length ? `, ${res.unmatched.length} zonder Liander-nummer` : ""}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const heeftMaterialen = (opgeslagen?.length ?? 0) > 0;

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
        <button
          onClick={() => exporteer.mutate()}
          disabled={!heeftMaterialen || exporteer.isPending}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
          title={heeftMaterialen ? "Exporteer opgeslagen materialen naar Liander template" : "Sla eerst de materiaallijst op"}
        >
          {exporteer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Exporteren naar Excel
        </button>
      </div>

      <MaterialenConfigurator
        caseId={id}
        caseType={caseRow.case_type}
      />
    </div>
  );
}
