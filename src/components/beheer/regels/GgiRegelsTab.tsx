import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDelete, DataTable, FormDialog, FormField, FormRow, RowActions } from "../shared";
import { ArtikelZoeker } from "../ArtikelZoeker";
import { ArtikelLabel } from "../RmuTab";
import { deleteRegel, fetchRegels, saveRegel } from "./regelsRepo";

type Ggi = {
  id: string;
  artikel_id: string;
  hoeveelheid: number;
  sort_order: number;
  actief: boolean;
};

export function GgiRegelsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Ggi> | null>(null);
  const [toDelete, setToDelete] = useState<Ggi | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["beheer-ggi"],
    queryFn: () => fetchRegels<Ggi>("ggi_artikelen"),
  });

  const save = useMutation({
    mutationFn: (v: Partial<Ggi>) => saveRegel("ggi_artikelen", v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-ggi"] });
      qc.invalidateQueries({ queryKey: ["ggi_artikelen"] });
      toast.success("Opgeslagen");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteRegel("ggi_artikelen", id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-ggi"] });
      qc.invalidateQueries({ queryKey: ["ggi_artikelen"] });
      toast.success("Verwijderd");
      setToDelete(null);
    },
  });

  const startNew = () => {
    setEditing({ hoeveelheid: 1, sort_order: (data as Ggi[]).length, actief: true });
    setOpen(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={startNew}>
          <Plus className="h-4 w-4 mr-1" /> GGI artikel toevoegen
        </Button>
      </div>
      <DataTable
        headers={["Volgorde", "Artikel", "Hoeveelheid", "Actief", ""]}
        rowIds={(data as Ggi[]).map((g) => g.id)}
        rows={(data as Ggi[]).map((g) => [
          g.sort_order,
          <ArtikelLabel id={g.artikel_id} />,
          g.hoeveelheid,
          g.actief ? "Ja" : "Nee",
          <RowActions
            onEdit={() => {
              setEditing(g);
              setOpen(true);
            }}
            onDelete={() => setToDelete(g)}
          />,
        ])}
        emptyIcon={Wrench}
        emptyMessage="Nog geen GGI artikelen"
        emptyDescription="Artikelen die bij GGI vervangen (renovatie) op de bestellijst komen."
        emptyAction={
          <Button onClick={startNew}>
            <Plus className="h-4 w-4 mr-1" /> Eerste GGI artikel
          </Button>
        }
      />
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing?.id ? "GGI artikel bewerken" : "GGI artikel toevoegen"}
      >
        {editing && (
          <div className="space-y-3">
            <FormField label="Artikel" required>
              <ArtikelZoeker
                value={editing.artikel_id ?? null}
                onChange={(id) => setEditing({ ...editing, artikel_id: id ?? undefined })}
                categorieSuggesties={["GGI"]}
              />
            </FormField>
            <FormRow>
              <FormField label="Hoeveelheid">
                <Input
                  type="number"
                  value={editing.hoeveelheid ?? 1}
                  onChange={(e) => setEditing({ ...editing, hoeveelheid: Number(e.target.value) })}
                  className="h-9"
                />
              </FormField>
              <FormField label="Volgorde">
                <Input
                  type="number"
                  value={editing.sort_order ?? 0}
                  onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                  className="h-9"
                />
              </FormField>
            </FormRow>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.actief ?? true}
                onChange={(e) => setEditing({ ...editing, actief: e.target.checked })}
              />
              Actief
            </label>
            <div className="flex justify-end pt-2">
              <Button
                onClick={() => save.mutate(editing)}
                disabled={save.isPending || !editing.artikel_id}
              >
                {save.isPending ? "Opslaan..." : "Opslaan"}
              </Button>
            </div>
          </div>
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
