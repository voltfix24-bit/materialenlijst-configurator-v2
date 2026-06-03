import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Severity = "fout" | "afwijking" | "ok";

interface CheckResult {
  id: string;
  titel: string;
  severity: Severity;
  samenvatting: string;
  details?: string[];
}

interface RegelRow {
  id: string;
  artikel_id: string | null;
  herkomst_label?: string | null;
  code?: string | null;
  [k: string]: unknown;
}

const TABELLEN_MET_ARTIKEL_ID: Array<{ table: string; label: string; required: boolean; filter?: (r: RegelRow) => boolean }> = [
  { table: "ggi_artikelen", label: "GGI artikelen", required: true },
  { table: "trafo_regels", label: "Trafo regels", required: true },
  { table: "ls_rek_regels", label: "LS-rek regels", required: true },
  { table: "prov_regels", label: "Provisorium regels", required: true },
  { table: "ms_kabel_regels", label: "MS kabel regels", required: true },
  { table: "rmu_veld_regels", label: "RMU veld regels", required: true },
  { table: "rmu_veld_artikelen", label: "RMU veld artikelen", required: true },
  { table: "rmu_zekeringen", label: "RMU zekeringen", required: true },
  { table: "ms_mof_materialen", label: "MS mof materialen", required: true },
  { table: "ls_mof_materialen", label: "LS mof materialen", required: true },
  { table: "standaard_materialen_templates", label: "Standaard materialen", required: true },
  { table: "station_vaste_artikelen", label: "Station vaste artikelen", required: true },
  // ms_mof_types: artikel_id is optioneel (EINDMOF heeft er bewust geen)
  { table: "ms_mof_types", label: "MS mof types (niet-EINDMOF)", required: true, filter: (r) => (r.code ?? "") !== "EINDMOF" },
];

async function runChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Laad artikelen index
  const { data: artikelen, error: artErr } = await supabase
    .from("artikelen")
    .select("id, artikel_nummer, korte_omschrijving, actief, alternatief_artikel_nummer");
  if (artErr) throw artErr;
  const byId = new Map((artikelen ?? []).map((a) => [a.id as string, a]));
  const byNr = new Map((artikelen ?? []).map((a) => [a.artikel_nummer as string, a]));

  // Per tabel: laad rijen + check
  for (const t of TABELLEN_MET_ARTIKEL_ID) {
    const { data, error } = await supabase.from(t.table as never).select("*");
    if (error) {
      results.push({
        id: `${t.table}-error`,
        titel: t.label,
        severity: "fout",
        samenvatting: `Kan tabel niet lezen: ${error.message}`,
      });
      continue;
    }
    const rows = ((data ?? []) as unknown as RegelRow[]).filter((r) => (t.filter ? t.filter(r) : true));

    const nullArtikel: RegelRow[] = [];
    const missingArtikel: RegelRow[] = [];
    const inactiveArtikel: Array<{ row: RegelRow; nr: string }> = [];

    for (const row of rows) {
      if (!row.artikel_id) {
        if (t.required) nullArtikel.push(row);
        continue;
      }
      const art = byId.get(row.artikel_id);
      if (!art) {
        missingArtikel.push(row);
      } else if (!art.actief) {
        inactiveArtikel.push({ row, nr: art.artikel_nummer as string });
      }
    }

    const totaal = nullArtikel.length + missingArtikel.length + inactiveArtikel.length;
    if (totaal === 0) {
      results.push({
        id: t.table,
        titel: t.label,
        severity: "ok",
        samenvatting: `${rows.length} rijen — alle artikelreferenties geldig.`,
      });
    } else {
      const details: string[] = [];
      if (nullArtikel.length) {
        details.push(
          `${nullArtikel.length}× ontbrekend artikel_id (rij-id's: ${nullArtikel.slice(0, 5).map((r) => r.id.slice(0, 8)).join(", ")}${nullArtikel.length > 5 ? "…" : ""})`,
        );
      }
      if (missingArtikel.length) {
        details.push(
          `${missingArtikel.length}× verwijst naar niet-bestaand artikel (rij-id's: ${missingArtikel.slice(0, 5).map((r) => r.id.slice(0, 8)).join(", ")}${missingArtikel.length > 5 ? "…" : ""})`,
        );
      }
      if (inactiveArtikel.length) {
        details.push(
          `${inactiveArtikel.length}× verwijst naar inactief artikel (${inactiveArtikel.slice(0, 5).map((x) => x.nr).join(", ")}${inactiveArtikel.length > 5 ? "…" : ""})`,
        );
      }
      results.push({
        id: t.table,
        titel: t.label,
        severity: nullArtikel.length || missingArtikel.length ? "fout" : "afwijking",
        samenvatting: `${totaal} probleem(en) in ${rows.length} rijen.`,
        details,
      });
    }
  }

  // RMU configuraties: rmu_artikel_id is verplicht; frame/bodem alleen voor ABB (optioneel voor Magnefix/Siemens)
  const { data: rmuCfg, error: rmuErr } = await supabase
    .from("rmu_configuraties")
    .select("id, code, merk, rmu_artikel_id, frame_artikel_id, bodemplaat_artikel_id");
  if (rmuErr) {
    results.push({ id: "rmu_cfg-error", titel: "RMU configuraties", severity: "fout", samenvatting: rmuErr.message });
  } else {
    const issues: string[] = [];
    const missingRmu: string[] = [];
    const missingFrameAbb: string[] = [];
    const danglingRefs: string[] = [];
    for (const c of rmuCfg ?? []) {
      if (!c.rmu_artikel_id) missingRmu.push(`${c.merk}/${c.code}`);
      else if (!byId.has(c.rmu_artikel_id)) danglingRefs.push(`${c.merk}/${c.code} rmu`);
      if (c.merk === "ABB") {
        if (!c.frame_artikel_id || !c.bodemplaat_artikel_id) missingFrameAbb.push(`${c.code}`);
      }
      for (const ref of [c.frame_artikel_id, c.bodemplaat_artikel_id]) {
        if (ref && !byId.has(ref)) danglingRefs.push(`${c.merk}/${c.code} frame/bodem`);
      }
    }
    if (missingRmu.length) issues.push(`${missingRmu.length}× geen RMU-artikel: ${missingRmu.join(", ")}`);
    if (missingFrameAbb.length) issues.push(`${missingFrameAbb.length}× ABB zonder frame/bodemplaat: ${missingFrameAbb.join(", ")}`);
    if (danglingRefs.length) issues.push(`${danglingRefs.length}× verwijst naar niet-bestaand artikel`);
    results.push({
      id: "rmu_configuraties",
      titel: "RMU configuraties",
      severity: missingRmu.length || danglingRefs.length ? "fout" : missingFrameAbb.length ? "afwijking" : "ok",
      samenvatting: issues.length ? issues[0] : `${rmuCfg?.length ?? 0} configuraties — alle referenties geldig.`,
      details: issues.length > 1 ? issues.slice(1) : undefined,
    });
  }

  // trafo_vult_kabel: kabel + pers + muurbeugel
  const { data: vk, error: vkErr } = await supabase
    .from("trafo_vult_kabel")
    .select("id, trafo_kva, kabel_doorsnede, kabel_artikel_id, perskabelschoen_artikel_id, muurbeugel_artikel_id")
    .eq("actief", true);
  if (vkErr) {
    results.push({ id: "vk-error", titel: "Trafo vult-kabel", severity: "fout", samenvatting: vkErr.message });
  } else {
    const issues: string[] = [];
    for (const r of vk ?? []) {
      const label = `${r.trafo_kva}kVA/${r.kabel_doorsnede}mm²`;
      const mis: string[] = [];
      if (!r.kabel_artikel_id) mis.push("kabel");
      if (!r.perskabelschoen_artikel_id) mis.push("perskabelschoen");
      if (!r.muurbeugel_artikel_id) mis.push("muurbeugel");
      if (mis.length) issues.push(`${label}: ontbreekt ${mis.join(", ")}`);
      for (const ref of [r.kabel_artikel_id, r.perskabelschoen_artikel_id, r.muurbeugel_artikel_id]) {
        if (ref && !byId.has(ref)) issues.push(`${label}: dangling ref`);
      }
    }
    results.push({
      id: "trafo_vult_kabel",
      titel: "Trafo vult-kabel",
      severity: issues.length ? "fout" : "ok",
      samenvatting: issues.length ? `${issues.length} probleem(en).` : `${vk?.length ?? 0} regels — compleet.`,
      details: issues.slice(0, 8),
    });
  }

  // Artikelen zelf: dubbele artikelnummers
  const counts = new Map<string, number>();
  for (const a of artikelen ?? []) {
    const nr = a.artikel_nummer as string;
    counts.set(nr, (counts.get(nr) ?? 0) + 1);
  }
  const dupes = [...counts.entries()].filter(([, n]) => n > 1);
  results.push({
    id: "artikelen-dupes",
    titel: "Artikelen — unieke artikelnummers",
    severity: dupes.length ? "fout" : "ok",
    samenvatting: dupes.length
      ? `${dupes.length} dubbele artikelnummer(s).`
      : `${artikelen?.length ?? 0} artikelen — geen duplicaten.`,
    details: dupes.slice(0, 10).map(([nr, n]) => `${nr} (${n}×)`),
  });

  // Alternatief-keten: inactieve artikelen met alternatief — check beschikbaarheid
  const issues: string[] = [];
  let altGoed = 0;
  for (const a of artikelen ?? []) {
    const altNr = (a as { alternatief_artikel_nummer?: string | null }).alternatief_artikel_nummer;
    if (!altNr) continue;
    const alt = byNr.get(altNr);
    if (!alt) {
      issues.push(`${a.artikel_nummer} → alt ${altNr}: bestaat niet`);
    } else if (!(alt as { actief?: boolean }).actief) {
      issues.push(`${a.artikel_nummer} → alt ${altNr}: alternatief is zelf inactief`);
    } else {
      altGoed++;
    }
  }
  results.push({
    id: "alternatief-keten",
    titel: "Alternatief-ketens",
    severity: issues.length ? "afwijking" : "ok",
    samenvatting: issues.length
      ? `${issues.length} artikel(en) met onbruikbaar alternatief (${altGoed} oké).`
      : `${altGoed} artikel(en) met geldig alternatief.`,
    details: issues.slice(0, 8),
  });

  // Case-materialen die naar inactieve artikelen verwijzen
  const { data: cm, error: cmErr } = await supabase
    .from("case_materialen")
    .select("id, case_id, artikel_id");
  if (cmErr) {
    results.push({ id: "case_materialen-error", titel: "Case-materialen", severity: "fout", samenvatting: cmErr.message });
  } else {
    const inactRefs: string[] = [];
    let danglingCm = 0;
    for (const row of cm ?? []) {
      const a = byId.get(row.artikel_id as string);
      if (!a) danglingCm++;
      else if (!(a as { actief?: boolean }).actief) inactRefs.push(`${row.case_id?.slice(0, 8)}/${a.artikel_nummer}`);
    }
    results.push({
      id: "case_materialen-inactief",
      titel: "Opgeslagen case-materialen vs Liander-template",
      severity: danglingCm ? "fout" : inactRefs.length ? "afwijking" : "ok",
      samenvatting: danglingCm
        ? `${danglingCm} rij(en) verwijzen naar niet-bestaand artikel.`
        : inactRefs.length
          ? `${inactRefs.length} rij(en) verwijzen naar inactief artikel.`
          : `${cm?.length ?? 0} rijen — alle artikelen actief.`,
      details: inactRefs.slice(0, 8),
    });
  }

  return results;
}

export function DataKwaliteitTab() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["data-kwaliteit"],
    queryFn: runChecks,
    staleTime: 0,
  });

  const results = data ?? [];
  const fout = results.filter((r) => r.severity === "fout").length;
  const afwijking = results.filter((r) => r.severity === "afwijking").length;
  const ok = results.filter((r) => r.severity === "ok").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Datakwaliteitscontroles</h2>
          <p className="text-sm text-muted-foreground">
            Controleert referentiële integriteit tussen alle stamdata-tabellen en `artikelen`.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted disabled:opacity-50"
        >
          {isFetching ? "Bezig…" : "Opnieuw controleren"}
        </button>
      </div>

      {!isLoading && results.length > 0 && (
        <div className="flex gap-2 text-sm">
          <Badge tone="fout" count={fout} label="fout" />
          <Badge tone="afwijking" count={afwijking} label="afwijking" />
          <Badge tone="ok" count={ok} label="correct" />
        </div>
      )}

      {isLoading && <div className="text-sm text-muted-foreground">Controles uitvoeren…</div>}
      {error && <div className="text-sm text-destructive">Fout: {(error as Error).message}</div>}

      <div className="border border-border rounded-md divide-y divide-border">
        {results.map((r) => (
          <div key={r.id} className="p-3 flex gap-3">
            <SeverityDot severity={r.severity} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-sm">{r.titel}</div>
                <div className={cn("text-xs uppercase tracking-wide", toneClass(r.severity))}>
                  {r.severity === "ok" ? "correct" : r.severity}
                </div>
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">{r.samenvatting}</div>
              {r.details && r.details.length > 0 && (
                <ul className="mt-1.5 text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                  {r.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeverityDot({ severity }: { severity: Severity }) {
  return (
    <div
      className={cn(
        "w-2 h-2 mt-1.5 rounded-full shrink-0",
        severity === "fout" && "bg-destructive",
        severity === "afwijking" && "bg-amber-500",
        severity === "ok" && "bg-emerald-500",
      )}
    />
  );
}

function Badge({ tone, count, label }: { tone: Severity; count: number; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs", badgeClass(tone))}>
      <span className="font-medium">{count}</span> {label}
    </span>
  );
}

function toneClass(s: Severity) {
  if (s === "fout") return "text-destructive";
  if (s === "afwijking") return "text-amber-600";
  return "text-emerald-600";
}

function badgeClass(s: Severity) {
  if (s === "fout") return "bg-destructive/10 text-destructive";
  if (s === "afwijking") return "bg-amber-500/10 text-amber-700";
  return "bg-emerald-500/10 text-emerald-700";
}
