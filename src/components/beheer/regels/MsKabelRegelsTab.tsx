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
const MS_KABEL_FORMULES = [
  "",
  "LengteMeters",
  "KabelMeters",
  "RollenBeschermband",
  "TotaalBuizen",
  "GeotextielAantal",
  "AantalOversteken",
  "BuizenPerOversteek",
  "OversteekMeters",
];

function TriBoolMs({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
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

export function MsKabelRegelsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<MsKabelRegel> | null>(null);
  const [toDelete, setToDelete] = useState<MsKabelRegel | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["beheer-mskabel-regels"],
    queryFn: () => fetchRegels<MsKabelRegel>("ms_kabel_regels"),
  });

  const save = useMutation({
    mutationFn: (v: Partial<MsKabelRegel>) => {
      const payload: Record<string, unknown> = { ...v };
      for (const k of ["conditie_kabel_type", "hoeveelheid_formule"] as const) {
        if (payload[k] === "") payload[k] = null;
      }
      return saveRegel("ms_kabel_regels", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-mskabel-regels"] });
      qc.invalidateQueries({ queryKey: ["ms_kabel_regels"] });
      toast.success("Opgeslagen");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteRegel("ms_kabel_regels", id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-mskabel-regels"] });
      qc.invalidateQueries({ queryKey: ["ms_kabel_regels"] });
      toast.success("Verwijderd");
      setToDelete(null);
    },
  });

  const startNew = () => {
    setEditing({
      hoeveelheid: 1,
      sort_order: (data as MsKabelRegel[]).length,
      actief: true,
      herkomst_label: "MS kabel",
    });
    setOpen(true);
  };

  const Cond = ({ v }: { v: string | boolean | null }) =>
    v === null || v === undefined ? (
      <span className="text-muted-foreground">—</span>
    ) : (
      <span className="font-mono text-xs">{String(v)}</span>
    );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={startNew}>
          <Plus className="h-4 w-4 mr-1" /> MS kabel regel toevoegen
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Conditie op kabel-type en oversteek matcht per kabel-trace. Formules:
        <code> LengteMeters</code>, <code>KabelMeters</code> (singel×3),{" "}
        <code>RollenBeschermband</code> (⌈L/40⌉),
        <code> TotaalBuizen</code> (⌈O/6⌉×N), <code>GeotextielAantal</code> (N×2). Aanvullend label
        krijgt suffix
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
          <RowActions
            onEdit={() => {
              setEditing(r);
              setOpen(true);
            }}
            onDelete={() => setToDelete(r)}
          />,
        ])}
        emptyIcon={Zap}
        emptyMessage="Nog geen MS kabel regels"
        emptyDescription="Conditionele regels voor MS kabel, beschermband, oversteek-buis en geotextiel."
        emptyAction={
          <Button onClick={startNew}>
            <Plus className="h-4 w-4 mr-1" /> Eerste MS kabel regel
          </Button>
        }
      />
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing?.id ? "MS kabel regel bewerken" : "MS kabel regel toevoegen"}
        size="lg"
      >
        {editing && (
          <div className="space-y-3">
            <FormRow>
              <FormField label="Kabeltype">
                <select
                  value={editing.conditie_kabel_type ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, conditie_kabel_type: e.target.value || null })
                  }
                  className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                >
                  {MS_KABEL_TYPES.map((x) => (
                    <option key={x} value={x}>
                      {x || "— alle —"}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Oversteek vereist">
                <TriBoolMs
                  value={editing.conditie_oversteek ?? null}
                  onChange={(v) => setEditing({ ...editing, conditie_oversteek: v })}
                />
              </FormField>
            </FormRow>
            <FormField label="Artikel" required>
              <ArtikelZoeker
                value={editing.artikel_id ?? null}
                onChange={(id) => setEditing({ ...editing, artikel_id: id ?? undefined })}
                categorieSuggesties={["MS kabel"]}
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
                  {MS_KABEL_FORMULES.map((x) => (
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
