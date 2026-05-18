import type { MaterialenConfig } from "../types";
import type { Stamdata } from "../queries";
import { add, type ArtikelLike, type PreviewMap } from "./shared";

/** Sectie 1: standaard templates + 2: station vaste artikelen. */
export function berekenStandaard(
  map: PreviewMap,
  config: MaterialenConfig,
  sd: Stamdata,
  caseType: string | undefined,
): void {
  if (caseType && config.subType) {
    for (const t of sd.standaardTemplates.data ?? []) {
      const a = (t as ArtikelLike).artikel;
      add(map, a, Number(t.standaard_hoeveelheid), "Standaard container", "standaard", {
        tabel: "standaard_materialen_templates",
        id: (t as { id?: string }).id,
      });
    }
  }
  if (config.subType) {
    for (const s of sd.stationVaste.data ?? []) {
      if ((s.van_toepassing_bij ?? []).includes(config.subType)) {
        add(
          map,
          (s as ArtikelLike).artikel,
          Number(s.hoeveelheid),
          `Station (${s.groep ?? "vast"})`,
          "standaard",
          { tabel: "station_vaste_artikelen", id: (s as { id?: string }).id },
        );
      }
    }
  }
}
