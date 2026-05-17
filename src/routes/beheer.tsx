import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { AssortimentTab } from "@/components/beheer/AssortimentTab";
import { ArtikelenTab } from "@/components/beheer/ArtikelenTab";
import { RmuTab } from "@/components/beheer/RmuTab";
import { MsMofTab, LsMofTab } from "@/components/beheer/MofTabs";
import { StandaardMaterialenTab, VasteArtikelenTab } from "@/components/beheer/OverigeTabs";
import { GgiRegelsTab, TrafoRegelsTab, LsRekRegelsTab, ProvRegelsTab, MsKabelRegelsTab, RmuVeldRegelsTab } from "@/components/beheer/RegelsTabs";

export const Route = createFileRoute("/beheer")({
  component: BeheerPage,
});

const TABS = [
  { key: "artikelen", label: "Artikelen" },
  { key: "assortiment", label: "Assortimentslijst" },
  { key: "rmu", label: "RMU configuraties" },
  { key: "ms_mof", label: "MS mof types" },
  { key: "ls_mof", label: "LS mof types" },
  { key: "standaard", label: "Standaard materialen" },
  { key: "vast", label: "Vaste artikelen per subtype" },
  { key: "trafo_regels", label: "Trafo regels" },
  { key: "lsrek_regels", label: "LS-rek regels" },
  { key: "prov_regels", label: "Provisorium regels" },
  { key: "ms_kabel_regels", label: "MS kabel regels" },
  { key: "rmu_veld_regels", label: "RMU veld regels" },
  { key: "ggi", label: "GGI artikelen" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function BeheerPage() {
  const [tab, setTab] = useState<TabKey>("artikelen");

  return (
    <div className="px-8 py-6 max-w-7xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Beheer</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Stamdata beheren voor de configurator.</p>
      </div>
      <div className="flex gap-1 mb-4 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2 text-sm border-b-2 -mb-px transition-colors whitespace-nowrap",
              tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "artikelen" && <ArtikelenTab />}
      {tab === "assortiment" && <AssortimentTab />}
      {tab === "rmu" && <RmuTab />}
      {tab === "ms_mof" && <MsMofTab />}
      {tab === "ls_mof" && <LsMofTab />}
      {tab === "standaard" && <StandaardMaterialenTab />}
      {tab === "vast" && <VasteArtikelenTab />}
      {tab === "trafo_regels" && <TrafoRegelsTab />}
      {tab === "lsrek_regels" && <LsRekRegelsTab />}
      {tab === "prov_regels" && <ProvRegelsTab />}
      {tab === "ms_kabel_regels" && <MsKabelRegelsTab />}
      {tab === "rmu_veld_regels" && <RmuVeldRegelsTab />}
      {tab === "ggi" && <GgiRegelsTab />}
      
    </div>
  );
}
