import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BookOpen, ChevronDown, ExternalLink, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  HOOFDSTUK_LABELS,
  VASTE_HOOFDSTUKKEN,
  vasteVragenVoorHoofdstuk,
  type BronDef,
  type VasteVraagDef,
  type VastHoofdstuk,
} from "@/lib/beheer/vragenRegister";
import { VraagKaart, type VraagRij } from "./EigenVragenTab";
import { ConfirmDelete } from "./shared";

/**
 * "Per hoofdstuk": hét overzicht van alles wat de configurator vraagt,
 * georganiseerd zoals de engineer het ziet — per hoofdstuk. Per vraag zijn de
 * gekoppelde artikelen/regels direct zichtbaar (uit het vragenregister voor
 * vaste vragen; inline bewerkbaar voor eigen vragen).
 */

interface HoofdstukRij {
  id: string;
  naam: string;
  actief: boolean;
}

type Keuze = VastHoofdstuk | `hoofdstuk:${string}` | "__eigen__";

export function VragenRegelsTab() {
  const [keuze, setKeuze] = useState<Keuze>("ms");

  const { data: hoofdstukken = [] } = useQuery({
    queryKey: ["beheer-eigen-hoofdstukken"],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maatwerk_hoofdstukken")
        .select("*")
        .eq("actief", true)
        .order("sort_order");
      if (error) return [];
      return data as HoofdstukRij[];
    },
  });

  const { data: eigenVragen = [] } = useQuery({
    queryKey: ["beheer-eigen-vragen"],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maatwerk_vragen")
        .select("*")
        .order("sort_order");
      if (error) return [];
      return data as VraagRij[];
    },
  });

  const isVast = (k: Keuze): k is VastHoofdstuk => (VASTE_HOOFDSTUKKEN as string[]).includes(k);

  const eigenVoorKeuze = eigenVragen.filter((v) => {
    if (isVast(keuze)) return v.sectie_key === keuze;
    if (keuze === "__eigen__")
      return (
        !v.sectie_key && (!v.hoofdstuk_id || !hoofdstukken.some((h) => h.id === v.hoofdstuk_id))
      );
    return v.hoofdstuk_id === keuze.slice(10);
  });
  const vasteVragen = isVast(keuze) ? vasteVragenVoorHoofdstuk(keuze) : [];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
        <BookOpen className="h-4 w-4 mt-0.5 text-primary shrink-0" />
        <div className="text-sm space-y-1">
          <p className="font-medium">Alle vragen per hoofdstuk — zoals de configurator ze stelt</p>
          <p className="text-muted-foreground text-xs">
            Kies een hoofdstuk en zie per vraag welke artikelen en regels eraan gekoppeld zijn.
            Vaste vragen klap je uit voor de volledige koppeling met bewerk-links; eigen vragen
            beheer je hier direct.
          </p>
        </div>
      </div>

      {/* Hoofdstuk-kiezer */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {VASTE_HOOFDSTUKKEN.map((h) => (
          <HoofdstukPill
            key={h}
            actief={keuze === h}
            onClick={() => setKeuze(h)}
            label={HOOFDSTUK_LABELS[h]}
          />
        ))}
        {hoofdstukken.map((h) => (
          <HoofdstukPill
            key={h.id}
            actief={keuze === `hoofdstuk:${h.id}`}
            onClick={() => setKeuze(`hoofdstuk:${h.id}`)}
            label={h.naam}
            eigen
          />
        ))}
        <HoofdstukPill
          actief={keuze === "__eigen__"}
          onClick={() => setKeuze("__eigen__")}
          label="Eigen vragen"
          eigen
        />
      </div>

      {/* Vaste vragen */}
      {vasteVragen.map((v) => (
        <VasteVraagKaart key={v.key} vraag={v} />
      ))}

      {/* Eigen vragen in dit hoofdstuk */}
      <EigenVragenBlok vragen={eigenVoorKeuze} />
    </div>
  );
}

function HoofdstukPill({
  actief,
  onClick,
  label,
  eigen,
}: {
  actief: boolean;
  onClick: () => void;
  label: string;
  eigen?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1.5 text-xs transition-colors",
        actief
          ? "border-primary bg-primary/10 text-foreground font-medium"
          : "border-border bg-surface text-muted-foreground hover:bg-accent/40",
        eigen && !actief && "border-dashed",
      )}
    >
      {eigen && (
        <span className="mr-1 inline-block w-1.5 h-1.5 rounded-full bg-[#B0578D] align-middle" />
      )}
      {label}
    </button>
  );
}

/** Vaste vraag met lazy geladen gekoppelde regels per bron. */
function VasteVraagKaart({ vraag }: { vraag: VasteVraagDef }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/20 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{vraag.label}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wider">
              vaste vraag
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Antwoorden: {vraag.antwoorden}
            {vraag.uitleg ? ` · ${vraag.uitleg}` : ""}
          </p>
        </div>
        <span className="text-[11px] text-muted-foreground shrink-0">
          {vraag.bronnen.length} koppeling{vraag.bronnen.length === 1 ? "" : "en"}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {vraag.bronnen.map((b) => (
            <BronBlok key={b.key} bron={b} />
          ))}
        </div>
      )}
    </div>
  );
}

const MAX_RIJEN = 12;

/** Gekoppelde regels uit één brontabel, geladen zodra de vraag open staat. */
function BronBlok({ bron }: { bron: BronDef }) {
  const [alles, setAlles] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["vraagbron", bron.tabel, bron.key],
    retry: false,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as never as any).from(bron.tabel).select(bron.select);
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data ?? []) as any[]).flatMap(bron.map);
    },
  });

  const rijen = data ?? [];
  const zichtbaar = alles ? rijen : rijen.slice(0, MAX_RIJEN);

  return (
    <div className="rounded-md border border-border bg-surface-2">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/60">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {bron.label}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {isLoading ? "laden…" : `${rijen.length} regel${rijen.length === 1 ? "" : "s"}`}
        </span>
        <Link
          to="/beheer"
          search={{ groep: bron.beheerGroep, tab: bron.beheerTab }}
          className="ml-auto text-[11px] text-primary hover:underline inline-flex items-center gap-1"
        >
          Bewerken <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      {isLoading && (
        <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Regels ophalen…
        </div>
      )}
      {error != null && (
        <div className="px-3 py-2 text-xs text-amber-700">
          Kon deze tabel niet lezen — mogelijk is een migratie nog niet uitgevoerd.
        </div>
      )}
      {!isLoading && rijen.length === 0 && !error && (
        <div className="px-3 py-2 text-xs text-muted-foreground">Nog geen regels.</div>
      )}
      {zichtbaar.length > 0 && (
        <ul className="divide-y divide-border/60">
          {zichtbaar.map((r, i) => (
            <li
              key={`${r.rijId}-${i}`}
              className={cn(
                "px-3 py-1.5 text-xs flex items-baseline gap-2",
                !r.actief && "opacity-50",
              )}
            >
              <span className="flex-1 min-w-0 text-muted-foreground truncate" title={r.conditie}>
                {r.conditie}
              </span>
              {r.artikelNummer ? (
                <Link
                  to="/beheer"
                  search={{
                    groep: bron.beheerGroep,
                    tab: bron.beheerTab,
                    row: r.rijId,
                    artikel: r.artikelNummer,
                  }}
                  className="font-mono text-primary hover:underline shrink-0"
                  title={r.omschrijving ?? undefined}
                >
                  {r.artikelNummer}
                </Link>
              ) : (
                <span className="text-muted-foreground shrink-0">{r.omschrijving ?? "—"}</span>
              )}
              <span
                className="font-semibold tabular-nums shrink-0 w-24 text-right truncate"
                title={r.hoeveelheid}
              >
                {r.hoeveelheid}
              </span>
            </li>
          ))}
        </ul>
      )}
      {rijen.length > MAX_RIJEN && (
        <button
          type="button"
          onClick={() => setAlles((a) => !a)}
          className="w-full px-3 py-1.5 text-[11px] text-primary hover:underline text-left"
        >
          {alles ? "Minder tonen" : `Alle ${rijen.length} regels tonen`}
        </button>
      )}
    </div>
  );
}

/** Eigen vragen binnen het gekozen hoofdstuk — direct hier te beheren. */
function EigenVragenBlok({ vragen }: { vragen: VraagRij[] }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [openVraag, setOpenVraag] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<VraagRij | null>(null);

  const invalideer = () => {
    qc.invalidateQueries({ queryKey: ["beheer-eigen-vragen"] });
    qc.invalidateQueries({ queryKey: ["maatwerk_vragen"] });
  };

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("maatwerk_vragen").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalideer();
      toast.success("Vraag verwijderd");
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between pt-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Eigen vragen in dit hoofdstuk
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            navigate({ to: "/beheer", search: { groep: "vragen", tab: "eigen_vragen" } })
          }
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Vraag toevoegen
        </Button>
      </div>
      {vragen.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Geen eigen vragen in dit hoofdstuk. Via "Vraag toevoegen" maak je er één en kies je dit
          hoofdstuk bij "Plaats in".
        </p>
      )}
      {vragen.map((v) => (
        <VraagKaart
          key={v.id}
          vraag={v}
          plaatsingLabel="dit hoofdstuk"
          isOpen={openVraag === v.id}
          onToggle={() => setOpenVraag(openVraag === v.id ? null : v.id)}
          onEdit={() =>
            navigate({ to: "/beheer", search: { groep: "vragen", tab: "eigen_vragen", row: v.id } })
          }
          onDelete={() => setToDelete(v)}
          onInvalideer={invalideer}
        />
      ))}
      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
        title="Vraag verwijderen?"
        description="De vraag én alle gekoppelde artikel-regels worden verwijderd."
      />
    </div>
  );
}
