import { useEffect, useRef, useState } from "react";
import type { PreviewItem } from "@/lib/configurator/types";

const HIGHLIGHT_MS = 1500;
const REMOVED_MS = 2000;

/**
 * Pure helper — bepaalt welke artikelen 'nieuw' zijn (hoeveelheid veranderd of
 * net toegevoegd) en welke net zijn weggevallen ten opzichte van de vorige
 * render. Wordt in de hook geconsumeerd, maar apart getest.
 */
export function berekenAnimatieDelta(
  vorige: Map<string, number>,
  effectief: PreviewItem[],
  items: PreviewItem[],
  eerste: boolean,
): { huidig: Map<string, number>; nieuwNrs: Set<string>; verwijderdItems: PreviewItem[] } {
  const huidig = new Map<string, number>();
  for (const p of effectief) huidig.set(p.artikel_nummer, p.hoeveelheid);

  const nieuwNrs = new Set<string>();
  const verwijderdItems: PreviewItem[] = [];
  if (eerste) return { huidig, nieuwNrs, verwijderdItems };

  for (const [nr, qty] of huidig) {
    const v = vorige.get(nr);
    if (v === undefined || v !== qty) nieuwNrs.add(nr);
  }
  const huidigeSet = new Set(effectief.map((p) => p.artikel_nummer));
  for (const p of items) {
    if (!huidigeSet.has(p.artikel_nummer) && vorige.has(p.artikel_nummer)) {
      verwijderdItems.push(p);
    }
  }
  return { huidig, nieuwNrs, verwijderdItems };
}

export function useWinkelwagenAnimaties(effectief: PreviewItem[], items: PreviewItem[]) {
  const vorigeRef = useRef<Map<string, number>>(new Map());
  const eersteRunRef = useRef(true);
  const [nieuwNrs, setNieuwNrs] = useState<Set<string>>(new Set());
  const [verwijderdAnim, setVerwijderdAnim] = useState<PreviewItem[]>([]);

  useEffect(() => {
    const eerste = eersteRunRef.current;
    eersteRunRef.current = false;
    const {
      huidig,
      nieuwNrs: nN,
      verwijderdItems: verw,
    } = berekenAnimatieDelta(vorigeRef.current, effectief, items, eerste);
    vorigeRef.current = huidig;
    setNieuwNrs(nN);
    if (verw.length > 0) setVerwijderdAnim(verw);

    const t1 = nN.size > 0 ? setTimeout(() => setNieuwNrs(new Set()), HIGHLIGHT_MS) : null;
    const t2 = verw.length > 0 ? setTimeout(() => setVerwijderdAnim([]), REMOVED_MS) : null;
    return () => {
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [effectief, items]);

  return { nieuwNrs, verwijderdAnim };
}
