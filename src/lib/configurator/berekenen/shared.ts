import type { Artikel, BronTabel, PreviewItem, PreviewSectie } from "../types";
import type { Stamdata } from "../queries";

export interface ArtikelLike { artikel?: Artikel | null }

export type LsMofTypeRow = { id: string; type: string; bestaand_type: string };

export type PreviewMap = Map<string, PreviewItem>;

export interface BronRef {
  tabel: BronTabel;
  id?: string;
}

/**
 * Voegt een artikel toe aan de preview-map of telt op bij bestaande regel.
 *
 * Wanneer het artikel in de DB als `actief = false` is gemarkeerd (omdat het
 * is uitgelopen in de laatste Liander-sync) wordt het nog wél meegenomen,
 * maar gemarkeerd met `inactief: true` zodat de winkelwagen een waarschuwing
 * kan tonen. Stil weglaten zou de engineer onbewust een incomplete lijst
 * geven; daarom expliciet zichtbaar maken.
 */
export function add(
  map: PreviewMap,
  artikel: Artikel | null | undefined,
  qty: number,
  herkomst: string,
  sectie: PreviewSectie,
  bron?: BronRef,
  nietBestellen = false,
): void {
  if (!artikel || qty <= 0) return;
  const isInactief = artikel.actief === false;
  if (isInactief && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(
      `[winkelwagen] Inactief artikel ${artikel.artikel_nummer} (${artikel.korte_omschrijving}) ` +
        `gebruikt via "${herkomst}" — controleer beheer-regels.`,
    );
  }
  const key = artikel.artikel_nummer;
  const ex = map.get(key);
  if (ex) {
    ex.hoeveelheid += qty;
    if (!ex.herkomst.includes(herkomst)) ex.herkomst.push(herkomst);
    const exB = ex.bijdragen.find(
      (b) =>
        b.herkomst === herkomst &&
        b.sectie === sectie &&
        b.bronTabel === bron?.tabel &&
        b.bronId === bron?.id,
    );
    if (exB) exB.hoeveelheid += qty;
    else
      ex.bijdragen.push({
        herkomst,
        sectie,
        hoeveelheid: qty,
        bronTabel: bron?.tabel,
        bronId: bron?.id,
      });
    if (nietBestellen) ex.niet_bestellen = true;
    if (isInactief) ex.inactief = true;
  } else {
    map.set(key, {
      artikel_id: artikel.id,
      artikel_nummer: artikel.artikel_nummer,
      korte_omschrijving: artikel.korte_omschrijving,
      eenheid: artikel.eenheid,
      categorie: artikel.categorie ?? "Overig",
      hoeveelheid: qty,
      niet_bestellen: nietBestellen,
      herkomst: [herkomst],
      sectie,
      bijdragen: [
        {
          herkomst,
          sectie,
          hoeveelheid: qty,
          bronTabel: bron?.tabel,
          bronId: bron?.id,
        },
      ],
      inactief: isInactief || undefined,
    });
  }
}

export function zoekLsMofType(
  lsMofTypes: LsMofTypeRow[],
  type: string,
  bestaandType: string,
) {
  const exact = lsMofTypes.find((t) => t.type === type && t.bestaand_type === bestaandType);
  if (exact) return exact;
  return lsMofTypes.find((t) => t.type === type && t.bestaand_type === "beide");
}

/** Factory voor lookup van artikel op artikelnummer uit stamdata. */
export function makeFindArtNr(sd: Stamdata): (nr: string) => Artikel | null {
  const arr = sd.artikelen.data ?? [];
  return (nr: string) => arr.find((a) => a.artikel_nummer === nr) ?? null;
}

/** Gedeelde context voor alle domeinberekeningen. */
export interface BerekenCtx {
  findArtNr: (nr: string) => Artikel | null;
  isCompact: boolean;
  isProvisorum: boolean;
  isRenovatie: boolean;
}
