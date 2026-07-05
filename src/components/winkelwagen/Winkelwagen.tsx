import { useEffect, useMemo, useRef, useState } from "react";
import { VolledigeMaterialenlijst } from "./VolledigeMaterialenlijst";
import type { PreviewItem, WinkelwagenAanpassingen } from "@/lib/configurator/types";
import type { ArtikelStam } from "@/lib/configurator/artikelTypes";

import { CorrectieDialoog } from "./CorrectieDialoog";
import { ExportBevestigingDialoog } from "./ExportBevestigingDialoog";
import { useWinkelwagenAanpassingen } from "./useWinkelwagenAanpassingen";
import { useExportProblemen } from "./useExportProblemen";
import { WinkelwagenSecties } from "./WinkelwagenSecties";
import { WinkelwagenHeader } from "./WinkelwagenHeader";
import { HandmatigToevoegen } from "./HandmatigToevoegen";
import { WinkelwagenFooter } from "./WinkelwagenFooter";
import { useWinkelwagenAnimaties } from "./useWinkelwagenAnimaties";
import { useWinkelwagenSecties } from "./useWinkelwagenSecties";
import { useWinkelwagenCorrecties } from "./useWinkelwagenCorrecties";

interface Props {
  items: PreviewItem[]; // berekende items vanuit configurator
  caseId: string;
  caseType: string;
  subType: string;
  hasSubType: boolean;
  saving: boolean;
  onSave: () => void;
  onItemsChange: (effectief: PreviewItem[]) => void;
  artikelen: ArtikelStam[];
  /** Welke configurator-sectie is actief — winkelwagen synchroniseert open secties hierop. */
  activeSectie?: string;
  onExport?: () => void;
  exportDisabled?: boolean;
  exportPending?: boolean;
  /** Verhoog deze counter om vanuit buiten (bv. case-header) de export-bevestigingscontrole te triggeren. */
  exportSignal?: number;
  /** Volledige case-configuratie — wordt als snapshot bij elke correctie opgeslagen. */
  configSnapshot?: Record<string, unknown> | null;
  /** Eerder opgeslagen aanpassingen (uit config_json.winkelwagen) — hersteld bij openen. */
  initieleAanpassingen?: WinkelwagenAanpassingen | null;
  /** Meldt elke wijziging in overrides/verwijderd/toegevoegd zodat de parent ze kan opslaan. */
  onAanpassingenChange?: (aanpassingen: WinkelwagenAanpassingen) => void;
}

export function Winkelwagen({
  items,
  caseId,
  caseType,
  subType,
  hasSubType,
  saving,
  onSave,
  onItemsChange,
  artikelen,
  activeSectie,
  onExport,
  exportDisabled,
  exportPending,
  exportSignal,
  configSnapshot,
  initieleAanpassingen,
  onAanpassingenChange,
}: Props) {
  const {
    effectief,
    overrides,
    setOverrides,
    verwijderd,
    setVerwijderd,
    toegevoegd,
    setToegevoegd,
  } = useWinkelwagenAanpassingen({
    caseId,
    items,
    initieleAanpassingen,
    onItemsChange,
    onAanpassingenChange,
  });
  const [showZoeker, setShowZoeker] = useState(false);
  const [zoek, setZoek] = useState("");
  const [zoekHoeveelheid, setZoekHoeveelheid] = useState(1);
  const [gekozenArtikel, setGekozenArtikel] = useState<ArtikelStam | null>(null);
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
  const [volledigOpen, setVolledigOpen] = useState(false);

  const { nieuwNrs, verwijderdAnim } = useWinkelwagenAnimaties(effectief, items);
  const {
    filter,
    setFilter,
    lijstRef,
    openSecties,
    sectieGroepen,
    zichtbareToegevoegd,
    sectiesMetNieuw,
    toggleSectie,
  } = useWinkelwagenSecties({
    activeSectie,
    caseId,
    effectief,
    verwijderdAnim,
    toegevoegd,
    nieuwNrs,
  });
  const {
    dialoogData,
    bevestigDialoog,
    annuleerDialoog,
    wijzigHoeveelheid,
    verwijderItem,
    voegHandmatigToe,
  } = useWinkelwagenCorrecties({
    caseId,
    caseType,
    subType,
    configSnapshot,
    items,
    toegevoegd,
    overrides,
    setOverrides,
    setVerwijderd,
    setToegevoegd,
  });

  const voegArtikelToe = () => {
    if (!gekozenArtikel || zoekHoeveelheid <= 0) return;
    voegHandmatigToe(gekozenArtikel, zoekHoeveelheid);
    setShowZoeker(false);
    setZoek("");
    setGekozenArtikel(null);
    setZoekHoeveelheid(1);
  };

  const suggesties = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    if (q.length < 2) return [];
    const al = new Set(effectief.map((e) => e.artikel_nummer));
    return artikelen
      .filter(
        (a) =>
          !al.has(a.artikel_nummer) &&
          (a.artikel_nummer.toLowerCase().includes(q) ||
            a.korte_omschrijving.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [zoek, artikelen, effectief]);

  const teBestellen = effectief.filter((p) => !p.niet_bestellen).length;
  const totaal = effectief.length;
  const exportProblemen = useExportProblemen(effectief, artikelen);

  const handleExportClick = () => {
    if (!onExport) return;
    if (exportProblemen.length > 0) {
      setExportConfirmOpen(true);
      return;
    }
    onExport();
  };

  // Externe trigger (case-header "Export"-knop) → zelfde bevestigingsflow als de
  // winkelwagen-knop. Skip de eerste mount zodat we niet automatisch openen.
  const exportSignalRef = useRef<number | undefined>(exportSignal);
  useEffect(() => {
    if (exportSignal === undefined) return;
    if (exportSignalRef.current === exportSignal) return;
    exportSignalRef.current = exportSignal;
    handleExportClick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportSignal]);

  return (
    <div className="bg-card flex flex-col h-full max-h-screen">
      <WinkelwagenHeader
        totaal={totaal}
        teBestellen={teBestellen}
        filter={filter}
        onFilterChange={setFilter}
        onOpenVolledig={() => setVolledigOpen(true)}
        onOpenZoeker={() => setShowZoeker(true)}
      />

      <WinkelwagenSecties
        lijstRef={lijstRef}
        hasSubType={hasSubType}
        sectieGroepen={sectieGroepen}
        toegevoegd={toegevoegd}
        zichtbareToegevoegd={zichtbareToegevoegd}
        openSecties={openSecties}
        sectiesMetNieuw={sectiesMetNieuw}
        nieuwNrs={nieuwNrs}
        overrides={overrides}
        onToggleSectie={toggleSectie}
        onWijzigHoeveelheid={wijzigHoeveelheid}
        onVerwijderItem={verwijderItem}
        onWijzigToegevoegd={(artikelNummer, hoeveelheid) =>
          setToegevoegd((prev) =>
            prev.map((x) => (x.artikel_nummer === artikelNummer ? { ...x, hoeveelheid } : x)),
          )
        }
      />

      <WinkelwagenFooter
        teBestellen={teBestellen}
        saving={saving}
        exportPending={exportPending}
        exportDisabled={exportDisabled || exportPending || !onExport}
        exportProblemenAantal={exportProblemen.length}
        onSave={onSave}
        onExport={handleExportClick}
      >
        <HandmatigToevoegen
          open={showZoeker}
          zoek={zoek}
          zoekHoeveelheid={zoekHoeveelheid}
          gekozenArtikel={gekozenArtikel}
          suggesties={suggesties}
          onZoekChange={(value) => {
            setZoek(value);
            setGekozenArtikel(null);
          }}
          onZoekHoeveelheidChange={setZoekHoeveelheid}
          onKiesArtikel={setGekozenArtikel}
          onSluiten={() => {
            setShowZoeker(false);
            setZoek("");
            setGekozenArtikel(null);
          }}
          onToevoegen={voegArtikelToe}
        />
      </WinkelwagenFooter>

      {dialoogData && (
        <CorrectieDialoog
          data={dialoogData}
          onBevestig={bevestigDialoog}
          onAnnuleer={annuleerDialoog}
        />
      )}

      {exportConfirmOpen && (
        <ExportBevestigingDialoog
          problemen={exportProblemen}
          onBevestig={() => {
            setExportConfirmOpen(false);
            onExport?.();
          }}
          onAnnuleer={() => setExportConfirmOpen(false)}
        />
      )}

      <VolledigeMaterialenlijst
        open={volledigOpen}
        onClose={() => setVolledigOpen(false)}
        effectief={effectief}
        handmatigeNrs={new Set(toegevoegd.map((t) => t.artikel_nummer))}
        overrideNrs={new Set(overrides.keys())}
        artikelen={artikelen}
        exportProblemen={exportProblemen}
        onChangeQty={(it, v) => wijzigHoeveelheid(it, v)}
        onVerwijder={(it) => verwijderItem(it)}
        onVoegToe={(stam, qty) => voegHandmatigToe(stam, qty)}
        onSave={onSave}
        onExport={handleExportClick}
        saving={saving}
        exportPending={exportPending}
        exportDisabled={exportDisabled || !onExport}
      />
    </div>
  );
}
