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
const PROV_FORMULES = [
  "",
  "perFVeld",
  "perFVeld*3",
  "provInbMsKabels",
  "provInbLsKabels",
  "ifInbMsThen1",
];

export function ProvRegelsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<ProvRegel> | null>(null);
  const [toDelete, setToDelete] = useState<ProvRegel | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["beheer-prov-regels"],
    queryFn: () => fetchRegels<ProvRegel>("prov_regels"),
  });

  const save = useMutation({
    mutationFn: (v: Partial<ProvRegel>) => {
      const payload: Record<string, unknown> = { ...v };
      for (const k of ["conditie_merk", "conditie_kva", "hoeveelheid_formule"] as const) {
        if (payload[k] === "") payload[k] = null;
      }
      return saveRegel("prov_regels", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-prov-regels"] });
      qc.invalidateQueries({ queryKey: ["prov_regels"] });
      toast.success("Opgeslagen");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteRegel("prov_regels", id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-prov-regels"] });
      qc.invalidateQueries({ queryKey: ["prov_regels"] });
      toast.success("Verwijderd");
      setToDelete(null);
    },
  });

  const startNew = () => {
    setEditing({
      hoeveelheid: 1,
      sort_order: (data as ProvRegel[]).length,
      actief: true,
      herkomst_label: "Provisorium",
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
          <Plus className="h-4 w-4 mr-1" /> Provisorium regel toevoegen
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Conditie merk/kVA matcht op <code>provRmuMerk</code> en <code>provZekeringKva</code>.
        Formules:
        <code>perFVeld</code>, <code>perFVeld*3</code>, <code>provInbMsKabels</code>,{" "}
        <code>provInbLsKabels</code>, <code>ifInbMsThen1</code>.
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
          <RowActions
            onEdit={() => {
              setEditing(r);
              setOpen(true);
            }}
            onDelete={() => setToDelete(r)}
          />,
        ])}
        emptyIcon={Wrench}
        emptyMessage="Nog geen provisorium regels"
        emptyDescription="Conditionele regels voor provisorium F-velden, buispatronen en in-bedrijfname."
        emptyAction={
          <Button onClick={startNew}>
            <Plus className="h-4 w-4 mr-1" /> Eerste provisorium regel
          </Button>
        }
      />
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing?.id ? "Provisorium regel bewerken" : "Provisorium regel toevoegen"}
        size="lg"
      >
        {editing && (
          <div className="space-y-3">
            <FormRow>
              <FormField label="Merk">
                <select
                  value={editing.conditie_merk ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, conditie_merk: e.target.value || null })
                  }
                  className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                >
                  {PROV_MERKEN.map((x) => (
                    <option key={x} value={x}>
                      {x || "— alle —"}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="kVA">
                <select
                  value={editing.conditie_kva ?? ""}
                  onChange={(e) => setEditing({ ...editing, conditie_kva: e.target.value || null })}
                  className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                >
                  {PROV_KVAS.map((x) => (
                    <option key={x} value={x}>
                      {x || "— alle —"}
                    </option>
                  ))}
                </select>
              </FormField>
            </FormRow>
            <FormField label="Artikel" required>
              <ArtikelZoeker
                value={editing.artikel_id ?? null}
                onChange={(id) => setEditing({ ...editing, artikel_id: id ?? undefined })}
                categorieSuggesties={["RMU", "LS-rek"]}
              />
            </FormField>
            <FormRow>
              <FormField label="Hoeveelheid (fallback)">
                <Input
                  type="number"
                  value={editing.hoeveelheid ?? 1}
                  onChange={(e) => setEditing({ ...editing, hoeveelheid: Number(e.target.value) })}
                  className="h-9"
                />
              </FormField>
              <FormField label="Formule (optioneel)">
                <select
                  value={editing.hoeveelheid_formule ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, hoeveelheid_formule: e.target.value || null })
                  }
                  className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                >
                  {PROV_FORMULES.map((x) => (
                    <option key={x} value={x}>
                      {x || "— geen —"}
                    </option>
                  ))}
                </select>
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
            <FormField label="Herkomst label">
              <Input
                value={editing.herkomst_label ?? ""}
                onChange={(e) => setEditing({ ...editing, herkomst_label: e.target.value })}
                className="h-9"
              />
            </FormField>
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
