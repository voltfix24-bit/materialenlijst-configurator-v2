import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AssortimentTab } from "@/components/beheer/AssortimentTab";

export const Route = createFileRoute("/beheer")({
  component: BeheerPage,
});

const TABS = [
  { key: "artikelen", label: "Artikelen" },
  { key: "assortiment", label: "Assortimentslijst" },
  { key: "rmu", label: "RMU configuraties" },
  { key: "ms_mof", label: "MS mof types" },
  { key: "ls_mof", label: "LS mof types" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function BeheerPage() {
  const [tab, setTab] = useState<TabKey>("artikelen");

  return (
    <div className="px-8 py-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Beheer</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Stamdata bekijken. Aanvullen via Lovable Cloud.</p>
      </div>
      <div className="flex gap-1 mb-4 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2 text-sm border-b-2 -mb-px transition-colors",
              tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "artikelen" && <ArtikelenTab />}
      {tab === "rmu" && <RmuTab />}
      {tab === "ms_mof" && <MsMofTab />}
      {tab === "ls_mof" && <LsMofTab />}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | number | boolean | null)[][] }) {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-muted-foreground">
          <tr>
            {headers.map((h) => (
              <th key={h} className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 && (
            <tr><td colSpan={headers.length} className="px-3 py-8 text-center text-xs text-muted-foreground">Geen data.</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-accent/40">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 align-top">{String(c ?? "—")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ArtikelenTab() {
  const { data } = useQuery({
    queryKey: ["beheer-artikelen"],
    queryFn: async () => (await supabase.from("artikelen").select("*").order("artikel_nummer")).data ?? [],
  });
  return (
    <Table
      headers={["Nummer", "Omschrijving", "Eenheid", "Categorie", "Actief"]}
      rows={(data ?? []).map((a) => [a.artikel_nummer, a.korte_omschrijving, a.eenheid, a.categorie, a.actief])}
    />
  );
}

function RmuTab() {
  const { data } = useQuery({
    queryKey: ["beheer-rmu"],
    queryFn: async () => (await supabase.from("rmu_configuraties").select("*").order("merk").order("code")).data ?? [],
  });
  return (
    <Table
      headers={["Code", "Merk", "I-Net", "Velden", "F", "C", "V", "Actief"]}
      rows={(data ?? []).map((c) => [c.code, c.merk, c.is_inet, c.aantal_velden, c.aantal_f, c.aantal_c, c.aantal_v, c.actief])}
    />
  );
}

function MsMofTab() {
  const { data } = useQuery({
    queryKey: ["beheer-ms-mof"],
    queryFn: async () => (await supabase.from("ms_mof_types").select("*").order("code")).data ?? [],
  });
  return (
    <Table
      headers={["Code", "Bestaand", "Min mm²", "Max mm²", "Omschrijving", "Actief"]}
      rows={(data ?? []).map((m) => [m.code, m.bestaand_type, m.bestaand_doorsnede_min, m.bestaand_doorsnede_max, m.omschrijving, m.actief])}
    />
  );
}

function LsMofTab() {
  const { data } = useQuery({
    queryKey: ["beheer-ls-mof"],
    queryFn: async () => (await supabase.from("ls_mof_types").select("*").order("type")).data ?? [],
  });
  return (
    <Table
      headers={["Type", "Bestaand", "Omschrijving", "Actief"]}
      rows={(data ?? []).map((m) => [m.type, m.bestaand_type, m.omschrijving, m.actief])}
    />
  );
}
