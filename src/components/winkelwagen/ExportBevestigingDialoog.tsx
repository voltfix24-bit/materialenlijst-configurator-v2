import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { splitAlternatieven } from "@/lib/assortiment/alternatief";

export interface ExportProbleemArtikel {
  artikel_nummer: string;
  korte_omschrijving: string;
  hoeveelheid: number;
  eenheid: string;
  /** "Inactief" | "Uitgelopen" | "Verwijderd" | "Geblokkeerd" | etc. */
  status_label: string;
  /** Ruwe alternatief-string uit DB (kan meerdere nummers bevatten, "GEEN OPVOLGER", "-" ...). */
  alternatief_raw: string | null;
  /** Parsed lijst van valide alternatief-artikelnummers. */
  alternatieven: string[];
  /** True als alt-veld expliciet "GEEN OPVOLGER" / "-" / leeg is. */
  geen_opvolger: boolean;
  /** True als alt-veld tekst-met-nummer bevat ("GEBR 20036380") — handmatige beoordeling. */
  handmatig_beoordelen: boolean;
  /** Eerder vastgelegde keuze uit `alternatief_keuzes`, indien aanwezig. */
  eerdere_keuze?: {
    nieuw_artikel_nummer: string;
    created_at: string;
    totaal_geupdate: number;
  } | null;
}

export function ExportBevestigingDialoog({
  problemen,
  onBevestig,
  onAnnuleer,
}: {
  problemen: ExportProbleemArtikel[];
  onBevestig: () => void;
  onAnnuleer: () => void;
}) {
  const aantal = problemen.length;
  const handmatigCount = problemen.filter(
    (p) => p.geen_opvolger || p.handmatig_beoordelen || p.alternatieven.length > 1,
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col">
        <div className="flex items-start gap-3 p-4 border-b border-border">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-foreground">
              Bevestig export — {aantal} artikel{aantal === 1 ? "" : "en"} vereisen aandacht
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Deze artikelen zijn <strong>inactief, uitgelopen, geblokkeerd of verwijderd</strong>{" "}
              in de huidige Liander-assortimentslijst.
              {handmatigCount > 0 && (
                <>
                  {" "}
                  <span className="text-amber-700 font-medium">
                    {handmatigCount} regel{handmatigCount === 1 ? "" : "s"} vereisen handmatige
                    beoordeling
                  </span>{" "}
                  (geen opvolger of meerdere alternatieven).
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onAnnuleer}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
            aria-label="Sluiten"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-1.5 pr-2 font-medium">Artikel</th>
                <th className="py-1.5 pr-2 font-medium">Status</th>
                <th className="py-1.5 pr-2 font-medium">Aantal</th>
                <th className="py-1.5 font-medium">Opvolger / alternatief</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {problemen.map((p) => {
                const meerdere = p.alternatieven.length > 1;
                const handmatig = p.geen_opvolger || p.handmatig_beoordelen || meerdere;
                return (
                  <tr key={p.artikel_nummer} className="align-top">
                    <td className="py-2 pr-2">
                      <div className="font-mono text-[11px] text-primary">{p.artikel_nummer}</div>
                      <div className="text-[11px] text-foreground/80 max-w-[260px]">
                        {p.korte_omschrijving}
                      </div>
                    </td>
                    <td className="py-2 pr-2">
                      <span
                        className={cn(
                          "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide",
                          p.status_label.toLowerCase().includes("verwij")
                            ? "bg-destructive/15 text-destructive"
                            : p.status_label.toLowerCase().includes("blok")
                              ? "bg-destructive/15 text-destructive"
                              : "bg-amber-500/20 text-amber-700",
                        )}
                      >
                        {p.status_label}
                      </span>
                    </td>
                    <td className="py-2 pr-2 font-mono tabular-nums text-foreground">
                      {p.hoeveelheid} {p.eenheid}
                    </td>
                    <td className="py-2">
                      {p.geen_opvolger ? (
                        <div className="text-[11px]">
                          <span className="font-semibold text-amber-700">Geen opvolger</span>
                          <span className="text-muted-foreground">
                            {" "}
                            — handmatige beoordeling vereist
                          </span>
                        </div>
                      ) : p.handmatig_beoordelen ? (
                        <div className="text-[11px]">
                          <span className="font-mono text-foreground">{p.alternatief_raw}</span>
                          <div className="text-amber-700 font-medium mt-0.5">
                            Onduidelijk veld — handmatig beoordelen
                          </div>
                        </div>
                      ) : meerdere ? (
                        <div className="text-[11px]">
                          <div className="flex flex-wrap gap-1 mb-0.5">
                            {p.alternatieven.map((nr) => (
                              <span
                                key={nr}
                                className="font-mono px-1.5 py-0.5 rounded bg-muted text-foreground"
                              >
                                {nr}
                              </span>
                            ))}
                          </div>
                          <span className="text-amber-700 font-medium">
                            Meerdere alternatieven — kies handmatig
                          </span>
                        </div>
                      ) : p.alternatieven.length === 1 ? (
                        <div className="text-[11px]">
                          <span className="font-mono text-foreground">{p.alternatieven[0]}</span>
                          <span className="text-muted-foreground"> — vervang via Beheer</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">
                          Geen alternatief bekend
                        </span>
                      )}
                      {p.eerdere_keuze && (
                        <div className="text-[11px] mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700">
                          <span>✓ Eerder gekozen:</span>
                          <span className="font-mono font-semibold">
                            {p.eerdere_keuze.nieuw_artikel_nummer}
                          </span>
                          <span className="text-emerald-700/70">
                            ({new Date(p.eerdere_keuze.created_at).toLocaleDateString("nl-NL")},{" "}
                            {p.eerdere_keuze.totaal_geupdate} ref)
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-2 p-4 border-t border-border bg-muted/30">
          <p className="text-[11px] text-muted-foreground">
            Bevestig alleen als je deze artikelen bewust meeneemt in de export naar Liander.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAnnuleer}
              className="px-3 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted"
            >
              Annuleren
            </button>
            <button
              type="button"
              onClick={onBevestig}
              className="px-3 py-2 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold"
            >
              Toch exporteren ({aantal})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
