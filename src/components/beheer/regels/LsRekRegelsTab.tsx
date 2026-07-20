import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDelete, DataTable, FormDialog, FormField, FormRow, RowActions } from "../shared";
import { ArtikelZoeker } from "../ArtikelZoeker";
import { ArtikelLabel } from "../RmuTab";
import { LsRekTestPaneel } from "../LsRekTestPaneel";
import { deleteRegel, fetchRegels, saveRegel } from "./regelsRepo";

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

function TriBool({
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

export function LsRekRegelsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<LsRekRegel> | null>(null);
  const [toDelete, setToDelete] = useState<LsRekRegel | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["beheer-lsrek-regels"],
    queryFn: () => fetchRegels<LsRekRegel>("ls_rek_regels"),
  });

  const save = useMutation({
    mutationFn: (v: Partial<LsRekRegel>) => {
      const payload: Record<string, unknown> = { ...v };
      for (const k of [
        "conditie_actie",
        "conditie_lsrek_type",
        "conditie_schroefpatroon",
        "conditie_kva",
        "hoeveelheid_formule",
      ] as const) {
        if (payload[k] === "") payload[k] = null;
      }
      return saveRegel("ls_rek_regels", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-lsrek-regels"] });
      qc.invalidateQueries({ queryKey: ["ls_rek_regels"] });
      toast.success("Opgeslagen");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteRegel("ls_rek_regels", id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beheer-lsrek-regels"] });
      qc.invalidateQueries({ queryKey: ["ls_rek_regels"] });
      toast.success("Verwijderd");
      setToDelete(null);
    },
  });

  const startNew = () => {
    setEditing({
      hoeveelheid: 1,
      sort_order: (data as LsRekRegel[]).length,
      actief: true,
      herkomst_label: "LS-rek",
    });
    setOpen(true);
  };

  const Cond = ({ v }: { v: string | number | boolean | null }) =>
    v === null || v === undefined ? (
      <span className="text-muted-foreground">—</span>
    ) : (
      <span className="font-mono text-xs">{String(v)}</span>
    );

  return (
    <div className="space-y-3">
      <LsRekTestPaneel />
      <div className="flex justify-end">
        <Button onClick={startNew}>
          <Plus className="h-4 w-4 mr-1" /> LS-rek regel toevoegen
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Elke gevulde conditie moet matchen. Lege conditie = matcht altijd. Formule overschrijft het
        aantal-veld als gezet (beschikbaar: <code>lsRekExtraStroken</code>,{" "}
        <code>lsRekAanSluitenKabels</code>, <code>lsRekAanSluitenKabels*2</code>).
      </p>
      <DataTable
        headers={[
          "Compact",
          "Renov",
          "Actie",
          "Type",
          "Bev.aanp",
          "OV",
          "Schroef",
          "kVA",
          "Artikel",
          "Aantal/formule",
          "Herkomst",
          "",
        ]}
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
          <RowActions
            onEdit={() => {
              setEditing(r);
              setOpen(true);
            }}
            onDelete={() => setToDelete(r)}
          />,
        ])}
        emptyIcon={Wrench}
        emptyMessage="Nog geen LS-rek regels"
        emptyDescription="Conditionele regels voor LS-rek, OV-stuurpunt en kabelbevestiging."
        emptyAction={
          <Button onClick={startNew}>
            <Plus className="h-4 w-4 mr-1" /> Eerste LS-rek regel
          </Button>
        }
      />
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing?.id ? "LS-rek regel bewerken" : "LS-rek regel toevoegen"}
        size="lg"
      >
        {editing && (
          <div className="space-y-3">
            <FormRow>
              <FormField label="Compact">
                <TriBool
                  value={editing.conditie_compact ?? null}
                  onChange={(v) => setEditing({ ...editing, conditie_compact: v })}
                />
              </FormField>
              <FormField label="Renovatie">
                <TriBool
                  value={editing.conditie_renovatie ?? null}
                  onChange={(v) => setEditing({ ...editing, conditie_renovatie: v })}
                />
              </FormField>
              <FormField label="Bev. aanpassen vereist">
                <TriBool
                  value={editing.conditie_beveiliging_aanpassen ?? null}
                  onChange={(v) => setEditing({ ...editing, conditie_beveiliging_aanpassen: v })}
                />
              </FormField>
              <FormField label="OV-stuurpunt vereist">
                <TriBool
                  value={editing.conditie_ov_stuurpunt ?? null}
                  onChange={(v) => setEditing({ ...editing, conditie_ov_stuurpunt: v })}
                />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label="Actie">
                <select
                  value={editing.conditie_actie ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, conditie_actie: e.target.value || null })
                  }
                  className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                >
                  {LS_ACTIES.map((x) => (
                    <option key={x} value={x}>
                      {x || "— alle —"}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="LS-rek type">
                <select
                  value={editing.conditie_lsrek_type ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, conditie_lsrek_type: e.target.value || null })
                  }
                  className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                >
                  {LS_TYPES.map((x) => (
                    <option key={x} value={x}>
                      {x || "— alle —"}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Schroefpatroon">
                <select
                  value={editing.conditie_schroefpatroon ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, conditie_schroefpatroon: e.target.value || null })
                  }
                  className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                >
                  {LS_SCHROEF.map((x) => (
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
                  {LS_KVAS.map((x) => (
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
                categorieSuggesties={["LS-rek", "OV-stuurpunt"]}
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
                  {LS_FORMULES.map((x) => (
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
