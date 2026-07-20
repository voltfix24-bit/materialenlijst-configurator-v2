import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, ChevronLeft, ChevronRight, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDelete, DataTable, FormDialog, FormField, FormRow, RowActions } from "./shared";
import {
  deleteArtikel,
  fetchArtikelCategorieen,
  fetchArtikelenPaged,
  saveArtikel,
  type BeheerArtikel as Artikel,
} from "@/lib/data/artikelenRepo";
import { cn } from "@/lib/utils";

const STATUSSEN = ["Actief", "Uitgelopen", "Geblokkeerd"];
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
    queryFn: fetchArtikelCategorieen,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["beheer-artikelen", search, statusFilter, catFilter, page],
    queryFn: () =>
      fetchArtikelenPaged({
        search,
        status: statusFilter,
        categorie: catFilter,
        page,
        pageSize: PAGE,
      }),
  });

  const save = useMutation({
    mutationFn: (a: Partial<Artikel>) => saveArtikel(a),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-artikelen"] });
      toast.success("Opgeslagen");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message ?? "Opslaan mislukt"),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteArtikel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-artikelen"] });
      toast.success("Verwijderd");
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message ?? "Verwijderen mislukt"),
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
        rowIds={(data?.rows ?? []).map((a) => a.id)}
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
        loading={isLoading}
        emptyIcon={Package}
        emptyMessage="Nog geen artikelen"
        emptyDescription="Upload eerst de assortimentslijst via de Assortiment tab."
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
  // Legacy alias: oude DB-waarde "Uitloop" wordt als "Uitgelopen" behandeld.
  const isUitgelopen = status === "Uitgelopen" || status === "Uitloop";
  const cls =
    status === "Geblokkeerd"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : isUitgelopen
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
