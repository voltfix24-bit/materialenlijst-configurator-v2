import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CASE_TYPE_LABELS, SUB_TYPE_LABELS, type SubType } from "@/lib/configurator/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cases/tabel")({
  head: () => ({
    meta: [
      { title: "Cases-overzicht (tabel) — TerreVolt" },
      { name: "description", content: "Tabeloverzicht van alle cases met case type en sub type, sorteerbaar en filterbaar." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CasesTabelPage,
});

type Row = {
  id: string;
  case_nummer: string | null;
  station_naam: string | null;
  case_type: string;
  sub_type: string | null;
  status: string;
  updated_at: string;
};

type SortKey = "case_type" | "sub_type" | "station_naam" | "case_nummer" | "status" | "updated_at";
type SortDir = "asc" | "desc";

function CasesTabelPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["cases", "tabel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("id, case_nummer, station_naam, case_type, sub_type, status, updated_at");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const [caseTypeFilter, setCaseTypeFilter] = useState("");
  const [subTypeFilter, setSubTypeFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("case_type");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const caseTypes = useMemo(
    () => Array.from(new Set((data ?? []).map((r) => r.case_type).filter(Boolean))).sort(),
    [data],
  );
  const subTypes = useMemo(
    () => Array.from(new Set((data ?? []).map((r) => r.sub_type ?? "").filter(Boolean))).sort(),
    [data],
  );

  const rows = useMemo(() => {
    let out = (data ?? []).filter((r) => {
      if (caseTypeFilter && r.case_type !== caseTypeFilter) return false;
      if (subTypeFilter && (r.sub_type ?? "") !== subTypeFilter) return false;
      return true;
    });
    out = [...out].sort((a, b) => {
      const av = (a[sortKey] ?? "") as string;
      const bv = (b[sortKey] ?? "") as string;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [data, caseTypeFilter, subTypeFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  return (
    <div className="px-6 sm:px-8 py-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[color:var(--navy)]">Cases — tabel</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Overzicht van alle cases per case type en sub type.</p>
        </div>
        <Link to="/cases" className="text-sm text-primary hover:underline">← Kaartweergave</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
        <label className="text-xs">
          <span className="block mb-1 text-muted-foreground">Filter case type</span>
          <select
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
            value={caseTypeFilter}
            onChange={(e) => setCaseTypeFilter(e.target.value)}
          >
            <option value="">Alle case types</option>
            {caseTypes.map((k) => (
              <option key={k} value={k}>{CASE_TYPE_LABELS[k] ?? k} ({k})</option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="block mb-1 text-muted-foreground">Filter sub type</span>
          <select
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
            value={subTypeFilter}
            onChange={(e) => setSubTypeFilter(e.target.value)}
          >
            <option value="">Alle sub types</option>
            {subTypes.map((k) => (
              <option key={k} value={k}>{SUB_TYPE_LABELS[k as SubType] ?? k} ({k})</option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              {([
                ["case_type", "Case type"],
                ["sub_type", "Sub type"],
                ["station_naam", "Station"],
                ["case_nummer", "Case nr."],
                ["status", "Status"],
                ["updated_at", "Bijgewerkt"],
              ] as [SortKey, string][]).map(([k, label]) => (
                <th key={k} className="text-left px-3 py-2 font-medium">
                  <button
                    onClick={() => toggleSort(k)}
                    className={cn(
                      "inline-flex items-center gap-1 hover:text-foreground transition-colors",
                      sortKey === k && "text-foreground",
                    )}
                  >
                    {label} <SortIcon k={k} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Laden…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Geen cases gevonden.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-2">
                  <span className="font-medium">{CASE_TYPE_LABELS[r.case_type] ?? r.case_type}</span>
                  <span className="ml-1 text-xs text-muted-foreground">({r.case_type})</span>
                </td>
                <td className="px-3 py-2">
                  {r.sub_type ? (
                    <>
                      <span>{SUB_TYPE_LABELS[r.sub_type as SubType] ?? r.sub_type}</span>
                      <span className="ml-1 text-xs text-muted-foreground">({r.sub_type})</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground italic">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Link to="/cases/$id" params={{ id: r.id }} className="text-primary hover:underline">
                    {r.station_naam || <span className="italic text-muted-foreground">Naamloos</span>}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.case_nummer ?? "—"}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(r.updated_at).toLocaleString("nl-NL")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{rows.length} case{rows.length === 1 ? "" : "s"} getoond.</p>
    </div>
  );
}
