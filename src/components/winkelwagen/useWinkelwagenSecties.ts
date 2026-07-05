import { useEffect, useMemo, useRef, useState } from "react";
import {
  PREVIEW_SECTIE_DEFS,
  type PreviewItem,
  type PreviewSectie,
  type ToegevoegdArtikel,
} from "@/lib/configurator/types";

export const CONFIG_SECTIE_NAAR_WINKELWAGEN: Record<string, PreviewSectie[]> = {
  project: ["standaard"],
  provisorium: ["provisorium"],
  ms: ["rmu", "msVerbindingen"],
  trafo: ["trafo", "vultKabel"],
  ls: ["lsVerbindingen", "lsRek"],
  overig: ["ggi", "standaard"],
  maatwerk: ["maatwerk"],
};

export interface SectieGroep {
  key: PreviewSectie;
  label: string;
  color: string;
  items: PreviewItem[];
  verwijderdeItems: PreviewItem[];
}

function matchtFilter(p: Pick<PreviewItem, "artikel_nummer" | "korte_omschrijving">, q: string) {
  return (
    !q ||
    p.artikel_nummer.toLowerCase().includes(q) ||
    p.korte_omschrijving.toLowerCase().includes(q)
  );
}

export function bouwSectieGroepen(
  effectief: PreviewItem[],
  verwijderdAnim: PreviewItem[],
  toegevoegd: ToegevoegdArtikel[],
  filter: string,
): SectieGroep[] {
  const q = filter.trim().toLowerCase();
  const handmatigeNrs = new Set(toegevoegd.map((t) => t.artikel_nummer));
  const map = new Map<PreviewSectie, PreviewItem[]>();
  for (const p of effectief) {
    if (handmatigeNrs.has(p.artikel_nummer)) continue;
    if (!matchtFilter(p, q)) continue;
    const arr = map.get(p.sectie) ?? [];
    arr.push(p);
    map.set(p.sectie, arr);
  }
  const verwijderdPerSectie = new Map<PreviewSectie, PreviewItem[]>();
  for (const v of verwijderdAnim) {
    if (!matchtFilter(v, q)) continue;
    const arr = verwijderdPerSectie.get(v.sectie) ?? [];
    arr.push(v);
    verwijderdPerSectie.set(v.sectie, arr);
  }
  return PREVIEW_SECTIE_DEFS.map((def) => ({
    key: def.key,
    label: def.label,
    color: def.color,
    items: map.get(def.key) ?? [],
    verwijderdeItems: verwijderdPerSectie.get(def.key) ?? [],
  })).filter((g) => g.items.length > 0 || g.verwijderdeItems.length > 0);
}

export function bouwZichtbareToegevoegd(
  toegevoegd: ToegevoegdArtikel[],
  filter: string,
): ToegevoegdArtikel[] {
  const q = filter.trim().toLowerCase();
  if (!q) return toegevoegd;
  return toegevoegd.filter((t) => matchtFilter(t, q));
}

export function bouwSectiesMetNieuw(
  nieuwNrs: Set<string>,
  sectieGroepen: SectieGroep[],
  toegevoegd: ToegevoegdArtikel[],
): Set<string> {
  const s = new Set<string>();
  if (nieuwNrs.size === 0) return s;
  for (const sec of sectieGroepen) {
    if (sec.items.some((it) => nieuwNrs.has(it.artikel_nummer))) s.add(sec.key);
  }
  if (toegevoegd.some((t) => nieuwNrs.has(t.artikel_nummer))) s.add("__handmatig");
  return s;
}

interface UseWinkelwagenSectiesArgs {
  activeSectie?: string;
  caseId: string;
  effectief: PreviewItem[];
  verwijderdAnim: PreviewItem[];
  toegevoegd: ToegevoegdArtikel[];
  nieuwNrs: Set<string>;
}

export function useWinkelwagenSecties({
  activeSectie,
  caseId,
  effectief,
  verwijderdAnim,
  toegevoegd,
  nieuwNrs,
}: UseWinkelwagenSectiesArgs) {
  const [openSecties, setOpenSecties] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const lijstRef = useRef<HTMLDivElement | null>(null);

  const eersteSyncRef = useRef(true);
  useEffect(() => {
    if (!activeSectie) return;
    const mapped = CONFIG_SECTIE_NAAR_WINKELWAGEN[activeSectie];
    if (!mapped || mapped.length === 0) return;
    setOpenSecties((prev) => {
      const s = new Set(prev);
      for (const k of mapped) s.add(k);
      return s;
    });
    if (eersteSyncRef.current) {
      eersteSyncRef.current = false;
      return;
    }
    requestAnimationFrame(() => {
      const root = lijstRef.current;
      if (!root) return;
      for (const k of mapped) {
        const el = root.querySelector<HTMLElement>(`[data-sectie="${k}"]`);
        if (el) {
          // Alleen de winkelwagenlijst zelf scrollen, niet de hoofdpagina.
          root.scrollTo({ top: el.offsetTop - root.offsetTop, behavior: "smooth" });
          break;
        }
      }
    });
  }, [activeSectie]);

  const eersteCaseResetRef = useRef(true);
  useEffect(() => {
    if (eersteCaseResetRef.current) {
      eersteCaseResetRef.current = false;
      return;
    }
    setOpenSecties(new Set());
    eersteSyncRef.current = true;
  }, [caseId]);

  const sectieGroepen = useMemo(
    () => bouwSectieGroepen(effectief, verwijderdAnim, toegevoegd, filter),
    [effectief, verwijderdAnim, toegevoegd, filter],
  );

  const zichtbareToegevoegd = useMemo(
    () => bouwZichtbareToegevoegd(toegevoegd, filter),
    [toegevoegd, filter],
  );

  const toggleSectie = (key: string) => {
    setOpenSecties((prev) => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key);
      else s.add(key);
      return s;
    });
  };

  const sectiesMetNieuw = useMemo(
    () => bouwSectiesMetNieuw(nieuwNrs, sectieGroepen, toegevoegd),
    [nieuwNrs, sectieGroepen, toegevoegd],
  );

  return {
    filter,
    setFilter,
    lijstRef,
    openSecties,
    sectieGroepen,
    zichtbareToegevoegd,
    sectiesMetNieuw,
    toggleSectie,
  };
}
