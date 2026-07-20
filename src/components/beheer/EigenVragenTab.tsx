import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HelpCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ConfirmDelete, DataTable, FormDialog, FormField, FormRow } from "./shared";
import { CASE_TYPE_LABELS } from "@/lib/configurator/types";
import { deleteVraag, fetchHoofdstukken, fetchVragen, saveVraag } from "./eigenVragen/maatwerkRepo";
import { HoofdstukkenBeheer } from "./eigenVragen/HoofdstukkenBeheer";
import { VraagKaart } from "./eigenVragen/VraagKaart";
import { TYPE_LABELS, type VraagRij } from "./eigenVragen/types";

// Re-export zodat bestaande imports (VragenRegelsTab) blijven werken.
export { VraagKaart } from "./eigenVragen/VraagKaart";
export type { VraagRij } from "./eigenVragen/types";

/**
 * Eigen vragen: nieuwe configuratorvragen toevoegen zonder code.
 * Vraag aanmaken (ja/nee, keuzelijst of aantal) → per antwoord artikelen
 * koppelen → de vraag verschijnt direct in de configurator (sectie "Eigen
 * vragen") en in de Proefcase-simulator.
 */

const CASE_TYPE_KEYS = ["NSA", "provisorium", "compact", "compact_prov"];

/** Bestaande configurator-hoofdstukken waarin een vraag geplaatst kan worden. */
const SECTIE_OPTIES: { key: string; label: string }[] = [
  { key: "project", label: "Type opdracht" },
  { key: "provisorium", label: "Provisorium" },
  { key: "ms", label: "MS — Middenspanning" },
  { key: "trafo", label: "Trafo & Vult kabel" },
  { key: "ls", label: "LS — Laagspanning" },
  { key: "overig", label: "Overig" },
];

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
    queryFn: fetchVragen,
  });

  // Eigen hoofdstukken (voor plaatsing + beheerblok bovenaan).
  const { data: hoofdstukken = [] } = useQuery({
    queryKey: ["beheer-eigen-hoofdstukken"],
    retry: false,
    queryFn: fetchHoofdstukken,
  });

  const invalideer = () => {
    qc.invalidateQueries({ queryKey: ["beheer-eigen-vragen"] });
    qc.invalidateQueries({ queryKey: ["maatwerk_vragen"] });
    qc.invalidateQueries({ queryKey: ["beheer-eigen-hoofdstukken"] });
    qc.invalidateQueries({ queryKey: ["maatwerk_hoofdstukken"] });
  };

  const save = useMutation({
    mutationFn: (v: Partial<VraagRij>) =>
      saveVraag({
        ...v,
        vraag_key: v.vraag_key || keyUitLabel(v.label ?? ""),
        opties: v.type === "keuze" ? (v.opties ?? []).filter((o) => o.trim() !== "") : [],
      }),
    onSuccess: () => {
      invalideer();
      toast.success("Vraag opgeslagen");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteVraag(id),
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

      <HoofdstukkenBeheer hoofdstukken={hoofdstukken} onInvalideer={invalideer} />

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
          plaatsingLabel={
            v.sectie_key
              ? `hoofdstuk ${SECTIE_OPTIES.find((s) => s.key === v.sectie_key)?.label ?? v.sectie_key}`
              : v.hoofdstuk_id
                ? `eigen hoofdstuk ${hoofdstukken.find((h) => h.id === v.hoofdstuk_id)?.naam ?? "?"}`
                : `hoofdstuk Eigen vragen (standaard)`
          }
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
            <FormField
              label="Plaats in"
              hint="Onderaan een bestaand hoofdstuk ('Extra vragen'), of in een eigen hoofdstuk met eigen naam."
            >
              <select
                value={
                  editing.sectie_key
                    ? `sectie:${editing.sectie_key}`
                    : editing.hoofdstuk_id
                      ? `hoofdstuk:${editing.hoofdstuk_id}`
                      : ""
                }
                onChange={(e) => {
                  const v = e.target.value;
                  setEditing({
                    ...editing,
                    sectie_key: v.startsWith("sectie:") ? v.slice(7) : null,
                    hoofdstuk_id: v.startsWith("hoofdstuk:") ? v.slice(10) : null,
                  });
                }}
                className="h-9 rounded-md border border-border bg-surface px-2 text-sm w-full"
              >
                <option value="">Standaardhoofdstuk "Eigen vragen"</option>
                <optgroup label="Bestaande hoofdstukken">
                  {SECTIE_OPTIES.map((s) => (
                    <option key={s.key} value={`sectie:${s.key}`}>
                      {s.label}
                    </option>
                  ))}
                </optgroup>
                {hoofdstukken.filter((h) => h.actief).length > 0 && (
                  <optgroup label="Eigen hoofdstukken">
                    {hoofdstukken
                      .filter((h) => h.actief)
                      .map((h) => (
                        <option key={h.id} value={`hoofdstuk:${h.id}`}>
                          {h.naam}
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
            </FormField>
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
