import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ConfirmDelete, DataTable, FormDialog, FormField, FormRow, RowActions } from "../shared";
import { ArtikelZoeker } from "../ArtikelZoeker";
import { ArtikelLabel } from "../RmuTab";
import { CASE_TYPE_LABELS } from "@/lib/configurator/types";
import { deleteVraagRegel, fetchVraagRegels, saveVraagRegel } from "./maatwerkRepo";
import { TYPE_LABELS, type RegelRij, type VraagRij } from "./types";

/** Eén vraag met uitklapbare artikel-regels per antwoord. */
export function VraagKaart({
  vraag,
  plaatsingLabel,
  isOpen,
  onToggle,
  onEdit,
  onDelete,
  onInvalideer,
}: {
  vraag: VraagRij;
  plaatsingLabel: string;
  isOpen: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onInvalideer: () => void;
}) {
  const qc = useQueryClient();
  const [regelOpen, setRegelOpen] = useState(false);
  const [regelEditing, setRegelEditing] = useState<Partial<RegelRij> | null>(null);
  const [regelDelete, setRegelDelete] = useState<RegelRij | null>(null);

  const { data: regels = [] } = useQuery({
    queryKey: ["beheer-eigen-vraag-regels", vraag.id],
    enabled: isOpen,
    queryFn: () => fetchVraagRegels(vraag.id),
  });

  const invalideer = () => {
    qc.invalidateQueries({ queryKey: ["beheer-eigen-vraag-regels", vraag.id] });
    onInvalideer();
  };

  const saveRegel = useMutation({
    mutationFn: (r: Partial<RegelRij>) => saveVraagRegel({ ...r, vraag_id: vraag.id }),
    onSuccess: () => {
      invalideer();
      toast.success("Regel opgeslagen");
      setRegelOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delRegel = useMutation({
    mutationFn: (id: string) => deleteVraagRegel(id),
    onSuccess: () => {
      invalideer();
      toast.success("Regel verwijderd");
      setRegelDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const antwoordOpties: string[] =
    vraag.type === "ja_nee"
      ? ["ja", "nee", "*"]
      : vraag.type === "keuze"
        ? [...vraag.opties, "*"]
        : ["*"];

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/20 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{vraag.label}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wider">
              {TYPE_LABELS[vraag.type] ?? vraag.type}
            </span>
            {!vraag.actief && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive uppercase tracking-wider">
                Uit
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Geldt voor:{" "}
            {vraag.van_toepassing_bij.length === 0
              ? "alle case types"
              : vraag.van_toepassing_bij.map((ct) => CASE_TYPE_LABELS[ct] ?? ct).join(", ")}
            {" · "}in {plaatsingLabel}
            {" · "}sleutel <span className="font-mono">{vraag.vraag_key}</span>
          </p>
        </div>
        <RowActions onEdit={onEdit} onDelete={onDelete} />
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <div className="border-t border-border px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Gekoppelde artikelen per antwoord
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRegelEditing({
                  antwoord:
                    vraag.type === "ja_nee"
                      ? "ja"
                      : vraag.type === "keuze"
                        ? (vraag.opties[0] ?? "*")
                        : "*",
                  hoeveelheid: 1,
                  per_eenheid: vraag.type === "aantal",
                  actief: true,
                  sort_order: regels.length + 1,
                });
                setRegelOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Artikel koppelen
            </Button>
          </div>
          {regels.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">
              Nog geen artikelen gekoppeld — de vraag doet dan nog niets in de winkelwagen.
            </p>
          )}
          {regels.length > 0 && (
            <DataTable
              headers={["Bij antwoord", "Artikel", "Hoeveelheid", "Actief", ""]}
              rowIds={regels.map((r) => r.id)}
              rows={regels.map((r) => [
                <span className="font-mono text-xs">
                  {r.antwoord === "*" ? "elk antwoord" : r.antwoord}
                </span>,
                <ArtikelLabel id={r.artikel_id} />,
                <span className="text-xs">
                  {r.hoeveelheid}
                  {vraag.type === "aantal" && r.per_eenheid && " × ingevuld aantal"}
                </span>,
                r.actief ? "Ja" : <span className="text-muted-foreground">Nee</span>,
                <RowActions
                  onEdit={() => {
                    setRegelEditing(r);
                    setRegelOpen(true);
                  }}
                  onDelete={() => setRegelDelete(r)}
                />,
              ])}
            />
          )}
        </div>
      )}

      <FormDialog
        open={regelOpen}
        onOpenChange={setRegelOpen}
        title={regelEditing?.id ? "Regel bewerken" : "Artikel koppelen"}
      >
        {regelEditing && (
          <div className="space-y-3">
            <FormField label="Bij antwoord" required hint="* = bij elk (niet-leeg) antwoord.">
              <select
                value={regelEditing.antwoord ?? "*"}
                onChange={(e) => setRegelEditing({ ...regelEditing, antwoord: e.target.value })}
                className="h-9 rounded-md border border-border bg-surface px-2 text-sm w-full"
              >
                {antwoordOpties.map((o) => (
                  <option key={o} value={o}>
                    {o === "*" ? "elk antwoord (*)" : o}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Artikel" required>
              <ArtikelZoeker
                value={regelEditing.artikel_id ?? null}
                onChange={(id) => setRegelEditing({ ...regelEditing, artikel_id: id ?? undefined })}
              />
            </FormField>
            <FormRow>
              <FormField label="Hoeveelheid" required>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={regelEditing.hoeveelheid ?? 1}
                  onChange={(e) =>
                    setRegelEditing({ ...regelEditing, hoeveelheid: Number(e.target.value) })
                  }
                  className="h-9"
                />
              </FormField>
              {vraag.type === "aantal" && (
                <FormField
                  label="Vermenigvuldigen"
                  hint="Aan: totaal = hoeveelheid × ingevuld aantal."
                >
                  <div className="flex items-center gap-2 h-9">
                    <Switch
                      checked={regelEditing.per_eenheid ?? false}
                      onCheckedChange={(c) => setRegelEditing({ ...regelEditing, per_eenheid: c })}
                    />
                    <span className="text-sm">× ingevuld aantal</span>
                  </div>
                </FormField>
              )}
            </FormRow>
            <div className="flex items-center gap-2">
              <Switch
                checked={regelEditing.actief ?? true}
                onCheckedChange={(c) => setRegelEditing({ ...regelEditing, actief: c })}
              />
              <span className="text-sm">Actief</span>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                onClick={() => saveRegel.mutate(regelEditing)}
                disabled={
                  saveRegel.isPending ||
                  !regelEditing.artikel_id ||
                  (regelEditing.hoeveelheid ?? 0) <= 0
                }
              >
                {saveRegel.isPending ? "Opslaan..." : "Opslaan"}
              </Button>
            </div>
          </div>
        )}
      </FormDialog>
      <ConfirmDelete
        open={!!regelDelete}
        onOpenChange={(o) => !o && setRegelDelete(null)}
        onConfirm={() => regelDelete && delRegel.mutate(regelDelete.id)}
      />
    </div>
  );
}
