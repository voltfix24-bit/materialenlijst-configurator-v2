import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Info,
  ChevronDown,
  Settings2,
  Zap,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDelete, FormDialog, FormField, FormRow } from "./shared";
import { ArtikelZoeker } from "./ArtikelZoeker";
import { ArtikelLabel } from "./RmuTab";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ──────────────────────────────────────────────────────────────
//  Types & opties
// ──────────────────────────────────────────────────────────────

type Regel = {
  id: string;
  conditie_merk: string | null;
  conditie_is_inet: boolean | null;
  conditie_veld_type: string | null;
  conditie_veld_nummer_is_1: boolean | null;
  conditie_is_reserve: boolean | null;
  conditie_kabel_type: string | null;
  conditie_kva: string | null;
  conditie_trafo_kabel_lengte: string | null;
  conditie_aantal_kv_min: number | null;
  conditie_aantal_kv_max: number | null;
  artikel_id: string;
  hoeveelheid: number;
  herkomst_label: string;
  sectie: string;
  sort_order: number;
  actief: boolean;
};

const MERKEN = ["Magnefix", "ABB", "Siemens"] as const;
const VELD_TYPES: { v: string; label: string }[] = [
  { v: "F", label: "F-veld (trafo / aftak)" },
  { v: "C", label: "C-veld (kabelaftak met scheider)" },
  { v: "V", label: "V-veld (kabelaftak met vermogensschakelaar)" },
];
const KABEL_TYPES = ["240AL", "630AL"];
const KVAS = ["250", "400", "630"];
const KABEL_LENGTES = ["7.25", "10"];

// ──────────────────────────────────────────────────────────────
//  Hulpcomponenten
// ──────────────────────────────────────────────────────────────

function JaNeeAlle({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const opts: { v: boolean | null; label: string }[] = [
    { v: null, label: "Maakt niet uit" },
    { v: true, label: "Ja" },
    { v: false, label: "Nee" },
  ];
  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden">
      {opts.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "px-3 h-9 text-xs transition-colors",
            value === o.v
              ? "bg-primary text-primary-foreground"
              : "bg-surface hover:bg-accent text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Selectje({
  value,
  onChange,
  options,
  alleLabel = "Alle",
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: string[];
  alleLabel?: string;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
    >
      <option value="">— {alleLabel} —</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/** Zet condities om in een vlot leesbare zin. */
function regelZin(r: Regel): { wanneer: string[]; dan: string } {
  const wanneer: string[] = [];
  if (r.conditie_veld_type)
    wanneer.push(`veldtype = ${r.conditie_veld_type}`);
  if (r.conditie_kabel_type)
    wanneer.push(`kabel = ${r.conditie_kabel_type}`);
  if (r.conditie_kva) wanneer.push(`trafo = ${r.conditie_kva} kVA`);
  if (r.conditie_trafo_kabel_lengte)
    wanneer.push(`trafokabel = ${r.conditie_trafo_kabel_lengte} m`);
  if (r.conditie_is_inet !== null)
    wanneer.push(r.conditie_is_inet ? "I-Net uitvoering" : "geen I-Net");
  if (r.conditie_veld_nummer_is_1 === true)
    wanneer.push("alleen 1e veld");
  if (r.conditie_is_reserve !== null)
    wanneer.push(r.conditie_is_reserve ? "reserve-veld" : "geen reserve");
  if (r.conditie_aantal_kv_min !== null || r.conditie_aantal_kv_max !== null) {
    const min = r.conditie_aantal_kv_min ?? "?";
    const max = r.conditie_aantal_kv_max ?? "?";
    wanneer.push(`aantal C+V velden ${min}–${max}`);
  }
  const dan = `+ ${r.hoeveelheid}× artikel`;
  return { wanneer, dan };
}

// ──────────────────────────────────────────────────────────────
//  Main tab
// ──────────────────────────────────────────────────────────────

export function RmuVeldRegelsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Regel> | null>(null);
  const [toDelete, setToDelete] = useState<Regel | null>(null);
  const [merkFilter, setMerkFilter] = useState<string>("alle");
  const [zoek, setZoek] = useState("");
  const [showHelp, setShowHelp] = useState(true);

  const { data = [] } = useQuery({
    queryKey: ["beheer-rmuveld-regels"],
    queryFn: async () =>
      (await supabase
        .from("rmu_veld_regels")
        .select("*")
        .order("sort_order")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (v: Partial<Regel>) => {
      const payload: any = { ...v };
      for (const k of [
        "conditie_merk",
        "conditie_veld_type",
        "conditie_kabel_type",
        "conditie_kva",
        "conditie_trafo_kabel_lengte",
      ] as const) {
        if (payload[k] === "") payload[k] = null;
      }
      if (v.id) {
        const { error } = await supabase
          .from("rmu_veld_regels")
          .update(payload)
          .eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rmu_veld_regels").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-rmuveld-regels"] });
      qc.invalidateQueries({ queryKey: ["rmu_veld_regels"] });
      toast.success("Regel opgeslagen");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("rmu_veld_regels")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-rmuveld-regels"] });
      qc.invalidateQueries({ queryKey: ["rmu_veld_regels"] });
      toast.success("Verwijderd");
      setToDelete(null);
    },
  });

  // Artikel lookup voor zoeken
  const { data: artikelen = [] } = useQuery({
    queryKey: ["beheer-artikelen-min"],
    queryFn: async () =>
      (await supabase
        .from("artikelen")
        .select("id,artikel_nummer,korte_omschrijving")).data ?? [],
  });
  const artMap = useMemo(
    () => new Map(artikelen.map((a) => [a.id, a])),
    [artikelen],
  );

  const filtered = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    return (data as Regel[]).filter((r) => {
      if (merkFilter !== "alle" && r.conditie_merk !== merkFilter) {
        // 'alle' = ook regels zonder merk; merkfilter geselecteerd = alleen dat merk
        if (!(merkFilter === "geen" && r.conditie_merk === null)) return false;
      }
      if (!q) return true;
      const a = artMap.get(r.artikel_id);
      const hay = [
        r.herkomst_label,
        r.conditie_veld_type,
        r.conditie_kabel_type,
        r.conditie_kva,
        a?.artikel_nummer,
        a?.korte_omschrijving,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data, merkFilter, zoek, artMap]);

  const gegroepeerd = useMemo(() => {
    const groups = new Map<string, Regel[]>();
    for (const r of filtered) {
      const key = r.conditie_merk ?? "Alle merken";
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }
    // Sorteer per groep op veldtype + sort_order
    for (const arr of groups.values()) {
      arr.sort((a, b) => {
        const vt = (a.conditie_veld_type ?? "z").localeCompare(
          b.conditie_veld_type ?? "z",
        );
        if (vt !== 0) return vt;
        return a.sort_order - b.sort_order;
      });
    }
    return groups;
  }, [filtered]);

  const startNew = () => {
    setEditing({
      hoeveelheid: 1,
      sort_order: (data as Regel[]).length,
      actief: true,
      herkomst_label: "RMU",
      sectie: "rmu",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Uitleg */}
      {showHelp && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <div className="text-sm space-y-2 flex-1">
              <p className="font-medium">Wat zijn RMU veld regels?</p>
              <p className="text-muted-foreground">
                Per veld in een RMU bepaalt het systeem automatisch welke
                extra artikelen op de bestellijst komen (eindsluitingen,
                buispatronen, ombouwsets, trafokabel, …). Elke regel zegt:{" "}
                <strong>“Als de configuratie er zó uitziet, voeg dan dit
                artikel toe.”</strong> Een regel matcht alleen als{" "}
                <em>elke ingevulde voorwaarde</em> klopt. Lege voorwaarden
                tellen als <em>maakt niet uit</em>.
              </p>
              <p className="text-muted-foreground">
                Verwar dit niet met{" "}
                <strong>RMU configuraties</strong> — die beschrijven welke
                RMU-bouwstenen er bestaan (merk, code, aantal velden, frame,
                bodemplaat). Veldregels regelen de <em>automations</em>
                erbovenop.
              </p>
              <button
                onClick={() => setShowHelp(false)}
                className="text-xs text-primary hover:underline"
              >
                Verberg uitleg
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-md border border-border p-1">
          {["alle", ...MERKEN, "geen"].map((m) => (
            <button
              key={m}
              onClick={() => setMerkFilter(m)}
              className={cn(
                "px-3 h-7 text-xs rounded transition-colors",
                merkFilter === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              {m === "alle"
                ? "Alle"
                : m === "geen"
                  ? "Zonder merk"
                  : m}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Zoek op label, artikel of conditie…"
            className="h-9 pl-8"
          />
        </div>
        {!showHelp && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHelp(true)}
            className="text-xs"
          >
            <Info className="h-3.5 w-3.5 mr-1" /> Uitleg
          </Button>
        )}
        <Button onClick={startNew}>
          <Plus className="h-4 w-4 mr-1" /> Nieuwe regel
        </Button>
      </div>

      {/* Groepen */}
      {gegroepeerd.size === 0 && (
        <div className="rounded-lg border border-border bg-surface p-12 text-center text-sm text-muted-foreground">
          Geen regels gevonden.
        </div>
      )}
      <div className="space-y-3">
        {Array.from(gegroepeerd.entries()).map(([merk, regels]) => (
          <MerkGroep
            key={merk}
            merk={merk}
            regels={regels}
            artMap={artMap}
            onEdit={(r) => {
              setEditing(r);
              setOpen(true);
            }}
            onDelete={(r) => setToDelete(r)}
          />
        ))}
      </div>

      <RegelDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        setEditing={setEditing}
        onSave={() => editing && save.mutate(editing)}
        saving={save.isPending}
      />
      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
        title="Regel verwijderen?"
        description="De regel wordt niet meer toegepast op cases. Deze actie kan niet ongedaan worden gemaakt."
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
//  Merk-groep
// ──────────────────────────────────────────────────────────────

function MerkGroep({
  merk,
  regels,
  artMap,
  onEdit,
  onDelete,
}: {
  merk: string;
  regels: Regel[];
  artMap: Map<string, { artikel_nummer: string; korte_omschrijving: string }>;
  onEdit: (r: Regel) => void;
  onDelete: (r: Regel) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 hover:bg-accent/40">
          <div className="flex items-center gap-3">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">{merk}</span>
            <span className="text-xs text-muted-foreground">
              {regels.length} regel{regels.length === 1 ? "" : "s"}
            </span>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="divide-y divide-border">
            {regels.map((r) => (
              <RegelRij
                key={r.id}
                regel={r}
                artikel={artMap.get(r.artikel_id)}
                onEdit={() => onEdit(r)}
                onDelete={() => onDelete(r)}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function RegelRij({
  regel,
  artikel,
  onEdit,
  onDelete,
}: {
  regel: Regel;
  artikel?: { artikel_nummer: string; korte_omschrijving: string };
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { wanneer } = regelZin(regel);
  return (
    <div
      className={cn(
        "px-4 py-3 flex items-start gap-4 hover:bg-accent/30",
        !regel.actief && "opacity-50",
      )}
    >
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase font-mono text-muted-foreground">
            Als
          </span>
          {wanneer.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">
              altijd (geen voorwaarden)
            </span>
          ) : (
            wanneer.map((w, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded bg-surface-2 border border-border text-xs"
              >
                {w}
              </span>
            ))
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase font-mono text-muted-foreground">
            Dan
          </span>
          <span className="px-2 py-0.5 rounded bg-primary/10 border border-primary/30 text-xs font-medium">
            + {regel.hoeveelheid}×
          </span>
          {artikel ? (
            <span className="text-sm">
              <span className="font-mono text-xs text-muted-foreground">
                {artikel.artikel_nummer}
              </span>{" "}
              {artikel.korte_omschrijving}
            </span>
          ) : (
            <span className="text-xs text-destructive">⚠ artikel ontbreekt</span>
          )}
          <span
            className={cn(
              "ml-auto px-2 py-0.5 rounded text-[10px] font-mono uppercase",
              regel.sectie === "trafo"
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : "bg-blue-500/10 text-blue-700 dark:text-blue-300",
            )}
          >
            {regel.sectie}
          </span>
          {!regel.actief && (
            <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-mono uppercase">
              inactief
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">
          Label: <span className="font-mono">{regel.herkomst_label}</span>
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
//  Dialog: stap-voor-stap regel bouwen
// ──────────────────────────────────────────────────────────────

function RegelDialog({
  open,
  onOpenChange,
  editing,
  setEditing,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Partial<Regel> | null;
  setEditing: (r: Partial<Regel> | null) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const set = (p: Partial<Regel>) =>
    editing && setEditing({ ...editing, ...p });
  const [adv, setAdv] = useState(false);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing?.id ? "Regel bewerken" : "Nieuwe regel"}
      size="lg"
    >
      {editing && (
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {/* STAP 1: WANNEER */}
          <section className="space-y-3">
            <header className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold">
                1
              </span>
              <h3 className="text-sm font-semibold">Wanneer geldt deze regel?</h3>
            </header>
            <p className="text-xs text-muted-foreground pl-8">
              Vul alleen in waar de regel op moet matchen. Lege velden =
              <em> maakt niet uit</em>.
            </p>

            <div className="pl-8 space-y-4">
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Hardware
                </h4>
                <FormRow>
                  <FormField label="Merk">
                    <Selectje
                      value={editing.conditie_merk ?? null}
                      onChange={(v) => set({ conditie_merk: v })}
                      options={[...MERKEN]}
                      alleLabel="Alle merken"
                    />
                  </FormField>
                  <FormField label="I-Net uitvoering?">
                    <JaNeeAlle
                      value={editing.conditie_is_inet ?? null}
                      onChange={(v) => set({ conditie_is_inet: v })}
                    />
                  </FormField>
                </FormRow>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Veld
                </h4>
                <FormField label="Veldtype">
                  <select
                    value={editing.conditie_veld_type ?? ""}
                    onChange={(e) =>
                      set({ conditie_veld_type: e.target.value || null })
                    }
                    className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
                  >
                    <option value="">— Alle veldtypes —</option>
                    {VELD_TYPES.map((v) => (
                      <option key={v.v} value={v.v}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormRow>
                  <FormField label="Alleen toepassen op 1e veld?">
                    <JaNeeAlle
                      value={editing.conditie_veld_nummer_is_1 ?? null}
                      onChange={(v) => set({ conditie_veld_nummer_is_1: v })}
                    />
                  </FormField>
                  <FormField label="Reserve-veld?">
                    <JaNeeAlle
                      value={editing.conditie_is_reserve ?? null}
                      onChange={(v) => set({ conditie_is_reserve: v })}
                    />
                  </FormField>
                </FormRow>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Configuratie
                </h4>
                <FormRow cols={3}>
                  <FormField label="Kabeltype">
                    <Selectje
                      value={editing.conditie_kabel_type ?? null}
                      onChange={(v) => set({ conditie_kabel_type: v })}
                      options={KABEL_TYPES}
                    />
                  </FormField>
                  <FormField label="Trafo kVA">
                    <Selectje
                      value={editing.conditie_kva ?? null}
                      onChange={(v) => set({ conditie_kva: v })}
                      options={KVAS}
                    />
                  </FormField>
                  <FormField label="Trafokabel lengte (m)">
                    <Selectje
                      value={editing.conditie_trafo_kabel_lengte ?? null}
                      onChange={(v) => set({ conditie_trafo_kabel_lengte: v })}
                      options={KABEL_LENGTES}
                    />
                  </FormField>
                </FormRow>
              </div>

              {/* Geavanceerd */}
              <Collapsible open={adv} onOpenChange={setAdv}>
                <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                  <Settings2 className="h-3.5 w-3.5" />
                  Geavanceerd: aantal C+V velden
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      adv && "rotate-180",
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    Voor regels die afhangen van hoeveel C+V velden de RMU
                    heeft (bv. Magnefix doos-keuze). Laat leeg om altijd te
                    matchen.
                  </p>
                  <FormRow>
                    <FormField label="Min. aantal C+V velden">
                      <Input
                        type="number"
                        value={editing.conditie_aantal_kv_min ?? ""}
                        onChange={(e) =>
                          set({
                            conditie_aantal_kv_min:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                        className="h-9"
                      />
                    </FormField>
                    <FormField label="Max. aantal C+V velden">
                      <Input
                        type="number"
                        value={editing.conditie_aantal_kv_max ?? ""}
                        onChange={(e) =>
                          set({
                            conditie_aantal_kv_max:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                        className="h-9"
                      />
                    </FormField>
                  </FormRow>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </section>

          {/* STAP 2: WAT */}
          <section className="space-y-3">
            <header className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold">
                2
              </span>
              <h3 className="text-sm font-semibold">
                Welk artikel komt erbij?
              </h3>
            </header>
            <div className="pl-8 space-y-3">
              <FormField label="Artikel" required>
                <ArtikelZoeker
                  value={editing.artikel_id ?? null}
                  onChange={(id) => set({ artikel_id: id ?? undefined })}
                  categorieSuggesties={["RMU", "Trafo"]}
                />
              </FormField>
              <FormRow>
                <FormField label="Aantal per veld">
                  <Input
                    type="number"
                    value={editing.hoeveelheid ?? 1}
                    onChange={(e) =>
                      set({ hoeveelheid: Number(e.target.value) })
                    }
                    className="h-9"
                  />
                </FormField>
                <FormField label="Sectie in winkelwagen">
                  <select
                    value={editing.sectie ?? "rmu"}
                    onChange={(e) => set({ sectie: e.target.value })}
                    className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
                  >
                    <option value="rmu">RMU</option>
                    <option value="trafo">Trafo</option>
                  </select>
                </FormField>
              </FormRow>
            </div>
          </section>

          {/* STAP 3: DETAILS */}
          <section className="space-y-3">
            <header className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold">
                3
              </span>
              <h3 className="text-sm font-semibold">Labels &amp; status</h3>
            </header>
            <div className="pl-8 space-y-3">
              <FormField
                label="Herkomst label"
                hint="Wordt getoond bij het artikel in de winkelwagen. {veldNummer} wordt automatisch vervangen."
              >
                <Input
                  value={editing.herkomst_label ?? ""}
                  onChange={(e) => set({ herkomst_label: e.target.value })}
                  className="h-9"
                />
              </FormField>
              <FormRow>
                <FormField label="Volgorde">
                  <Input
                    type="number"
                    value={editing.sort_order ?? 0}
                    onChange={(e) =>
                      set({ sort_order: Number(e.target.value) })
                    }
                    className="h-9"
                  />
                </FormField>
                <FormField label="Status">
                  <label className="flex items-center gap-2 text-sm h-9">
                    <input
                      type="checkbox"
                      checked={editing.actief ?? true}
                      onChange={(e) => set({ actief: e.target.checked })}
                    />
                    Actief (regel wordt toegepast)
                  </label>
                </FormField>
              </FormRow>
            </div>
          </section>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Annuleren
            </Button>
            <Button
              onClick={onSave}
              disabled={
                saving || !editing.artikel_id || !editing.herkomst_label
              }
            >
              {saving ? "Opslaan…" : "Regel opslaan"}
            </Button>
          </div>
        </div>
      )}
    </FormDialog>
  );
}
