import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDelete, DataTable, FormDialog, FormField, FormRow, RowActions } from "../shared";
import { ArtikelZoeker } from "../ArtikelZoeker";
import { ArtikelLabel } from "../RmuTab";
import { deleteRegel, fetchRegels, saveRegel } from "./regelsRepo";

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
    queryFn: () => fetchRegels<TrafoRegel>("trafo_regels"),
  });

  const save = useMutation({
    mutationFn: (v: Partial<TrafoRegel>) => {
      // Lege strings → null voor condities
      const payload: Record<string, unknown> = { ...v };
      for (const k of ["conditie_actie", "conditie_kva", "conditie_kabel_lengte"] as const) {
        if (payload[k] === "") payload[k] = null;
      }
      return saveRegel("trafo_regels", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-trafo-regels"] });
      qc.invalidateQueries({ queryKey: ["trafo_regels"] });
      toast.success("Opgeslagen");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteRegel("trafo_regels", id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-trafo-regels"] });
      qc.invalidateQueries({ queryKey: ["trafo_regels"] });
      toast.success("Verwijderd");
      setToDelete(null);
    },
  });

  const startNew = () => {
    setEditing({
      hoeveelheid: 1,
      sort_order: (data as TrafoRegel[]).length,
      actief: true,
      herkomst_label: "Trafo",
    });
    setOpen(true);
  };

  const Cond = ({ v }: { v: string | null }) =>
    v == null ? (
      <span className="text-muted-foreground">—</span>
    ) : (
      <span className="font-mono text-xs">{v}</span>
    );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={startNew}>
          <Plus className="h-4 w-4 mr-1" /> Trafo regel toevoegen
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Een regel matcht als elke <em>gevulde</em> conditie gelijk is aan de configuratie. Leeg =
        matcht altijd. Regels met <em>actie</em> vereisen dat zowel <em>actie</em> als <em>kVA</em>{" "}
        in de case gezet zijn.
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
          <RowActions
            onEdit={() => {
              setEditing(r);
              setOpen(true);
            }}
            onDelete={() => setToDelete(r)}
          />,
        ])}
        emptyIcon={Zap}
        emptyMessage="Nog geen trafo regels"
        emptyDescription="Conditionele regels voor trafo, aansluitvlag en telcon klem."
        emptyAction={
          <Button onClick={startNew}>
            <Plus className="h-4 w-4 mr-1" /> Eerste trafo regel
          </Button>
        }
      />
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing?.id ? "Trafo regel bewerken" : "Trafo regel toevoegen"}
        size="lg"
      >
        {editing && (
          <div className="space-y-3">
            <FormRow>
              <FormField label="Conditie: actie">
                <select
                  value={editing.conditie_actie ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, conditie_actie: e.target.value || null })
                  }
                  className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                >
                  {ACTIES.map((a) => (
                    <option key={a} value={a}>
                      {a || "— alle —"}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Conditie: kVA">
                <select
                  value={editing.conditie_kva ?? ""}
                  onChange={(e) => setEditing({ ...editing, conditie_kva: e.target.value || null })}
                  className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                >
                  {KVAS.map((k) => (
                    <option key={k} value={k}>
                      {k || "— alle —"}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Conditie: kabellengte">
                <select
                  value={editing.conditie_kabel_lengte ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, conditie_kabel_lengte: e.target.value || null })
                  }
                  className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                >
                  {LENGTES.map((l) => (
                    <option key={l} value={l}>
                      {l || "— alle —"}
                    </option>
                  ))}
                </select>
              </FormField>
            </FormRow>
            <FormField label="Artikel" required>
              <ArtikelZoeker
                value={editing.artikel_id ?? null}
                onChange={(id) => setEditing({ ...editing, artikel_id: id ?? undefined })}
                categorieSuggesties={["Trafo"]}
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
              <FormField label="Herkomst label">
                <Input
                  value={editing.herkomst_label ?? ""}
                  onChange={(e) => setEditing({ ...editing, herkomst_label: e.target.value })}
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
                disabled={save.isPending || !editing.artikel_id || !editing.herkomst_label}
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
