import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, ClipboardList, Anchor, Plug, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDelete, DataTable, FormDialog, FormField, FormRow, RowActions } from "./shared";
import { ArtikelZoeker } from "./ArtikelZoeker";
import { ArtikelLabel } from "./RmuTab";

const CASE_TYPES = ["NSA", "provisorium", "compact", "compact_prov"];
const SUBTYPES = ["cs_zonder_prov", "cs_met_prov", "renovatie_prov", "renovatie_nsa"];
const KVAS = [250, 400, 630, 1000];

// === Standaard materialen ===

type Stand = { id: string; case_type: string; artikel_id: string; standaard_hoeveelheid: number };

export function StandaardMaterialenTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Stand> | null>(null);
  const [toDelete, setToDelete] = useState<Stand | null>(null);
  const [filterCaseType, setFilterCaseType] = useState<string>("alle");

  const { data = [] } = useQuery({
    queryKey: ["beheer-standaard"],
    queryFn: async () => (await supabase.from("standaard_materialen_templates").select("*").order("case_type")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (v: Partial<Stand>) => {
      if (v.id) {
        const { error } = await supabase.from("standaard_materialen_templates").update(v).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("standaard_materialen_templates").insert(v as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-standaard"] });
      toast.success("Opgeslagen");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("standaard_materialen_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-standaard"] });
      toast.success("Verwijderd");
      setToDelete(null);
    },
  });

  const alle = data as Stand[];
  const gefilterd = filterCaseType === "alle" ? alle : alle.filter((s) => s.case_type === filterCaseType);
  const teller = (ct: string) => alle.filter((s) => s.case_type === ct).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-muted-foreground mr-1">Filter case type:</span>
          {(["alle", ...CASE_TYPES] as const).map((ct) => {
            const actief = filterCaseType === ct;
            const label = ct === "alle" ? `Alle (${alle.length})` : `${ct} (${teller(ct)})`;
            return (
              <button
                key={ct}
                onClick={() => setFilterCaseType(ct)}
                className={
                  "rounded-md border px-2.5 py-1 text-xs transition-colors " +
                  (actief
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-surface text-muted-foreground hover:bg-accent/40")
                }
              >
                {label}
              </button>
            );
          })}
        </div>
        <Button onClick={() => { setEditing({ case_type: filterCaseType === "alle" ? "NSA" : filterCaseType, standaard_hoeveelheid: 1 }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Standaard materiaal toevoegen
        </Button>
      </div>
      <DataTable
        headers={["Case type", "Artikel", "Hoeveelheid", ""]}
        rows={gefilterd.map((s) => [
          s.case_type,
          <ArtikelLabel id={s.artikel_id} />,
          s.standaard_hoeveelheid,
          <RowActions onEdit={() => { setEditing(s); setOpen(true); }} onDelete={() => setToDelete(s)} />,
        ])}
        emptyIcon={ClipboardList}
        emptyMessage={filterCaseType === "alle" ? "Nog geen standaard materialen" : `Geen standaard materialen voor ${filterCaseType}`}
        emptyDescription="Materialen die altijd op de bestellijst komen, ongeacht configuratie."
        emptyAction={
          <Button onClick={() => { setEditing({ case_type: filterCaseType === "alle" ? "NSA" : filterCaseType, standaard_hoeveelheid: 1 }); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Eerste standaard materiaal
          </Button>
        }
      />

      <FormDialog open={open} onOpenChange={setOpen} title={editing?.id ? "Standaard materiaal bewerken" : "Standaard materiaal toevoegen"}>
        {editing && (
          <div className="space-y-3">
            <FormField label="Case type" required>
              <select value={editing.case_type ?? "NSA"} onChange={(e) => setEditing({ ...editing, case_type: e.target.value })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
                {CASE_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Artikel" required>
              <ArtikelZoeker value={editing.artikel_id ?? null} onChange={(id) => setEditing({ ...editing, artikel_id: id ?? undefined })} categorieSuggesties={["MS garnituren", "LS garnituren", "MRO algemeen", "MS voedingsstations"]} />
            </FormField>
            <FormField label="Standaard hoeveelheid">
              <Input type="number" value={editing.standaard_hoeveelheid ?? 1} onChange={(e) => setEditing({ ...editing, standaard_hoeveelheid: Number(e.target.value) })} className="h-9" />
            </FormField>
            <div className="flex justify-end pt-2">
              <Button onClick={() => save.mutate(editing)} disabled={save.isPending || !editing.artikel_id}>
                {save.isPending ? "Opslaan..." : "Opslaan"}
              </Button>
            </div>
          </div>
        )}
      </FormDialog>
      <ConfirmDelete open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} onConfirm={() => toDelete && del.mutate(toDelete.id)} />
    </div>
  );
}

// === Vaste artikelen per subtype ===

type Vast = {
  id: string;
  groep: string | null;
  van_toepassing_bij: string[];
  artikel_id: string;
  hoeveelheid: number;
  actief: boolean;
};

export function VasteArtikelenTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Vast> | null>(null);
  const [toDelete, setToDelete] = useState<Vast | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["beheer-vast"],
    queryFn: async () => (await supabase.from("station_vaste_artikelen").select("*").order("groep")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (v: Partial<Vast>) => {
      if (v.id) {
        const { error } = await supabase.from("station_vaste_artikelen").update(v).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("station_vaste_artikelen").insert(v as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-vast"] });
      toast.success("Opgeslagen");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("station_vaste_artikelen").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-vast"] });
      toast.success("Verwijderd");
      setToDelete(null);
    },
  });

  const toggleSubtype = (s: string) => {
    if (!editing) return;
    const cur = editing.van_toepassing_bij ?? [];
    setEditing({ ...editing, van_toepassing_bij: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing({ van_toepassing_bij: [], hoeveelheid: 1, actief: true }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Vast artikel toevoegen
        </Button>
      </div>
      <DataTable
        headers={["Groep", "Van toepassing bij", "Artikel", "Hoeveelheid", "Actief", ""]}
        rows={(data as Vast[]).map((v) => [
          v.groep ?? "—",
          <div className="flex flex-wrap gap-1">
            {(v.van_toepassing_bij ?? []).map((s) => (
              <span key={s} className="inline-block rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono">{s}</span>
            ))}
          </div>,
          <ArtikelLabel id={v.artikel_id} />,
          v.hoeveelheid,
          v.actief ? "Ja" : "Nee",
          <RowActions onEdit={() => { setEditing(v); setOpen(true); }} onDelete={() => setToDelete(v)} />,
        ])}
        emptyIcon={Anchor}
        emptyMessage="Nog geen vaste artikelen"
        emptyDescription="Configureer station-vaste artikelen per case type."
        emptyAction={
          <Button onClick={() => { setEditing({ van_toepassing_bij: [], hoeveelheid: 1, actief: true }); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Eerste vast artikel
          </Button>
        }
      />
      <FormDialog open={open} onOpenChange={setOpen} title={editing?.id ? "Vast artikel bewerken" : "Vast artikel toevoegen"} size="lg">
        {editing && (
          <div className="space-y-3">
            <FormField label="Groep">
              <Input value={editing.groep ?? ""} onChange={(e) => setEditing({ ...editing, groep: e.target.value || null })} className="h-9" />
            </FormField>
            <FormField label="Van toepassing bij" required>
              <div className="flex flex-wrap gap-2">
                {SUBTYPES.map((s) => (
                  <label key={s} className="flex items-center gap-1.5 text-xs rounded-md border border-border bg-surface px-2 py-1">
                    <input type="checkbox" checked={(editing.van_toepassing_bij ?? []).includes(s)} onChange={() => toggleSubtype(s)} />
                    {s}
                  </label>
                ))}
              </div>
            </FormField>
            <FormField label="Artikel" required>
              <ArtikelZoeker value={editing.artikel_id ?? null} onChange={(id) => setEditing({ ...editing, artikel_id: id ?? undefined })} categorieSuggesties={["MS garnituren", "LS garnituren", "MS beveiliging", "Bevestigingsmiddelen"]} />
            </FormField>
            <FormRow>
              <FormField label="Hoeveelheid">
                <Input type="number" value={editing.hoeveelheid ?? 1} onChange={(e) => setEditing({ ...editing, hoeveelheid: Number(e.target.value) })} className="h-9" />
              </FormField>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editing.actief ?? true} onChange={(e) => setEditing({ ...editing, actief: e.target.checked })} />
                  Actief
                </label>
              </div>
            </FormRow>
            <div className="flex justify-end pt-2">
              <Button onClick={() => save.mutate(editing)} disabled={save.isPending || !editing.artikel_id || !(editing.van_toepassing_bij ?? []).length}>
                {save.isPending ? "Opslaan..." : "Opslaan"}
              </Button>
            </div>
          </div>
        )}
      </FormDialog>
      <ConfirmDelete open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} onConfirm={() => toDelete && del.mutate(toDelete.id)} />
    </div>
  );
}

// === Trafo vult kabel ===

type TrafoKabel = {
  id: string;
  trafo_kva: number;
  aantal_kabels: number;
  kabel_doorsnede: number;
  aantal_perskabelschoenen: number;
  kabel_artikel_id: string | null;
  perskabelschoen_artikel_id: string | null;
  muurbeugel_artikel_id: string | null;
  omschrijving: string | null;
  actief: boolean;
  sort_order: number;
};

export function TrafoVultKabelTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<TrafoKabel> | null>(null);
  const [toDelete, setToDelete] = useState<TrafoKabel | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["beheer-trafo-kabel"],
    queryFn: async () => (await supabase.from("trafo_vult_kabel").select("*").order("trafo_kva")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (v: Partial<TrafoKabel>) => {
      if (v.id) {
        const { error } = await supabase.from("trafo_vult_kabel").update(v).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("trafo_vult_kabel").insert(v as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-trafo-kabel"] });
      toast.success("Opgeslagen");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trafo_vult_kabel").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-trafo-kabel"] });
      toast.success("Verwijderd");
      setToDelete(null);
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing({ trafo_kva: 400, aantal_kabels: 4, kabel_doorsnede: 300, aantal_perskabelschoenen: 8 }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Trafo vult kabel toevoegen
        </Button>
      </div>
      <DataTable
        headers={["kVA", "Aantal kabels", "Doorsnede", "Kabel", "# Pers", "Perskabelschoen", "Muurbeugel", "Omschrijving", ""]}
        rows={(data as TrafoKabel[]).map((t) => [
          t.trafo_kva,
          t.aantal_kabels,
          t.kabel_doorsnede,
          <ArtikelLabel id={t.kabel_artikel_id} />,
          t.aantal_perskabelschoenen,
          <ArtikelLabel id={t.perskabelschoen_artikel_id} />,
          <ArtikelLabel id={t.muurbeugel_artikel_id} />,
          t.omschrijving ?? "",
          <RowActions onEdit={() => { setEditing(t); setOpen(true); }} onDelete={() => setToDelete(t)} />,
        ])}
        emptyIcon={Plug}
        emptyMessage="Nog geen trafo vult kabel configuraties"
        emptyDescription="Voeg kabelspecs toe per trafo type."
        emptyAction={
          <Button onClick={() => { setEditing({ trafo_kva: 400, aantal_kabels: 4, kabel_doorsnede: 300, aantal_perskabelschoenen: 8 }); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Eerste configuratie
          </Button>
        }
      />
      <FormDialog open={open} onOpenChange={setOpen} title={editing?.id ? "Trafo vult kabel bewerken" : "Trafo vult kabel toevoegen"}>
        {editing && (
          <div className="space-y-3">
            <FormField label="Trafo kVA" required>
              <select value={editing.trafo_kva ?? 400} onChange={(e) => setEditing({ ...editing, trafo_kva: Number(e.target.value) })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
                {KVAS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </FormField>
            <FormRow>
              <FormField label="Aantal kabels">
                <Input type="number" value={editing.aantal_kabels ?? 1} onChange={(e) => setEditing({ ...editing, aantal_kabels: Number(e.target.value) })} className="h-9" />
              </FormField>
              <FormField label="Kabel doorsnede (mm²)">
                <Input type="number" value={editing.kabel_doorsnede ?? 150} onChange={(e) => setEditing({ ...editing, kabel_doorsnede: Number(e.target.value) })} className="h-9" />
              </FormField>
            </FormRow>
            <FormField label="Aantal perskabelschoenen">
              <Input type="number" value={editing.aantal_perskabelschoenen ?? 6} onChange={(e) => setEditing({ ...editing, aantal_perskabelschoenen: Number(e.target.value) })} className="h-9" />
            </FormField>
            <FormField label="Kabel artikel">
              <ArtikelZoeker value={editing.kabel_artikel_id ?? null} onChange={(id) => setEditing({ ...editing, kabel_artikel_id: id })} categorieSuggesties={["LS kabels"]} />
            </FormField>
            <FormField label="Perskabelschoen artikel">
              <ArtikelZoeker value={editing.perskabelschoen_artikel_id ?? null} onChange={(id) => setEditing({ ...editing, perskabelschoen_artikel_id: id })} categorieSuggesties={["MS garnituren"]} />
            </FormField>
            <FormField label="Muurbeugel artikel">
              <ArtikelZoeker value={editing.muurbeugel_artikel_id ?? null} onChange={(id) => setEditing({ ...editing, muurbeugel_artikel_id: id })} categorieSuggesties={["Bevestiging"]} />
            </FormField>
            <FormField label="Omschrijving (vrij)">
              <Input value={editing.omschrijving ?? ""} onChange={(e) => setEditing({ ...editing, omschrijving: e.target.value })} className="h-9" />
            </FormField>
            <div className="flex justify-end pt-2">
              <Button onClick={() => save.mutate(editing)} disabled={save.isPending}>
                {save.isPending ? "Opslaan..." : "Opslaan"}
              </Button>
            </div>
          </div>
        )}
      </FormDialog>
      <ConfirmDelete open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} onConfirm={() => toDelete && del.mutate(toDelete.id)} />
    </div>
  );
}

// === LS beveiligingsopties (mespatroon-keuzes per LS richting) ===

type LsBevOptie = {
  id: string;
  artikel_id: string;
  label: string;
  sort_order: number;
  actief: boolean;
};

export function LsBeveiligingOptiesTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<LsBevOptie> | null>(null);
  const [toDelete, setToDelete] = useState<LsBevOptie | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["beheer-ls-beveiliging-opties"],
    queryFn: async () =>
      (await supabase.from("ls_beveiliging_opties").select("*").order("sort_order")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (v: Partial<LsBevOptie>) => {
      if (v.id) {
        const { error } = await supabase.from("ls_beveiliging_opties").update(v).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ls_beveiliging_opties").insert(v as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-ls-beveiliging-opties"] });
      qc.invalidateQueries({ queryKey: ["ls_beveiliging_opties"] });
      toast.success("Opgeslagen");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ls_beveiliging_opties").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-ls-beveiliging-opties"] });
      qc.invalidateQueries({ queryKey: ["ls_beveiliging_opties"] });
      toast.success("Verwijderd");
      setToDelete(null);
    },
  });

  const rows = data as LsBevOptie[];

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
        Mespatroon-keuzes die per LS-richting beschikbaar zijn in de configurator (sectie LS-laagspanning → "Mespatroon per richting").
      </div>
      <div className="flex justify-end">
        <Button onClick={() => { setEditing({ sort_order: (rows.at(-1)?.sort_order ?? 0) + 10, actief: true }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Optie toevoegen
        </Button>
      </div>
      <DataTable
        headers={["Volgorde", "Label", "Artikel", "Actief", ""]}
        rows={rows.map((r) => [
          r.sort_order,
          <span className="font-medium">{r.label}</span>,
          <ArtikelLabel id={r.artikel_id} />,
          r.actief ? "Ja" : "Nee",
          <RowActions onEdit={() => { setEditing(r); setOpen(true); }} onDelete={() => setToDelete(r)} />,
        ])}
        emptyIcon={ShieldCheck}
        emptyMessage="Nog geen beveiligingsopties"
        emptyDescription="Voeg de mespatroon-keuzes (bv. 80A gG, 125A gG, 160A gFF) toe."
        emptyAction={
          <Button onClick={() => { setEditing({ sort_order: 10, actief: true }); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Eerste optie
          </Button>
        }
      />
      <FormDialog open={open} onOpenChange={setOpen} title={editing?.id ? "Optie bewerken" : "Optie toevoegen"} size="md">
        {editing && (
          <div className="space-y-3">
            <FormField label="Label" required>
              <Input
                value={editing.label ?? ""}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                placeholder="bv. 100A gFF"
                className="h-9"
              />
            </FormField>
            <FormField label="Artikel" required>
              <ArtikelZoeker
                value={editing.artikel_id ?? null}
                onChange={(id) => setEditing({ ...editing, artikel_id: id ?? undefined })}
                categorieSuggesties={["LS beveiliging", "MS beveiliging"]}
              />
            </FormField>
            <FormRow>
              <FormField label="Volgorde">
                <Input
                  type="number"
                  value={editing.sort_order ?? 0}
                  onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                  className="h-9"
                />
              </FormField>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.actief ?? true}
                    onChange={(e) => setEditing({ ...editing, actief: e.target.checked })}
                  />
                  Actief
                </label>
              </div>
            </FormRow>
            <div className="flex justify-end pt-2">
              <Button
                onClick={() => save.mutate(editing)}
                disabled={save.isPending || !editing.label || !editing.artikel_id}
              >
                {save.isPending ? "Opslaan..." : "Opslaan"}
              </Button>
            </div>
          </div>
        )}
      </FormDialog>
      <ConfirmDelete open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} onConfirm={() => toDelete && del.mutate(toDelete.id)} />
    </div>
  );
}
