import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDelete, RowActions } from "../shared";
import { addHoofdstuk, deleteHoofdstuk, renameHoofdstuk } from "./maatwerkRepo";
import type { HoofdstukRij } from "./types";

/** Beheer van eigen hoofdstukken: naam wijzigen, toevoegen, verwijderen. */
export function HoofdstukkenBeheer({
  hoofdstukken,
  onInvalideer,
}: {
  hoofdstukken: HoofdstukRij[];
  onInvalideer: () => void;
}) {
  const [nieuweNaam, setNieuweNaam] = useState("");
  const [namen, setNamen] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<HoofdstukRij | null>(null);

  const voegToe = useMutation({
    mutationFn: (naam: string) => addHoofdstuk(naam, hoofdstukken.length + 1),
    onSuccess: () => {
      onInvalideer();
      setNieuweNaam("");
      toast.success("Hoofdstuk toegevoegd");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hernoem = useMutation({
    mutationFn: ({ id, naam }: { id: string; naam: string }) => renameHoofdstuk(id, naam),
    onSuccess: () => {
      onInvalideer();
      toast.success("Naam gewijzigd");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verwijder = useMutation({
    mutationFn: (id: string) => deleteHoofdstuk(id),
    onSuccess: () => {
      onInvalideer();
      setToDelete(null);
      toast.success("Hoofdstuk verwijderd");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        Eigen hoofdstukken
      </p>
      <p className="text-[11px] text-muted-foreground">
        Elk hoofdstuk wordt een eigen sectie-kaart in de configurator, met de naam die jij kiest.
        Vragen plaats je erin via het veld "Plaats in" bij de vraag.
      </p>
      <div className="space-y-1.5">
        {hoofdstukken.map((h) => (
          <div key={h.id} className="flex items-center gap-2">
            <Input
              value={namen[h.id] ?? h.naam}
              onChange={(e) => setNamen((p) => ({ ...p, [h.id]: e.target.value }))}
              onBlur={() => {
                const naam = (namen[h.id] ?? h.naam).trim();
                if (naam && naam !== h.naam) hernoem.mutate({ id: h.id, naam });
              }}
              className="h-8 max-w-xs text-sm"
            />
            <RowActions onDelete={() => setToDelete(h)} />
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <Input
            value={nieuweNaam}
            onChange={(e) => setNieuweNaam(e.target.value)}
            placeholder="Nieuw hoofdstuk, bv. Civiel werk"
            className="h-8 max-w-xs text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && nieuweNaam.trim()) voegToe.mutate(nieuweNaam.trim());
            }}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!nieuweNaam.trim() || voegToe.isPending}
            onClick={() => voegToe.mutate(nieuweNaam.trim())}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Toevoegen
          </Button>
        </div>
      </div>
      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        onConfirm={() => toDelete && verwijder.mutate(toDelete.id)}
        title="Hoofdstuk verwijderen?"
        description="Vragen in dit hoofdstuk worden niet verwijderd — ze verhuizen naar het standaardhoofdstuk 'Eigen vragen'."
      />
    </div>
  );
}
