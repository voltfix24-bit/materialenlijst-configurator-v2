import { Plus } from "lucide-react";
import { Field, InfoBox } from "@/components/ui-prim/Field";
import { PillGroup } from "@/components/ui-prim/PillGroup";
import { Stepper } from "@/components/ui-prim/Stepper";
import { useStamdata } from "@/lib/configurator/queries";
import {
  buildRmuVelden,
  newLsMof,
  type LsMof,
  type MaterialenConfig,
  type RmuVeldConfig,
} from "@/lib/configurator/types";
import type { UpdateFn } from "./shared";
import { veldBadge, veldLabel } from "./veldHelpers";
import { LsMofKaart } from "./LsMofKaart";

export function ProvisoriumSection({
  config,
  update,
  sd,
}: {
  config: MaterialenConfig;
  update: UpdateFn;
  sd: ReturnType<typeof useStamdata>;
}) {
  const filtered = (sd.rmuConfigs.data ?? []).filter(
    (c) => c.merk === config.provRmuMerk && c.is_inet === false,
  );
  const setVeld = (id: string, patch: Partial<RmuVeldConfig>) => {
    update({
      provRmuVelden: config.provRmuVelden.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    });
  };
  const setMof = (id: string, patch: Partial<LsMof>) =>
    update({
      provLsMoffen: config.provLsMoffen.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    });
  const removeMof = (id: string) =>
    update({ provLsMoffen: config.provLsMoffen.filter((m) => m.id !== id) });
  const addMof = () => update({ provLsMoffen: [...config.provLsMoffen, newLsMof()] });

  return (
    <div className="space-y-4">
      <InfoBox type="info">
        De provisorium zorgt voor spanning tijdens de renovatie. Vul hieronder de RMU en zekeringen
        van de provisorium in. RMU, frame en bodemplaat worden niet besteld.
      </InfoBox>

      <Field label="Provisorium RMU merk">
        <PillGroup
          value={config.provRmuMerk}
          onChange={(v) =>
            update({
              provRmuMerk: v as MaterialenConfig["provRmuMerk"],
              provRmuConfig: null,
              provRmuVelden: [],
            })
          }
          options={[
            { value: "ABB", label: "ABB" },
            { value: "Siemens", label: "Siemens" },
            { value: "Magnefix", label: "Magnefix" },
          ]}
        />
      </Field>

      {config.provRmuMerk && (
        <Field label="Provisorium RMU configuratie">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground">Geen configuraties gevonden.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {filtered.map((c) => {
                const active = config.provRmuConfig?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    data-active={active}
                    onClick={() => update({ provRmuConfig: c, provRmuVelden: buildRmuVelden(c) })}
                    className="border border-border bg-surface rounded-md px-3 py-1.5 text-sm hover:bg-accent data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:border-primary"
                  >
                    {c.code}
                  </button>
                );
              })}
            </div>
          )}
        </Field>
      )}

      {config.provRmuConfig && (
        <InfoBox type="info">
          <span className="font-mono text-xs">
            {config.provRmuConfig.aantal_velden} velden · {config.provRmuConfig.aantal_f}F /{" "}
            {config.provRmuConfig.aantal_c}C / {config.provRmuConfig.aantal_v}V
          </span>
        </InfoBox>
      )}

      {config.provRmuConfig && config.provRmuVelden.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Provisorium veldinstellingen
          </div>
          {config.provRmuVelden.map((veld) => (
            <ProvVeldKaart key={veld.id} veld={veld} merk={config.provRmuMerk} setVeld={setVeld} />
          ))}
        </div>
      )}

      <Field label="Provisorium trafo vermogen (kVA)">
        <PillGroup
          value={config.provZekeringKva}
          onChange={(v) => update({ provZekeringKva: v as MaterialenConfig["provZekeringKva"] })}
          options={[
            { value: "250", label: "250 kVA" },
            { value: "400", label: "400 kVA" },
            { value: "630", label: "630 kVA" },
            { value: "1000", label: "1000 kVA" },
          ]}
        />
      </Field>

      <Field label="LS-moffen op provisorium?">
        <PillGroup
          value={config.provLsMoffenActief ? "ja" : "nee"}
          onChange={(v) =>
            update({
              provLsMoffenActief: v === "ja",
              provLsMoffen: v === "ja" ? config.provLsMoffen : [],
            })
          }
          options={[
            { value: "ja", label: "Ja", color: "green" },
            { value: "nee", label: "Nee", color: "amber" },
          ]}
        />
      </Field>

      {config.provLsMoffenActief && (
        <div className="space-y-3">
          {config.provLsMoffen.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nog geen provisorium LS-moffen toegevoegd.
            </p>
          )}
          {config.provLsMoffen.map((m, idx) => (
            <LsMofKaart
              key={m.id}
              mof={m}
              index={idx}
              isProv={false}
              onChange={(patch) => setMof(m.id, patch)}
              onRemove={() => removeMof(m.id)}
            />
          ))}
          <button
            onClick={addMof}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Plus className="w-4 h-4" /> Provisorium LS-mof toevoegen
          </button>
        </div>
      )}

      <div className="border-t border-border pt-4 space-y-4">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          In-bedrijfname
        </div>

        <Field label="Hoeveel MS kabels aansluiten?">
          <Stepper
            value={config.provInbMsKabels ?? 0}
            onChange={(v) => update({ provInbMsKabels: v })}
            min={0}
            max={10}
            disabled={!config.provRmuConfig}
          />
          {!config.provRmuConfig && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Kies eerst een provisorium RMU configuratie
            </p>
          )}
        </Field>

        {(config.provInbMsKabels ?? 0) > 0 && config.provRmuMerk && (
          <InfoBox type="info">
            {config.provRmuMerk === "Magnefix"
              ? `${config.provInbMsKabels}× Eindsl XLPE 20kV (20039648) · ${config.provInbMsKabels}× Afschermset (20018032) · 1× Doos onderdelen (20029905)`
              : `${config.provInbMsKabels}× Steker XLPE 20kV 3x1x240 (20040681)`}
          </InfoBox>
        )}

        <Field label="Hoeveel LS kabels aansluiten?">
          <Stepper
            value={config.provInbLsKabels ?? 0}
            onChange={(v) => update({ provInbLsKabels: v })}
            min={0}
            max={24}
            disabled={!config.provRmuConfig}
          />
          {!config.provRmuConfig && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Kies eerst een provisorium RMU configuratie
            </p>
          )}
        </Field>

        {(config.provInbLsKabels ?? 0) > 0 && (
          <InfoBox type="info">
            {`${config.provInbLsKabels}× Kabelinlegklem M10 (20018004) · ${config.provInbLsKabels}× K56 S klem (20042042)`}
          </InfoBox>
        )}
      </div>
    </div>
  );
}

function ProvVeldKaart({
  veld,
  merk,
  setVeld,
}: {
  veld: RmuVeldConfig;
  merk: string;
  setVeld: (id: string, patch: Partial<RmuVeldConfig>) => void;
}) {
  const badge = veldBadge(merk, veld.veldType);
  const label = veldLabel(merk, veld.veldType, veld.veldNummer);
  const isMagnefix = merk === "Magnefix";

  if (veld.veldType === "F") {
    return (
      <div className="rounded-md border border-border bg-background/40 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="rounded bg-secondary text-secondary-foreground text-xs font-mono px-1.5 py-0.5">
            {badge}
          </span>
          <span className="text-sm font-medium">{label}</span>
        </div>
        <InfoBox type="info">
          Provisorium eindsluiting + buispatroon (3×) worden automatisch toegevoegd op basis van het
          provisorium kVA.
        </InfoBox>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-background/40 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="rounded bg-secondary text-secondary-foreground text-xs font-mono px-1.5 py-0.5">
          {badge}
        </span>
        <span className="text-sm font-medium">{label}</span>
        <span className="text-[10px] text-muted-foreground ml-auto">altijd aangesloten</span>
      </div>
      {!isMagnefix && (
        <Field label="Kabeltype">
          <PillGroup
            value={veld.kabelType}
            onChange={(v) => setVeld(veld.id, { kabelType: v as RmuVeldConfig["kabelType"] })}
            options={[
              { value: "240AL", label: "3x1x240AL singels" },
              { value: "630AL", label: "3x1x630AL singels" },
            ]}
          />
        </Field>
      )}
      {isMagnefix && (
        <InfoBox type="info">
          K-veld eindsluiting + afschermset worden automatisch toegevoegd
        </InfoBox>
      )}
    </div>
  );
}
