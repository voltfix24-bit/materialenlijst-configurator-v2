import { Field, InfoBox } from "@/components/ui-prim/Field";
import { PillGroup } from "@/components/ui-prim/PillGroup";
import { Stepper } from "@/components/ui-prim/Stepper";
import { useStamdata } from "@/lib/configurator/queries";
import { useInetDefaultArtikelen } from "@/lib/configurator/extraStamdata";
import {
  buildRmuVelden,
  type MaterialenConfig,
  type RmuVeldConfig,
} from "@/lib/configurator/types";
import type { UpdateFn } from "./shared";
import { veldBadge, veldLabel } from "./veldHelpers";
import { LsRichtingBeveiliging } from "./LsRichtingBeveiliging";

export function RmuSection({
  config,
  update,
  sd,
  isCompact,
}: {
  config: MaterialenConfig;
  update: UpdateFn;
  sd: ReturnType<typeof useStamdata>;
  isCompact: boolean;
}) {
  const inetDefaults = useInetDefaultArtikelen();
  const merken = isCompact ? ["ABB", "Siemens"] : ["ABB", "Siemens", "Magnefix"];
  // Bij compact: i-Net altijd "nee"
  const effectiveInet = isCompact ? "nee" : config.rmuInet;
  const isInet = effectiveInet === "ja";
  const filteredConfigs = (sd.rmuConfigs.data ?? []).filter(
    (c) =>
      c.merk === config.rmuMerk && (config.rmuMerk === "Magnefix" ? true : c.is_inet === isInet),
  );

  const pickConfig = (c: (typeof filteredConfigs)[number]) => {
    update({
      rmuConfig: c,
      rmuVelden: buildRmuVelden(c),
      iNetArtikelen:
        c.is_inet && config.iNetArtikelen.length === 0
          ? inetDefaults.map((x) => ({ ...x }))
          : config.iNetArtikelen,
    });
  };

  const setVeld = (id: string, patch: Partial<RmuVeldConfig>) => {
    update({ rmuVelden: config.rmuVelden.map((v) => (v.id === id ? { ...v, ...patch } : v)) });
  };

  const showVeldKaartjes = !!config.rmuConfig && config.rmuVelden.length > 0;
  const isMagnefix = config.rmuMerk === "Magnefix";
  const showConfigPicker = !!config.rmuMerk && (isCompact || isMagnefix || !!config.rmuInet);

  return (
    <div className="space-y-4">
      {isCompact && (
        <InfoBox type="info">
          RMU is aanwezig — wordt niet besteld. Keuze bepaalt buispatronen en eindsluitingen.
        </InfoBox>
      )}
      <Field label="Merk">
        <PillGroup
          value={config.rmuMerk}
          onChange={(v) =>
            update({
              rmuMerk: v as MaterialenConfig["rmuMerk"],
              rmuConfig: null,
              rmuVelden: [],
              rmuInet: isCompact ? "nee" : v === "Magnefix" ? "" : config.rmuInet,
            })
          }
          options={merken.map((m) => ({ value: m, label: m }))}
        />
      </Field>
      {!isCompact && config.rmuMerk && config.rmuMerk !== "Magnefix" && (
        <Field label="I-Net">
          <PillGroup
            value={config.rmuInet}
            onChange={(v) => {
              const next = v as "ja" | "nee";
              update({
                rmuInet: next,
                rmuConfig: null,
                rmuVelden: [],
                iNetArtikelen:
                  next === "ja" && config.iNetArtikelen.length === 0
                    ? inetDefaults.map((x) => ({ ...x }))
                    : config.iNetArtikelen,
              });
            }}
            options={[
              { value: "nee", label: "Nee" },
              { value: "ja", label: "Ja (DA)" },
            ]}
          />
        </Field>
      )}
      {showConfigPicker && (
        <Field label="Configuratie">
          {filteredConfigs.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Geen configuraties gevonden voor deze combinatie.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {filteredConfigs.map((c) => {
                const active = config.rmuConfig?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    data-active={active}
                    onClick={() => pickConfig(c)}
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
      {config.rmuConfig && (
        <InfoBox type="info">
          <span className="font-mono text-xs">
            {config.rmuConfig.aantal_velden} velden · {config.rmuConfig.aantal_f}F /{" "}
            {config.rmuConfig.aantal_c}C / {config.rmuConfig.aantal_v}V
          </span>
        </InfoBox>
      )}

      {isCompact && config.rmuConfig && (
        <>
          <Field label="Trafo vermogen (kVA) — bepaalt buispatronen en LS-rek beveiliging">
            <PillGroup
              value={config.trafoKva}
              onChange={(v) => update({ trafoKva: v as MaterialenConfig["trafoKva"] })}
              options={[
                { value: "250", label: "250 kVA" },
                { value: "400", label: "400 kVA" },
                { value: "630", label: "630 kVA" },
                { value: "1000", label: "1000 kVA" },
              ]}
            />
          </Field>
          {config.trafoKva && (
            <InfoBox type="info">
              LS-rek beveiliging: mespatroon {config.trafoKva} kVA wordt automatisch toegevoegd (3×)
            </InfoBox>
          )}
          <Field label="Aantal aan te sluiten LS-kabels">
            <Stepper
              value={config.lsRekAanSluitenKabels}
              onChange={(v) => update({ lsRekAanSluitenKabels: v })}
              min={0}
              max={99}
            />
          </Field>
          {config.lsRekAanSluitenKabels > 0 && (
            <InfoBox type="info">
              K56 U bevestigingsklem ({config.lsRekAanSluitenKabels * 2}×) + kabelinlegklem (
              {config.lsRekAanSluitenKabels}×)
            </InfoBox>
          )}
          <LsRichtingBeveiliging config={config} update={update} />
        </>
      )}

      {showVeldKaartjes && (
        <div className="space-y-3 pt-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Veldinstellingen
          </div>
          {config.rmuVelden.map((veld) =>
            isMagnefix ? (
              <MagnefixVeldKaart key={veld.id} veld={veld} config={config} update={update} />
            ) : (
              <VeldKaart
                key={veld.id}
                veld={veld}
                setVeld={setVeld}
                config={config}
                update={update}
                isInet={isInet}
                merk={config.rmuMerk}
                isCompact={isCompact}
              />
            ),
          )}
        </div>
      )}

      {showVeldKaartjes && isInet && (
        <INetArtikelenSection config={config} update={update} sd={sd} />
      )}
    </div>
  );
}

function VeldKaart({
  veld,
  setVeld,
  config,
  update,
  isInet,
  merk,
  isCompact,
}: {
  veld: RmuVeldConfig;
  setVeld: (id: string, patch: Partial<RmuVeldConfig>) => void;
  config: MaterialenConfig;
  update: UpdateFn;
  isInet: boolean;
  merk: string;
  isCompact: boolean;
}) {
  const reserveLocked = (veld.veldType === "C" || veld.veldType === "V") && veld.veldNummer <= 2;
  const kabelOpties = [
    { value: "240AL", label: "3x1x240AL singels" },
    { value: "630AL", label: "3x1x630AL singels" },
  ];
  const badge = veldBadge(merk, veld.veldType);
  const label = veldLabel(merk, veld.veldType, veld.veldNummer);

  if (veld.veldType === "F") {
    return (
      <div className="rounded-md border border-border bg-background/40 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className="rounded bg-secondary text-secondary-foreground text-xs font-mono px-1.5 py-0.5">
            {badge}
          </span>
          <span className="text-sm font-medium">{label}</span>
        </div>
        {!isCompact && (
          <Field label="Trafo kabel lengte">
            <PillGroup
              value={config.trafoKabelLengte}
              onChange={(v) =>
                update({ trafoKabelLengte: v as MaterialenConfig["trafoKabelLengte"] })
              }
              options={[
                { value: "7.25", label: "7,25 m" },
                { value: "10", label: "10 m" },
              ]}
            />
          </Field>
        )}
        {config.trafoKva ? (
          <InfoBox type="info">
            Vermogen: {config.trafoKva} kVA — buispatroon wordt automatisch bepaald
          </InfoBox>
        ) : (
          <InfoBox type="warning">
            ⚠ Vul het trafo vermogen in {isCompact ? "hierboven" : "bij de Trafo-sectie"}
          </InfoBox>
        )}
      </div>
    );
  }

  // C of V
  const aangesloten = !veld.isReserve;
  return (
    <div className="rounded-md border border-border bg-background/40 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="rounded bg-secondary text-secondary-foreground text-xs font-mono px-1.5 py-0.5">
          {badge}
        </span>
        <span className="text-sm font-medium">{label}</span>
        {reserveLocked && (
          <span className="text-[10px] text-muted-foreground ml-auto">altijd aangesloten</span>
        )}
      </div>
      {!reserveLocked && (
        <Field label="Status">
          <PillGroup
            value={veld.isReserve ? "reserve" : "aan"}
            onChange={(v) =>
              setVeld(veld.id, {
                isReserve: v === "reserve",
                kabelType: v === "reserve" ? "" : veld.kabelType,
              })
            }
            options={[
              { value: "aan", label: "Aangesloten", color: "green" },
              { value: "reserve", label: "Reserve", color: "amber" },
            ]}
          />
        </Field>
      )}
      {aangesloten && (
        <Field label="Kabeltype">
          <PillGroup
            value={veld.kabelType}
            onChange={(v) => setVeld(veld.id, { kabelType: v as RmuVeldConfig["kabelType"] })}
            options={kabelOpties}
          />
        </Field>
      )}
      {aangesloten && veld.veldType === "V" && veld.kabelType === "630AL" && (
        <InfoBox type="info">
          {isInet
            ? "Ombouwset iMSR (20043486) wordt toegevoegd"
            : "Ombouwset W4 regMSR (20043756) wordt toegevoegd"}
        </InfoBox>
      )}
    </div>
  );
}

function MagnefixVeldKaart({
  veld,
  config,
  update,
}: {
  veld: RmuVeldConfig;
  config: MaterialenConfig;
  update: UpdateFn;
}) {
  if (veld.veldType === "F") {
    return (
      <div className="rounded-md border border-border bg-background/40 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className="rounded bg-secondary text-secondary-foreground text-xs font-mono px-1.5 py-0.5">
            T
          </span>
          <span className="text-sm font-medium">T-veld — Trafo richting</span>
        </div>
        <Field label="Trafo kabel lengte">
          <PillGroup
            value={config.trafoKabelLengte}
            onChange={(v) =>
              update({ trafoKabelLengte: v as MaterialenConfig["trafoKabelLengte"] })
            }
            options={[
              { value: "7.25", label: "7,25 m" },
              { value: "10", label: "10 m" },
            ]}
          />
        </Field>
        {config.trafoKva ? (
          <InfoBox type="info">
            Vermogen: {config.trafoKva} kVA — Magnefix buispatroon wordt automatisch bepaald
          </InfoBox>
        ) : (
          <InfoBox type="warning">⚠ Vul het trafo vermogen in bij de Trafo-sectie</InfoBox>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-background/40 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="rounded bg-secondary text-secondary-foreground text-xs font-mono px-1.5 py-0.5">
          K
        </span>
        <span className="text-sm font-medium">K-veld {veld.veldNummer} — Kabelrichting</span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          materialen automatisch bepaald
        </span>
      </div>
      <InfoBox type="info">Eindsluiting 240AL + afschermset worden automatisch toegevoegd</InfoBox>
    </div>
  );
}

function INetArtikelenSection({
  config,
  update,
  sd,
}: {
  config: MaterialenConfig;
  update: UpdateFn;
  sd: ReturnType<typeof useStamdata>;
}) {
  const setQty = (artikel_nummer: string, hoeveelheid: number) => {
    update({
      iNetArtikelen: config.iNetArtikelen.map((ia) =>
        ia.artikel_nummer === artikel_nummer ? { ...ia, hoeveelheid } : ia,
      ),
    });
  };
  const findArt = (nr: string) => (sd.artikelen.data ?? []).find((a) => a.artikel_nummer === nr);
  return (
    <div className="space-y-2 pt-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        I-Net vaste artikelen
      </div>
      <div className="rounded-md border border-border bg-background/40 p-3 space-y-2">
        {config.iNetArtikelen.map((ia) => {
          const art = findArt(ia.artikel_nummer);
          return (
            <div key={ia.artikel_nummer} className="flex items-center gap-2 text-sm">
              <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">
                {ia.artikel_nummer}
              </span>
              <span className="flex-1 truncate">{art?.korte_omschrijving ?? "—"}</span>
              <Stepper
                value={ia.hoeveelheid}
                onChange={(v) => setQty(ia.artikel_nummer, v)}
                min={0}
                max={50}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
