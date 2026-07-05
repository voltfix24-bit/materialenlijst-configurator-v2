import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ARTIKEL_REFS } from "@/lib/assortiment/impact";
import { CheckCircle2, AlertTriangle, XCircle, ExternalLink, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Audit-scherm voor automations.
 *
 * Voor elke automation-tabel controleert deze view:
 *  1. Welke artikel-kolommen bestaan er feitelijk in de database?
 *  2. Welke daarvan zijn geregistreerd in `ARTIKEL_REFS` (= worden meegenomen
 *     in impact-herberekening en zoek-en-vervang)?
 *  3. Klopt de beheer-deeplink (bestaat de aangewezen tab in de UI)?
 *  4. Hoeveel rijen zitten er in de tabel; hoeveel rijen hebben een niet-gevulde
 *     of niet-bestaande artikel-verwijzing per kolom?
 *
 * Doel: zichtbaar maken of nieuwe/hernoemde artikel-kolommen "vergeten" zijn in
 * de impact-registratie (zoals eerder gebeurd was met `perskabelschoen_artikel_id`).
 */

// Automations zoals ze in beheer.tsx onder groep "automations" geregistreerd zijn.
const AUTOMATION_TABELLEN: { tabel: string; label: string; beheerTab: string }[] = [
  { tabel: "rmu_veld_regels", label: "RMU veld regels", beheerTab: "rmu_veld_regels" },
  { tabel: "trafo_regels", label: "Trafo regels", beheerTab: "trafo_regels" },
  { tabel: "trafo_vult_kabel", label: "Trafo vult-kabel", beheerTab: "trafo_vult_kabel" },
  { tabel: "ls_rek_regels", label: "LS-rek regels", beheerTab: "lsrek_regels" },
  { tabel: "prov_regels", label: "Provisorium regels", beheerTab: "prov_regels" },
  { tabel: "ms_kabel_regels", label: "MS kabel regels", beheerTab: "ms_kabel_regels" },
];

// Bekende beheer-tabs (mirror van GROEPEN in src/routes/beheer.tsx). Als een
// deeplink hier niet in staat, klopt de registratie in ARTIKEL_REFS niet.
const BEKENDE_TABS: Record<string, Set<string>> = {
  automations: new Set([
    "rmu_veld_regels",
    "trafo_regels",
    "trafo_vult_kabel",
    "lsrek_regels",
    "prov_regels",
    "ms_kabel_regels",
  ]),
  hardware: new Set(["rmu", "ms_mof", "ls_mof", "ls_beveiliging"]),
  standaard: new Set(["standaard", "vast", "ggi"]),
  catalogus: new Set(["artikelen", "assortiment"]),
  overzicht: new Set(["overzicht", "leesbaar"]),
  kwaliteit: new Set(["datakwaliteit", "automation_audit"]),
  historie: new Set(["wijzigingen"]),
};

interface KolomStatus {
  kolom: string;
  geregistreerd: boolean; // in ARTIKEL_REFS?
  beheerTabCorrect: boolean | null; // null = niet geregistreerd
  totaal: number;
  gevuld: number;
  leeg: number;
  onbekend: number; // artikel_id die niet in artikelen-tabel staat
}

interface AutomationAudit {
  tabel: string;
  label: string;
  beheerTab: string;
  uiTabBestaat: boolean;
  aantalRijen: number;
  kolommen: KolomStatus[];
  ontbrekendeKolommen: string[]; // in DB aanwezig maar niet in ARTIKEL_REFS
  fout?: string;
}

async function loadAudit(): Promise<AutomationAudit[]> {
  // Artikel-index om onbekende verwijzingen te detecteren.
  const { data: artikelen, error: artErr } = await supabase
    .from("artikelen")
    .select("id");
  if (artErr) throw new Error(`artikelen: ${artErr.message}`);
  const bestaandeIds = new Set<string>((artikelen ?? []).map((a) => a.id as string));

  const audits: AutomationAudit[] = [];

  for (const auto of AUTOMATION_TABELLEN) {
    try {
      // Lees alles uit de tabel (deze tabellen zijn klein: enkele tientallen tot honderden rijen).
      const { data, error } = await supabase.from(auto.tabel as never).select("*");
      if (error) {
        audits.push({
          tabel: auto.tabel,
          label: auto.label,
          beheerTab: auto.beheerTab,
          uiTabBestaat: BEKENDE_TABS.automations.has(auto.beheerTab),
          aantalRijen: 0,
          kolommen: [],
          ontbrekendeKolommen: [],
          fout: error.message,
        });
        continue;
      }
      const rijen = (data ?? []) as Array<Record<string, unknown>>;

      // Detecteer alle kolommen die eruitzien als artikel-verwijzing.
      const kolomSet = new Set<string>();
      for (const r of rijen) {
        for (const k of Object.keys(r)) {
          if (k === "artikel_id" || k.endsWith("_artikel_id")) kolomSet.add(k);
        }
      }
      // Ook bekend uit ARTIKEL_REFS (voor het geval de tabel leeg is).
      for (const ref of ARTIKEL_REFS) {
        if (ref.tabel === auto.tabel) kolomSet.add(ref.kolom);
      }

      const geregistreerdeKolommen = new Set(
        ARTIKEL_REFS.filter((r) => r.tabel === auto.tabel).map((r) => r.kolom),
      );

      const kolommen: KolomStatus[] = [];
      for (const kol of [...kolomSet].sort()) {
        let gevuld = 0;
        let leeg = 0;
        let onbekend = 0;
        for (const r of rijen) {
          const v = r[kol];
          if (typeof v !== "string" || !v) {
            leeg++;
          } else {
            gevuld++;
            if (!bestaandeIds.has(v)) onbekend++;
          }
        }
        const ref = ARTIKEL_REFS.find((x) => x.tabel === auto.tabel && x.kolom === kol);
        kolommen.push({
          kolom: kol,
          geregistreerd: !!ref,
          beheerTabCorrect: ref
            ? BEKENDE_TABS[ref.beheerGroep ?? ""]?.has(ref.beheerTab ?? "") ?? false
            : null,
          totaal: rijen.length,
          gevuld,
          leeg,
          onbekend,
        });
      }

      const ontbrekend = [...kolomSet].filter((k) => !geregistreerdeKolommen.has(k));

      audits.push({
        tabel: auto.tabel,
        label: auto.label,
        beheerTab: auto.beheerTab,
        uiTabBestaat: BEKENDE_TABS.automations.has(auto.beheerTab),
        aantalRijen: rijen.length,
        kolommen,
        ontbrekendeKolommen: ontbrekend,
      });
    } catch (e) {
      audits.push({
        tabel: auto.tabel,
        label: auto.label,
        beheerTab: auto.beheerTab,
        uiTabBestaat: BEKENDE_TABS.automations.has(auto.beheerTab),
        aantalRijen: 0,
        kolommen: [],
        ontbrekendeKolommen: [],
        fout: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return audits;
}

export function AutomationAuditTab() {
  const query = useQuery({ queryKey: ["automation-audit"], queryFn: loadAudit });

  const samenvatting = useMemo(() => {
    const list = query.data ?? [];
    let ok = 0;
    let waarschuwing = 0;
    let fout = 0;
    for (const a of list) {
      if (a.fout || a.ontbrekendeKolommen.length > 0 || !a.uiTabBestaat) fout++;
      else if (a.kolommen.some((k) => !k.geregistreerd || k.onbekend > 0 || k.beheerTabCorrect === false))
        waarschuwing++;
      else ok++;
    }
    return { ok, waarschuwing, fout };
  }, [query.data]);

  if (query.isLoading) {
    return <div className="text-sm text-muted-foreground">Audit uitvoeren…</div>;
  }
  if (query.error) {
    return (
      <div className="text-sm text-destructive">
        Audit mislukt: {(query.error as Error).message}
      </div>
    );
  }

  const audits = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-surface p-3 text-xs text-muted-foreground flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
        <div>
          Deze audit controleert per automation-tabel of alle artikel-kolommen bekend zijn bij de
          impact-herberekening (<code>ARTIKEL_REFS</code>) en of de beheer-deeplink naar een
          bestaande tab wijst. Wanneer een kolom hier als “niet geregistreerd” staat, wordt hij niet
          meegenomen in zoek-en-vervang en impact-analyse — dat is de fout die eerder bij
          <code> perskabelschoen_artikel_id</code> optrad.
        </div>
      </div>

      <div className="flex gap-3 text-xs">
        <SamenvattingBadge kleur="ok" label={`${samenvatting.ok} OK`} />
        <SamenvattingBadge kleur="waarschuwing" label={`${samenvatting.waarschuwing} aandacht`} />
        <SamenvattingBadge kleur="fout" label={`${samenvatting.fout} fout`} />
      </div>

      <div className="space-y-3">
        {audits.map((a) => (
          <AutomationCard key={a.tabel} audit={a} />
        ))}
      </div>
    </div>
  );
}

function SamenvattingBadge({
  kleur,
  label,
}: {
  kleur: "ok" | "waarschuwing" | "fout";
  label: string;
}) {
  const cls =
    kleur === "ok"
      ? "bg-success/10 text-success border-success/30"
      : kleur === "waarschuwing"
        ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
        : "bg-destructive/10 text-destructive border-destructive/30";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded border px-2 py-0.5", cls)}>
      {label}
    </span>
  );
}

function AutomationCard({ audit }: { audit: AutomationAudit }) {
  const heeftFout =
    !!audit.fout || audit.ontbrekendeKolommen.length > 0 || !audit.uiTabBestaat;
  const heeftWaarschuwing = audit.kolommen.some(
    (k) => !k.geregistreerd || k.onbekend > 0 || k.beheerTabCorrect === false,
  );
  const status: "ok" | "waarschuwing" | "fout" = heeftFout
    ? "fout"
    : heeftWaarschuwing
      ? "waarschuwing"
      : "ok";

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <StatusIcon status={status} />
            <h3 className="font-medium text-sm">{audit.label}</h3>
            <span className="font-mono text-[11px] text-muted-foreground">
              {audit.tabel}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {audit.aantalRijen} rijen · beheer-tab:{" "}
            <span className="font-mono">{audit.beheerTab}</span>{" "}
            {audit.uiTabBestaat ? (
              <span className="text-success">✓ bestaat</span>
            ) : (
              <span className="text-destructive">✗ ontbreekt in UI</span>
            )}
          </p>
        </div>
        <Link
          to="/beheer"
          search={{ groep: "automations", tab: audit.beheerTab }}
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          Open tab <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {audit.fout && (
        <div className="text-xs text-destructive mb-2">Fout bij lezen: {audit.fout}</div>
      )}

      {audit.ontbrekendeKolommen.length > 0 && (
        <div className="mb-3 rounded border border-destructive/30 bg-destructive/5 p-2 text-xs">
          <div className="font-medium text-destructive mb-1">
            Kolommen in DB die niet geregistreerd zijn in impact-herberekening:
          </div>
          <ul className="list-disc list-inside space-y-0.5">
            {audit.ontbrekendeKolommen.map((k) => (
              <li key={k} className="font-mono">
                {k}
              </li>
            ))}
          </ul>
          <div className="mt-1 text-muted-foreground">
            Voeg deze toe aan <code>ARTIKEL_REFS</code> in{" "}
            <code>src/lib/assortiment/impact.ts</code>, anders slaat zoek-en-vervang ze over.
          </div>
        </div>
      )}

      {audit.kolommen.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-1.5 pr-3">Kolom</th>
                <th className="py-1.5 pr-3">Impact-registratie</th>
                <th className="py-1.5 pr-3">Beheer-deeplink</th>
                <th className="py-1.5 pr-3 text-right">Gevuld</th>
                <th className="py-1.5 pr-3 text-right">Leeg</th>
                <th className="py-1.5 pr-3 text-right">Onbekend artikel</th>
              </tr>
            </thead>
            <tbody>
              {audit.kolommen.map((k) => (
                <tr key={k.kolom} className="border-b border-border/60 last:border-0">
                  <td className="py-1.5 pr-3 font-mono">{k.kolom}</td>
                  <td className="py-1.5 pr-3">
                    {k.geregistreerd ? (
                      <span className="text-success">✓ geregistreerd</span>
                    ) : (
                      <span className="text-destructive">✗ ontbreekt</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">
                    {k.beheerTabCorrect === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : k.beheerTabCorrect ? (
                      <span className="text-success">✓ correct</span>
                    ) : (
                      <span className="text-destructive">✗ wijst nergens heen</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{k.gevuld}</td>
                  <td
                    className={cn(
                      "py-1.5 pr-3 text-right tabular-nums",
                      k.leeg > 0 && "text-amber-700",
                    )}
                  >
                    {k.leeg}
                  </td>
                  <td
                    className={cn(
                      "py-1.5 pr-3 text-right tabular-nums",
                      k.onbekend > 0 && "text-destructive font-medium",
                    )}
                  >
                    {k.onbekend}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: "ok" | "waarschuwing" | "fout" }) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === "waarschuwing")
    return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}
