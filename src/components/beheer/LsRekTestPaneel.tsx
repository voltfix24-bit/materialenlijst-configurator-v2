import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FlaskConical, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField, FormRow } from "./shared";

type Regel = {
  id: string;
  conditie_compact: boolean | null;
  conditie_renovatie: boolean | null;
  conditie_actie: string | null;
  conditie_lsrek_type: string | null;
  conditie_beveiliging_aanpassen: boolean | null;
  conditie_ov_stuurpunt: boolean | null;
  conditie_schroefpatroon: string | null;
  conditie_kva: string | null;
  artikel_id: string;
  hoeveelheid: number;
  hoeveelheid_formule: string | null;
  herkomst_label: string;
  sort_order: number;
  actief: boolean;
};

type TestInput = {
  compact: boolean;
  renovatie: boolean;
  lsRekActie: string;
  lsRekType: string;
  lsRekBeveiligingAanpassen: boolean;
  lsRekOvStuurpunt: boolean;
  lsRekSchroefpatroon: string;
  trafoKva: string;
  lsRekExtraStroken: number;
  lsRekAanSluitenKabels: number;
};

const DEFAULT: TestInput = {
  compact: false,
  renovatie: true,
  lsRekActie: "vervangen",
  lsRekType: "8",
  lsRekBeveiligingAanpassen: false,
  lsRekOvStuurpunt: false,
  lsRekSchroefpatroon: "35A",
  trafoKva: "400",
  lsRekExtraStroken: 0,
  lsRekAanSluitenKabels: 0,
};

function evalFormule(formule: string | null, fallback: number, t: TestInput): number {
  if (!formule) return fallback;
  switch (formule) {
    case "lsRekExtraStroken": return t.lsRekExtraStroken;
    case "lsRekAanSluitenKabels": return t.lsRekAanSluitenKabels;
    case "lsRekAanSluitenKabels*2": return t.lsRekAanSluitenKabels * 2;
    default: return fallback;
  }
}

function matchRegel(r: Regel, t: TestInput): boolean {
  if (!r.actief) return false;
  if (r.conditie_compact !== null && r.conditie_compact !== t.compact) return false;
  if (r.conditie_renovatie !== null && r.conditie_renovatie !== t.renovatie) return false;
  if (r.conditie_actie !== null && r.conditie_actie !== t.lsRekActie) return false;
  if (r.conditie_lsrek_type !== null && r.conditie_lsrek_type !== t.lsRekType) return false;
  if (r.conditie_beveiliging_aanpassen === true && !t.lsRekBeveiligingAanpassen) return false;
  if (r.conditie_ov_stuurpunt === true && !t.lsRekOvStuurpunt) return false;
  if (r.conditie_schroefpatroon !== null && r.conditie_schroefpatroon !== t.lsRekSchroefpatroon) return false;
  if (r.conditie_kva !== null && r.conditie_kva !== t.trafoKva) return false;
  return true;
}

const SEL = "h-9 rounded-md border border-border bg-surface px-2 text-sm";

export function LsRekTestPaneel() {
  const [open, setOpen] = useState(false);
  const [t, setT] = useState<TestInput>(DEFAULT);

  const { data: regels = [] } = useQuery({
    queryKey: ["beheer-lsrek-regels"],
    queryFn: async () => (await supabase.from("ls_rek_regels").select("*").order("sort_order")).data ?? [],
  });

  const { data: artikelen = [] } = useQuery({
    queryKey: ["artikelen-min"],
    queryFn: async () => (await supabase.from("artikelen").select("id, artikel_nummer, korte_omschrijving")).data ?? [],
  });

  const artMap = useMemo(() => {
    const m = new Map<string, { artikel_nummer: string; korte_omschrijving: string }>();
    for (const a of artikelen as any[]) m.set(a.id, { artikel_nummer: a.artikel_nummer, korte_omschrijving: a.korte_omschrijving });
    return m;
  }, [artikelen]);

  const matches = useMemo(() => {
    return (regels as Regel[])
      .filter((r) => matchRegel(r, t))
      .map((r) => ({ ...r, qty: evalFormule(r.hoeveelheid_formule, Number(r.hoeveelheid), t) }))
      .filter((r) => r.qty > 0 || r.hoeveelheid_formule === null);
  }, [regels, t]);

  const upd = <K extends keyof TestInput>(k: K, v: TestInput[K]) => setT((s) => ({ ...s, [k]: v }));

  return (
    <div className="rounded-lg border border-border bg-surface/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-surface/60 transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <FlaskConical className="h-4 w-4 text-primary" />
        Regel-testpaneel
        <span className="text-xs text-muted-foreground font-normal ml-2">
          Voer een testcase in en zie welke regels matchen + welke aantallen eruit komen.
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border">
          <FormRow>
            <FormField label="Compact">
              <select className={SEL} value={String(t.compact)} onChange={(e) => upd("compact", e.target.value === "true")}>
                <option value="false">nee</option><option value="true">ja</option>
              </select>
            </FormField>
            <FormField label="Renovatie">
              <select className={SEL} value={String(t.renovatie)} onChange={(e) => upd("renovatie", e.target.value === "true")}>
                <option value="false">nee</option><option value="true">ja</option>
              </select>
            </FormField>
            <FormField label="Bev. aanpassen">
              <select className={SEL} value={String(t.lsRekBeveiligingAanpassen)} onChange={(e) => upd("lsRekBeveiligingAanpassen", e.target.value === "true")}>
                <option value="false">nee</option><option value="true">ja</option>
              </select>
            </FormField>
            <FormField label="OV-stuurpunt">
              <select className={SEL} value={String(t.lsRekOvStuurpunt)} onChange={(e) => upd("lsRekOvStuurpunt", e.target.value === "true")}>
                <option value="false">nee</option><option value="true">ja</option>
              </select>
            </FormField>
          </FormRow>
          <FormRow>
            <FormField label="Actie">
              <select className={SEL} value={t.lsRekActie} onChange={(e) => upd("lsRekActie", e.target.value)}>
                <option value="">—</option><option value="vervangen">vervangen</option><option value="gehandhaafd">gehandhaafd</option>
              </select>
            </FormField>
            <FormField label="LS-rek type">
              <select className={SEL} value={t.lsRekType} onChange={(e) => upd("lsRekType", e.target.value)}>
                <option value="">—</option><option value="8">8</option><option value="12">12</option>
              </select>
            </FormField>
            <FormField label="Schroefpatroon">
              <select className={SEL} value={t.lsRekSchroefpatroon} onChange={(e) => upd("lsRekSchroefpatroon", e.target.value)}>
                <option value="">—</option><option value="35A">35A</option><option value="50A">50A</option>
              </select>
            </FormField>
            <FormField label="kVA">
              <select className={SEL} value={t.trafoKva} onChange={(e) => upd("trafoKva", e.target.value)}>
                <option value="">—</option><option value="250">250</option><option value="400">400</option><option value="630">630</option>
              </select>
            </FormField>
          </FormRow>
          <FormRow>
            <FormField label="Extra stroken (lsRekExtraStroken)">
              <Input type="number" min={0} value={t.lsRekExtraStroken} onChange={(e) => upd("lsRekExtraStroken", Number(e.target.value))} className="h-9" />
            </FormField>
            <FormField label="Aan te sluiten kabels (lsRekAanSluitenKabels)">
              <Input type="number" min={0} value={t.lsRekAanSluitenKabels} onChange={(e) => upd("lsRekAanSluitenKabels", Number(e.target.value))} className="h-9" />
            </FormField>
            <div className="flex items-end">
              <Button variant="outline" size="sm" onClick={() => setT(DEFAULT)}>Reset</Button>
            </div>
          </FormRow>

          <div className="rounded-md border border-border bg-background">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <span className="text-sm font-medium">Resultaat</span>
              <span className="text-xs text-muted-foreground">
                {matches.length} van {(regels as Regel[]).length} regels matchen
              </span>
            </div>
            {matches.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">Geen enkele regel matcht deze input.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground bg-surface/50">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-medium">Artikel</th>
                    <th className="text-left px-3 py-1.5 font-medium">Omschrijving</th>
                    <th className="text-left px-3 py-1.5 font-medium">Herkomst</th>
                    <th className="text-left px-3 py-1.5 font-medium">Bron</th>
                    <th className="text-right px-3 py-1.5 font-medium">Aantal</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((r) => {
                    const a = artMap.get(r.artikel_id);
                    return (
                      <tr key={r.id} className="border-t border-border">
                        <td className="px-3 py-1.5 font-mono text-xs">{a?.artikel_nummer ?? "?"}</td>
                        <td className="px-3 py-1.5 text-xs">{a?.korte_omschrijving ?? "—"}</td>
                        <td className="px-3 py-1.5 text-xs">{r.herkomst_label}</td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">
                          {r.hoeveelheid_formule ? <code>{r.hoeveelheid_formule}</code> : <span>vast</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-xs font-semibold">{r.qty}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
