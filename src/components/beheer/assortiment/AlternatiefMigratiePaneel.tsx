import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  voorbereidAlternatiefMigratie,
  voerAlternatiefMigratieDoor,
  type AlternatiefVoorstel,
} from "@/lib/assortiment/alternatief";

export function AlternatiefMigratiePaneel() {
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["alternatief-voorstellen"],
    queryFn: voorbereidAlternatiefMigratie,
  });
  const [keuze, setKeuze] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bezigMet, setBezigMet] = useState<string | null>(null);

  const lijst = data ?? [];

  const effectieveKeuze = (v: AlternatiefVoorstel): string | null =>
    keuze[v.oud_id] ?? v.gekozen_nummer ?? null;

  const isMigreerbaar = (v: AlternatiefVoorstel): boolean => {
    if (v.impact.totaal === 0) return false;
    const nr = effectieveKeuze(v);
    if (!nr) return false;
    const k = v.kandidaten.find((c) => c.artikel_nummer === nr);
    return !!(k && k.artikel_id && k.actief);
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const voerUit = async () => {
    const teDoen = lijst.filter((v) => selected.has(v.oud_id) && isMigreerbaar(v));
    if (teDoen.length === 0) return;
    let succes = 0;
    let totaalRijen = 0;
    const fouten: string[] = [];
    for (const v of teDoen) {
      setBezigMet(v.oud_nummer);
      const nr = effectieveKeuze(v);
      if (!nr) continue;
      try {
        const res = await voerAlternatiefMigratieDoor(v, nr);
        succes++;
        totaalRijen += res.totaal_geupdate;
        const stapFouten = res.stappen.filter((s) => s.error);
        if (stapFouten.length > 0) {
          fouten.push(
            `${v.oud_nummer}: ${stapFouten.map((s) => `${s.tabel}.${s.kolom}: ${s.error}`).join("; ")}`,
          );
        }
      } catch (e) {
        fouten.push(`${v.oud_nummer}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setBezigMet(null);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["alternatief-voorstellen"] });
    qc.invalidateQueries({ queryKey: ["alternatief-keuzes"] });
    qc.invalidateQueries({ queryKey: ["data-kwaliteit"] });
    if (fouten.length === 0) {
      toast.success(
        `${succes} migratie(s) doorgevoerd · ${totaalRijen} verwijzing(en) gemigreerd.`,
      );
    } else {
      toast.error(
        `${succes} migratie(s) gelukt · ${totaalRijen} rijen · ${fouten.length} met fouten: ${fouten[0]}`,
        { duration: 14000 },
      );
    }
  };

  return (
    <div className="space-y-2 mt-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Alternatief-migratie</h3>
          <p className="text-xs text-muted-foreground">
            Inactieve artikelen met een alternatief. Bij meerdere kandidaten moet je expliciet
            kiezen — er gebeurt niets automatisch.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-xs px-2 py-1 rounded-md border border-border hover:bg-accent disabled:opacity-50"
        >
          {isFetching ? "Bezig…" : "Verversen"}
        </button>
      </div>
      {isLoading ? (
        <div className="text-xs text-muted-foreground">Laden…</div>
      ) : lijst.length === 0 ? (
        <div className="text-xs text-muted-foreground rounded-md border border-border bg-surface px-3 py-3">
          Geen inactieve artikelen met alternatief gevonden.
        </div>
      ) : (
        <div className="rounded-md border border-border bg-surface overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 w-8"></th>
                <th className="text-left px-2 py-1.5 font-medium">Oud</th>
                <th className="text-left px-2 py-1.5 font-medium">Kandidaten</th>
                <th className="text-left px-2 py-1.5 font-medium">Gekozen</th>
                <th className="text-right px-2 py-1.5 font-medium"># refs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lijst.map((v) => {
                const keuzeNr = effectieveKeuze(v);
                const migreerbaar = isMigreerbaar(v);
                const meerdere = v.kandidaten.length > 1;
                return (
                  <tr key={v.oud_id} className={migreerbaar ? "" : "opacity-70"}>
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        disabled={!migreerbaar || bezigMet !== null}
                        checked={selected.has(v.oud_id)}
                        onChange={() => toggle(v.oud_id)}
                      />
                    </td>
                    <td className="px-2 py-1.5 font-mono align-top">
                      {v.oud_nummer}
                      <div className="text-muted-foreground text-[11px] font-sans">
                        {v.oud_omschrijving}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      {v.kandidaten.length === 0 ? (
                        <span className="text-muted-foreground italic">geen</span>
                      ) : (
                        <div className="space-y-1">
                          {v.kandidaten.map((k) => (
                            <div key={k.artikel_nummer}>
                              <div className="flex items-center gap-1 font-mono">
                                <span>{k.artikel_nummer}</span>
                                {!k.artikel_id ? (
                                  <span className="text-destructive text-[10px]">(onbekend)</span>
                                ) : !k.actief ? (
                                  <span className="text-amber-600 text-[10px]">(inactief)</span>
                                ) : (
                                  <span className="text-success text-[10px]">(actief)</span>
                                )}
                              </div>
                              {k.omschrijving && (
                                <div className="text-muted-foreground text-[11px] font-sans">
                                  {k.omschrijving}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      {meerdere ? (
                        <div>
                          <select
                            value={keuzeNr ?? ""}
                            onChange={(e) =>
                              setKeuze((p) => ({ ...p, [v.oud_id]: e.target.value }))
                            }
                            disabled={bezigMet !== null}
                            className="text-xs border border-border rounded px-1.5 py-0.5 bg-background font-mono"
                          >
                            <option value="">— kies —</option>
                            {v.kandidaten
                              .filter((k) => k.artikel_id && k.actief)
                              .map((k) => (
                                <option key={k.artikel_nummer} value={k.artikel_nummer}>
                                  {k.artikel_nummer}
                                  {k.omschrijving ? ` — ${k.omschrijving}` : ""}
                                </option>
                              ))}
                          </select>
                          {keuzeNr && (
                            <div className="text-muted-foreground text-[11px] font-sans mt-0.5">
                              {v.kandidaten.find((k) => k.artikel_nummer === keuzeNr)
                                ?.omschrijving ?? ""}
                            </div>
                          )}
                        </div>
                      ) : keuzeNr ? (
                        <div>
                          <span className="inline-flex items-center gap-1 font-mono">
                            <ArrowRight className="w-3 h-3" />
                            {keuzeNr}
                            <CheckCircle2 className="w-3 h-3 text-success" />
                          </span>
                          {(() => {
                            const k = v.kandidaten.find((c) => c.artikel_nummer === keuzeNr);
                            return k?.omschrijving ? (
                              <div className="text-muted-foreground text-[11px] font-sans">
                                {k.omschrijving}
                              </div>
                            ) : null;
                          })()}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">
                          {v.kandidaten.length === 0 ? "—" : "geen bruikbare"}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono align-top">
                      {v.impact.totaal}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-background">
            <span className="text-xs text-muted-foreground">
              {selected.size} geselecteerd
              {bezigMet && ` · bezig met ${bezigMet}…`}
            </span>
            <button
              onClick={voerUit}
              disabled={selected.size === 0 || bezigMet !== null}
              className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs hover:opacity-90 disabled:opacity-50"
            >
              {bezigMet !== null && <Loader2 className="w-3 h-3 animate-spin" />}
              Geselecteerde migraties doorvoeren
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
