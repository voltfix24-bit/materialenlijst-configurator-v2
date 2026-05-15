import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronRight, Clock, Package, Plus, Search, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
const STATUS_COLORS: Record<string, string> = {
  concept: "bg-muted text-muted-foreground",
  gepland: "bg-blue-500/10 text-blue-500 dark:text-blue-400",
  in_uitvoering: "bg-amber-500/10 text-amber-500 dark:text-amber-400",
  afgerond: "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400",
};
const CASE_TYPE_LABELS: Record<string, string> = {
  NSA: "NSA",
  provisorium: "Provisorium",
  compact: "Compact",
  custom: "Custom",
};

function CasesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ case_nummer: "", station_naam: "", case_type: "NSA" as string });
  const [zoekterm, setZoekterm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: cases } = useQuery({
    queryKey: ["cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*, case_materialen(count)")
        .order("updated_at", { ascending: false });
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

  const filtered = useMemo(() => {
    const term = zoekterm.trim().toLowerCase();
    return (cases ?? []).filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (!term) return true;
      const hay = `${c.station_naam ?? ""} ${c.case_nummer ?? ""}`.toLowerCase();
      return hay.includes(term);
    });
  }, [cases, zoekterm, statusFilter]);

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

      {/* Filter balk */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Zoek op naam of casenummer..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            value={zoekterm}
            onChange={(e) => setZoekterm(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Alle statussen</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 && (
        <div className="rounded-lg border border-border bg-surface px-4 py-12 text-center text-sm text-muted-foreground">
          {cases?.length === 0 ? "Nog geen cases. Maak er één aan." : "Geen cases gevonden voor deze filters."}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((c) => {
          const matCount = (c.case_materialen as { count: number }[] | null)?.[0]?.count ?? 0;
          return (
            <div
              key={c.id}
              className="group relative rounded-xl border border-border bg-surface p-4 hover:border-border/80 hover:bg-accent/30 transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wider">
                      {CASE_TYPE_LABELS[c.case_type] ?? c.case_type}
                    </span>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[c.status] ?? "bg-muted text-muted-foreground")}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold truncate">
                    {c.station_naam || <span className="text-muted-foreground italic">Naamloos station</span>}
                  </h3>
                  {c.case_nummer && (
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{c.case_nummer}</p>
                  )}
                </div>
                <div className="flex items-start gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (confirm("Case verwijderen?")) removeCase.mutate(c.id);
                    }}
                    className="relative z-10 p-1.5 rounded text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 mt-1 group-hover:text-muted-foreground transition-colors" />
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  {matCount} materialen
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(c.updated_at), { locale: nl, addSuffix: true })}
                </span>
              </div>

              <Link
                to="/cases/$id"
                params={{ id: c.id }}
                className="absolute inset-0 rounded-xl"
                aria-label={`Open ${c.station_naam ?? "case"}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
