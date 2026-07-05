import { useEffect, useRef, useState } from "react";
import type { PreviewItem } from "@/lib/configurator/types";

const HIGHLIGHT_MS = 1500;
const REMOVED_MS = 2000;

export function useWinkelwagenAnimaties(effectief: PreviewItem[], items: PreviewItem[]) {
  const vorigeRef = useRef<Map<string, number>>(new Map());
  const eersteRunRef = useRef(true);
  const [nieuwNrs, setNieuwNrs] = useState<Set<string>>(new Set());
  const [verwijderdAnim, setVerwijderdAnim] = useState<PreviewItem[]>([]);

  useEffect(() => {
    const huidig = new Map<string, number>();
    for (const p of effectief) huidig.set(p.artikel_nummer, p.hoeveelheid);
    const eerste = eersteRunRef.current;
    eersteRunRef.current = false;

    const nN = new Set<string>();
    if (!eerste) {
      for (const [nr, qty] of huidig) {
        const v = vorigeRef.current.get(nr);
        if (v === undefined || v !== qty) nN.add(nr);
      }
    }
    const verw: PreviewItem[] = [];
    if (!eerste) {
      const huidigeSet = new Set(effectief.map((p) => p.artikel_nummer));
      for (const p of items) {
        if (!huidigeSet.has(p.artikel_nummer) && vorigeRef.current.has(p.artikel_nummer)) {
          verw.push(p);
        }
      }
    }
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
