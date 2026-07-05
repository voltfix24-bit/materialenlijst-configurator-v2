import { useEffect, useMemo, useRef, useState } from "react";
import {
  type PreviewItem,
  type PreviewSectie,
  type ToegevoegdArtikel,
  type WinkelwagenAanpassingen,
} from "@/lib/configurator/types";

interface UseWinkelwagenAanpassingenArgs {
  caseId: string;
  items: PreviewItem[];
  initieleAanpassingen?: WinkelwagenAanpassingen | null;
  onItemsChange: (effectief: PreviewItem[]) => void;
  onAanpassingenChange?: (aanpassingen: WinkelwagenAanpassingen) => void;
}

export function useWinkelwagenAanpassingen({
  caseId,
  items,
  initieleAanpassingen,
  onItemsChange,
  onAanpassingenChange,
}: UseWinkelwagenAanpassingenArgs) {
  const initieleAanpassingenRef = useRef(initieleAanpassingen);
  initieleAanpassingenRef.current = initieleAanpassingen;
  const eersteAanpassingenRunRef = useRef(true);

  const [overrides, setOverrides] = useState<Map<string, number>>(
    () => new Map(Object.entries(initieleAanpassingen?.overrides ?? {})),
  );
  const [verwijderd, setVerwijderd] = useState<Set<string>>(
    () => new Set(initieleAanpassingen?.verwijderd ?? []),
  );
  const [toegevoegd, setToegevoegd] = useState<ToegevoegdArtikel[]>(
    () => initieleAanpassingen?.toegevoegd ?? [],
  );

  const eersteResetRef = useRef(true);
  useEffect(() => {
    if (eersteResetRef.current) {
      eersteResetRef.current = false;
      return;
    }
    const init = initieleAanpassingenRef.current;
    eersteAanpassingenRunRef.current = true;
    setOverrides(new Map(Object.entries(init?.overrides ?? {})));
    setVerwijderd(new Set(init?.verwijderd ?? []));
    setToegevoegd(init?.toegevoegd ?? []);
  }, [caseId]);

  const effectief = useMemo<PreviewItem[]>(() => {
    const base = items
      .filter((it) => !verwijderd.has(it.artikel_nummer))
      .map((it) => {
        const ov = overrides.get(it.artikel_nummer);
        return ov !== undefined ? { ...it, hoeveelheid: ov } : it;
      });
    const extra: PreviewItem[] = toegevoegd.map((t) => ({
      artikel_id: t.artikel_id,
      artikel_nummer: t.artikel_nummer,
      korte_omschrijving: t.korte_omschrijving,
      eenheid: t.eenheid,
      categorie: "",
      hoeveelheid: t.hoeveelheid,
      niet_bestellen: false,
      herkomst: ["Handmatig toegevoegd"],
      sectie: "standaard" as PreviewSectie,
      bijdragen: [
        { herkomst: "Handmatig toegevoegd", sectie: "standaard", hoeveelheid: t.hoeveelheid },
      ],
    }));
    return [...base, ...extra];
  }, [items, overrides, verwijderd, toegevoegd]);

  const onItemsChangeRef = useRef(onItemsChange);
  onItemsChangeRef.current = onItemsChange;
  useEffect(() => {
    onItemsChangeRef.current(effectief);
  }, [effectief]);

  const onAanpassingenChangeRef = useRef(onAanpassingenChange);
  onAanpassingenChangeRef.current = onAanpassingenChange;
  useEffect(() => {
    if (eersteAanpassingenRunRef.current) {
      eersteAanpassingenRunRef.current = false;
      return;
    }
    onAanpassingenChangeRef.current?.({
      overrides: Object.fromEntries(overrides),
      verwijderd: [...verwijderd],
      toegevoegd,
    });
  }, [overrides, verwijderd, toegevoegd]);

  return {
    effectief,
    overrides,
    setOverrides,
    verwijderd,
    setVerwijderd,
    toegevoegd,
    setToegevoegd,
  };
}
