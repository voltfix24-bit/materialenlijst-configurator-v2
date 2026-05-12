import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDelete, DataTable, FormDialog, FormField, FormRow, RowActions } from "./shared";
import { ArtikelZoeker } from "./ArtikelZoeker";
import { ArtikelLabel } from "./RmuTab";

const CASE_TYPES = ["NSA", "provisorium", "compact", "custom"];
const SUBTYPES = ["cs_zonder_prov", "cs_met_prov", "renovatie_prov", "renovatie_nsa"];
const KVAS = [250, 400, 630, 1000];

// === Standaard materialen ===

type Stand = { id: string; case_type: string; artikel_id: string; standaard_hoeveelheid: number };

export function StandaardMaterialenTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Stand> | null>(null);
  const [toDelete, setToDelete] = useState<Stand | null>(null);

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

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing({ case_type: "NSA", standaard_hoeveelheid: 1 }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Standaard materiaal toevoegen
        </Button>
      </div>
      <DataTable
        headers={["Case type", "Artikel", "Hoeveelheid", ""]}
        rows={(data as Stand[]).map((s) => [
          s.case_type,
          <ArtikelLabel id={s.artikel_id} />,
          s.standaard_hoeveelheid,
          <RowActions onEdit={() => { setEditing(s); setOpen(true); }} onDelete={() => setToDelete(s)} />,
        ])}
        emptyMessage="Nog geen standaard materialen."
        emptyAction={
          <Button onClick={() => { setEditing({ case_type: "NSA", standaard_hoeveelheid: 1 }); setOpen(true); }}>
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
              <ArtikelZoeker value={editing.artikel_id ?? null} onChange={(id) => setEditing({ ...editing, artikel_id: id ?? undefined })} />
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
        emptyMessage="Nog geen vaste artikelen."
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
              <ArtikelZoeker value={editing.artikel_id ?? null} onChange={(id) => setEditing({ ...editing, artikel_id: id ?? undefined })} />
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
  kabel_doorsnede: number; // schema number, but spec says text — keep as number per existing schema
  aantal_perskabelschoenen: number;
  perskabelschoen_artikel_id: string | null;
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
        <Button onClick={() => { setEditing({ trafo_kva: 400, aantal_kabels: 1, kabel_doorsnede: 150, aantal_perskabelschoenen: 6 }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Trafo vult kabel toevoegen
        </Button>
      </div>
      <DataTable
        headers={["Trafo kVA", "Aantal kabels", "Doorsnede", "# Perskabelschoenen", "Artikel", ""]}
        rows={(data as TrafoKabel[]).map((t) => [
          t.trafo_kva,
          t.aantal_kabels,
          t.kabel_doorsnede,
          t.aantal_perskabelschoenen,
          <ArtikelLabel id={t.perskabelschoen_artikel_id} />,
          <RowActions onEdit={() => { setEditing(t); setOpen(true); }} onDelete={() => setToDelete(t)} />,
        ])}
        emptyMessage="Nog geen trafo vult kabel configuraties."
        emptyAction={
          <Button onClick={() => { setEditing({ trafo_kva: 400, aantal_kabels: 1, kabel_doorsnede: 150, aantal_perskabelschoenen: 6 }); setOpen(true); }}>
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
            <FormField label="Perskabelschoen artikel">
              <ArtikelZoeker value={editing.perskabelschoen_artikel_id ?? null} onChange={(id) => setEditing({ ...editing, perskabelschoen_artikel_id: id })} />
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
