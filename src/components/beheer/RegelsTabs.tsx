import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Wrench, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDelete, DataTable, FormDialog, FormField, FormRow, RowActions } from "./shared";
import { ArtikelZoeker } from "./ArtikelZoeker";
import { ArtikelLabel } from "./RmuTab";
import { LsRekTestPaneel } from "./LsRekTestPaneel";

// === GGI artikelen ===

type Ggi = { id: string; artikel_id: string; hoeveelheid: number; sort_order: number; actief: boolean };

export function GgiRegelsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Ggi> | null>(null);
  const [toDelete, setToDelete] = useState<Ggi | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["beheer-ggi"],
    queryFn: async () => (await supabase.from("ggi_artikelen").select("*").order("sort_order")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (v: Partial<Ggi>) => {
      if (v.id) {
        const { error } = await supabase.from("ggi_artikelen").update(v).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ggi_artikelen").insert(v as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["beheer-ggi"] }); qc.invalidateQueries({ queryKey: ["ggi_artikelen"] }); toast.success("Opgeslagen"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("ggi_artikelen").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["beheer-ggi"] }); qc.invalidateQueries({ queryKey: ["ggi_artikelen"] }); toast.success("Verwijderd"); setToDelete(null); },
  });

  const startNew = () => { setEditing({ hoeveelheid: 1, sort_order: (data as Ggi[]).length, actief: true }); setOpen(true); };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={startNew}><Plus className="h-4 w-4 mr-1" /> GGI artikel toevoegen</Button>
      </div>
      <DataTable
        headers={["Volgorde", "Artikel", "Hoeveelheid", "Actief", ""]}
        rowIds={(data as Ggi[]).map((g) => g.id)}
        rows={(data as Ggi[]).map((g) => [
          g.sort_order,
          <ArtikelLabel id={g.artikel_id} />,
          g.hoeveelheid,
          g.actief ? "Ja" : "Nee",
          <RowActions onEdit={() => { setEditing(g); setOpen(true); }} onDelete={() => setToDelete(g)} />,
        ])}
        emptyIcon={Wrench}
        emptyMessage="Nog geen GGI artikelen"
        emptyDescription="Artikelen die bij GGI vervangen (renovatie) op de bestellijst komen."
        emptyAction={<Button onClick={startNew}><Plus className="h-4 w-4 mr-1" /> Eerste GGI artikel</Button>}
      />
      <FormDialog open={open} onOpenChange={setOpen} title={editing?.id ? "GGI artikel bewerken" : "GGI artikel toevoegen"}>
        {editing && (
          <div className="space-y-3">
            <FormField label="Artikel" required>
              <ArtikelZoeker value={editing.artikel_id ?? null} onChange={(id) => setEditing({ ...editing, artikel_id: id ?? undefined })} categorieSuggesties={["GGI"]} />
            </FormField>
            <FormRow>
              <FormField label="Hoeveelheid">
                <Input type="number" value={editing.hoeveelheid ?? 1} onChange={(e) => setEditing({ ...editing, hoeveelheid: Number(e.target.value) })} className="h-9" />
              </FormField>
              <FormField label="Volgorde">
                <Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className="h-9" />
              </FormField>
            </FormRow>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.actief ?? true} onChange={(e) => setEditing({ ...editing, actief: e.target.checked })} />
              Actief
            </label>
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

// === Trafo regels ===

type TrafoRegel = {
  id: string;
  conditie_actie: string | null;
  conditie_kva: string | null;
  conditie_kabel_lengte: string | null;
  artikel_id: string;
  hoeveelheid: number;
  herkomst_label: string;
  sort_order: number;
  actief: boolean;
};

const ACTIES = ["", "nieuw", "draaien", "blijft"];
const KVAS = ["", "250", "400", "630", "1000"];
const LENGTES = ["", "7.25", "10"];

export function TrafoRegelsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<TrafoRegel> | null>(null);
  const [toDelete, setToDelete] = useState<TrafoRegel | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["beheer-trafo-regels"],
    queryFn: async () => (await supabase.from("trafo_regels").select("*").order("sort_order")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (v: Partial<TrafoRegel>) => {
      // Lege strings → null voor condities
      const payload = { ...v };
      for (const k of ["conditie_actie", "conditie_kva", "conditie_kabel_lengte"] as const) {
        if (payload[k] === "") payload[k] = null;
      }
      if (v.id) {
        const { error } = await supabase.from("trafo_regels").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("trafo_regels").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["beheer-trafo-regels"] }); qc.invalidateQueries({ queryKey: ["trafo_regels"] }); toast.success("Opgeslagen"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("trafo_regels").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["beheer-trafo-regels"] }); qc.invalidateQueries({ queryKey: ["trafo_regels"] }); toast.success("Verwijderd"); setToDelete(null); },
  });

  const startNew = () => { setEditing({ hoeveelheid: 1, sort_order: (data as TrafoRegel[]).length, actief: true, herkomst_label: "Trafo" }); setOpen(true); };

  const Cond = ({ v }: { v: string | null }) => v == null ? <span className="text-muted-foreground">—</span> : <span className="font-mono text-xs">{v}</span>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={startNew}><Plus className="h-4 w-4 mr-1" /> Trafo regel toevoegen</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Een regel matcht als elke <em>gevulde</em> conditie gelijk is aan de configuratie. Leeg = matcht altijd.
        Regels met <em>actie</em> vereisen dat zowel <em>actie</em> als <em>kVA</em> in de case gezet zijn.
      </p>
      <DataTable
        headers={["Actie", "kVA", "Kabel", "Artikel", "Aantal", "Herkomst label", "Actief", ""]}
        rowIds={(data as TrafoRegel[]).map((r) => r.id)}
        rows={(data as TrafoRegel[]).map((r) => [
          <Cond v={r.conditie_actie} />,
          <Cond v={r.conditie_kva} />,
          <Cond v={r.conditie_kabel_lengte} />,
          <ArtikelLabel id={r.artikel_id} />,
          r.hoeveelheid,
          <span className="text-xs">{r.herkomst_label}</span>,
          r.actief ? "Ja" : "Nee",
          <RowActions onEdit={() => { setEditing(r); setOpen(true); }} onDelete={() => setToDelete(r)} />,
        ])}
        emptyIcon={Zap}
        emptyMessage="Nog geen trafo regels"
        emptyDescription="Conditionele regels voor trafo, aansluitvlag en telcon klem."
        emptyAction={<Button onClick={startNew}><Plus className="h-4 w-4 mr-1" /> Eerste trafo regel</Button>}
      />
      <FormDialog open={open} onOpenChange={setOpen} title={editing?.id ? "Trafo regel bewerken" : "Trafo regel toevoegen"} size="lg">
        {editing && (
          <div className="space-y-3">
            <FormRow>
              <FormField label="Conditie: actie">
                <select value={editing.conditie_actie ?? ""} onChange={(e) => setEditing({ ...editing, conditie_actie: e.target.value || null })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
                  {ACTIES.map((a) => <option key={a} value={a}>{a || "— alle —"}</option>)}
                </select>
              </FormField>
              <FormField label="Conditie: kVA">
                <select value={editing.conditie_kva ?? ""} onChange={(e) => setEditing({ ...editing, conditie_kva: e.target.value || null })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
                  {KVAS.map((k) => <option key={k} value={k}>{k || "— alle —"}</option>)}
                </select>
              </FormField>
              <FormField label="Conditie: kabellengte">
                <select value={editing.conditie_kabel_lengte ?? ""} onChange={(e) => setEditing({ ...editing, conditie_kabel_lengte: e.target.value || null })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
                  {LENGTES.map((l) => <option key={l} value={l}>{l || "— alle —"}</option>)}
                </select>
              </FormField>
            </FormRow>
            <FormField label="Artikel" required>
              <ArtikelZoeker value={editing.artikel_id ?? null} onChange={(id) => setEditing({ ...editing, artikel_id: id ?? undefined })} categorieSuggesties={["Trafo"]} />
            </FormField>
            <FormRow>
              <FormField label="Hoeveelheid">
                <Input type="number" value={editing.hoeveelheid ?? 1} onChange={(e) => setEditing({ ...editing, hoeveelheid: Number(e.target.value) })} className="h-9" />
              </FormField>
              <FormField label="Herkomst label">
                <Input value={editing.herkomst_label ?? ""} onChange={(e) => setEditing({ ...editing, herkomst_label: e.target.value })} className="h-9" />
              </FormField>
              <FormField label="Volgorde">
                <Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className="h-9" />
              </FormField>
            </FormRow>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.actief ?? true} onChange={(e) => setEditing({ ...editing, actief: e.target.checked })} />
              Actief
            </label>
            <div className="flex justify-end pt-2">
              <Button onClick={() => save.mutate(editing)} disabled={save.isPending || !editing.artikel_id || !editing.herkomst_label}>
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

// === LS-rek regels ===

type LsRekRegel = {
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

const LS_ACTIES = ["", "vervangen", "gehandhaafd"];
const LS_TYPES = ["", "8", "12"];
const LS_SCHROEF = ["", "35A", "50A"];
const LS_KVAS = ["", "250", "400", "630"];
const LS_FORMULES = ["", "lsRekExtraStroken", "lsRekAanSluitenKabels", "lsRekAanSluitenKabels*2"];

function TriBool({ value, onChange }: { value: boolean | null; onChange: (v: boolean | null) => void }) {
  const str = value === null ? "" : value ? "ja" : "nee";
  return (
    <select
      value={str}
      onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "ja")}
      className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
    >
      <option value="">— alle —</option>
      <option value="ja">ja</option>
      <option value="nee">nee</option>
    </select>
  );
}

export function LsRekRegelsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<LsRekRegel> | null>(null);
  const [toDelete, setToDelete] = useState<LsRekRegel | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["beheer-lsrek-regels"],
    queryFn: async () => (await supabase.from("ls_rek_regels").select("*").order("sort_order")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (v: Partial<LsRekRegel>) => {
      const payload: any = { ...v };
      for (const k of ["conditie_actie", "conditie_lsrek_type", "conditie_schroefpatroon", "conditie_kva", "hoeveelheid_formule"] as const) {
        if (payload[k] === "") payload[k] = null;
      }
      if (v.id) {
        const { error } = await supabase.from("ls_rek_regels").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ls_rek_regels").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["beheer-lsrek-regels"] }); qc.invalidateQueries({ queryKey: ["ls_rek_regels"] }); toast.success("Opgeslagen"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("ls_rek_regels").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["beheer-lsrek-regels"] }); qc.invalidateQueries({ queryKey: ["ls_rek_regels"] }); toast.success("Verwijderd"); setToDelete(null); },
  });

  const startNew = () => { setEditing({ hoeveelheid: 1, sort_order: (data as LsRekRegel[]).length, actief: true, herkomst_label: "LS-rek" }); setOpen(true); };

  const Cond = ({ v }: { v: string | number | boolean | null }) =>
    v === null || v === undefined ? <span className="text-muted-foreground">—</span> : <span className="font-mono text-xs">{String(v)}</span>;

  return (
    <div className="space-y-3">
      <LsRekTestPaneel />
      <div className="flex justify-end">
        <Button onClick={startNew}><Plus className="h-4 w-4 mr-1" /> LS-rek regel toevoegen</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Elke gevulde conditie moet matchen. Lege conditie = matcht altijd. Formule overschrijft het aantal-veld als gezet
        (beschikbaar: <code>lsRekExtraStroken</code>, <code>lsRekAanSluitenKabels</code>, <code>lsRekAanSluitenKabels*2</code>).
      </p>
      <DataTable
        headers={["Compact", "Renov", "Actie", "Type", "Bev.aanp", "OV", "Schroef", "kVA", "Artikel", "Aantal/formule", "Herkomst", ""]}
        rowIds={(data as LsRekRegel[]).map((r) => r.id)}
        rows={(data as LsRekRegel[]).map((r) => [
          <Cond v={r.conditie_compact} />,
          <Cond v={r.conditie_renovatie} />,
          <Cond v={r.conditie_actie} />,
          <Cond v={r.conditie_lsrek_type} />,
          <Cond v={r.conditie_beveiliging_aanpassen} />,
          <Cond v={r.conditie_ov_stuurpunt} />,
          <Cond v={r.conditie_schroefpatroon} />,
          <Cond v={r.conditie_kva} />,
          <ArtikelLabel id={r.artikel_id} />,
          <span className="text-xs">{r.hoeveelheid_formule ?? r.hoeveelheid}</span>,
          <span className="text-xs">{r.herkomst_label}</span>,
          <RowActions onEdit={() => { setEditing(r); setOpen(true); }} onDelete={() => setToDelete(r)} />,
        ])}
        emptyIcon={Wrench}
        emptyMessage="Nog geen LS-rek regels"
        emptyDescription="Conditionele regels voor LS-rek, OV-stuurpunt en kabelbevestiging."
        emptyAction={<Button onClick={startNew}><Plus className="h-4 w-4 mr-1" /> Eerste LS-rek regel</Button>}
      />
      <FormDialog open={open} onOpenChange={setOpen} title={editing?.id ? "LS-rek regel bewerken" : "LS-rek regel toevoegen"} size="lg">
        {editing && (
          <div className="space-y-3">
            <FormRow>
              <FormField label="Compact"><TriBool value={editing.conditie_compact ?? null} onChange={(v) => setEditing({ ...editing, conditie_compact: v })} /></FormField>
              <FormField label="Renovatie"><TriBool value={editing.conditie_renovatie ?? null} onChange={(v) => setEditing({ ...editing, conditie_renovatie: v })} /></FormField>
              <FormField label="Bev. aanpassen vereist"><TriBool value={editing.conditie_beveiliging_aanpassen ?? null} onChange={(v) => setEditing({ ...editing, conditie_beveiliging_aanpassen: v })} /></FormField>
              <FormField label="OV-stuurpunt vereist"><TriBool value={editing.conditie_ov_stuurpunt ?? null} onChange={(v) => setEditing({ ...editing, conditie_ov_stuurpunt: v })} /></FormField>
            </FormRow>
            <FormRow>
              <FormField label="Actie">
                <select value={editing.conditie_actie ?? ""} onChange={(e) => setEditing({ ...editing, conditie_actie: e.target.value || null })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
                  {LS_ACTIES.map((x) => <option key={x} value={x}>{x || "— alle —"}</option>)}
                </select>
              </FormField>
              <FormField label="LS-rek type">
                <select value={editing.conditie_lsrek_type ?? ""} onChange={(e) => setEditing({ ...editing, conditie_lsrek_type: e.target.value || null })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
                  {LS_TYPES.map((x) => <option key={x} value={x}>{x || "— alle —"}</option>)}
                </select>
              </FormField>
              <FormField label="Schroefpatroon">
                <select value={editing.conditie_schroefpatroon ?? ""} onChange={(e) => setEditing({ ...editing, conditie_schroefpatroon: e.target.value || null })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
                  {LS_SCHROEF.map((x) => <option key={x} value={x}>{x || "— alle —"}</option>)}
                </select>
              </FormField>
              <FormField label="kVA">
                <select value={editing.conditie_kva ?? ""} onChange={(e) => setEditing({ ...editing, conditie_kva: e.target.value || null })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
                  {LS_KVAS.map((x) => <option key={x} value={x}>{x || "— alle —"}</option>)}
                </select>
              </FormField>
            </FormRow>
            <FormField label="Artikel" required>
              <ArtikelZoeker value={editing.artikel_id ?? null} onChange={(id) => setEditing({ ...editing, artikel_id: id ?? undefined })} categorieSuggesties={["LS-rek", "OV-stuurpunt"]} />
            </FormField>
            <FormRow>
              <FormField label="Hoeveelheid (fallback)">
                <Input type="number" value={editing.hoeveelheid ?? 1} onChange={(e) => setEditing({ ...editing, hoeveelheid: Number(e.target.value) })} className="h-9" />
              </FormField>
              <FormField label="Formule (optioneel)">
                <select value={editing.hoeveelheid_formule ?? ""} onChange={(e) => setEditing({ ...editing, hoeveelheid_formule: e.target.value || null })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
                  {LS_FORMULES.map((x) => <option key={x} value={x}>{x || "— geen —"}</option>)}
                </select>
              </FormField>
              <FormField label="Volgorde">
                <Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className="h-9" />
              </FormField>
            </FormRow>
            <FormField label="Herkomst label">
              <Input value={editing.herkomst_label ?? ""} onChange={(e) => setEditing({ ...editing, herkomst_label: e.target.value })} className="h-9" />
            </FormField>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.actief ?? true} onChange={(e) => setEditing({ ...editing, actief: e.target.checked })} />
              Actief
            </label>
            <div className="flex justify-end pt-2">
              <Button onClick={() => save.mutate(editing)} disabled={save.isPending || !editing.artikel_id || !editing.herkomst_label}>
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

// === Provisorium regels ===

type ProvRegel = {
  id: string;
  conditie_merk: string | null;
  conditie_kva: string | null;
  artikel_id: string;
  hoeveelheid: number;
  hoeveelheid_formule: string | null;
  herkomst_label: string;
  sort_order: number;
  actief: boolean;
};

const PROV_MERKEN = ["", "Magnefix", "ABB", "Siemens"];
const PROV_KVAS = ["", "250", "400", "630"];
const PROV_FORMULES = ["", "perFVeld", "perFVeld*3", "provInbMsKabels", "provInbLsKabels", "ifInbMsThen1"];

export function ProvRegelsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<ProvRegel> | null>(null);
  const [toDelete, setToDelete] = useState<ProvRegel | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["beheer-prov-regels"],
    queryFn: async () => (await supabase.from("prov_regels").select("*").order("sort_order")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (v: Partial<ProvRegel>) => {
      const payload: any = { ...v };
      for (const k of ["conditie_merk", "conditie_kva", "hoeveelheid_formule"] as const) {
        if (payload[k] === "") payload[k] = null;
      }
      if (v.id) {
        const { error } = await supabase.from("prov_regels").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("prov_regels").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["beheer-prov-regels"] }); qc.invalidateQueries({ queryKey: ["prov_regels"] }); toast.success("Opgeslagen"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("prov_regels").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["beheer-prov-regels"] }); qc.invalidateQueries({ queryKey: ["prov_regels"] }); toast.success("Verwijderd"); setToDelete(null); },
  });

  const startNew = () => { setEditing({ hoeveelheid: 1, sort_order: (data as ProvRegel[]).length, actief: true, herkomst_label: "Provisorium" }); setOpen(true); };

  const Cond = ({ v }: { v: string | null }) => v == null ? <span className="text-muted-foreground">—</span> : <span className="font-mono text-xs">{v}</span>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={startNew}><Plus className="h-4 w-4 mr-1" /> Provisorium regel toevoegen</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Conditie merk/kVA matcht op <code>provRmuMerk</code> en <code>provZekeringKva</code>. Formules:
        <code>perFVeld</code>, <code>perFVeld*3</code>, <code>provInbMsKabels</code>, <code>provInbLsKabels</code>, <code>ifInbMsThen1</code>.
      </p>
      <DataTable
        headers={["Merk", "kVA", "Artikel", "Aantal/formule", "Herkomst", "Actief", ""]}
        rowIds={(data as ProvRegel[]).map((r) => r.id)}
        rows={(data as ProvRegel[]).map((r) => [
          <Cond v={r.conditie_merk} />,
          <Cond v={r.conditie_kva} />,
          <ArtikelLabel id={r.artikel_id} />,
          <span className="text-xs">{r.hoeveelheid_formule ?? r.hoeveelheid}</span>,
          <span className="text-xs">{r.herkomst_label}</span>,
          r.actief ? "Ja" : "Nee",
          <RowActions onEdit={() => { setEditing(r); setOpen(true); }} onDelete={() => setToDelete(r)} />,
        ])}
        emptyIcon={Wrench}
        emptyMessage="Nog geen provisorium regels"
        emptyDescription="Conditionele regels voor provisorium F-velden, buispatronen en in-bedrijfname."
        emptyAction={<Button onClick={startNew}><Plus className="h-4 w-4 mr-1" /> Eerste provisorium regel</Button>}
      />
      <FormDialog open={open} onOpenChange={setOpen} title={editing?.id ? "Provisorium regel bewerken" : "Provisorium regel toevoegen"} size="lg">
        {editing && (
          <div className="space-y-3">
            <FormRow>
              <FormField label="Merk">
                <select value={editing.conditie_merk ?? ""} onChange={(e) => setEditing({ ...editing, conditie_merk: e.target.value || null })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
                  {PROV_MERKEN.map((x) => <option key={x} value={x}>{x || "— alle —"}</option>)}
                </select>
              </FormField>
              <FormField label="kVA">
                <select value={editing.conditie_kva ?? ""} onChange={(e) => setEditing({ ...editing, conditie_kva: e.target.value || null })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
                  {PROV_KVAS.map((x) => <option key={x} value={x}>{x || "— alle —"}</option>)}
                </select>
              </FormField>
            </FormRow>
            <FormField label="Artikel" required>
              <ArtikelZoeker value={editing.artikel_id ?? null} onChange={(id) => setEditing({ ...editing, artikel_id: id ?? undefined })} categorieSuggesties={["RMU", "LS-rek"]} />
            </FormField>
            <FormRow>
              <FormField label="Hoeveelheid (fallback)">
                <Input type="number" value={editing.hoeveelheid ?? 1} onChange={(e) => setEditing({ ...editing, hoeveelheid: Number(e.target.value) })} className="h-9" />
              </FormField>
              <FormField label="Formule (optioneel)">
                <select value={editing.hoeveelheid_formule ?? ""} onChange={(e) => setEditing({ ...editing, hoeveelheid_formule: e.target.value || null })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
                  {PROV_FORMULES.map((x) => <option key={x} value={x}>{x || "— geen —"}</option>)}
                </select>
              </FormField>
              <FormField label="Volgorde">
                <Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className="h-9" />
              </FormField>
            </FormRow>
            <FormField label="Herkomst label">
              <Input value={editing.herkomst_label ?? ""} onChange={(e) => setEditing({ ...editing, herkomst_label: e.target.value })} className="h-9" />
            </FormField>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.actief ?? true} onChange={(e) => setEditing({ ...editing, actief: e.target.checked })} />
              Actief
            </label>
            <div className="flex justify-end pt-2">
              <Button onClick={() => save.mutate(editing)} disabled={save.isPending || !editing.artikel_id || !editing.herkomst_label}>
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

// === MS kabel regels ===

type MsKabelRegel = {
  id: string;
  conditie_kabel_type: string | null;
  conditie_oversteek: boolean | null;
  artikel_id: string;
  hoeveelheid: number;
  hoeveelheid_formule: string | null;
  herkomst_label: string;
  sort_order: number;
  actief: boolean;
};

const MS_KABEL_TYPES = ["", "240AL_singel", "630AL_singel", "3x240AL"];
const MS_KABEL_FORMULES = ["", "LengteMeters", "KabelMeters", "RollenBeschermband", "TotaalBuizen", "GeotextielAantal", "AantalOversteken", "BuizenPerOversteek", "OversteekMeters"];

function TriBoolMs({ value, onChange }: { value: boolean | null; onChange: (v: boolean | null) => void }) {
  const str = value === null ? "" : value ? "ja" : "nee";
  return (
    <select value={str} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "ja")} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
      <option value="">— alle —</option>
      <option value="ja">ja</option>
      <option value="nee">nee</option>
    </select>
  );
}

export function MsKabelRegelsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<MsKabelRegel> | null>(null);
  const [toDelete, setToDelete] = useState<MsKabelRegel | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["beheer-mskabel-regels"],
    queryFn: async () => (await supabase.from("ms_kabel_regels").select("*").order("sort_order")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (v: Partial<MsKabelRegel>) => {
      const payload: any = { ...v };
      for (const k of ["conditie_kabel_type", "hoeveelheid_formule"] as const) {
        if (payload[k] === "") payload[k] = null;
      }
      if (v.id) {
        const { error } = await supabase.from("ms_kabel_regels").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ms_kabel_regels").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["beheer-mskabel-regels"] }); qc.invalidateQueries({ queryKey: ["ms_kabel_regels"] }); toast.success("Opgeslagen"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("ms_kabel_regels").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["beheer-mskabel-regels"] }); qc.invalidateQueries({ queryKey: ["ms_kabel_regels"] }); toast.success("Verwijderd"); setToDelete(null); },
  });

  const startNew = () => { setEditing({ hoeveelheid: 1, sort_order: (data as MsKabelRegel[]).length, actief: true, herkomst_label: "MS kabel" }); setOpen(true); };

  const Cond = ({ v }: { v: string | boolean | null }) =>
    v === null || v === undefined ? <span className="text-muted-foreground">—</span> : <span className="font-mono text-xs">{String(v)}</span>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={startNew}><Plus className="h-4 w-4 mr-1" /> MS kabel regel toevoegen</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Conditie op kabel-type en oversteek matcht per kabel-trace. Formules:
        <code> LengteMeters</code>, <code>KabelMeters</code> (singel×3), <code>RollenBeschermband</code> (⌈L/40⌉),
        <code> TotaalBuizen</code> (⌈O/6⌉×N), <code>GeotextielAantal</code> (N×2). Aanvullend label krijgt suffix
        <code> trace {`{idx}`}</code>.
      </p>
      <DataTable
        headers={["Kabeltype", "Oversteek", "Artikel", "Aantal/formule", "Herkomst", "Actief", ""]}
        rowIds={(data as MsKabelRegel[]).map((r) => r.id)}
        rows={(data as MsKabelRegel[]).map((r) => [
          <Cond v={r.conditie_kabel_type} />,
          <Cond v={r.conditie_oversteek} />,
          <ArtikelLabel id={r.artikel_id} />,
          <span className="text-xs">{r.hoeveelheid_formule ?? r.hoeveelheid}</span>,
          <span className="text-xs">{r.herkomst_label}</span>,
          r.actief ? "Ja" : "Nee",
          <RowActions onEdit={() => { setEditing(r); setOpen(true); }} onDelete={() => setToDelete(r)} />,
        ])}
        emptyIcon={Zap}
        emptyMessage="Nog geen MS kabel regels"
        emptyDescription="Conditionele regels voor MS kabel, beschermband, oversteek-buis en geotextiel."
        emptyAction={<Button onClick={startNew}><Plus className="h-4 w-4 mr-1" /> Eerste MS kabel regel</Button>}
      />
      <FormDialog open={open} onOpenChange={setOpen} title={editing?.id ? "MS kabel regel bewerken" : "MS kabel regel toevoegen"} size="lg">
        {editing && (
          <div className="space-y-3">
            <FormRow>
              <FormField label="Kabeltype">
                <select value={editing.conditie_kabel_type ?? ""} onChange={(e) => setEditing({ ...editing, conditie_kabel_type: e.target.value || null })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
                  {MS_KABEL_TYPES.map((x) => <option key={x} value={x}>{x || "— alle —"}</option>)}
                </select>
              </FormField>
              <FormField label="Oversteek vereist">
                <TriBoolMs value={editing.conditie_oversteek ?? null} onChange={(v) => setEditing({ ...editing, conditie_oversteek: v })} />
              </FormField>
            </FormRow>
            <FormField label="Artikel" required>
              <ArtikelZoeker value={editing.artikel_id ?? null} onChange={(id) => setEditing({ ...editing, artikel_id: id ?? undefined })} categorieSuggesties={["MS kabel"]} />
            </FormField>
            <FormRow>
              <FormField label="Hoeveelheid (fallback)">
                <Input type="number" value={editing.hoeveelheid ?? 1} onChange={(e) => setEditing({ ...editing, hoeveelheid: Number(e.target.value) })} className="h-9" />
              </FormField>
              <FormField label="Formule (optioneel)">
                <select value={editing.hoeveelheid_formule ?? ""} onChange={(e) => setEditing({ ...editing, hoeveelheid_formule: e.target.value || null })} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
                  {MS_KABEL_FORMULES.map((x) => <option key={x} value={x}>{x || "— geen —"}</option>)}
                </select>
              </FormField>
              <FormField label="Volgorde">
                <Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className="h-9" />
              </FormField>
            </FormRow>
            <FormField label="Herkomst label">
              <Input value={editing.herkomst_label ?? ""} onChange={(e) => setEditing({ ...editing, herkomst_label: e.target.value })} className="h-9" />
            </FormField>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.actief ?? true} onChange={(e) => setEditing({ ...editing, actief: e.target.checked })} />
              Actief
            </label>
            <div className="flex justify-end pt-2">
              <Button onClick={() => save.mutate(editing)} disabled={save.isPending || !editing.artikel_id || !editing.herkomst_label}>
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

// === RMU veld regels ===
// Vriendelijke versie staat in RmuVeldRegelsTab.tsx
export { RmuVeldRegelsTab } from "./RmuVeldRegelsTab";

