import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { PreviewItem, ToegevoegdArtikel } from "@/lib/configurator/types";
import type { ArtikelStam } from "@/lib/configurator/artikelTypes";
import { useSlaCorrectieOp } from "@/lib/leersysteem/hooks";
import { bouwCorrectieContext } from "@/lib/leersysteem/context";
import {
  bouwContextKey,
  type CorrectieDialoogData,
  type CorrectieScope,
} from "@/lib/leersysteem/types";

export function bepaalBron(it: PreviewItem): {
  tabel: string | null;
  id: string | null;
  herkomst: string | null;
  meerdere: boolean;
} {
  const aantal = it.bijdragen?.length ?? 0;
  if (aantal !== 1) {
    return { tabel: null, id: null, herkomst: null, meerdere: aantal > 1 };
  }
  const b = it.bijdragen[0];
  return {
    tabel: b.bronTabel ?? null,
    id: b.bronId ?? null,
    herkomst: b.herkomst ?? null,
    meerdere: false,
  };
}

interface UseWinkelwagenCorrectiesArgs {
  caseId: string;
  caseType: string;
  subType: string;
  configSnapshot?: Record<string, unknown> | null;
  items: PreviewItem[];
  toegevoegd: ToegevoegdArtikel[];
  overrides: Map<string, number>;
  setOverrides: Dispatch<SetStateAction<Map<string, number>>>;
  setVerwijderd: Dispatch<SetStateAction<Set<string>>>;
  setToegevoegd: Dispatch<SetStateAction<ToegevoegdArtikel[]>>;
}

export function useWinkelwagenCorrecties({
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
}: UseWinkelwagenCorrectiesArgs) {
  const [dialoogData, setDialoogData] = useState<CorrectieDialoogData | null>(null);
  const [pendingRevert, setPendingRevert] = useState<(() => void) | null>(null);
  const slaCorrectieOp = useSlaCorrectieOp();

  const eersteCaseResetRef = useRef(true);
  useEffect(() => {
    if (eersteCaseResetRef.current) {
      eersteCaseResetRef.current = false;
      return;
    }
    setDialoogData(null);
    setPendingRevert(null);
  }, [caseId]);

  const openDialoog = (data: CorrectieDialoogData, revert: () => void) => {
    setDialoogData(data);
    setPendingRevert(() => revert);
  };

  const bevestigDialoog = (reden: string, scope: CorrectieScope) => {
    if (!dialoogData) return;
    const sectie = dialoogData.sectie ?? null;
    const bronTabel = dialoogData.bron_tabel ?? null;
    const bronId = dialoogData.bron_id ?? null;
    const meerdere = dialoogData.meerdere_bronnen ?? false;
    const bijdragen = Array.isArray(dialoogData.bijdragen)
      ? (dialoogData.bijdragen as unknown[])
      : null;
    const configContext = bouwCorrectieContext({
      caseType,
      subType,
      actie: dialoogData.actie,
      artikelNummer: dialoogData.artikel_nummer,
      sectie,
      bronTabel: bronTabel,
      bronId: bronId,
      bronHerkomst: dialoogData.bron_herkomst ?? null,
      meerdereBronnen: meerdere,
      bijdragen,
      configSnapshot: configSnapshot ?? null,
      oudeHoeveelheid: dialoogData.oude_hoeveelheid,
      nieuweHoeveelheid: dialoogData.nieuwe_hoeveelheid,
    });
    const contextKey = bouwContextKey({
      case_type: caseType,
      sub_type: subType,
      sectie,
      bron_tabel: bronTabel,
      bron_id: bronId,
      actie: dialoogData.actie,
      artikel_nummer: dialoogData.artikel_nummer,
      sectie_key: configContext.sectie_key,
      vraag_key: configContext.vraag_key,
      gekozen_antwoord: configContext.gekozen_antwoord,
    });

    slaCorrectieOp.mutate({
      case_id: caseId,
      case_type: caseType,
      sub_type: subType,
      artikel_nummer: dialoogData.artikel_nummer,
      korte_omschrijving: dialoogData.korte_omschrijving,
      actie: dialoogData.actie,
      oude_hoeveelheid: dialoogData.oude_hoeveelheid,
      nieuwe_hoeveelheid: dialoogData.nieuwe_hoeveelheid,
      reden,
      scope,
      bron_tabel: bronTabel,
      bron_id: bronId,
      bron_herkomst: dialoogData.bron_herkomst ?? null,
      meerdere_bronnen: meerdere,
      bijdragen,
      sectie,
      config_context: configContext,
      context_key: contextKey,
    });

    setDialoogData(null);
    setPendingRevert(null);
  };

  const annuleerDialoog = () => {
    pendingRevert?.();
    setDialoogData(null);
    setPendingRevert(null);
  };

  const wijzigHoeveelheid = (it: PreviewItem, nieuw: number) => {
    const oudOriginal =
      items.find((x) => x.artikel_nummer === it.artikel_nummer)?.hoeveelheid ?? it.hoeveelheid;
    const huidig = overrides.get(it.artikel_nummer) ?? oudOriginal;
    if (nieuw === huidig) return;
    setOverrides((prev) => {
      const m = new Map(prev);
      m.set(it.artikel_nummer, nieuw);
      return m;
    });
    const bron = bepaalBron(it);
    openDialoog(
      {
        artikel_nummer: it.artikel_nummer,
        korte_omschrijving: it.korte_omschrijving,
        actie: "hoeveelheid_gewijzigd",
        oude_hoeveelheid: oudOriginal,
        nieuwe_hoeveelheid: nieuw,
        bron_tabel: bron.tabel,
        bron_id: bron.id,
        bron_herkomst: bron.herkomst,
        meerdere_bronnen: bron.meerdere,
        bijdragen: it.bijdragen,
        sectie: it.sectie ?? null,
      },
      () => {
        setOverrides((prev) => {
          const m = new Map(prev);
          m.delete(it.artikel_nummer);
          return m;
        });
      },
    );
  };

  const verwijderItem = (it: PreviewItem) => {
    const isHandmatig = toegevoegd.some((t) => t.artikel_nummer === it.artikel_nummer);
    if (isHandmatig) {
      const snapshot = toegevoegd.find((t) => t.artikel_nummer === it.artikel_nummer)!;
      setToegevoegd((prev) => prev.filter((t) => t.artikel_nummer !== it.artikel_nummer));
      openDialoog(
        {
          artikel_nummer: it.artikel_nummer,
          korte_omschrijving: it.korte_omschrijving,
          actie: "verwijderd",
          oude_hoeveelheid: it.hoeveelheid,
          nieuwe_hoeveelheid: null,
          bron_tabel: null,
          bron_id: null,
          bron_herkomst: "Handmatig toegevoegd",
          meerdere_bronnen: false,
          bijdragen: it.bijdragen,
          sectie: it.sectie ?? null,
        },
        () => {
          setToegevoegd((prev) =>
            prev.some((t) => t.artikel_nummer === snapshot.artikel_nummer)
              ? prev
              : [...prev, snapshot],
          );
        },
      );
      return;
    }
    setVerwijderd((prev) => new Set([...prev, it.artikel_nummer]));
    const bron = bepaalBron(it);
    openDialoog(
      {
        artikel_nummer: it.artikel_nummer,
        korte_omschrijving: it.korte_omschrijving,
        actie: "verwijderd",
        oude_hoeveelheid: it.hoeveelheid,
        nieuwe_hoeveelheid: null,
        bron_tabel: bron.tabel,
        bron_id: bron.id,
        bron_herkomst: bron.herkomst,
        meerdere_bronnen: bron.meerdere,
        bijdragen: it.bijdragen,
        sectie: it.sectie ?? null,
      },
      () => {
        setVerwijderd((prev) => {
          const s = new Set(prev);
          s.delete(it.artikel_nummer);
          return s;
        });
      },
    );
  };

  const voegHandmatigToe = (stam: ArtikelStam, qty: number) => {
    if (!stam.id || qty <= 0) return;
    const nieuw: ToegevoegdArtikel = {
      artikel_id: stam.id,
      artikel_nummer: stam.artikel_nummer,
      korte_omschrijving: stam.korte_omschrijving,
      eenheid: stam.eenheid || "st",
      hoeveelheid: qty,
    };
    setToegevoegd((prev) => [
      ...prev.filter((t) => t.artikel_nummer !== nieuw.artikel_nummer),
      nieuw,
    ]);
    openDialoog(
      {
        artikel_nummer: nieuw.artikel_nummer,
        korte_omschrijving: nieuw.korte_omschrijving,
        actie: "toegevoegd",
        oude_hoeveelheid: null,
        nieuwe_hoeveelheid: nieuw.hoeveelheid,
      },
      () => {
        setToegevoegd((prev) => prev.filter((t) => t.artikel_nummer !== nieuw.artikel_nummer));
      },
    );
  };

  return {
    dialoogData,
    bevestigDialoog,
    annuleerDialoog,
    wijzigHoeveelheid,
    verwijderItem,
    voegHandmatigToe,
  };
}
