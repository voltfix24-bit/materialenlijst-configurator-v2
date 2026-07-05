import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronDown, HelpCircle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ConfirmDelete, DataTable, FormDialog, FormField, FormRow, RowActions } from "./shared";
import { ArtikelZoeker } from "./ArtikelZoeker";
import { ArtikelLabel } from "./RmuTab";
import { CASE_TYPE_LABELS } from "@/lib/configurator/types";

/**
 * Eigen vragen: nieuwe configuratorvragen toevoegen zonder code.
 * Vraag aanmaken (ja/nee, keuzelijst of aantal) → per antwoord artikelen
 * koppelen → de vraag verschijnt direct in de configurator (sectie "Eigen
 * vragen") en in de Proefcase-simulator.
 */

const TYPE_LABELS: Record<string, string> = {
  ja_nee: "Ja / nee",
  keuze: "Keuzelijst",
  aantal: "Aantal",
};

const CASE_TYPE_KEYS = ["NSA", "provisorium", "compact", "compact_prov"];

interface VraagRij {
  id: string;
  vraag_key: string;
  label: string;
  uitleg: string | null;
  type: string;
  opties: string[];
  van_toepassing_bij: string[];
  actief: boolean;
  sort_order: number;
}

interface RegelRij {
  id: string;
  vraag_id: string;
  antwoord: string;
  artikel_id: string;
  hoeveelheid: number;
  per_eenheid: boolean;
  actief: boolean;
  sort_order: number;
}

/** Maak een stabiele vraag_key uit het label: "Is er graafwerk?" → "is_er_graafwerk". */
function keyUitLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function EigenVragenTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<VraagRij> | null>(null);
  const [toDelete, setToDelete] = useState<VraagRij | null>(null);
  const [openVraag, setOpenVraag] = useState<string | null>(null);

  const {
    data: vragen = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["beheer-eigen-vragen"],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maatwerk_vragen")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as VraagRij[];
    },
  });

  const invalideer = () => {
    qc.invalidateQueries({ queryKey: ["beheer-eigen-vragen"] });
    qc.invalidateQueries({ queryKey: ["maatwerk_vragen"] });
  };

  const save = useMutation({
    mutationFn: async (v: Partial<VraagRij>) => {
      const payload = {
        ...v,
        vraag_key: v.vraag_key || keyUitLabel(v.label ?? ""),
        opties: v.type === "keuze" ? (v.opties ?? []).filter((o) => o.trim() !== "") : [],
      };
      if (v.id) {
        const { error } = await supabase.from("maatwerk_vragen").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("maatwerk_vragen")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalideer();
      toast.success("Vraag opgeslagen");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("maatwerk_vragen").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalideer();
      toast.success("Vraag en gekoppelde regels verwijderd");
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (error) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
        De tabel <code className="font-mono">maatwerk_vragen</code> bestaat nog niet — voer eerst de
        migratie <code className="font-mono">20260705200000_eigen_vragen.sql</code> uit.
      </div>
    );
  }

  const optiesTekst = (editing?.opties ?? []).join("\n");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground max-w-xl">
          Voeg zelf een vraag toe aan de configurator zonder code: kies het type (ja/nee, keuzelijst
          of aantal), koppel per antwoord artikelen, en de vraag verschijnt direct in de sectie{" "}
          <strong>Eigen vragen</strong> van de configurator én in de Proefcase-simulator.
        </p>
        <Button
          onClick={() => {
            setEditing({
              type: "ja_nee",
              actief: true,
              van_toepassing_bij: [],
              opties: [],
              sort_order: vragen.length + 1,
            });
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Vraag toevoegen
        </Button>
      </div>

      {!isLoading && vragen.length === 0 && (
        <DataTable
          headers={["Vraag", "Type", "Geldt voor", "Actief", ""]}
          rows={[]}
          emptyIcon={HelpCircle}
          emptyMessage="Nog geen eigen vragen"
          emptyDescription="Bijvoorbeeld: 'Is er graafwerk nodig?' met per antwoord de artikelen die dan meekomen."
        />
      )}

      {vragen.map((v) => (
        <VraagKaart
          key={v.id}
          vraag={v}
          isOpen={openVraag === v.id}
          onToggle={() => setOpenVraag(openVraag === v.id ? null : v.id)}
          onEdit={() => {
            setEditing(v);
            setOpen(true);
          }}
          onDelete={() => setToDelete(v)}
          onInvalideer={invalideer}
        />
      ))}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing?.id ? "Vraag bewerken" : "Vraag toevoegen"}
        size="lg"
      >
        {editing && (
          <div className="space-y-3">
            <FormField
              label="Vraag (label)"
              required
              hint="Zoals de engineer hem in de configurator ziet."
            >
              <Input
                value={editing.label ?? ""}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                placeholder="Is er graafwerk nodig?"
                className="h-9"
              />
            </FormField>
            <FormRow>
              <FormField
                label="Type"
                required
                hint={
                  editing.id
                    ? "Type wijzigen kan bestaande antwoorden onbruikbaar maken."
                    : undefined
                }
              >
                <select
                  value={editing.type ?? "ja_nee"}
                  onChange={(e) => setEditing({ ...editing, type: e.target.value })}
                  className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                >
                  {Object.entries(TYPE_LABELS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Uitleg (optioneel)" hint="Helptekst onder de vraag.">
                <Input
                  value={editing.uitleg ?? ""}
                  onChange={(e) => setEditing({ ...editing, uitleg: e.target.value || null })}
                  className="h-9"
                />
              </FormField>
            </FormRow>
            {editing.type === "keuze" && (
              <FormField label="Opties (één per regel)" required>
                <textarea
                  value={optiesTekst}
                  onChange={(e) => setEditing({ ...editing, opties: e.target.value.split("\n") })}
                  className="w-full min-h-[70px] rounded-md border border-border bg-input px-3 py-2 text-sm font-mono"
                  placeholder={"klein\nmiddel\ngroot"}
                />
              </FormField>
            )}
            <FormField label="Geldt voor case types" hint="Niets aangevinkt = alle vier.">
              <div className="flex flex-wrap gap-3">
                {CASE_TYPE_KEYS.map((ct) => {
                  const checked = (editing.van_toepassing_bij ?? []).includes(ct);
                  return (
                    <label key={ct} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const huidig = editing.van_toepassing_bij ?? [];
                          setEditing({
                            ...editing,
                            van_toepassing_bij: e.target.checked
                              ? [...huidig, ct]
                              : huidig.filter((x) => x !== ct),
                          });
                        }}
                      />
                      {CASE_TYPE_LABELS[ct] ?? ct}
                    </label>
                  );
                })}
              </div>
            </FormField>
            <div className="flex items-center gap-2">
              <Switch
                checked={editing.actief ?? true}
                onCheckedChange={(c) => setEditing({ ...editing, actief: c })}
              />
              <span className="text-sm">Actief (zichtbaar in configurator)</span>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                onClick={() => save.mutate(editing)}
                disabled={
                  save.isPending ||
                  !editing.label?.trim() ||
                  (editing.type === "keuze" &&
                    (editing.opties ?? []).filter((o) => o.trim()).length < 2)
                }
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
        title="Vraag verwijderen?"
        description="De vraag én alle gekoppelde artikel-regels worden verwijderd. Antwoorden in bestaande cases blijven bewaard maar leveren geen artikelen meer op."
      />
    </div>
  );
}

/** Eén vraag met uitklapbare artikel-regels per antwoord. */
function VraagKaart({
  vraag,
  isOpen,
  onToggle,
  onEdit,
  onDelete,
  onInvalideer,
}: {
  vraag: VraagRij;
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maatwerk_vraag_regels")
        .select("*")
        .eq("vraag_id", vraag.id)
        .order("sort_order");
      if (error) throw error;
      return data as RegelRij[];
    },
  });

  const invalideer = () => {
    qc.invalidateQueries({ queryKey: ["beheer-eigen-vraag-regels", vraag.id] });
    onInvalideer();
  };

  const saveRegel = useMutation({
    mutationFn: async (r: Partial<RegelRij>) => {
      const payload = { ...r, vraag_id: vraag.id };
      if (r.id) {
        const { error } = await supabase
          .from("maatwerk_vraag_regels")
          .update(payload)
          .eq("id", r.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("maatwerk_vraag_regels")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalideer();
      toast.success("Regel opgeslagen");
      setRegelOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delRegel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("maatwerk_vraag_regels").delete().eq("id", id);
      if (error) throw error;
    },
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
