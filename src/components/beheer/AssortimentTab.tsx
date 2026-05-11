import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseAssortimentslijst } from "@/lib/assortiment/excel";
import { berekenDiff, voerSyncDoor, type DiffResultaat } from "@/lib/assortiment/sync";

export function AssortimentTab() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [bestand, setBestand] = useState<File | null>(null);
  const [diff, setDiff] = useState<DiffResultaat | null>(null);

  const { data: laatsteSync } = useQuery({
    queryKey: ["assortiment-laatste-sync"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_instellingen")
        .select("waarde, updated_at")
        .eq("sleutel", "laatste_assortiment_sync")
        .maybeSingle();
      return data;
    },
  });

  const analyseer = useMutation({
    mutationFn: async (file: File) => {
      const parsed = await parseAssortimentslijst(file);
      if (parsed.length === 0) throw new Error("Geen artikelen gevonden in dit bestand");
      return berekenDiff(parsed);
    },
    onSuccess: (d) => setDiff(d),
    onError: (e: Error) => toast.error(e.message),
  });

  const doorvoeren = useMutation({
    mutationFn: async () => {
      if (!diff || !bestand) throw new Error("Geen diff");
      await voerSyncDoor(diff, bestand.name);
    },
    onSuccess: () => {
      toast.success("Assortiment gesynchroniseerd");
      setDiff(null);
      setBestand(null);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["beheer-artikelen"] });
      qc.invalidateQueries({ queryKey: ["assortiment-laatste-sync"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onFile = (f: File | null) => {
    setDiff(null);
    setBestand(f);
    if (f) analyseer.mutate(f);
  };

  const samenvatting = useMemo(() => {
    if (!laatsteSync?.waarde) return null;
    const [iso, naam] = laatsteSync.waarde.split(" | ");
    const d = new Date(iso);
    return `${d.toLocaleString("nl-NL")} · ${naam ?? ""}`;
  }, [laatsteSync]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="text-sm font-medium">Assortimentslijst uploaden</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Upload het maandelijkse .xlsx bestand. Sheet "Aanvulling" wordt ingelezen.
          </div>
          {samenvatting && (
            <div className="text-xs text-muted-foreground mt-1.5 font-mono">
              Laatste sync: {samenvatting}
            </div>
          )}
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
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent"
        >
          {analyseer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Bestand kiezen
        </button>
      </div>

      {bestand && (
        <div className="text-xs text-muted-foreground">
          Bestand: <span className="font-mono text-foreground">{bestand.name}</span>
        </div>
      )}

      {diff && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Stat color="text-success" label="Nieuw" count={diff.nieuw.length} icon="✅" />
            <Stat color="text-primary" label="Gewijzigd" count={diff.gewijzigd.length} icon="🔄" />
            <Stat color="text-warning" label="Uitgelopen" count={diff.uitgelopen.length} icon="⚠️" />
          </div>
          <div className="text-xs text-muted-foreground">
            {diff.ongewijzigd} artikelen ongewijzigd.
          </div>

          <DiffSectie titel="Nieuw">
            {diff.nieuw.length === 0 ? (
              <Leeg />
            ) : (
              <table className="w-full text-xs">
                <tbody className="divide-y divide-border">
                  {diff.nieuw.slice(0, 100).map((p) => (
                    <tr key={p.artikel_nummer}>
                      <td className="px-2 py-1 font-mono">{p.artikel_nummer}</td>
                      <td className="px-2 py-1">{p.korte_omschrijving}</td>
                      <td className="px-2 py-1 text-muted-foreground">{p.categorie}</td>
                      <td className="px-2 py-1 text-muted-foreground">{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {diff.nieuw.length > 100 && <Meer n={diff.nieuw.length - 100} />}
          </DiffSectie>

          <DiffSectie titel="Gewijzigd">
            {diff.gewijzigd.length === 0 ? (
              <Leeg />
            ) : (
              <table className="w-full text-xs">
                <tbody className="divide-y divide-border">
                  {diff.gewijzigd.slice(0, 100).map((g) => (
                    <tr key={g.huidig.id}>
                      <td className="px-2 py-1 font-mono">{g.nieuw.artikel_nummer}</td>
                      <td className="px-2 py-1">{g.nieuw.korte_omschrijving}</td>
                      <td className="px-2 py-1 text-muted-foreground">{g.veranderingen.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {diff.gewijzigd.length > 100 && <Meer n={diff.gewijzigd.length - 100} />}
          </DiffSectie>

          <DiffSectie titel="Uitgelopen (worden inactief)">
            {diff.uitgelopen.length === 0 ? (
              <Leeg />
            ) : (
              <table className="w-full text-xs">
                <tbody className="divide-y divide-border">
                  {diff.uitgelopen.slice(0, 100).map((a) => (
                    <tr key={a.id}>
                      <td className="px-2 py-1 font-mono">{a.artikel_nummer}</td>
                      <td className="px-2 py-1">{a.korte_omschrijving}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {diff.uitgelopen.length > 100 && <Meer n={diff.uitgelopen.length - 100} />}
          </DiffSectie>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => { setDiff(null); setBestand(null); if (fileRef.current) fileRef.current.value = ""; }}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-accent"
            >
              Annuleren
            </button>
            <button
              onClick={() => doorvoeren.mutate()}
              disabled={doorvoeren.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-1.5 text-sm hover:opacity-90 disabled:opacity-50"
            >
              {doorvoeren.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Doorvoeren
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, count, icon, color }: { label: string; count: number; icon: string; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-xs text-muted-foreground">{icon} {label}</div>
      <div className={`text-2xl font-mono mt-0.5 ${color}`}>{count}</div>
    </div>
  );
}

function DiffSectie({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <details className="rounded-lg border border-border bg-surface overflow-hidden" open>
      <summary className="px-3 py-2 text-xs font-mono uppercase tracking-wider text-muted-foreground cursor-pointer hover:bg-accent/30">
        {titel}
      </summary>
      <div className="border-t border-border max-h-80 overflow-auto">{children}</div>
    </details>
  );
}

function Leeg() {
  return <div className="px-3 py-4 text-xs text-muted-foreground text-center">Geen.</div>;
}

function Meer({ n }: { n: number }) {
  return <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border">…en nog {n} meer</div>;
}
