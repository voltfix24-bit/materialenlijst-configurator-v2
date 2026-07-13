import { describe, it, expect } from "vitest";
import {
  categoriseerVertaaltabel,
  type BestaandArtikelMini,
  type VertaaltabelRij,
} from "./vertaaltabel";

function art(
  id: string,
  nr: string,
  actief: boolean,
  alt: string | null = null,
): BestaandArtikelMini {
  return { id, artikel_nummer: nr, actief, alternatief_artikel_nummer: alt };
}

function byNr(...arts: BestaandArtikelMini[]): Map<string, BestaandArtikelMini> {
  return new Map(arts.map((a) => [a.artikel_nummer, a]));
}

const rij = (oud: string, nieuw: string): VertaaltabelRij => ({
  oud_nummer: oud,
  nieuw_nummer: nieuw,
  omschrijving: "test",
});

describe("categoriseerVertaaltabel", () => {
  it("markeert 'gereed' als oud actief bestaat en nieuw actief bestaat", () => {
    const map = byNr(art("o1", "26000080", true), art("n1", "20050011", true));
    const [m] = categoriseerVertaaltabel([rij("26000080", "20050011")], map);
    expect(m.status).toBe("gereed");
    expect(m.oud_id).toBe("o1");
    expect(m.nieuw_id).toBe("n1");
  });

  it("markeert 'nieuw_inactief' als het nieuwe artikel inactief is", () => {
    const map = byNr(art("o1", "26000080", true), art("n1", "20050011", false));
    const [m] = categoriseerVertaaltabel([rij("26000080", "20050011")], map);
    expect(m.status).toBe("nieuw_inactief");
  });

  it("markeert 'nieuw_ontbreekt' als het nieuwe nummer niet in de DB staat", () => {
    const map = byNr(art("o1", "26000080", true));
    const [m] = categoriseerVertaaltabel([rij("26000080", "20050011")], map);
    expect(m.status).toBe("nieuw_ontbreekt");
    expect(m.nieuw_id).toBeNull();
  });

  it("markeert 'oud_ontbreekt' als het oude nummer niet in de DB staat", () => {
    const map = byNr(art("n1", "20050011", true));
    const [m] = categoriseerVertaaltabel([rij("26000080", "20050011")], map);
    expect(m.status).toBe("oud_ontbreekt");
    expect(m.oud_id).toBeNull();
  });

  it("markeert 'al_ingesteld' als het oude artikel al exact dit alternatief heeft", () => {
    const map = byNr(art("o1", "26000080", false, "20050011"), art("n1", "20050011", true));
    const [m] = categoriseerVertaaltabel([rij("26000080", "20050011")], map);
    expect(m.status).toBe("al_ingesteld");
  });

  it("markeert 'conflict' als het oude artikel al een ánder alternatief heeft", () => {
    const map = byNr(art("o1", "26000080", true, "20059999"), art("n1", "20050011", true));
    const [m] = categoriseerVertaaltabel([rij("26000080", "20050011")], map);
    expect(m.status).toBe("conflict");
    expect(m.huidig_alternatief).toBe("20059999");
  });

  it("behandelt lege-string alternatief als geen alternatief (niet als conflict)", () => {
    const map = byNr(art("o1", "26000080", true, "   "), art("n1", "20050011", true));
    const [m] = categoriseerVertaaltabel([rij("26000080", "20050011")], map);
    expect(m.status).toBe("gereed");
    expect(m.huidig_alternatief).toBeNull();
  });

  it("verwerkt meerdere rijen onafhankelijk", () => {
    const map = byNr(
      art("o1", "26000080", true),
      art("n1", "20050011", true),
      art("o2", "26000085", true, "20050006"),
    );
    const res = categoriseerVertaaltabel(
      [rij("26000080", "20050011"), rij("26000085", "20050006"), rij("26999999", "20059999")],
      map,
    );
    expect(res.map((m) => m.status)).toEqual(["gereed", "al_ingesteld", "oud_ontbreekt"]);
  });
});
