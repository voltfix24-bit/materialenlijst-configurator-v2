import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  parseVertaaltabel,
  berekenVertaaltabelDiff,
  voerVertaaltabelImportDoor,
  bepaalImportActie,
  type VertaaltabelDiff,
  type VertaaltabelStatus,
  type ConflictBesluit,
} from "@/lib/assortiment/vertaaltabel";
import { DiffSectie, Meer } from "./shared";

const STATUS_META: Record<VertaaltabelStatus, { label: string; kleur: string; uitleg: string }> = {
  gereed: {
    label: "Gereed",
    kleur: "text-success",
    uitleg: "Oud + nieuw bestaan; alternatief wordt gezet en oud op inactief → direct migreerbaar.",
  },
  nieuw_inactief: {
    label: "Nieuw inactief",
    kleur: "text-warning",
    uitleg: "Nieuw artikel bestaat maar is inactief; migratie kan pas als het nieuwe actief is.",
  },
  nieuw_ontbreekt: {
    label: "Nieuw ontbreekt",
    kleur: "text-warning",
    uitleg:
      "Nieuw nummer staat nog niet in de DB; upload eerst de assortimentslijst met dit artikel.",
  },
  al_ingesteld: {
    label: "Al ingesteld",
    kleur: "text-muted-foreground",
    uitleg: "Oud artikel heeft dit alternatief al; alleen inactief-markering indien nodig.",
  },
  conflict: {
    label: "Conflict",
    kleur: "text-destructive",
    uitleg: "Oud artikel heeft al een ánder alternatief; kies per rij: behoud DB of vertaaltabel.",
  },
  oud_ontbreekt: {
    label: "Oud ontbreekt",
    kleur: "text-muted-foreground",
    uitleg: "Oud nummer staat niet in de DB; niets te doen.",
  },
};

const STATUS_VOLGORDE: VertaaltabelStatus[] = [
  "gereed",
  "nieuw_inactief",
  "nieuw_ontbreekt",
  "conflict",
  "al_ingesteld",
  "oud_ontbreekt",
];

export function VertaaltabelImportPaneel() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [bestand, setBestand] = useState<File | null>(null);
  const [diff, setDiff] = useState<VertaaltabelDiff | null>(null);
  const [markeerInactief, setMarkeerInactief] = useState(true);
  const [maakNieuweArtikelenAan, setMaakNieuweArtikelenAan] = useState(true);
  const [conflictBesluiten, setConflictBesluiten] = useState<Record<string, ConflictBesluit>>({});

  const opties = useMemo(
    () => ({ markeerInactief, maakNieuweArtikelenAan, conflictBesluiten }),
    [markeerInactief, maakNieuweArtikelenAan, conflictBesluiten],
  );

  const analyseer = useMutation({
    mutationFn: async (file: File) => {
      const rijen = await parseVertaaltabel(file);
      return berekenVertaaltabelDiff(rijen);
    },
    onSuccess: (d) => {
      setDiff(d);
      setConflictBesluiten({});
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doorvoeren = useMutation({
    mutationFn: async () => {
      if (!diff) throw new Error("Geen vertaaltabel geanalyseerd");
      return voerVertaaltabelImportDoor(diff, opties);
    },
    onSuccess: (res) => {
      const tekst =
        `${res.nieuw_aangemaakt} nieuw aangemaakt · ${res.alt_gezet} alternatief gezet · ` +
        `${res.inactief_gemarkeerd} inactief · ${res.conflicten_overgeslagen} conflict behouden`;
      if (res.fouten.length === 0) {
        toast.success(
          `Vertaaltabel geïmporteerd · ${tekst}. Draai nu de Alternatief-migratie hieronder.`,
          { duration: 9000 },
        );
      } else {
        toast.error(
          `Import gedeeltelijk · ${tekst} · ${res.fouten.length} fout(en): ${res.fouten[0].detail}`,
          { duration: 12000 },
        );
      }
      reset();
      qc.invalidateQueries({ queryKey: ["alternatief-voorstellen"] });
      qc.invalidateQueries({ queryKey: ["alternatief-keuzes"] });
      qc.invalidateQueries({ queryKey: ["beheer-artikelen"] });
      qc.invalidateQueries({ queryKey: ["artikelen"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = () => {
    setBestand(null);
    setDiff(null);
    setConflictBesluiten({});
    if (fileRef.current) fileRef.current.value = "";
  };

  const onFile = (f: File | null) => {
    setDiff(null);
    setBestand(f);
    if (f) analyseer.mutate(f);
  };

  const setBesluit = (oud: string, besluit: ConflictBesluit) =>
    setConflictBesluiten((prev) => ({ ...prev, [oud]: besluit }));

  const teVerwerken = useMemo(() => {
    if (!diff) return 0;
    return diff.matches.filter((m) => !bepaalImportActie(m, opties).overslaan).length;
  }, [diff, opties]);

  const openConflicten = useMemo(() => {
    if (!diff) return 0;
    return diff.matches.filter(
      (m) =>
        m.status === "conflict" &&
        (conflictBesluiten[m.rij.oud_nummer] ?? "behoud") !== "overschrijf",
    ).length;
  }, [diff, conflictBesluiten]);

  return (
    <div className="space-y-2 mt-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-sm font-medium">
            Vertaaltabel importeren (oud → nieuw artikelnummer)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload de losse vertaaltabel (kolom A = oud nummer, B = nieuw nummer, C = omschrijving).
            Maakt (waar nodig) ontbrekende nieuwe artikelen aan, zet per oud artikel het{" "}
            <span className="font-mono">alternatief</span> en markeert het inactief. Verlegt zélf
            niets — draai daarna de <span className="font-medium">Alternatief-migratie</span>.
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={analyseer.isPending || doorvoeren.isPending}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50 flex-shrink-0"
        >
          {analyseer.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          Vertaaltabel kiezen
        </button>
      </div>

      {bestand && (
        <div className="text-xs text-muted-foreground">
          Bestand: <span className="font-mono text-foreground">{bestand.name}</span>
        </div>
      )}

      {diff && (
        <div className="space-y-3">
          <div className="grid grid-cols-6 gap-2">
            {STATUS_VOLGORDE.map((s) => (
              <div
                key={s}
                className="rounded-lg border border-border bg-surface p-2.5"
                title={STATUS_META[s].uitleg}
              >
                <div className="text-[11px] text-muted-foreground">{STATUS_META[s].label}</div>
                <div className={`text-xl font-mono mt-0.5 ${STATUS_META[s].kleur}`}>
                  {diff.telling[s]}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5 text-xs">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={markeerInactief}
                onChange={(e) => setMarkeerInactief(e.target.checked)}
              />
              <span>
                Oude artikelen inactief markeren (nodig zodat de Alternatief-migratie ze oppikt).
              </span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={maakNieuweArtikelenAan}
                onChange={(e) => setMaakNieuweArtikelenAan(e.target.checked)}
              />
              <span>
                Ontbrekende nieuwe artikelen aanmaken uit de vertaaltabel (nummer + omschrijving),
                zodat de migratie ernaartoe kan verwijzen.
              </span>
            </label>
          </div>

          {diff.telling.conflict > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  {diff.telling.conflict} conflict(en): het oude artikel heeft al een ánder
                  alternatief in de DB. Kies per rij hieronder tussen de bestaande DB-waarde of de
                  vertaaltabel-waarde. Standaard blijft de DB-waarde behouden.{" "}
                  {openConflicten > 0 && (
                    <span className="font-medium">{openConflicten} nog op "behoud".</span>
                  )}
                </span>
              </div>
            </div>
          )}

          <DiffSectie titel="Vertaaltabel-rijen">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left px-2 py-1 font-medium">Oud</th>
                  <th className="text-left px-2 py-1 font-medium">Nieuw (vertaaltabel)</th>
                  <th className="text-left px-2 py-1 font-medium">Omschrijving</th>
                  <th className="text-left px-2 py-1 font-medium">Status / keuze</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {diff.matches.slice(0, 400).map((m) => {
                  const besluit = conflictBesluiten[m.rij.oud_nummer] ?? "behoud";
                  return (
                    <tr key={m.rij.oud_nummer}>
                      <td className="px-2 py-1 font-mono align-top">{m.rij.oud_nummer}</td>
                      <td className="px-2 py-1 font-mono align-top">
                        <span className="inline-flex items-center gap-1">
                          <ArrowRight className="w-3 h-3" />
                          {m.rij.nieuw_nummer}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-muted-foreground align-top">
                        {m.rij.omschrijving}
                      </td>
                      <td className="px-2 py-1 align-top">
                        {m.status === "conflict" ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-destructive">
                              Conflict — DB heeft nu:{" "}
                              <span className="font-mono">{m.huidig_alternatief}</span>
                            </span>
                            <div className="inline-flex rounded-md border border-border overflow-hidden w-fit">
                              <button
                                onClick={() => setBesluit(m.rij.oud_nummer, "behoud")}
                                className={`px-2 py-0.5 ${
                                  besluit === "behoud"
                                    ? "bg-muted font-medium"
                                    : "hover:bg-accent/40"
                                }`}
                              >
                                Behoud DB
                              </button>
                              <button
                                onClick={() => setBesluit(m.rij.oud_nummer, "overschrijf")}
                                className={`px-2 py-0.5 border-l border-border ${
                                  besluit === "overschrijf"
                                    ? "bg-primary text-primary-foreground font-medium"
                                    : "hover:bg-accent/40"
                                }`}
                              >
                                Vertaaltabel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span
                            className={STATUS_META[m.status].kleur}
                            title={STATUS_META[m.status].uitleg}
                          >
                            {STATUS_META[m.status].label}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {diff.matches.length > 400 && <Meer n={diff.matches.length - 400} />}
          </DiffSectie>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">
              {teVerwerken} rij(en) worden verwerkt (rest overgeslagen).
            </span>
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-accent"
              >
                Annuleren
              </button>
              <button
                onClick={() => doorvoeren.mutate()}
                disabled={doorvoeren.isPending || teVerwerken === 0}
                className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-1.5 text-sm hover:opacity-90 disabled:opacity-50"
              >
                {doorvoeren.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Import doorvoeren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
