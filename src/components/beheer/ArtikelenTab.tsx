import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDelete, DataTable, FormDialog, FormField, FormRow, RowActions } from "./shared";
import { cn } from "@/lib/utils";

type Artikel = {
  id: string;
  artikel_nummer: string;
  korte_omschrijving: string;
  eenheid: string;
  basis_eenheid: string | null;
  aantal_in_verpakking: number | null;
  categorie: string | null;
  status: string | null;
  alternatief_artikel_nummer: string | null;
  actief: boolean;
};

const STATUSSEN = ["Actief", "Uitloop", "Geblokkeerd"];
const EENHEDEN = ["Stuks", "Doos", "Rol", "Meter"];
const BASIS_EENHEDEN = ["ST", "M", "ROL"];
const PAGE = 50;

function emptyArtikel(): Partial<Artikel> {
  return { artikel_nummer: "", korte_omschrijving: "", eenheid: "Stuks", status: "Actief", actief: true };
}

export function ArtikelenTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Artikel> | null>(null);
  const [toDelete, setToDelete] = useState<Artikel | null>(null);

  const { data: categorieen = [] } = useQuery({
    queryKey: ["artikel-categorieen"],
    queryFn: async () => {
      const { data } = await supabase.from("artikelen").select("categorie").not("categorie", "is", null);
      return Array.from(new Set((data ?? []).map((r) => r.categorie).filter(Boolean))) as string[];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["beheer-artikelen", search, statusFilter, catFilter, page],
    queryFn: async () => {
      let q = supabase.from("artikelen").select("*", { count: "exact" }).order("artikel_nummer");
      if (search.trim().length >= 2) {
        const s = search.replace(/[%,]/g, "");
        q = q.or(`artikel_nummer.ilike.%${s}%,korte_omschrijving.ilike.%${s}%`);
      }
      if (statusFilter) q = q.eq("status", statusFilter);
      if (catFilter) q = q.eq("categorie", catFilter);
      q = q.range(page * PAGE, page * PAGE + PAGE - 1);
      const { data, count } = await q;
      return { rows: (data ?? []) as Artikel[], count: count ?? 0 };
    },
  });

  const save = useMutation({
    mutationFn: async (a: Partial<Artikel>) => {
      const payload = { ...a };
      if (a.id) {
        const { error } = await supabase.from("artikelen").update(payload).eq("id", a.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("artikelen").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-artikelen"] });
      toast.success("Opgeslagen");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Opslaan mislukt"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("artikelen").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-artikelen"] });
      toast.success("Verwijderd");
      setToDelete(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Verwijderen mislukt"),
  });

  const total = data?.count ?? 0;
  const maxPage = Math.max(0, Math.ceil(total / PAGE) - 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Zoek op nummer of omschrijving..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className="h-9 max-w-xs"
        />
        <select
          value={catFilter}
          onChange={(e) => {
            setCatFilter(e.target.value);
            setPage(0);
          }}
          className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
        >
          <option value="">Alle categorieën</option>
          {categorieen.sort().map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
          className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
        >
          <option value="">Alle statussen</option>
          {STATUSSEN.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <Button
          onClick={() => {
            setEditing(emptyArtikel());
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Artikel toevoegen
        </Button>
      </div>

      <DataTable
        headers={["Nummer", "Omschrijving", "Eenheid", "Categorie", "Status", "Actief", ""]}
        rows={(data?.rows ?? []).map((a) => [
          <span className="font-mono text-xs">{a.artikel_nummer}</span>,
          a.korte_omschrijving,
          a.eenheid,
          a.categorie ?? "—",
          <StatusBadge status={a.status} />,
          a.actief ? "Ja" : "Nee",
          <RowActions
            onEdit={() => {
              setEditing(a);
              setOpen(true);
            }}
            onDelete={() => setToDelete(a)}
          />,
        ])}
        emptyMessage={isLoading ? "Laden..." : "Geen artikelen gevonden."}
        emptyAction={
          <Button
            onClick={() => {
              setEditing(emptyArtikel());
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Eerste artikel toevoegen
          </Button>
        }
      />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{total} artikelen</span>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" className="h-7 w-7" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span>
            {page + 1} / {maxPage + 1}
          </span>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            disabled={page >= maxPage}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <FormDialog open={open} onOpenChange={setOpen} title={editing?.id ? "Artikel bewerken" : "Artikel toevoegen"} size="lg">
        {editing && <ArtikelForm value={editing} onChange={setEditing} onSave={() => save.mutate(editing)} saving={save.isPending} />}
      </FormDialog>

      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
        title="Artikel verwijderen?"
        description={toDelete ? `${toDelete.artikel_nummer} – ${toDelete.korte_omschrijving}` : ""}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const cls =
    status === "Geblokkeerd"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : status === "Uitloop"
        ? "bg-warning/15 text-warning border-warning/30"
        : "bg-success/15 text-success border-success/30";
  return <span className={cn("inline-block rounded border px-2 py-0.5 text-[10px]", cls)}>{status}</span>;
}

function ArtikelForm({
  value,
  onChange,
  onSave,
  saving,
}: {
  value: Partial<Artikel>;
  onChange: (v: Partial<Artikel>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const set = (patch: Partial<Artikel>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-3">
      <FormRow>
        <FormField label="Artikelnummer" required>
          <Input value={value.artikel_nummer ?? ""} onChange={(e) => set({ artikel_nummer: e.target.value })} className="h-9 font-mono" />
        </FormField>
        <FormField label="Status">
          <select
            value={value.status ?? "Actief"}
            onChange={(e) => set({ status: e.target.value })}
            className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
          >
            {STATUSSEN.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FormField>
      </FormRow>
      <FormField label="Korte omschrijving" required>
        <Input value={value.korte_omschrijving ?? ""} onChange={(e) => set({ korte_omschrijving: e.target.value })} className="h-9" />
      </FormField>
      <FormRow cols={3}>
        <FormField label="Eenheid">
          <select
            value={value.eenheid ?? "Stuks"}
            onChange={(e) => set({ eenheid: e.target.value })}
            className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
          >
            {EENHEDEN.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Basis eenheid">
          <select
            value={value.basis_eenheid ?? ""}
            onChange={(e) => set({ basis_eenheid: e.target.value || null })}
            className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
          >
            <option value="">—</option>
            {BASIS_EENHEDEN.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Aantal in verpakking">
          <Input
            type="number"
            value={value.aantal_in_verpakking ?? ""}
            onChange={(e) => set({ aantal_in_verpakking: e.target.value ? Number(e.target.value) : null })}
            className="h-9"
          />
        </FormField>
      </FormRow>
      <FormRow>
        <FormField label="Categorie">
          <Input value={value.categorie ?? ""} onChange={(e) => set({ categorie: e.target.value || null })} className="h-9" />
        </FormField>
        <FormField label="Alternatief artikelnummer">
          <Input
            value={value.alternatief_artikel_nummer ?? ""}
            onChange={(e) => set({ alternatief_artikel_nummer: e.target.value || null })}
            className="h-9 font-mono"
          />
        </FormField>
      </FormRow>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value.actief ?? true} onChange={(e) => set({ actief: e.target.checked })} />
        Actief (bestelbaar in configurator)
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onSave} disabled={saving || !value.artikel_nummer || !value.korte_omschrijving}>
          {saving ? "Opslaan..." : "Opslaan"}
        </Button>
      </div>
    </div>
  );
}
