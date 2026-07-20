import { useState } from "react";
import { ChevronDown, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormDialog, FormField, FormRow } from "../shared";
import { ArtikelZoeker } from "../ArtikelZoeker";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { KABEL_LENGTES, KABEL_TYPES, KVAS, MERKEN, VELD_TYPES, type Regel } from "./types";

function JaNeeAlle({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const opts: { v: boolean | null; label: string }[] = [
    { v: null, label: "Maakt niet uit" },
    { v: true, label: "Ja" },
    { v: false, label: "Nee" },
  ];
  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden">
      {opts.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "px-3 h-9 text-xs transition-colors",
            value === o.v
              ? "bg-primary text-primary-foreground"
              : "bg-surface hover:bg-accent text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Selectje({
  value,
  onChange,
  options,
  alleLabel = "Alle",
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: string[];
  alleLabel?: string;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
    >
      <option value="">— {alleLabel} —</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function RegelDialog({
  open,
  onOpenChange,
  editing,
  setEditing,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Partial<Regel> | null;
  setEditing: (r: Partial<Regel> | null) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const set = (p: Partial<Regel>) => editing && setEditing({ ...editing, ...p });
  const [adv, setAdv] = useState(false);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing?.id ? "Regel bewerken" : "Nieuwe regel"}
      size="lg"
    >
      {editing && (
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {/* STAP 1: WANNEER */}
          <section className="space-y-3">
            <header className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold">
                1
              </span>
              <h3 className="text-sm font-semibold">Wanneer geldt deze regel?</h3>
            </header>
            <p className="text-xs text-muted-foreground pl-8">
              Vul alleen in waar de regel op moet matchen. Lege velden =<em> maakt niet uit</em>.
            </p>

            <div className="pl-8 space-y-4">
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Hardware
                </h4>
                <FormRow>
                  <FormField label="Merk">
                    <Selectje
                      value={editing.conditie_merk ?? null}
                      onChange={(v) => set({ conditie_merk: v })}
                      options={[...MERKEN]}
                      alleLabel="Alle merken"
                    />
                  </FormField>
                  <FormField label="I-Net uitvoering?">
                    <JaNeeAlle
                      value={editing.conditie_is_inet ?? null}
                      onChange={(v) => set({ conditie_is_inet: v })}
                    />
                  </FormField>
                </FormRow>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Veld
                </h4>
                <FormField label="Veldtype">
                  <select
                    value={editing.conditie_veld_type ?? ""}
                    onChange={(e) => set({ conditie_veld_type: e.target.value || null })}
                    className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
                  >
                    <option value="">— Alle veldtypes —</option>
                    {VELD_TYPES.map((v) => (
                      <option key={v.v} value={v.v}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormRow>
                  <FormField label="Alleen toepassen op 1e veld?">
                    <JaNeeAlle
                      value={editing.conditie_veld_nummer_is_1 ?? null}
                      onChange={(v) => set({ conditie_veld_nummer_is_1: v })}
                    />
                  </FormField>
                  <FormField label="Reserve-veld?">
                    <JaNeeAlle
                      value={editing.conditie_is_reserve ?? null}
                      onChange={(v) => set({ conditie_is_reserve: v })}
                    />
                  </FormField>
                </FormRow>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Configuratie
                </h4>
                <FormRow cols={3}>
                  <FormField label="Kabeltype">
                    <Selectje
                      value={editing.conditie_kabel_type ?? null}
                      onChange={(v) => set({ conditie_kabel_type: v })}
                      options={KABEL_TYPES}
                    />
                  </FormField>
                  <FormField label="Trafo kVA">
                    <Selectje
                      value={editing.conditie_kva ?? null}
                      onChange={(v) => set({ conditie_kva: v })}
                      options={KVAS}
                    />
                  </FormField>
                  <FormField label="Trafokabel lengte (m)">
                    <Selectje
                      value={editing.conditie_trafo_kabel_lengte ?? null}
                      onChange={(v) => set({ conditie_trafo_kabel_lengte: v })}
                      options={KABEL_LENGTES}
                    />
                  </FormField>
                </FormRow>
              </div>

              {/* Geavanceerd */}
              <Collapsible open={adv} onOpenChange={setAdv}>
                <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                  <Settings2 className="h-3.5 w-3.5" />
                  Geavanceerd: aantal C+V velden
                  <ChevronDown
                    className={cn("h-3.5 w-3.5 transition-transform", adv && "rotate-180")}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    Voor regels die afhangen van hoeveel C+V velden de RMU heeft (bv. Magnefix
                    doos-keuze). Laat leeg om altijd te matchen.
                  </p>
                  <FormRow>
                    <FormField label="Min. aantal C+V velden">
                      <Input
                        type="number"
                        value={editing.conditie_aantal_kv_min ?? ""}
                        onChange={(e) =>
                          set({
                            conditie_aantal_kv_min:
                              e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className="h-9"
                      />
                    </FormField>
                    <FormField label="Max. aantal C+V velden">
                      <Input
                        type="number"
                        value={editing.conditie_aantal_kv_max ?? ""}
                        onChange={(e) =>
                          set({
                            conditie_aantal_kv_max:
                              e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className="h-9"
                      />
                    </FormField>
                  </FormRow>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </section>

          {/* STAP 2: WAT */}
          <section className="space-y-3">
            <header className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold">
                2
              </span>
              <h3 className="text-sm font-semibold">Welk artikel komt erbij?</h3>
            </header>
            <div className="pl-8 space-y-3">
              <FormField label="Artikel" required>
                <ArtikelZoeker
                  value={editing.artikel_id ?? null}
                  onChange={(id) => set({ artikel_id: id ?? undefined })}
                  categorieSuggesties={["RMU", "Trafo"]}
                />
              </FormField>
              <FormRow>
                <FormField label="Aantal per veld">
                  <Input
                    type="number"
                    value={editing.hoeveelheid ?? 1}
                    onChange={(e) => set({ hoeveelheid: Number(e.target.value) })}
                    className="h-9"
                  />
                </FormField>
                <FormField label="Sectie in winkelwagen">
                  <select
                    value={editing.sectie ?? "rmu"}
                    onChange={(e) => set({ sectie: e.target.value })}
                    className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
                  >
                    <option value="rmu">RMU</option>
                    <option value="trafo">Trafo</option>
                  </select>
                </FormField>
              </FormRow>
            </div>
          </section>

          {/* STAP 3: DETAILS */}
          <section className="space-y-3">
            <header className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold">
                3
              </span>
              <h3 className="text-sm font-semibold">Labels &amp; status</h3>
            </header>
            <div className="pl-8 space-y-3">
              <FormField
                label="Herkomst label"
                hint="Wordt getoond bij het artikel in de winkelwagen. {veldNummer} wordt automatisch vervangen."
              >
                <Input
                  value={editing.herkomst_label ?? ""}
                  onChange={(e) => set({ herkomst_label: e.target.value })}
                  className="h-9"
                />
              </FormField>
              <FormRow>
                <FormField label="Volgorde">
                  <Input
                    type="number"
                    value={editing.sort_order ?? 0}
                    onChange={(e) => set({ sort_order: Number(e.target.value) })}
                    className="h-9"
                  />
                </FormField>
                <FormField label="Status">
                  <label className="flex items-center gap-2 text-sm h-9">
                    <input
                      type="checkbox"
                      checked={editing.actief ?? true}
                      onChange={(e) => set({ actief: e.target.checked })}
                    />
                    Actief (regel wordt toegepast)
                  </label>
                </FormField>
              </FormRow>
            </div>
          </section>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Annuleren
            </Button>
            <Button
              onClick={onSave}
              disabled={saving || !editing.artikel_id || !editing.herkomst_label}
            >
              {saving ? "Opslaan…" : "Regel opslaan"}
            </Button>
          </div>
        </div>
      )}
    </FormDialog>
  );
}
