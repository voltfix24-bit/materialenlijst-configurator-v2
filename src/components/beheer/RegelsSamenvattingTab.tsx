import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronRight, AlertTriangle, FileText, ExternalLink, FlaskConical, CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  voorwaardenVoor,
  zinVoor,
  formuleOfGetal,
  SECTIE_PER_TYPE,
  TYPE_LABEL,
  type RegelType,
} from "@/lib/beheer/regelSamenvatting";
import {
  TEST_VELDEN,
  defaultInputVoor,
  evalueerRegel,
  berekenTestHoeveelheid,
  type TestInput,
} from "@/lib/beheer/regelTest";

interface Artikel {
  id: string;
  artikel_nummer: string;
  korte_omschrijving: string;
  status: string | null;
  actief: boolean;
  categorie: string | null;
}

interface RegelRij {
  id: string;
  type: RegelType;
  bron_tabel: string;
  beheer_tab: string;
  artikel_id: string | null;
  herkomst_label: string | null;
  raw: Record<string, unknown>;
}

const BEHEER_TAB_PER_TYPE: Record<RegelType, string> = {
  ggi: "ggi",
  trafo: "trafo_regels",
  ls_rek: "lsrek_regels",
  prov: "prov_regels",
  ms_kabel: "ms_kabel_regels",
  rmu_veld: "rmu_veld_regels",
};

const BEHEER_GROEP_PER_TYPE: Record<RegelType, string> = {
  ggi: "standaard",
  trafo: "automations",
  ls_rek: "automations",
  prov: "automations",
  ms_kabel: "automations",
  rmu_veld: "automations",
};

async function fetchAlleRegels(): Promise<RegelRij[]> {
  const [ggi, trafo, lsr, prov, msk, rmu] = await Promise.all([
    supabase.from("ggi_artikelen").select("*").order("sort_order"),
    supabase.from("trafo_regels").select("*").order("sort_order"),
    supabase.from("ls_rek_regels").select("*").order("sort_order"),
    supabase.from("prov_regels").select("*").order("sort_order"),
    supabase.from("ms_kabel_regels").select("*").order("sort_order"),
    supabase.from("rmu_veld_regels").select("*").order("sort_order"),
  ]);
  const rows: RegelRij[] = [];
  const push = (type: RegelType, tabel: string, data: Record<string, unknown>[] | null) => {
    for (const r of data ?? []) {
      rows.push({
        id: `${tabel}:${r.id as string}`,
        type,
        bron_tabel: tabel,
        beheer_tab: BEHEER_TAB_PER_TYPE[type],
        artikel_id: (r.artikel_id as string | null) ?? null,
        herkomst_label: (r.herkomst_label as string | null) ?? null,
        raw: r,
      });
    }
  };
  push("ggi", "ggi_artikelen", ggi.data as Record<string, unknown>[] | null);
  push("trafo", "trafo_regels", trafo.data as Record<string, unknown>[] | null);
  push("ls_rek", "ls_rek_regels", lsr.data as Record<string, unknown>[] | null);
  push("prov", "prov_regels", prov.data as Record<string, unknown>[] | null);
  push("ms_kabel", "ms_kabel_regels", msk.data as Record<string, unknown>[] | null);
  push("rmu_veld", "rmu_veld_regels", rmu.data as Record<string, unknown>[] | null);
  return rows;
}

function statusBadge(a: Artikel | undefined) {
  if (!a) return { label: "Onbekend artikel", cls: "bg-destructive/15 text-destructive border-destructive/30", probleem: true };
  if (!a.actief) return { label: "Inactief / verwijderd", cls: "bg-destructive/15 text-destructive border-destructive/30", probleem: true };
  if (a.status === "Uitgelopen" || a.status === "Uitloop")
    return { label: "Uitgelopen", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30", probleem: true };
  if (a.status === "Geblokkeerd")
    return { label: "Geblokkeerd", cls: "bg-destructive/15 text-destructive border-destructive/30", probleem: true };
  return { label: "Actief", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", probleem: false };
}

type StatusFilter = "alle" | "actief" | "uitloop" | "inactief" | "probleem";

export function RegelsSamenvattingTab() {
  const { data: regels = [], isLoading } = useQuery({
    queryKey: ["beheer-regels-samenvatting"],
    queryFn: fetchAlleRegels,
  });

  const artikelIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of regels) if (r.artikel_id) s.add(r.artikel_id);
    return [...s];
  }, [regels]);

  const { data: artikelen = [] } = useQuery<Artikel[]>({
    queryKey: ["beheer-regels-samenvatting-artikelen", artikelIds],
    enabled: artikelIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("artikelen")
        .select("id, artikel_nummer, korte_omschrijving, status, actief, categorie")
        .in("id", artikelIds);
      return (data ?? []) as Artikel[];
    },
  });
  const artikelMap = useMemo(() => new Map(artikelen.map((a) => [a.id, a])), [artikelen]);

  const [zoek, setZoek] = useState("");
  const [sectie, setSectie] = useState<RegelType | "alle">("alle");
  const [status, setStatus] = useState<StatusFilter>("alle");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [testRegel, setTestRegel] = useState<RegelRij | null>(null);

  const gefilterd = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    return regels.filter((r) => {
      if (sectie !== "alle" && r.type !== sectie) return false;
      const a = r.artikel_id ? artikelMap.get(r.artikel_id) : undefined;
      const sb = statusBadge(a);
      if (status === "actief" && (sb.probleem || sb.label !== "Actief")) return false;
      if (status === "uitloop" && sb.label !== "Uitgelopen") return false;
      if (status === "inactief" && sb.label !== "Inactief / verwijderd") return false;
      if (status === "probleem" && !sb.probleem) return false;
      if (q) {
        const hay = [
          a?.artikel_nummer,
          a?.korte_omschrijving,
          r.herkomst_label,
          TYPE_LABEL[r.type],
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [regels, artikelMap, zoek, sectie, status]);

  const perSectie = useMemo(() => {
    const out: Record<RegelType, RegelRij[]> = {
      ggi: [],
      trafo: [],
      ls_rek: [],
      prov: [],
      ms_kabel: [],
      rmu_veld: [],
    };
    for (const r of gefilterd) out[r.type].push(r);
    return out;
  }, [gefilterd]);

  const toggle = (id: string) =>
    setOpen((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <FileText className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <div className="text-sm space-y-1">
            <p className="font-medium">Leesbaar overzicht van alle automation-regels</p>
            <p className="text-muted-foreground text-xs">
              Per regel zie je in mensentaal wanneer hij geldt en welk artikel op de bestellijst komt. De
              onderliggende tabellen blijven beschikbaar in de bestaande beheer-tabs voor detailbewerking.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Zoek op artikelnummer, omschrijving of label…"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          className="h-9 max-w-sm"
        />
        <select
          value={sectie}
          onChange={(e) => setSectie(e.target.value as RegelType | "alle")}
          className="h-9 text-sm rounded-md border border-border bg-background px-2"
        >
          <option value="alle">Alle secties</option>
          {(Object.keys(SECTIE_PER_TYPE) as RegelType[]).map((t) => (
            <option key={t} value={t}>
              {SECTIE_PER_TYPE[t]}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="h-9 text-sm rounded-md border border-border bg-background px-2"
        >
          <option value="alle">Alle artikelstatus</option>
          <option value="actief">Alleen actief</option>
          <option value="uitloop">Alleen uitloop</option>
          <option value="inactief">Alleen inactief / verwijderd</option>
          <option value="probleem">Probleemartikelen</option>
        </select>
        <span className="text-xs text-muted-foreground ml-auto">
          {isLoading ? "Laden…" : `${gefilterd.length} regel(s)`}
        </span>
      </div>

      {(Object.keys(SECTIE_PER_TYPE) as RegelType[]).map((type) => {
        const lijst = perSectie[type];
        if (lijst.length === 0) return null;
        return (
          <section key={type} className="rounded-lg border border-border bg-surface">
            <header className="px-4 py-2 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold">{SECTIE_PER_TYPE[type]}</h3>
              <span className="text-[11px] text-muted-foreground">
                {lijst.length} {TYPE_LABEL[type]}{lijst.length === 1 ? "" : "s"}
              </span>
            </header>
            <ul className="divide-y divide-border">
              {lijst.map((r) => {
                const a = r.artikel_id ? artikelMap.get(r.artikel_id) : undefined;
                const sb = statusBadge(a);
                const isOpen = open.has(r.id);
                const v = voorwaardenVoor(type, r.raw);
                const zin = zinVoor(
                  type,
                  r.raw,
                  a?.artikel_nummer ?? null,
                  a?.korte_omschrijving ?? null,
                );
                return (
                  <li key={r.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="text-sm leading-snug">{zin}</p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          {a ? (
                            <span className="font-mono text-muted-foreground">
                              {a.artikel_nummer}
                            </span>
                          ) : (
                            <span className="text-destructive">Geen artikel gekoppeld</span>
                          )}
                          <span className={cn("px-1.5 py-0.5 rounded-full border", sb.cls)}>
                            {sb.label}
                          </span>
                          {sb.probleem && (
                            <AlertTriangle className="h-3 w-3 text-amber-600" />
                          )}
                          {a?.categorie && (
                            <span className="text-muted-foreground">· {a.categorie}</span>
                          )}
                          {r.herkomst_label && (
                            <span className="text-muted-foreground">
                              · komt op winkelwagen-regel
                              <strong className="ml-1 text-foreground">{r.herkomst_label}</strong>
                            </span>
                          )}
                          <span className="text-muted-foreground">
                            · hoeveelheid {formuleOfGetal(r.raw)}
                          </span>
                          {(r.raw["actief"] as boolean | undefined) === false && (
                            <span className="px-1.5 py-0.5 rounded-full border bg-muted text-muted-foreground border-border">
                              Regel uit
                            </span>
                          )}
                        </div>
                      </div>
                      {TEST_VELDEN[type].length > 0 && (
                        <button
                          type="button"
                          onClick={() => setTestRegel(r)}
                          className="text-[11px] text-primary hover:underline flex items-center gap-1 shrink-0"
                          title="Open testpaneel — voert geen wijzigingen door"
                        >
                          <FlaskConical className="h-3 w-3" /> Test
                        </button>
                      )}
                      <Link
                        to="/beheer"
                        search={{
                          groep: BEHEER_GROEP_PER_TYPE[type],
                          tab: r.beheer_tab,
                          row: r.raw.id as string,
                          ...(a ? { artikel: a.artikel_nummer } : {}),
                        }}
                        className="text-[11px] text-primary hover:underline flex items-center gap-1 shrink-0"
                      >
                        Bewerken <ExternalLink className="h-3 w-3" />
                      </Link>
                      <button
                        onClick={() => toggle(r.id)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        aria-label="Technische details"
                      >
                        <ChevronRight
                          className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")}
                        />
                      </button>
                    </div>
                    {isOpen && (
                      <div className="mt-2 ml-1 rounded-md border border-border bg-surface-2 p-2 space-y-2">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                            Voorwaarden ({v.length === 0 ? "geen — geldt altijd" : v.length})
                          </p>
                          {v.length > 0 && (
                            <ul className="text-[11px] space-y-0.5">
                              {v.map((c, i) => (
                                <li key={i}>
                                  <span className="text-muted-foreground">{c.label}:</span>{" "}
                                  <span className="font-mono">{c.waarde}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                            Technische velden (tabel {r.bron_tabel})
                          </p>
                          <pre className="text-[10px] font-mono leading-tight max-h-48 overflow-auto whitespace-pre-wrap break-all">
                            {JSON.stringify(r.raw, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {!isLoading && gefilterd.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Geen regels voldoen aan de filters.
        </p>
      )}

      <TestRegelDialog
        regel={testRegel}
        artikel={testRegel?.artikel_id ? artikelMap.get(testRegel.artikel_id) : undefined}
        onClose={() => setTestRegel(null)}
      />
    </div>
  );
}

function TestRegelDialog({
  regel,
  artikel,
  onClose,
}: {
  regel: RegelRij | null;
  artikel: Artikel | undefined;
  onClose: () => void;
}) {
  const [input, setInput] = useState<TestInput>({});
  // Reset input bij wisselen van regel.
  useMemo(() => {
    if (regel) setInput(defaultInputVoor(regel.type, regel.raw));
  }, [regel?.id]);

  if (!regel) return null;
  const velden = TEST_VELDEN[regel.type];
  const result = evalueerRegel(regel.type, regel.raw, input);
  const hv = berekenTestHoeveelheid(regel.raw);
  const artikelProbleem = !artikel
    ? "Geen artikel gekoppeld."
    : !artikel.actief
      ? `Artikel ${artikel.artikel_nummer} is inactief / verwijderd.`
      : artikel.status === "Geblokkeerd"
        ? `Artikel ${artikel.artikel_nummer} is geblokkeerd.`
        : artikel.status === "Uitgelopen" || artikel.status === "Uitloop"
          ? `Artikel ${artikel.artikel_nummer} is uitgelopen — controleer of alternatief moet worden gebruikt.`
          : null;
  const hoeveelheid0 = typeof hv.waarde === "number" && hv.waarde === 0;
  const echtActief = result.matcht && !artikelProbleem && !hoeveelheid0;

  return (
    <Dialog open={!!regel} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            Regel testen — {TYPE_LABEL[regel.type]}
          </DialogTitle>
          <DialogDescription>
            Verander de voorbeeldwaarden en zie of deze regel actief zou worden.
            <strong className="ml-1 text-foreground">Niets wordt opgeslagen.</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-md border border-border bg-surface-2 p-2 text-xs">
            {zinVoor(
              regel.type,
              regel.raw,
              artikel?.artikel_nummer ?? null,
              artikel?.korte_omschrijving ?? null,
            )}
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Testinvoer
            </p>
            <div className="grid grid-cols-2 gap-2">
              {velden.map((v) => {
                const val = input[v.key];
                if (v.type === "bool") {
                  return (
                    <label key={v.key} className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={val === true}
                        onCheckedChange={(c) =>
                          setInput((p) => ({ ...p, [v.key]: c === true }))
                        }
                      />
                      {v.label}
                    </label>
                  );
                }
                if (v.opties && v.opties.length > 0) {
                  return (
                    <label key={v.key} className="text-xs space-y-0.5">
                      <span className="text-muted-foreground">{v.label}</span>
                      <select
                        value={(val as string) ?? ""}
                        onChange={(e) =>
                          setInput((p) => ({ ...p, [v.key]: e.target.value }))
                        }
                        className="w-full h-8 rounded-md border border-border bg-background px-1.5 text-xs"
                      >
                        <option value="">— leeg —</option>
                        {v.opties.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }
                return (
                  <label key={v.key} className="text-xs space-y-0.5">
                    <span className="text-muted-foreground">{v.label}</span>
                    <Input
                      value={(val as string) ?? ""}
                      onChange={(e) =>
                        setInput((p) => ({ ...p, [v.key]: e.target.value }))
                      }
                      className="h-8 text-xs"
                    />
                  </label>
                );
              })}
              {velden.length === 0 && (
                <p className="col-span-2 text-xs text-muted-foreground">
                  Deze regel heeft geen voorwaarden — hij is altijd actief.
                </p>
              )}
            </div>
          </div>

          <div
            className={cn(
              "rounded-md border p-3 space-y-2 text-xs",
              echtActief
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-amber-500/30 bg-amber-500/10",
            )}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              {echtActief ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Regel wordt actief
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-amber-600" />
                  Regel wordt NIET actief
                </>
              )}
            </div>
            {echtActief && artikel && (
              <ul className="space-y-0.5">
                <li>
                  Artikel: <span className="font-mono">{artikel.artikel_nummer}</span> — {artikel.korte_omschrijving}
                </li>
                <li>Hoeveelheid: {String(hv.waarde)}</li>
                {hv.toelichting && (
                  <li className="text-muted-foreground">{hv.toelichting}</li>
                )}
                {artikel.categorie && <li>Categorie: {artikel.categorie}</li>}
                {regel.herkomst_label && (
                  <li>
                    Verschijnt in winkelwagen onder herkomst <strong>{regel.herkomst_label}</strong>
                  </li>
                )}
                <li className="text-muted-foreground">Sectie: {SECTIE_PER_TYPE[regel.type]}</li>
              </ul>
            )}
            {!echtActief && (
              <ul className="space-y-0.5 list-disc list-inside">
                {result.redenen.map((r, i) => (
                  <li key={`m-${i}`}>{r}</li>
                ))}
                {artikelProbleem && <li>{artikelProbleem}</li>}
                {hoeveelheid0 && <li>Hoeveelheid is 0 — niets wordt toegevoegd.</li>}
              </ul>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground">
            Deze evaluator spiegelt de voorwaarden-matching van de berekenmodule en past geen
            case- of winkelwagen-data aan.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
