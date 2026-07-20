import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Info, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDelete } from "./shared";
import { cn } from "@/lib/utils";
import { MERKEN, type Regel } from "./rmuVeldRegels/types";
import { MerkGroep } from "./rmuVeldRegels/RegelLijst";
import { RegelDialog } from "./rmuVeldRegels/RegelDialog";

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
      (await supabase.from("rmu_veld_regels").select("*").order("sort_order")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (v: Partial<Regel>) => {
      const payload: Record<string, unknown> = { ...v };
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
          .update(payload as never)
          .eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rmu_veld_regels").insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-rmuveld-regels"] });
      qc.invalidateQueries({ queryKey: ["rmu_veld_regels"] });
      toast.success("Regel opgeslagen");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rmu_veld_regels").delete().eq("id", id);
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
      (await supabase.from("artikelen").select("id,artikel_nummer,korte_omschrijving")).data ?? [],
  });
  const artMap = useMemo(() => new Map(artikelen.map((a) => [a.id, a])), [artikelen]);

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
        const vt = (a.conditie_veld_type ?? "z").localeCompare(b.conditie_veld_type ?? "z");
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
                Per veld in een RMU bepaalt het systeem automatisch welke extra artikelen op de
                bestellijst komen (eindsluitingen, buispatronen, ombouwsets, trafokabel, …). Elke
                regel zegt:{" "}
                <strong>“Als de configuratie er zó uitziet, voeg dan dit artikel toe.”</strong> Een
                regel matcht alleen als <em>elke ingevulde voorwaarde</em> klopt. Lege voorwaarden
                tellen als <em>maakt niet uit</em>.
              </p>
              <p className="text-muted-foreground">
                Verwar dit niet met <strong>RMU configuraties</strong> — die beschrijven welke
                RMU-bouwstenen er bestaan (merk, code, aantal velden, frame, bodemplaat). Veldregels
                regelen de <em>automations</em> erbovenop.
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
              {m === "alle" ? "Alle" : m === "geen" ? "Zonder merk" : m}
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
          <Button variant="ghost" size="sm" onClick={() => setShowHelp(true)} className="text-xs">
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
