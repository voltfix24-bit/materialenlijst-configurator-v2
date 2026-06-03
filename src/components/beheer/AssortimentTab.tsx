import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseAssortimentslijst, SHEET_NAAM, VERWIJDERD_SHEET_NAAM } from "@/lib/assortiment/excel";
import {
  berekenDiff,
  voerSyncDoor,
  type DiffResultaat,
  type SyncResult,
} from "@/lib/assortiment/sync";
import { berekenImpact, type ImpactPerArtikel } from "@/lib/assortiment/impact";
import {
  voorbereidAlternatiefMigratie,
  voerAlternatiefMigratieDoor,
  getAlternatiefKeuzes,
  type AlternatiefVoorstel,
  type AlternatiefKeuze,
} from "@/lib/assortiment/alternatief";

export function AssortimentTab() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [bestand, setBestand] = useState<File | null>(null);
  const [diff, setDiff] = useState<DiffResultaat | null>(null);
  const [impact, setImpact] = useState<ImpactPerArtikel[] | null>(null);
  const [erkenRisico, setErkenRisico] = useState(false);

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

  const { data: keuzes } = useQuery({
    queryKey: ["alternatief-keuzes"],
    queryFn: getAlternatiefKeuzes,
  });

  const analyseer = useMutation({
    mutationFn: async (file: File) => {
      const parsed = await parseAssortimentslijst(file);
      if (parsed.artikelen.length === 0) {
        throw new Error(`Geen artikelen gevonden in sheet "${SHEET_NAAM}"`);
      }
      const d = await berekenDiff(parsed);
      // Impact op alle artikelen die straks niet meer normaal actief zijn:
      //  - uitgelopen (niet meer in Verbruik)
      //  - verwijderd-met-DB-match (uit sheet "Lijst verwijderd")
      //  - gewijzigd waarbij het artikel nu inactief wordt (Geblokkeerd, Uitloop-via-status, Inactief)
      const gewijzigdNaarInactief = d.gewijzigd
        .filter((g) => g.huidig.actief && g.nieuw.status.toLowerCase() !== "actief")
        .map((g) => g.huidig.id);
      const ids = [
        ...d.uitgelopen.map((a) => a.id),
        ...d.verwijderd.map((v) => v.huidig?.id).filter((x): x is string => !!x),
        ...gewijzigdNaarInactief,
      ];
      const imp = ids.length > 0 ? await berekenImpact(ids) : [];
      return { d, imp };
    },
    onSuccess: ({ d, imp }) => {
      setDiff(d);
      setImpact(imp);
      setErkenRisico(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const doorvoeren = useMutation({
    mutationFn: async () => {
      if (!diff || !bestand) throw new Error("Geen diff");
      return voerSyncDoor(diff, bestand.name);
    },
    onSuccess: (res: SyncResult) => {
      const ok = res.errors.length === 0;
      const tekst =
        `+${res.inserted} nieuw · ~${res.updated} gewijzigd · −${res.deactivated} uitgelopen · ` +
        `−${res.verwijderd_verwerkt} verwijderd`;
      if (ok) {
        toast.success(`Assortiment gesynchroniseerd · ${tekst}`);
      } else {
        toast.error(
          `Sync gedeeltelijk geslaagd · ${tekst} · ${res.errors.length} fout(en). ` +
            `Eerste: ${res.errors[0].stap} — ${res.errors[0].detail}`,
          { duration: 12000 },
        );
      }
      setDiff(null);
      setImpact(null);
      setBestand(null);
      setErkenRisico(false);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["beheer-artikelen"] });
      qc.invalidateQueries({ queryKey: ["assortiment-laatste-sync"] });
      qc.invalidateQueries({ queryKey: ["artikelen"] });
      qc.invalidateQueries({ queryKey: ["alternatief-voorstellen"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onFile = (f: File | null) => {
    setDiff(null);
    setImpact(null);
    setBestand(f);
    if (f) analyseer.mutate(f);
  };

  const samenvatting = useMemo(() => {
    if (!laatsteSync?.waarde) return null;
    const [iso, naam] = laatsteSync.waarde.split(" | ");
    const d = new Date(iso);
    return `${d.toLocaleString("nl-NL")} · ${naam ?? ""}`;
  }, [laatsteSync]);

  const hardeImpactZonderAlt = useMemo(
    () => (impact ?? []).filter((i) => i.totaal > 0 && !i.alternatiefBeschikbaar),
    [impact],
  );
  const doorvoerenGeblokkeerd =
    !diff ||
    doorvoeren.isPending ||
    (hardeImpactZonderAlt.length > 0 && !erkenRisico);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="text-sm font-medium">Assortimentslijst uploaden</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Upload het maandelijkse Liander .xlsx-bestand. Sheet "
            <span className="font-mono font-semibold text-foreground">{SHEET_NAAM}</span>"
            wordt ingelezen als bron voor bestellen/exporteren (artikelen vanaf rij 14, kolommen B/C/D/E/F/G/I/J).
            Sheet "<span className="font-mono">{VERWIJDERD_SHEET_NAAM}</span>" levert opvolgers voor verwijderde
            artikelen (kolom A = oud nummer, kolom F = opvolger).
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
          {(() => {
            const geblokkeerd = diff.gewijzigd.filter(
              (g) => g.nieuw.status.toLowerCase() === "geblokkeerd",
            ).length;
            return (
              <div className="grid grid-cols-5 gap-3">
                <Stat color="text-success" label="Nieuw" count={diff.nieuw.length} icon="✅" />
                <Stat color="text-primary" label="Gewijzigd" count={diff.gewijzigd.length} icon="🔄" />
                <Stat color="text-warning" label="Uitloop" count={diff.uitgelopen.length} icon="⚠️" />
                <Stat color="text-destructive" label="Geblokkeerd" count={geblokkeerd} icon="🚫" />
                <Stat color="text-destructive" label="Verwijderd" count={diff.verwijderd.length} icon="🗑" />
              </div>
            );
          })()}
          <div className="text-xs text-muted-foreground">
            {diff.ongewijzigd} artikelen ongewijzigd. Sheet "
            <span className="font-mono">{SHEET_NAAM}</span>" wordt ingelezen — niet "Aanvulling".
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

          <DiffSectie titel="Uitgelopen (in DB actief, niet meer in Verbruik)">
            {diff.uitgelopen.length === 0 ? (
              <Leeg />
            ) : (
              <table className="w-full text-xs">
                <tbody className="divide-y divide-border">
                  {diff.uitgelopen.slice(0, 100).map((a) => (
                    <tr key={a.id}>
                      <td className="px-2 py-1 font-mono">{a.artikel_nummer}</td>
                      <td className="px-2 py-1">{a.korte_omschrijving}</td>
                      <td className="px-2 py-1 text-muted-foreground">
                        {a.alternatief_artikel_nummer ? `alt: ${a.alternatief_artikel_nummer}` : "geen alt."}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {diff.uitgelopen.length > 100 && <Meer n={diff.uitgelopen.length - 100} />}
          </DiffSectie>

          <DiffSectie titel={`Verwijderd (uit sheet "${VERWIJDERD_SHEET_NAAM}")`}>
            {diff.verwijderd.length === 0 ? (
              <Leeg />
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-2 py-1 font-medium">Artikel</th>
                    <th className="text-left px-2 py-1 font-medium">Opvolger</th>
                    <th className="text-left px-2 py-1 font-medium">In DB?</th>
                    <th className="text-left px-2 py-1 font-medium">Reden</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {diff.verwijderd.slice(0, 100).map((v) => (
                    <tr key={v.parsed.artikel_nummer}>
                      <td className="px-2 py-1">
                        <span className="font-mono">{v.parsed.artikel_nummer}</span>
                        <div className="text-muted-foreground text-[11px]">{v.parsed.korte_omschrijving}</div>
                      </td>
                      <td className="px-2 py-1">
                        {v.parsed.opvolger_nummers.length === 0 ? (
                          <span className="text-muted-foreground italic">
                            {v.parsed.opvolger_raw ?? "geen opvolger"}
                          </span>
                        ) : (
                          <span className="font-mono inline-flex items-center gap-1">
                            <ArrowRight className="w-3 h-3" />
                            {v.parsed.opvolger_nummers.join(" / ")}
                            {v.parsed.opvolger_handmatig && (
                              <span
                                className="ml-1 inline-flex items-center px-1 rounded text-[9px] font-semibold uppercase tracking-wide bg-amber-500/20 text-amber-700"
                                title={`Originele celwaarde: "${v.parsed.opvolger_raw}". Controleer of het juiste nummer is gepakt.`}
                              >
                                handmatig
                              </span>
                            )}
                            {v.conflict_met_huidig_alt && (
                              <span
                                className="ml-1 inline-flex items-center px-1 rounded text-[9px] font-semibold uppercase tracking-wide bg-destructive/15 text-destructive"
                                title={`Huidig alt in DB: ${v.huidig?.alternatief_artikel_nummer} — wordt NIET overschreven.`}
                              >
                                conflict
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-muted-foreground">
                        {v.huidig ? (
                          <span className="text-success">ja</span>
                        ) : (
                          <span className="text-muted-foreground italic">nee — alleen geregistreerd</span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-muted-foreground text-[11px]">
                        {v.parsed.reden ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {diff.verwijderd.length > 100 && <Meer n={diff.verwijderd.length - 100} />}
          </DiffSectie>

          <ImpactSectie impact={impact ?? []} />

          {hardeImpactZonderAlt.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-medium text-amber-700">
                    {hardeImpactZonderAlt.length} uitgelopen/verwijderd artikel(en) worden nog gebruikt in
                    beheer-regels en hebben géén bruikbaar alternatief.
                  </div>
                  <div className="text-amber-700/80 mt-0.5">
                    Na doorvoeren staan deze artikelen op inactief maar blijven referenties bestaan.
                    Cases die deze artikelen gebruiken krijgen een waarschuwing in de winkelwagen.
                  </div>
                  <label className="inline-flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={erkenRisico}
                      onChange={(e) => setErkenRisico(e.target.checked)}
                    />
                    <span className="text-amber-700">Ik begrijp dit en wil toch doorvoeren.</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => { setDiff(null); setImpact(null); setBestand(null); setErkenRisico(false); if (fileRef.current) fileRef.current.value = ""; }}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-accent"
            >
              Annuleren
            </button>
            <button
              onClick={() => doorvoeren.mutate()}
              disabled={doorvoerenGeblokkeerd}
              className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-1.5 text-sm hover:opacity-90 disabled:opacity-50"
            >
              {doorvoeren.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Doorvoeren
            </button>
          </div>
        </div>
      )}

      <AlternatiefMigratiePaneel />
    </div>
  );
}

function ImpactSectie({ impact }: { impact: ImpactPerArtikel[] }) {
  if (impact.length === 0) {
    return (
      <DiffSectie titel="Impact op beheer-regels">
        <div className="px-3 py-3 text-xs text-muted-foreground">
          Geen uitgelopen of verwijderde artikelen → geen impact op beheer-regels.
        </div>
      </DiffSectie>
    );
  }
  const geraakt = impact.filter((i) => i.totaal > 0);
  return (
    <DiffSectie titel={`Impact op beheer-regels (${geraakt.length}/${impact.length} geraakt)`}>
      {geraakt.length === 0 ? (
        <div className="px-3 py-3 text-xs text-muted-foreground">
          Geen van de uitgelopen/verwijderde artikelen wordt nog gebruikt in beheer-regels.
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left px-2 py-1 font-medium">Oud artikel</th>
              <th className="text-left px-2 py-1 font-medium">Alternatief</th>
              <th className="text-right px-2 py-1 font-medium"># regels</th>
              <th className="text-left px-2 py-1 font-medium">Waar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {geraakt.slice(0, 50).map((i) => (
              <tr key={i.artikel_id}>
                <td className="px-2 py-1">
                  <span className="font-mono">{i.artikel_nummer}</span>
                  <div className="text-muted-foreground text-[11px]">{i.korte_omschrijving}</div>
                </td>
                <td className="px-2 py-1">
                  {i.alternatief_artikel_nummer ? (
                    <span className="inline-flex items-center gap-1 font-mono">
                      <ArrowRight className="w-3 h-3" />
                      {i.alternatief_artikel_nummer}
                      {i.alternatiefBeschikbaar ? (
                        <CheckCircle2 className="w-3 h-3 text-success" aria-label="beschikbaar" />
                      ) : (
                        <XCircle className="w-3 h-3 text-destructive" aria-label="niet beschikbaar of inactief" />
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-2 py-1 text-right font-mono">{i.totaal}</td>
                <td className="px-2 py-1 text-muted-foreground text-[11px]">
                  {i.gebruikt_in.map((g) => `${g.tabel}.${g.kolom} (${g.count})`).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {geraakt.length > 50 && <Meer n={geraakt.length - 50} />}
    </DiffSectie>
  );
}

function AlternatiefMigratiePaneel() {
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
            Inactieve artikelen met een alternatief. Bij meerdere kandidaten moet je expliciet kiezen —
            er gebeurt niets automatisch.
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
                      <div className="text-muted-foreground text-[11px] font-sans">{v.oud_omschrijving}</div>
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      {v.kandidaten.length === 0 ? (
                        <span className="text-muted-foreground italic">geen</span>
                      ) : (
                        <div className="space-y-0.5">
                          {v.kandidaten.map((k) => (
                            <div key={k.artikel_nummer} className="flex items-center gap-1 font-mono">
                              <span>{k.artikel_nummer}</span>
                              {!k.artikel_id ? (
                                <span className="text-destructive text-[10px]">(onbekend)</span>
                              ) : !k.actief ? (
                                <span className="text-amber-600 text-[10px]">(inactief)</span>
                              ) : (
                                <span className="text-success text-[10px]">(actief)</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      {meerdere ? (
                        <select
                          value={keuzeNr ?? ""}
                          onChange={(e) => setKeuze((p) => ({ ...p, [v.oud_id]: e.target.value }))}
                          disabled={bezigMet !== null}
                          className="text-xs border border-border rounded px-1.5 py-0.5 bg-background font-mono"
                        >
                          <option value="">— kies —</option>
                          {v.kandidaten
                            .filter((k) => k.artikel_id && k.actief)
                            .map((k) => (
                              <option key={k.artikel_nummer} value={k.artikel_nummer}>
                                {k.artikel_nummer}
                              </option>
                            ))}
                        </select>
                      ) : keuzeNr ? (
                        <span className="inline-flex items-center gap-1 font-mono">
                          <ArrowRight className="w-3 h-3" />
                          {keuzeNr}
                          <CheckCircle2 className="w-3 h-3 text-success" />
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">
                          {v.kandidaten.length === 0
                            ? "—"
                            : "geen bruikbare"}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono align-top">{v.impact.totaal}</td>
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
