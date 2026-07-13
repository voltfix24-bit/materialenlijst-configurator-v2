import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Info, Package, Zap, ShieldCheck, History } from "lucide-react";
import { AssortimentTab } from "@/components/beheer/AssortimentTab";
import { ArtikelenTab } from "@/components/beheer/ArtikelenTab";
import { RmuTab } from "@/components/beheer/RmuTab";
import { MsMofTab, LsMofTab } from "@/components/beheer/MofTabs";
import {
  StandaardMaterialenTab,
  VasteArtikelenTab,
  LsBeveiligingOptiesTab,
  TrafoVultKabelTab,
} from "@/components/beheer/OverigeTabs";
import {
  GgiRegelsTab,
  TrafoRegelsTab,
  LsRekRegelsTab,
  ProvRegelsTab,
  MsKabelRegelsTab,
  RmuVeldRegelsTab,
} from "@/components/beheer/RegelsTabs";
import { DataKwaliteitTab } from "@/components/beheer/DataKwaliteitTab";
import { ProefcaseTab } from "@/components/beheer/ProefcaseTab";
import { EigenVragenTab } from "@/components/beheer/EigenVragenTab";
import { VragenRegelsTab } from "@/components/beheer/VragenRegelsTab";
import { RingklemmenTab, InetArtikelenTab } from "@/components/beheer/RingklemInetTabs";
import { AutomationAuditTab } from "@/components/beheer/AutomationAuditTab";
import { OverzichtTab } from "@/components/beheer/OverzichtTab";
import { RegelsSamenvattingTab } from "@/components/beheer/RegelsSamenvattingTab";
import { WijzigingenTab } from "@/components/beheer/WijzigingenTab";
import { useDeeplinkHighlight } from "@/lib/beheer/useDeeplinkHighlight";

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

type Tab = {
  key: string;
  label: string;
  render: () => React.ReactElement;
  /** Onderliggende tabel-tab: bereikbaar via het "Tabellen"-menu en deep-links. */
  geavanceerd?: boolean;
};
type Groep = {
  key: string;
  label: string;
  icon: typeof Package;
  beschrijving: string;
  tabs: Tab[];
};

// Vier groepen met elk één duidelijke taak. De oude tabel-tabs bestaan nog
// als "geavanceerd" (voor deep-links en snel tabel-bewerken) maar de ingang
// is vraag-gecentreerd: Vragen & regels → per hoofdstuk.
const GROEPEN: Groep[] = [
  {
    key: "vragen",
    label: "Vragen & regels",
    icon: Zap,
    beschrijving: "Alles wat de configurator vraagt, per hoofdstuk — met de gekoppelde artikelen.",
    tabs: [
      { key: "vragen_regels", label: "Per hoofdstuk", render: () => <VragenRegelsTab /> },
      { key: "eigen_vragen", label: "Eigen vragen", render: () => <EigenVragenTab /> },
      { key: "leesbaar", label: "Leesbaar overzicht", render: () => <RegelsSamenvattingTab /> },
      {
        key: "rmu_veld_regels",
        label: "RMU veld regels",
        render: () => <RmuVeldRegelsTab />,
        geavanceerd: true,
      },
      {
        key: "trafo_regels",
        label: "Trafo regels",
        render: () => <TrafoRegelsTab />,
        geavanceerd: true,
      },
      {
        key: "trafo_vult_kabel",
        label: "Trafo vult-kabel",
        render: () => <TrafoVultKabelTab />,
        geavanceerd: true,
      },
      {
        key: "lsrek_regels",
        label: "LS-rek regels",
        render: () => <LsRekRegelsTab />,
        geavanceerd: true,
      },
      {
        key: "prov_regels",
        label: "Provisorium regels",
        render: () => <ProvRegelsTab />,
        geavanceerd: true,
      },
      {
        key: "ms_kabel_regels",
        label: "MS kabel regels",
        render: () => <MsKabelRegelsTab />,
        geavanceerd: true,
      },
      {
        key: "standaard",
        label: "Standaard materialen",
        render: () => <StandaardMaterialenTab />,
        geavanceerd: true,
      },
      {
        key: "vast",
        label: "Vaste artikelen per subtype",
        render: () => <VasteArtikelenTab />,
        geavanceerd: true,
      },
      { key: "ggi", label: "GGI artikelen", render: () => <GgiRegelsTab />, geavanceerd: true },
    ],
  },
  {
    key: "catalogus",
    label: "Catalogus & bouwstenen",
    icon: Package,
    beschrijving:
      "Artikelen, de maandelijkse assortimentslijst en de bouwstenen (RMU's, moffen, klemmen).",
    tabs: [
      { key: "artikelen", label: "Artikelen", render: () => <ArtikelenTab /> },
      { key: "assortiment", label: "Assortimentslijst", render: () => <AssortimentTab /> },
      { key: "rmu", label: "RMU configuraties", render: () => <RmuTab /> },
      { key: "ms_mof", label: "MS mof types", render: () => <MsMofTab />, geavanceerd: true },
      { key: "ls_mof", label: "LS mof types", render: () => <LsMofTab />, geavanceerd: true },
      {
        key: "ls_beveiliging",
        label: "LS beveiligingsopties",
        render: () => <LsBeveiligingOptiesTab />,
        geavanceerd: true,
      },
      {
        key: "ringklemmen",
        label: "Ringklemmen",
        render: () => <RingklemmenTab />,
        geavanceerd: true,
      },
      {
        key: "inet",
        label: "I-Net artikelen",
        render: () => <InetArtikelenTab />,
        geavanceerd: true,
      },
    ],
  },
  {
    key: "controle",
    label: "Controle & test",
    icon: ShieldCheck,
    beschrijving: "Proefcase-simulator, datakwaliteit, audit en veilig zoeken & vervangen.",
    tabs: [
      { key: "proefcase", label: "Proefcase (simulator)", render: () => <ProefcaseTab /> },
      { key: "datakwaliteit", label: "Datakwaliteit", render: () => <DataKwaliteitTab /> },
      { key: "automation_audit", label: "Automations audit", render: () => <AutomationAuditTab /> },
      { key: "overzicht", label: "Zoek & vervang", render: () => <OverzichtTab /> },
    ],
  },
  {
    key: "historie",
    label: "Wijzigingen",
    icon: History,
    beschrijving:
      "Log van syncs, vervangingen en doorgevoerde leervoorstellen — nieuwste bovenaan.",
    tabs: [{ key: "wijzigingen", label: "Wijzigingen", render: () => <WijzigingenTab /> }],
  },
];

// Deep-link compatibiliteit: tab-keys zijn uniek, dus een oude link met alleen
// een (verouderde) groep of een tab uit een oude groep blijft gewoon werken.
const TAB_NAAR_GROEP: Record<string, string> = {};
for (const g of GROEPEN) for (const t of g.tabs) TAB_NAAR_GROEP[t.key] = g.key;

const GROEP_ALIAS: Record<string, string> = {
  overzicht: "controle",
  hardware: "catalogus",
  automations: "vragen",
  standaard: "vragen",
  kwaliteit: "controle",
};

/** Vertaal (oude of nieuwe) search-params naar geldige groep + tab. */
function resolveDeeplink(zoek: BeheerSearch): { groepKey: string; tabKey: string } | null {
  if (zoek.tab && TAB_NAAR_GROEP[zoek.tab]) {
    return { groepKey: TAB_NAAR_GROEP[zoek.tab], tabKey: zoek.tab };
  }
  const groepKey = zoek.groep ? (GROEP_ALIAS[zoek.groep] ?? zoek.groep) : undefined;
  const g = GROEPEN.find((x) => x.key === groepKey);
  if (g) return { groepKey: g.key, tabKey: g.tabs[0].key };
  return null;
}

function BeheerPage() {
  const search = Route.useSearch();
  const initieel = resolveDeeplink(search) ?? {
    groepKey: GROEPEN[0].key,
    tabKey: GROEPEN[0].tabs[0].key,
  };
  const [groepKey, setGroepKey] = useState<string>(initieel.groepKey);
  const [tabKey, setTabKey] = useState<string>(initieel.tabKey);
  const [intro, setIntro] = useState(true);

  // Sync wanneer deep-link search params veranderen (bv. via een andere tab).
  useEffect(() => {
    const doel = resolveDeeplink(search);
    if (doel) {
      setGroepKey(doel.groepKey);
      setTabKey(doel.tabKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.groep, search.tab]);

  const groep = GROEPEN.find((g) => g.key === groepKey) ?? GROEPEN[0];
  const tab = groep.tabs.find((t) => t.key === tabKey) ?? groep.tabs[0];
  const primaireTabs = groep.tabs.filter((t) => !t.geavanceerd);
  const geavanceerdeTabs = groep.tabs.filter((t) => t.geavanceerd);
  const actieveIsGeavanceerd = !!tab.geavanceerd;

  const kiesGroep = (g: Groep) => {
    setGroepKey(g.key);
    setTabKey(g.tabs[0].key);
  };

  return (
    <div className="px-8 py-6 max-w-7xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Beheer</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Vragen, regels en stamdata voor de configurator.
        </p>
      </div>

      {intro && (
        <div className="mb-5 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <div className="text-sm flex-1 space-y-1">
              <p className="font-medium">Hoe is dit beheer opgebouwd?</p>
              <ul className="text-muted-foreground space-y-0.5 list-disc list-inside">
                <li>
                  <strong>Vragen & regels</strong> — per hoofdstuk zien én aanpassen wat de
                  configurator vraagt en welke artikelen daaraan hangen.
                </li>
                <li>
                  <strong>Catalogus & bouwstenen</strong> — artikelen, de Liander-assortimentslijst
                  en de vaste bouwstenen.
                </li>
                <li>
                  <strong>Controle & test</strong> — proefcase draaien, datakwaliteit checken,
                  artikelen veilig vervangen.
                </li>
                <li>
                  <strong>Wijzigingen</strong> — alles wat er is aangepast, door jou of het
                  leersysteem.
                </li>
              </ul>
              <button
                onClick={() => setIntro(false)}
                className="text-xs text-primary hover:underline mt-1"
              >
                Verberg
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Groepkeuze – primaire navigatie */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
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
                <Icon
                  className={cn("h-4 w-4", actief ? "text-primary" : "text-muted-foreground")}
                />
                <span className="text-sm font-medium">{g.label}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                {g.beschrijving}
              </p>
            </button>
          );
        })}
      </div>

      {/* Sub-tabs binnen de groep + geavanceerd tabellen-menu */}
      <div className="flex items-center gap-1 mb-4 border-b border-border overflow-x-auto">
        {primaireTabs.map((t) => (
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
        {geavanceerdeTabs.length > 0 && (
          <select
            value={actieveIsGeavanceerd ? tab.key : ""}
            onChange={(e) => e.target.value && setTabKey(e.target.value)}
            className={cn(
              "ml-auto shrink-0 h-8 rounded-md border bg-surface px-2 text-xs",
              actieveIsGeavanceerd
                ? "border-primary text-foreground font-medium"
                : "border-border text-muted-foreground",
            )}
            title="Onderliggende tabellen — voor snel bewerken van een hele tabel"
          >
            <option value="">Tabellen…</option>
            {geavanceerdeTabs.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <DeeplinkBanner artikel={search.artikel} row={search.row} />

      {tab.render()}
    </div>
  );
}

function DeeplinkBanner({ artikel, row }: { artikel?: string; row?: string }) {
  const { status } = useDeeplinkHighlight(row);
  if (!artikel && !row) return null;
  return (
    <div className="mb-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs space-y-0.5">
      {artikel && (
        <div>
          Geopend vanuit winkelwagen: deze regel voegt artikel{" "}
          <strong className="font-mono">{artikel}</strong> toe.
        </div>
      )}
      {row && status === "searching" && (
        <div className="text-muted-foreground">Regel zoeken in deze tab…</div>
      )}
      {row && status === "found" && (
        <div className="text-success">Regel gevonden en gemarkeerd.</div>
      )}
      {row && status === "not_found" && (
        <div className="text-amber-700">
          Regel niet gevonden — mogelijk verwijderd, gewijzigd of in een andere tab.
        </div>
      )}
    </div>
  );
}
