import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Link2, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ConfirmDelete, DataTable, FormDialog, FormField, FormRow, RowActions } from "./shared";

/**
 * Beheer voor stamdata die voorheen hardcoded in de code stond:
 * - ringklem_specs: welke ringklem past bij welke hoofd-/aftakkabel (LS-aftakmoffen)
 * - inet_default_artikelen: standaardset die meekomt bij een I-Net (DA) RMU
 */

/** Toont de omschrijving + status van het artikel achter een artikelnummer. */
function ArtikelNummerInfo({ nummer }: { nummer: string | undefined }) {
  const { data } = useQuery({
    queryKey: ["artikel-bij-nummer", nummer],
    enabled: !!nummer && nummer.length >= 8,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artikelen")
        .select("artikel_nummer, korte_omschrijving, actief")
        .eq("artikel_nummer", nummer!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  if (!nummer || nummer.length < 8) return null;
  if (data === undefined) return null;
  if (data === null)
    return (
      <span className="text-[11px] text-destructive">
        Onbekend artikelnummer — niet in de catalogus.
      </span>
    );
  return (
    <span className="text-[11px] text-muted-foreground">
      {data.korte_omschrijving}
      {!data.actief && <span className="text-destructive ml-1">(inactief!)</span>}
    </span>
  );
}

function useArtikelOmschrijvingen(nummers: string[]) {
  return useQuery({
    queryKey: ["artikel-omschrijvingen", [...nummers].sort().join(",")],
    enabled: nummers.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artikelen")
        .select("artikel_nummer, korte_omschrijving, actief")
        .in("artikel_nummer", nummers);
      if (error) throw error;
      return new Map((data ?? []).map((a) => [a.artikel_nummer, a]));
    },
  });
}

// === Ringklemmen ===

interface RingklemRij {
  id: string;
  artikel_nummer: string;
  omschrijving: string;
  hoofdkabel_doorsnede_min: number;
  hoofdkabel_doorsnede_max: number;
  hoofdkabel_materiaal: string;
  aftakkabel_doorsnede_min: number;
  aftakkabel_doorsnede_max: number;
  actief: boolean;
  sort_order: number;
}

export function RingklemmenTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<RingklemRij> | null>(null);
  const [toDelete, setToDelete] = useState<RingklemRij | null>(null);

  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["beheer-ringklemmen"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ringklem_specs").select("*").order("sort_order");
      if (error) throw error;
      return data as RingklemRij[];
    },
    retry: false,
  });

  const invalideer = () => {
    qc.invalidateQueries({ queryKey: ["beheer-ringklemmen"] });
    qc.invalidateQueries({ queryKey: ["ringklem_specs"] });
  };

  const save = useMutation({
    mutationFn: async (v: Partial<RingklemRij>) => {
      if (v.id) {
        const { error } = await supabase.from("ringklem_specs").update(v).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ringklem_specs")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert(v as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalideer();
      toast.success("Opgeslagen");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ringklem_specs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalideer();
      toast.success("Verwijderd");
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (error) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
        De tabel <code className="font-mono">ringklem_specs</code> bestaat nog niet — voer eerst de
        migratie <code className="font-mono">20260705090000_ringklemmen_en_inet_naar_db.sql</code>{" "}
        uit. Tot die tijd gebruikt de configurator de oude vaste lijst uit de code.
      </div>
    );
  }

  const geldig =
    !!editing?.artikel_nummer &&
    !!editing?.omschrijving &&
    editing?.hoofdkabel_doorsnede_min != null &&
    editing?.hoofdkabel_doorsnede_max != null &&
    editing?.aftakkabel_doorsnede_min != null &&
    editing?.aftakkabel_doorsnede_max != null;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground max-w-xl">
          Bepaalt welke ringklem de configurator voorstelt bij een LS-aftakmof, op basis van
          hoofdkabel-doorsnede, materiaal (Al/Cu) en aftakkabel-doorsnede. Stond voorheen vast in de
          code — wijzigingen hier werken direct door in de configurator.
        </p>
        <Button
          onClick={() => {
            setEditing({
              hoofdkabel_materiaal: "Cu",
              aftakkabel_doorsnede_min: 6,
              aftakkabel_doorsnede_max: 50,
              actief: true,
              sort_order: data.length + 1,
            });
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Ringklem toevoegen
        </Button>
      </div>
      <DataTable
        headers={["Artikel", "Omschrijving", "Hoofdkabel", "Aftakkabel", "Actief", ""]}
        loading={isLoading}
        rowIds={data.map((r) => r.id)}
        rows={data.map((r) => [
          <span className="font-mono text-xs">{r.artikel_nummer}</span>,
          r.omschrijving,
          <span className="text-xs">
            {r.hoofdkabel_doorsnede_min === r.hoofdkabel_doorsnede_max
              ? `${r.hoofdkabel_doorsnede_min}`
              : `${r.hoofdkabel_doorsnede_min}–${r.hoofdkabel_doorsnede_max}`}{" "}
            mm² · {r.hoofdkabel_materiaal}
          </span>,
          <span className="text-xs">
            {r.aftakkabel_doorsnede_min}–{r.aftakkabel_doorsnede_max} mm²
          </span>,
          r.actief ? "Ja" : <span className="text-muted-foreground">Nee</span>,
          <RowActions
            onEdit={() => {
              setEditing(r);
              setOpen(true);
            }}
            onDelete={() => setToDelete(r)}
          />,
        ])}
        emptyIcon={Link2}
        emptyMessage="Geen ringklemmen"
        emptyDescription="Zonder ringklem-specificaties kan de configurator geen ringklem voorstellen bij LS-aftakmoffen."
      />

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing?.id ? "Ringklem bewerken" : "Ringklem toevoegen"}
        size="lg"
      >
        {editing && (
          <div className="space-y-3">
            <FormRow>
              <FormField label="Artikelnummer" required hint="8-cijferig Liander-nummer">
                <Input
                  value={editing.artikel_nummer ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, artikel_nummer: e.target.value.trim() })
                  }
                  className="h-9 font-mono"
                />
                <ArtikelNummerInfo nummer={editing.artikel_nummer} />
              </FormField>
              <FormField label="Omschrijving" required>
                <Input
                  value={editing.omschrijving ?? ""}
                  onChange={(e) => setEditing({ ...editing, omschrijving: e.target.value })}
                  className="h-9"
                />
              </FormField>
            </FormRow>
            <FormRow cols={3}>
              <FormField label="Hoofdkabel min (mm²)" required>
                <Input
                  type="number"
                  value={editing.hoofdkabel_doorsnede_min ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, hoofdkabel_doorsnede_min: Number(e.target.value) })
                  }
                  className="h-9"
                />
              </FormField>
              <FormField label="Hoofdkabel max (mm²)" required>
                <Input
                  type="number"
                  value={editing.hoofdkabel_doorsnede_max ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, hoofdkabel_doorsnede_max: Number(e.target.value) })
                  }
                  className="h-9"
                />
              </FormField>
              <FormField label="Materiaal" required>
                <select
                  value={editing.hoofdkabel_materiaal ?? "Cu"}
                  onChange={(e) => setEditing({ ...editing, hoofdkabel_materiaal: e.target.value })}
                  className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                >
                  <option value="Cu">Cu</option>
                  <option value="Al">Al</option>
                  <option value="beide">beide</option>
                </select>
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label="Aftakkabel min (mm²)" required>
                <Input
                  type="number"
                  value={editing.aftakkabel_doorsnede_min ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, aftakkabel_doorsnede_min: Number(e.target.value) })
                  }
                  className="h-9"
                />
              </FormField>
              <FormField label="Aftakkabel max (mm²)" required>
                <Input
                  type="number"
                  value={editing.aftakkabel_doorsnede_max ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, aftakkabel_doorsnede_max: Number(e.target.value) })
                  }
                  className="h-9"
                />
              </FormField>
            </FormRow>
            <div className="flex items-center gap-2">
              <Switch
                checked={editing.actief ?? true}
                onCheckedChange={(c) => setEditing({ ...editing, actief: c })}
              />
              <span className="text-sm">Actief</span>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => save.mutate(editing)} disabled={save.isPending || !geldig}>
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

// === I-Net standaardartikelen ===

interface InetRij {
  id: string;
  artikel_nummer: string;
  hoeveelheid: number;
  actief: boolean;
  sort_order: number;
}

export function InetArtikelenTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<InetRij> | null>(null);
  const [toDelete, setToDelete] = useState<InetRij | null>(null);

  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["beheer-inet-artikelen"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inet_default_artikelen")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as InetRij[];
    },
    retry: false,
  });

  const nummers = useMemo(() => data.map((r) => r.artikel_nummer), [data]);
  const { data: omschrijvingen } = useArtikelOmschrijvingen(nummers);

  const invalideer = () => {
    qc.invalidateQueries({ queryKey: ["beheer-inet-artikelen"] });
    qc.invalidateQueries({ queryKey: ["inet_default_artikelen"] });
  };

  const save = useMutation({
    mutationFn: async (v: Partial<InetRij>) => {
      if (v.id) {
        const { error } = await supabase.from("inet_default_artikelen").update(v).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("inet_default_artikelen")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert(v as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalideer();
      toast.success("Opgeslagen");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inet_default_artikelen").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalideer();
      toast.success("Verwijderd");
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (error) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
        De tabel <code className="font-mono">inet_default_artikelen</code> bestaat nog niet — voer
        eerst de migratie{" "}
        <code className="font-mono">20260705090000_ringklemmen_en_inet_naar_db.sql</code> uit. Tot
        die tijd gebruikt de configurator de oude vaste lijst uit de code.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground max-w-xl">
          Standaardset die automatisch wordt voorgesteld wanneer in een case een I-Net (DA) RMU
          wordt gekozen. De engineer kan de set per case nog aanpassen; dit is alleen het startpunt.
        </p>
        <Button
          onClick={() => {
            setEditing({ hoeveelheid: 1, actief: true, sort_order: data.length + 1 });
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Artikel toevoegen
        </Button>
      </div>
      <DataTable
        headers={["Artikel", "Omschrijving", "Hoeveelheid", "Actief", ""]}
        loading={isLoading}
        rowIds={data.map((r) => r.id)}
        rows={data.map((r) => {
          const a = omschrijvingen?.get(r.artikel_nummer);
          return [
            <span className="font-mono text-xs">{r.artikel_nummer}</span>,
            a ? (
              <span className="text-xs">
                {a.korte_omschrijving}
                {!a.actief && <span className="text-destructive ml-1">(inactief!)</span>}
              </span>
            ) : (
              <span className="text-xs text-destructive">Niet in catalogus</span>
            ),
            r.hoeveelheid,
            r.actief ? "Ja" : <span className="text-muted-foreground">Nee</span>,
            <RowActions
              onEdit={() => {
                setEditing(r);
                setOpen(true);
              }}
              onDelete={() => setToDelete(r)}
            />,
          ];
        })}
        emptyIcon={Wifi}
        emptyMessage="Geen I-Net artikelen"
        emptyDescription="Bij de keuze 'I-Net: ja' wordt dan geen standaardset voorgesteld."
      />

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing?.id ? "I-Net artikel bewerken" : "I-Net artikel toevoegen"}
      >
        {editing && (
          <div className="space-y-3">
            <FormField label="Artikelnummer" required hint="8-cijferig Liander-nummer">
              <Input
                value={editing.artikel_nummer ?? ""}
                onChange={(e) => setEditing({ ...editing, artikel_nummer: e.target.value.trim() })}
                className="h-9 font-mono"
              />
              <ArtikelNummerInfo nummer={editing.artikel_nummer} />
            </FormField>
            <FormField label="Hoeveelheid" required>
              <Input
                type="number"
                min={1}
                value={editing.hoeveelheid ?? 1}
                onChange={(e) => setEditing({ ...editing, hoeveelheid: Number(e.target.value) })}
                className="h-9"
              />
            </FormField>
            <div className="flex items-center gap-2">
              <Switch
                checked={editing.actief ?? true}
                onCheckedChange={(c) => setEditing({ ...editing, actief: c })}
              />
              <span className="text-sm">Actief</span>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                onClick={() => save.mutate(editing)}
                disabled={save.isPending || !editing.artikel_nummer}
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
