import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PillGroup } from "@/components/ui-prim/PillGroup";
import { Field, FieldRow } from "@/components/ui-prim/Field";

export const Route = createFileRoute("/cases/")({
  component: CasesPage,
});

const STATUS_LABELS: Record<string, string> = {
  concept: "Concept",
  gepland: "Gepland",
  in_uitvoering: "In uitvoering",
  afgerond: "Afgerond",
};

function CasesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ case_nummer: "", station_naam: "", case_type: "NSA" as string });

  const { data: cases } = useQuery({
    queryKey: ["cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*, case_materialen(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createCase = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .insert({
          case_nummer: form.case_nummer || null,
          station_naam: form.station_naam || null,
          case_type: form.case_type,
          status: "concept",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["cases"] });
      navigate({ to: "/cases/$id", params: { id: c.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeCase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cases"] });
      toast.success("Case verwijderd");
    },
  });

  return (
    <div className="px-8 py-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Materiaalbestellijsten per station.</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Nieuwe case
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-lg border border-border bg-surface p-4">
          <FieldRow>
            <Field label="Case nummer">
              <input
                value={form.case_nummer}
                onChange={(e) => setForm({ ...form, case_nummer: e.target.value })}
                placeholder="C-2026-001"
                className="bg-input rounded-md px-3 py-1.5 text-sm border border-border focus:outline-none focus:border-primary w-48"
              />
            </Field>
            <Field label="Station">
              <input
                value={form.station_naam}
                onChange={(e) => setForm({ ...form, station_naam: e.target.value })}
                placeholder="Stationsnaam"
                className="bg-input rounded-md px-3 py-1.5 text-sm border border-border focus:outline-none focus:border-primary w-64"
              />
            </Field>
            <Field label="Case type">
              <PillGroup
                value={form.case_type}
                onChange={(v) => setForm({ ...form, case_type: v })}
                options={[
                  { value: "NSA", label: "NSA" },
                  { value: "provisorium", label: "Provisorium" },
                  { value: "compact", label: "Compact" },
                  { value: "custom", label: "Custom" },
                ]}
              />
            </Field>
          </FieldRow>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => createCase.mutate()}
              disabled={createCase.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Aanmaken & openen
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-md px-4 py-2 text-sm hover:bg-accent">
              Annuleren
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface divide-y divide-border overflow-hidden">
        {cases?.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            Nog geen cases. Maak er één aan.
          </div>
        )}
        {cases?.map((c) => {
          const matCount = (c.case_materialen as { count: number }[] | null)?.[0]?.count ?? 0;
          return (
            <div key={c.id} className="flex items-center px-4 py-3 hover:bg-accent/40 transition-colors group">
              <Link to="/cases/$id" params={{ id: c.id }} className="flex-1 flex items-center gap-4 min-w-0">
                <span className="font-mono text-xs text-muted-foreground w-28 shrink-0">{c.case_nummer || "—"}</span>
                <span className="flex-1 truncate font-medium">{c.station_naam || <span className="text-muted-foreground italic">naamloos</span>}</span>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                  {c.case_type}
                </span>
                <span className="rounded-md border border-border px-2 py-0.5 text-xs">
                  {STATUS_LABELS[c.status] ?? c.status}
                </span>
                <span className="text-xs font-mono text-muted-foreground w-16 text-right">
                  {matCount} mat.
                </span>
              </Link>
              <button
                onClick={() => {
                  if (confirm("Case verwijderen?")) removeCase.mutate(c.id);
                }}
                className="ml-3 p-1.5 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
