import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Info, Package, Settings2, Zap, Wrench, ShieldCheck } from "lucide-react";
import { AssortimentTab } from "@/components/beheer/AssortimentTab";
import { ArtikelenTab } from "@/components/beheer/ArtikelenTab";
import { RmuTab } from "@/components/beheer/RmuTab";
import { MsMofTab, LsMofTab } from "@/components/beheer/MofTabs";
import { StandaardMaterialenTab, VasteArtikelenTab } from "@/components/beheer/OverigeTabs";
import { GgiRegelsTab, TrafoRegelsTab, LsRekRegelsTab, ProvRegelsTab, MsKabelRegelsTab, RmuVeldRegelsTab } from "@/components/beheer/RegelsTabs";
import { DataKwaliteitTab } from "@/components/beheer/DataKwaliteitTab";

type BeheerSearch = { groep?: string; tab?: string; artikel?: string; row?: string };

export const Route = createFileRoute("/beheer")({
  validateSearch: (s: Record<string, unknown>): BeheerSearch => ({
    groep: typeof s.groep === "string" ? s.groep : undefined,
    tab: typeof s.tab === "string" ? s.tab : undefined,
    artikel: typeof s.artikel === "string" ? s.artikel : undefined,
    row: typeof s.row === "string" ? s.row : undefined,
  }),
  component: BeheerPage,
});

type Tab = { key: string; label: string; render: () => React.ReactElement };
type Groep = { key: string; label: string; icon: typeof Package; beschrijving: string; tabs: Tab[] };

const GROEPEN: Groep[] = [
  {
    key: "catalogus",
    label: "Catalogus",
    icon: Package,
    beschrijving: "De artikelen en het assortiment dat in cases gebruikt kan worden.",
    tabs: [
      { key: "artikelen", label: "Artikelen", render: () => <ArtikelenTab /> },
      { key: "assortiment", label: "Assortimentslijst", render: () => <AssortimentTab /> },
    ],
  },
  {
    key: "hardware",
    label: "Hardware (bouwstenen)",
    icon: Settings2,
    beschrijving: "Welke RMU's en moftypes bestaan, met hun vaste onderdelen.",
    tabs: [
      { key: "rmu", label: "RMU configuraties", render: () => <RmuTab /> },
      { key: "ms_mof", label: "MS mof types", render: () => <MsMofTab /> },
      { key: "ls_mof", label: "LS mof types", render: () => <LsMofTab /> },
    ],
  },
  {
    key: "automations",
    label: "Automations (regels)",
    icon: Zap,
    beschrijving:
      "Conditionele regels: 'Als de case er zó uitziet, voeg dan dit artikel toe'. Lege voorwaarden = maakt niet uit.",
    tabs: [
      { key: "rmu_veld_regels", label: "RMU veld regels", render: () => <RmuVeldRegelsTab /> },
      { key: "trafo_regels", label: "Trafo regels", render: () => <TrafoRegelsTab /> },
      { key: "lsrek_regels", label: "LS-rek regels", render: () => <LsRekRegelsTab /> },
      { key: "prov_regels", label: "Provisorium regels", render: () => <ProvRegelsTab /> },
      { key: "ms_kabel_regels", label: "MS kabel regels", render: () => <MsKabelRegelsTab /> },
    ],
  },
  {
    key: "standaard",
    label: "Standaard & GGI",
    icon: Wrench,
    beschrijving: "Artikelen die altijd of bij bepaalde subtypes meekomen.",
    tabs: [
      { key: "standaard", label: "Standaard materialen", render: () => <StandaardMaterialenTab /> },
      { key: "vast", label: "Vaste artikelen per subtype", render: () => <VasteArtikelenTab /> },
      { key: "ggi", label: "GGI artikelen", render: () => <GgiRegelsTab /> },
    ],
  },
  {
    key: "kwaliteit",
    label: "Datakwaliteit",
    icon: ShieldCheck,
    beschrijving: "Controle op ontbrekende artikelen en referentiële fouten.",
    tabs: [{ key: "datakwaliteit", label: "Datakwaliteit", render: () => <DataKwaliteitTab /> }],
  },
];

function BeheerPage() {
  const search = Route.useSearch();
  const initialGroep = GROEPEN.find((g) => g.key === search.groep) ?? GROEPEN[0];
  const initialTab =
    initialGroep.tabs.find((t) => t.key === search.tab)?.key ?? initialGroep.tabs[0].key;
  const [groepKey, setGroepKey] = useState<string>(initialGroep.key);
  const [tabKey, setTabKey] = useState<string>(initialTab);
  const [intro, setIntro] = useState(true);

  // Sync wanneer deep-link search params veranderen (bv. via een andere tab).
  useEffect(() => {
    if (search.groep) {
      const g = GROEPEN.find((x) => x.key === search.groep);
      if (g) {
        setGroepKey(g.key);
        const t = g.tabs.find((x) => x.key === search.tab)?.key ?? g.tabs[0].key;
        setTabKey(t);
      }
    }
  }, [search.groep, search.tab]);

  const groep = GROEPEN.find((g) => g.key === groepKey) ?? GROEPEN[0];
  const tab = groep.tabs.find((t) => t.key === tabKey) ?? groep.tabs[0];

  const kiesGroep = (g: Groep) => {
    setGroepKey(g.key);
    setTabKey(g.tabs[0].key);
  };

  return (
    <div className="px-8 py-6 max-w-7xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Beheer</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Stamdata, hardware en automations voor de configurator.
        </p>
      </div>

      {intro && (
        <div className="mb-5 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <div className="text-sm flex-1 space-y-1">
              <p className="font-medium">Hoe is dit beheer opgebouwd?</p>
              <ul className="text-muted-foreground space-y-0.5 list-disc list-inside">
                <li><strong>Catalogus</strong> — alle artikelen die je kunt bestellen.</li>
                <li><strong>Hardware</strong> — welke RMU's en moffen bestaan (de bouwstenen).</li>
                <li><strong>Automations</strong> — als-dan regels die bepalen welke extra artikelen automatisch op de bestellijst komen.</li>
                <li><strong>Standaard & GGI</strong> — artikelen die altijd of bij bepaalde subtypes meekomen.</li>
                <li><strong>Datakwaliteit</strong> — checks op ontbrekende of foute koppelingen.</li>
              </ul>
              <button onClick={() => setIntro(false)} className="text-xs text-primary hover:underline mt-1">
                Verberg
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Groepkeuze – primaire navigatie */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        {GROEPEN.map((g) => {
          const Icon = g.icon;
          const actief = g.key === groepKey;
          return (
            <button
              key={g.key}
              onClick={() => kiesGroep(g)}
              className={cn(
                "text-left rounded-lg border p-3 transition-colors",
                actief
                  ? "border-primary bg-primary/5"
                  : "border-border bg-surface hover:bg-accent/40",
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={cn("h-4 w-4", actief ? "text-primary" : "text-muted-foreground")} />
                <span className="text-sm font-medium">{g.label}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                {g.beschrijving}
              </p>
            </button>
          );
        })}
      </div>

      {/* Sub-tabs binnen de groep */}
      <div className="flex gap-1 mb-4 border-b border-border overflow-x-auto">
        {groep.tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTabKey(t.key)}
            className={cn(
              "px-4 py-2 text-sm border-b-2 -mb-px transition-colors whitespace-nowrap",
              tab.key === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(search.artikel || search.row) && (
        <div className="mb-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs space-y-0.5">
          {search.artikel && (
            <div>
              Geopend vanuit winkelwagen — zoek hier naar artikel{" "}
              <strong className="font-mono">{search.artikel}</strong>.
            </div>
          )}
          {search.row && (
            <div className="text-muted-foreground">
              Exacte regel-ID: <strong className="font-mono">{search.row}</strong> — gebruik
              browser-zoek (Ctrl/Cmd+F) om de regel te vinden.
            </div>
          )}
        </div>
      )}

      {tab.render()}
    </div>
  );
}
