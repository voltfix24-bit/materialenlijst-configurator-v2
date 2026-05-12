import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDelete, DataTable, FormDialog, FormField, FormRow, RowActions } from "./shared";
import { ArtikelZoeker } from "./ArtikelZoeker";
import { cn } from "@/lib/utils";

const MERKEN = ["ABB", "Siemens", "Magnefix"];
const KVAS = [250, 400, 630, 1000];
const VELD_TYPES = ["F", "C", "V", "*"];

type RmuConfig = {
  id: string;
  code: string;
  merk: string;
  is_inet: boolean;
  aantal_velden: number;
  aantal_f: number;
  aantal_c: number;
  aantal_v: number;
  rmu_artikel_id: string | null;
  frame_artikel_id: string | null;
  bodemplaat_artikel_id: string | null;
  actief: boolean;
};

type VeldArt = {
  id: string;
  merk: string;
  is_inet: boolean;
  veld_type: string;
  artikel_id: string;
  hoeveelheid: number;
  hoeveelheid_formule: string | null;
};

type Zekering = {
  id: string;
  merk: string;
  trafo_kva: number;
  artikel_id: string;
  hoeveelheid: number;
};

const SUBTABS = [
  { key: "configs", label: "RMU configuraties" },
  { key: "velden", label: "Veldartikelen" },
  { key: "zekeringen", label: "Zekeringen" },
] as const;

export function RmuTab() {
  const [sub, setSub] = useState<(typeof SUBTABS)[number]["key"]>("configs");
  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border">
        {SUBTABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSub(t.key)}
            className={cn(
              "px-3 py-1.5 text-xs border-b-2 -mb-px",
              sub === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {sub === "configs" && <ConfigsTable />}
      {sub === "velden" && <VeldenTable />}
      {sub === "zekeringen" && <ZekeringenTable />}
    </div>
  );
}

function ArtikelLabel({ id }: { id: string | null }) {
  const { data } = useQuery({
    queryKey: ["artikel-label", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from("artikelen").select("artikel_nummer,korte_omschrijving").eq("id", id!).maybeSingle();
      return data;
    },
  });
  if (!id) return <span className="text-muted-foreground">—</span>;
  if (!data) return <span className="text-muted-foreground text-xs">…</span>;
  return (
    <span className="text-xs">
      <span className="font-mono">{data.artikel_nummer}</span> · {data.korte_omschrijving}
    </span>
  );
}

function ConfigsTable() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<RmuConfig> | null>(null);
  const [toDelete, setToDelete] = useState<RmuConfig | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["beheer-rmu-configs"],
    queryFn: async () => (await supabase.from("rmu_configuraties").select("*").order("merk").order("code")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (v: Partial<RmuConfig>) => {
      const payload = {
        ...v,
        aantal_velden: (v.aantal_f ?? 0) + (v.aantal_c ?? 0) + (v.aantal_v ?? 0),
      };
      if (v.id) {
        const { error } = await supabase.from("rmu_configuraties").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rmu_configuraties").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-rmu-configs"] });
      toast.success("Opgeslagen");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rmu_configuraties").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-rmu-configs"] });
      toast.success("Verwijderd");
      setToDelete(null);
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing({ merk: "ABB", is_inet: false, aantal_f: 0, aantal_c: 0, aantal_v: 0, actief: true });
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Configuratie toevoegen
        </Button>
      </div>
      <DataTable
        headers={["Code", "Merk", "I-Net", "F", "C", "V", "Velden", "RMU artikel", "Bodemplaat", "Actief", ""]}
        rows={(data as RmuConfig[]).map((c) => [
          c.code,
          c.merk,
          c.is_inet ? "Ja" : "Nee",
          c.aantal_f,
          c.aantal_c,
          c.aantal_v,
          c.aantal_velden,
          <ArtikelLabel id={c.rmu_artikel_id} />,
          <ArtikelLabel id={c.bodemplaat_artikel_id} />,
          c.actief ? "Ja" : "Nee",
          <RowActions
            onEdit={() => {
              setEditing(c);
              setOpen(true);
            }}
            onDelete={() => setToDelete(c)}
          />,
        ])}
        emptyMessage="Nog geen configuraties."
        emptyAction={
          <Button
            onClick={() => {
              setEditing({ merk: "ABB", is_inet: false, aantal_f: 0, aantal_c: 0, aantal_v: 0, actief: true });
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Eerste configuratie
          </Button>
        }
      />
      <FormDialog open={open} onOpenChange={setOpen} title={editing?.id ? "Configuratie bewerken" : "Configuratie toevoegen"} size="lg">
        {editing && (
          <ConfigForm value={editing} onChange={setEditing} onSave={() => save.mutate(editing)} saving={save.isPending} />
        )}
      </FormDialog>
      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
      />
    </div>
  );
}

function ConfigForm({
  value,
  onChange,
  onSave,
  saving,
}: {
  value: Partial<RmuConfig>;
  onChange: (v: Partial<RmuConfig>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const set = (p: Partial<RmuConfig>) => onChange({ ...value, ...p });
  return (
    <div className="space-y-3">
      <FormRow>
        <FormField label="Code" required>
          <Input value={value.code ?? ""} onChange={(e) => set({ code: e.target.value })} className="h-9 font-mono" />
        </FormField>
        <FormField label="Merk" required>
          <select value={value.merk ?? ""} onChange={(e) => set({ merk: e.target.value })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
            {MERKEN.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </FormField>
      </FormRow>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value.is_inet ?? false} onChange={(e) => set({ is_inet: e.target.checked })} />
        I-Net uitvoering
      </label>
      <FormRow cols={3}>
        <FormField label="F-velden">
          <Input type="number" value={value.aantal_f ?? 0} onChange={(e) => set({ aantal_f: Number(e.target.value) })} className="h-9" />
        </FormField>
        <FormField label="C-velden">
          <Input type="number" value={value.aantal_c ?? 0} onChange={(e) => set({ aantal_c: Number(e.target.value) })} className="h-9" />
        </FormField>
        <FormField label="V-velden">
          <Input type="number" value={value.aantal_v ?? 0} onChange={(e) => set({ aantal_v: Number(e.target.value) })} className="h-9" />
        </FormField>
      </FormRow>
      <FormField label="RMU artikel" required>
        <ArtikelZoeker value={value.rmu_artikel_id ?? null} onChange={(id) => set({ rmu_artikel_id: id })} categorieSuggesties={["MS schakelinstallati"]} />
      </FormField>
      <FormField label="Frame artikel">
        <ArtikelZoeker value={value.frame_artikel_id ?? null} onChange={(id) => set({ frame_artikel_id: id })} categorieSuggesties={["MS schakelinstallati"]} />
      </FormField>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value.actief ?? true} onChange={(e) => set({ actief: e.target.checked })} />
        Actief
      </label>
      <div className="flex justify-end pt-2">
        <Button onClick={onSave} disabled={saving || !value.code || !value.merk || !value.rmu_artikel_id}>
          {saving ? "Opslaan..." : "Opslaan"}
        </Button>
      </div>
    </div>
  );
}

function VeldenTable() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<VeldArt> | null>(null);
  const [toDelete, setToDelete] = useState<VeldArt | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["beheer-rmu-velden"],
    queryFn: async () => (await supabase.from("rmu_veld_artikelen").select("*").order("merk").order("veld_type")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (v: Partial<VeldArt>) => {
      if (v.id) {
        const { error } = await supabase.from("rmu_veld_artikelen").update(v).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rmu_veld_artikelen").insert(v as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-rmu-velden"] });
      toast.success("Opgeslagen");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rmu_veld_artikelen").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-rmu-velden"] });
      toast.success("Verwijderd");
      setToDelete(null);
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing({ merk: "ABB", is_inet: false, veld_type: "F", hoeveelheid: 1 });
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Veldartikel toevoegen
        </Button>
      </div>
      <DataTable
        headers={["Merk", "I-Net", "Veld", "Artikel", "Hoeveelheid", "Formule", ""]}
        rows={(data as VeldArt[]).map((v) => [
          v.merk,
          v.is_inet ? "Ja" : "Nee",
          v.veld_type,
          <ArtikelLabel id={v.artikel_id} />,
          v.hoeveelheid,
          v.hoeveelheid_formule ?? "—",
          <RowActions onEdit={() => { setEditing(v); setOpen(true); }} onDelete={() => setToDelete(v)} />,
        ])}
        emptyMessage="Nog geen veldartikelen."
        emptyAction={
          <Button onClick={() => { setEditing({ merk: "ABB", is_inet: false, veld_type: "F", hoeveelheid: 1 }); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Eerste veldartikel
          </Button>
        }
      />
      <FormDialog open={open} onOpenChange={setOpen} title={editing?.id ? "Veldartikel bewerken" : "Veldartikel toevoegen"}>
        {editing && (
          <div className="space-y-3">
            <FormRow>
              <FormField label="Merk" required>
                <select value={editing.merk ?? ""} onChange={(e) => setEditing({ ...editing, merk: e.target.value })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
                  {MERKEN.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </FormField>
              <FormField label="Veldtype" required>
                <select value={editing.veld_type ?? "F"} onChange={(e) => setEditing({ ...editing, veld_type: e.target.value })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
                  {VELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormField>
            </FormRow>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.is_inet ?? false} onChange={(e) => setEditing({ ...editing, is_inet: e.target.checked })} />
              I-Net uitvoering
            </label>
            <FormField label="Artikel" required>
              <ArtikelZoeker value={editing.artikel_id ?? null} onChange={(id) => setEditing({ ...editing, artikel_id: id ?? undefined })} categorieSuggesties={["MS schakelinstallati", "MS beveiliging", "MS garnituren"]} />
            </FormField>
            <FormRow>
              <FormField label="Hoeveelheid">
                <Input type="number" value={editing.hoeveelheid ?? 1} onChange={(e) => setEditing({ ...editing, hoeveelheid: Number(e.target.value) })} className="h-9" />
              </FormField>
              <FormField label="Hoeveelheid formule" hint="bv. N * 2 (N = aantal velden van dat type)">
                <Input value={editing.hoeveelheid_formule ?? ""} onChange={(e) => setEditing({ ...editing, hoeveelheid_formule: e.target.value || null })} className="h-9 font-mono" />
              </FormField>
            </FormRow>
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

function ZekeringenTable() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Zekering> | null>(null);
  const [toDelete, setToDelete] = useState<Zekering | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["beheer-rmu-zekeringen"],
    queryFn: async () => (await supabase.from("rmu_zekeringen").select("*").order("merk").order("trafo_kva")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (v: Partial<Zekering>) => {
      if (v.id) {
        const { error } = await supabase.from("rmu_zekeringen").update(v).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rmu_zekeringen").insert(v as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-rmu-zekeringen"] });
      toast.success("Opgeslagen");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rmu_zekeringen").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-rmu-zekeringen"] });
      toast.success("Verwijderd");
      setToDelete(null);
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing({ merk: "ABB", trafo_kva: 400, hoeveelheid: 3 }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Zekering toevoegen
        </Button>
      </div>
      <DataTable
        headers={["Merk", "Trafo kVA", "Artikel", "Hoeveelheid", ""]}
        rows={(data as Zekering[]).map((z) => [
          z.merk,
          z.trafo_kva,
          <ArtikelLabel id={z.artikel_id} />,
          z.hoeveelheid,
          <RowActions onEdit={() => { setEditing(z); setOpen(true); }} onDelete={() => setToDelete(z)} />,
        ])}
        emptyMessage="Nog geen zekeringen."
        emptyAction={
          <Button onClick={() => { setEditing({ merk: "ABB", trafo_kva: 400, hoeveelheid: 3 }); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Eerste zekering
          </Button>
        }
      />
      <FormDialog open={open} onOpenChange={setOpen} title={editing?.id ? "Zekering bewerken" : "Zekering toevoegen"}>
        {editing && (
          <div className="space-y-3">
            <FormRow>
              <FormField label="Merk" required>
                <select value={editing.merk ?? ""} onChange={(e) => setEditing({ ...editing, merk: e.target.value })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
                  {MERKEN.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </FormField>
              <FormField label="Trafo kVA" required>
                <select value={editing.trafo_kva ?? 400} onChange={(e) => setEditing({ ...editing, trafo_kva: Number(e.target.value) })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
                  {KVAS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </FormField>
            </FormRow>
            <FormField label="Artikel" required>
              <ArtikelZoeker value={editing.artikel_id ?? null} onChange={(id) => setEditing({ ...editing, artikel_id: id ?? undefined })} categorieSuggesties={["MS beveiliging"]} />
            </FormField>
            <FormField label="Hoeveelheid">
              <Input type="number" value={editing.hoeveelheid ?? 3} onChange={(e) => setEditing({ ...editing, hoeveelheid: Number(e.target.value) })} className="h-9" />
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

export { ArtikelLabel };
