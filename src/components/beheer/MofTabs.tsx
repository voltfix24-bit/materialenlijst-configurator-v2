import { useState } from "react";
import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, ChevronDown, ChevronRight, Cable } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDelete, DataTable, FormDialog, FormField, FormRow, RowActions } from "./shared";
import { ArtikelZoeker } from "./ArtikelZoeker";
import { ArtikelLabel } from "./RmuTab";
import { cn } from "@/lib/utils";

type Mat = { id: string; mof_type_id: string; artikel_id: string; hoeveelheid: number; hoeveelheid_formule: string | null };

export function MofMaterialenSubtable({ mofTypeId, table }: { mofTypeId: string; table: "ms_mof_materialen" | "ls_mof_materialen" }) {
  const qc = useQueryClient();
  const key = ["mof-mat", table, mofTypeId];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Mat> | null>(null);
  const [toDelete, setToDelete] = useState<Mat | null>(null);

  const { data = [] } = useQuery({
    queryKey: key,
    queryFn: async () => (await supabase.from(table as any).select("*").eq("mof_type_id", mofTypeId)).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (v: Partial<Mat>) => {
      const payload = { ...v, mof_type_id: mofTypeId };
      if (v.id) {
        const { error } = await supabase.from(table as any).update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table as any).insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Opgeslagen");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Verwijderd");
      setToDelete(null);
    },
  });

  return (
    <div className="space-y-2 p-3 bg-background/40">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Bijbehorende materialen</div>
        <Button size="sm" variant="outline" onClick={() => { setEditing({ hoeveelheid: 1 }); setOpen(true); }}>
          <Plus className="h-3 w-3 mr-1" /> Materiaal
        </Button>
      </div>
      <DataTable
        headers={["Artikel", "Hoeveelheid", "Formule", ""]}
        rowIds={(data as unknown as Mat[]).map((m) => m.id)}
        rows={(data as unknown as Mat[]).map((m) => [
          <ArtikelLabel id={m.artikel_id} />,
          m.hoeveelheid,
          m.hoeveelheid_formule ?? "—",
          <RowActions onEdit={() => { setEditing(m); setOpen(true); }} onDelete={() => setToDelete(m)} />,
        ])}
        emptyIcon={Cable}
        emptyMessage="Nog geen mof types"
        emptyDescription="Voeg types toe om de auto-lookup in cases te activeren."
      />
      <FormDialog open={open} onOpenChange={setOpen} title={editing?.id ? "Materiaal bewerken" : "Materiaal toevoegen"}>
        {editing && (
          <div className="space-y-3">
            <FormField label="Artikel" required>
              <ArtikelZoeker
                value={editing.artikel_id ?? null}
                onChange={(id) => setEditing({ ...editing, artikel_id: id ?? undefined })}
                categorieSuggesties={table === "ms_mof_materialen" ? ["MS garnituren", "MS beveiliging"] : ["LS garnituren", "LS-install.drd.&snr."]}
              />
            </FormField>
            <FormRow>
              <FormField label="Hoeveelheid">
                <Input type="number" value={editing.hoeveelheid ?? 1} onChange={(e) => setEditing({ ...editing, hoeveelheid: Number(e.target.value) })} className="h-9" />
              </FormField>
              <FormField label="Hoeveelheid formule" hint="bv. N * 3">
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

export function ExpandRow({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="text-muted-foreground hover:text-foreground">
      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
    </button>
  );
}

// === MS MOF TAB ===

const BESTAAND_MS = ["GPLK", "XLPE", "XLPE_singel"];
const NIEUW_MS = ["GPLK", "XLPE", "XLPE_singel", "beide"];

type MsMof = {
  id: string;
  code: string;
  bestaand_type: string;
  bestaand_doorsnede_min: number | null;
  bestaand_doorsnede_max: number | null;
  nieuwe_type: string | null;
  nieuwe_doorsnede_min: number | null;
  nieuwe_doorsnede_max: number | null;
  omschrijving: string | null;
  artikel_id: string | null;
  actief: boolean;
};

export function MsMofTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<MsMof> | null>(null);
  const [toDelete, setToDelete] = useState<MsMof | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data = [] } = useQuery({
    queryKey: ["beheer-ms-mof"],
    queryFn: async () => (await supabase.from("ms_mof_types").select("*").order("code")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (v: Partial<MsMof>) => {
      if (v.id) {
        const { error } = await supabase.from("ms_mof_types").update(v).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ms_mof_types").insert(v as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-ms-mof"] });
      toast.success("Opgeslagen");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ms_mof_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-ms-mof"] });
      toast.success("Verwijderd");
      setToDelete(null);
    },
  });

  const toggle = (id: string) => {
    const n = new Set(expanded);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setExpanded(n);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing({ bestaand_type: "GPLK", actief: true }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> MS mof type toevoegen
        </Button>
      </div>
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted-foreground">
            <tr>
              {["", "Code", "Bestaand", "Min mm²", "Max mm²", "Nieuw", "Min mm²", "Max mm²", "Mof artikel", "Actief", ""].map((h, i) => (
                <th key={i} className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(data as MsMof[]).length === 0 && (
              <tr><td colSpan={11} className="px-3 py-10 text-center">
                <div className="text-xs text-muted-foreground mb-3">Nog geen MS mof types.</div>
                <Button onClick={() => { setEditing({ bestaand_type: "GPLK", actief: true }); setOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Eerste mof type
                </Button>
              </td></tr>
            )}
            {(data as MsMof[]).map((m) => (
              <React.Fragment key={m.id}>
                <tr
                  key={m.id}
                  data-row-id={m.id}
                  className="hover:bg-accent/40 data-[highlight=true]:bg-primary/10 data-[highlight=true]:ring-2 data-[highlight=true]:ring-primary data-[highlight=true]:ring-inset"
                >
                  <td className="px-3 py-2 w-8"><ExpandRow expanded={expanded.has(m.id)} onToggle={() => toggle(m.id)} /></td>
                  <td className="px-3 py-2 font-mono text-xs">{m.code}</td>
                  <td className="px-3 py-2">{m.bestaand_type}</td>
                  <td className="px-3 py-2">{m.bestaand_doorsnede_min ?? "—"}</td>
                  <td className="px-3 py-2">{m.bestaand_doorsnede_max ?? "—"}</td>
                  <td className="px-3 py-2">{m.nieuwe_type ?? "—"}</td>
                  <td className="px-3 py-2">{m.nieuwe_doorsnede_min ?? "—"}</td>
                  <td className="px-3 py-2">{m.nieuwe_doorsnede_max ?? "—"}</td>
                  <td className="px-3 py-2"><ArtikelLabel id={m.artikel_id} /></td>
                  <td className="px-3 py-2">{m.actief ? "Ja" : "Nee"}</td>
                  <td className="px-3 py-2"><RowActions onEdit={() => { setEditing(m); setOpen(true); }} onDelete={() => setToDelete(m)} /></td>
                </tr>
                {expanded.has(m.id) && (
                  <tr key={m.id + "-exp"}>
                    <td colSpan={11} className={cn("p-0 border-t border-border")}>
                      <MofMaterialenSubtable mofTypeId={m.id} table="ms_mof_materialen" />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <FormDialog open={open} onOpenChange={setOpen} title={editing?.id ? "MS mof type bewerken" : "MS mof type toevoegen"} size="lg">
        {editing && (
          <div className="space-y-3">
            <FormRow>
              <FormField label="Code" required>
                <Input value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} className="h-9 font-mono" />
              </FormField>
              <FormField label="Bestaand kabeltype" required>
                <select value={editing.bestaand_type ?? "GPLK"} onChange={(e) => setEditing({ ...editing, bestaand_type: e.target.value })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
                  {BESTAAND_MS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </FormField>
            </FormRow>
            <FormField label="Omschrijving">
              <Input value={editing.omschrijving ?? ""} onChange={(e) => setEditing({ ...editing, omschrijving: e.target.value || null })} className="h-9" />
            </FormField>
            <FormRow>
              <FormField label="Min doorsnede mm²">
                <Input type="number" value={editing.bestaand_doorsnede_min ?? ""} onChange={(e) => setEditing({ ...editing, bestaand_doorsnede_min: e.target.value ? Number(e.target.value) : null })} className="h-9" />
              </FormField>
              <FormField label="Max doorsnede mm²">
                <Input type="number" value={editing.bestaand_doorsnede_max ?? ""} onChange={(e) => setEditing({ ...editing, bestaand_doorsnede_max: e.target.value ? Number(e.target.value) : null })} className="h-9" />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label="Nieuw kabeltype">
                <select value={editing.nieuwe_type ?? ""} onChange={(e) => setEditing({ ...editing, nieuwe_type: e.target.value || null })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
                  <option value="">—</option>
                  {NIEUW_MS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </FormField>
              <FormField label="Nieuw min mm²">
                <Input type="number" value={editing.nieuwe_doorsnede_min ?? ""} onChange={(e) => setEditing({ ...editing, nieuwe_doorsnede_min: e.target.value ? Number(e.target.value) : null })} className="h-9" />
              </FormField>
              <FormField label="Nieuw max mm²">
                <Input type="number" value={editing.nieuwe_doorsnede_max ?? ""} onChange={(e) => setEditing({ ...editing, nieuwe_doorsnede_max: e.target.value ? Number(e.target.value) : null })} className="h-9" />
              </FormField>
            </FormRow>
            <FormField label="Mof artikel">
              <ArtikelZoeker value={editing.artikel_id ?? null} onChange={(id) => setEditing({ ...editing, artikel_id: id })} categorieSuggesties={["MS garnituren"]} />
            </FormField>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.actief ?? true} onChange={(e) => setEditing({ ...editing, actief: e.target.checked })} />
              Actief
            </label>
            <div className="flex justify-end pt-2">
              <Button onClick={() => save.mutate(editing)} disabled={save.isPending || !editing.code}>
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

// === LS MOF TAB ===

const LS_TYPES = ["verbinding", "aftakmof", "eindmof"];
const LS_BESTAAND = ["GPLK", "kunststof", "beide"];

type LsMof = {
  id: string;
  type: string;
  bestaand_type: string;
  omschrijving: string | null;
  actief: boolean;
};

export function LsMofTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<LsMof> | null>(null);
  const [toDelete, setToDelete] = useState<LsMof | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data = [] } = useQuery({
    queryKey: ["beheer-ls-mof"],
    queryFn: async () => (await supabase.from("ls_mof_types").select("*").order("type")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (v: Partial<LsMof>) => {
      if (v.id) {
        const { error } = await supabase.from("ls_mof_types").update(v).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ls_mof_types").insert(v as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-ls-mof"] });
      toast.success("Opgeslagen");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ls_mof_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-ls-mof"] });
      toast.success("Verwijderd");
      setToDelete(null);
    },
  });

  const toggle = (id: string) => {
    const n = new Set(expanded);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setExpanded(n);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing({ type: "verbinding", bestaand_type: "GPLK", actief: true }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> LS mof type toevoegen
        </Button>
      </div>
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted-foreground">
            <tr>
              {["", "Type", "Bestaand", "Omschrijving", "Actief", ""].map((h) => (
                <th key={h} className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(data as LsMof[]).length === 0 && (
              <tr><td colSpan={6} className="px-3 py-10 text-center">
                <div className="text-xs text-muted-foreground mb-3">Nog geen LS mof types.</div>
                <Button onClick={() => { setEditing({ type: "verbinding", bestaand_type: "GPLK", actief: true }); setOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Eerste mof type
                </Button>
              </td></tr>
            )}
            {(data as LsMof[]).map((m) => (
              <React.Fragment key={m.id}>
                <tr
                  key={m.id}
                  data-row-id={m.id}
                  className="hover:bg-accent/40 data-[highlight=true]:bg-primary/10 data-[highlight=true]:ring-2 data-[highlight=true]:ring-primary data-[highlight=true]:ring-inset"
                >
                  <td className="px-3 py-2 w-8"><ExpandRow expanded={expanded.has(m.id)} onToggle={() => toggle(m.id)} /></td>
                  <td className="px-3 py-2">{m.type}</td>
                  <td className="px-3 py-2">{m.bestaand_type}</td>
                  <td className="px-3 py-2">{m.omschrijving ?? "—"}</td>
                  <td className="px-3 py-2">{m.actief ? "Ja" : "Nee"}</td>
                  <td className="px-3 py-2"><RowActions onEdit={() => { setEditing(m); setOpen(true); }} onDelete={() => setToDelete(m)} /></td>
                </tr>
                {expanded.has(m.id) && (
                  <tr key={m.id + "-exp"}>
                    <td colSpan={6} className="p-0 border-t border-border">
                      <MofMaterialenSubtable mofTypeId={m.id} table="ls_mof_materialen" />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <FormDialog open={open} onOpenChange={setOpen} title={editing?.id ? "LS mof type bewerken" : "LS mof type toevoegen"}>
        {editing && (
          <div className="space-y-3">
            <FormRow>
              <FormField label="Type" required>
                <select value={editing.type ?? "verbinding"} onChange={(e) => setEditing({ ...editing, type: e.target.value })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
                  {LS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormField>
              <FormField label="Bestaand kabeltype" required>
                <select value={editing.bestaand_type ?? "GPLK"} onChange={(e) => setEditing({ ...editing, bestaand_type: e.target.value })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
                  {LS_BESTAAND.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </FormField>
            </FormRow>
            <FormField label="Omschrijving">
              <Input value={editing.omschrijving ?? ""} onChange={(e) => setEditing({ ...editing, omschrijving: e.target.value || null })} className="h-9" />
            </FormField>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.actief ?? true} onChange={(e) => setEditing({ ...editing, actief: e.target.checked })} />
              Actief
            </label>
            <div className="flex justify-end pt-2">
              <Button onClick={() => save.mutate(editing)} disabled={save.isPending || !editing.type}>
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
