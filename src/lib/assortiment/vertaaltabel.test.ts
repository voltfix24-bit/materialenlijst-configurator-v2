import { describe, it, expect } from "vitest";
import {
  categoriseerVertaaltabel,
  bepaalImportActie,
  type BestaandArtikelMini,
  type VertaaltabelRij,
  type VertaaltabelMatch,
  type VertaaltabelImportOpties,
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

const OPTIES: VertaaltabelImportOpties = {
  markeerInactief: true,
  maakNieuweArtikelenAan: true,
  conflictBesluiten: {},
};

function match(over: Partial<VertaaltabelMatch>): VertaaltabelMatch {
  return {
    rij: rij("26000080", "20050011"),
    status: "gereed",
    oud_id: "o1",
    oud_actief: true,
    huidig_alternatief: null,
    nieuw_id: "n1",
    nieuw_actief: true,
    ...over,
  };
}

describe("bepaalImportActie", () => {
  it("slaat 'oud_ontbreekt' volledig over", () => {
    const a = bepaalImportActie(match({ status: "oud_ontbreekt", oud_id: null }), OPTIES);
    expect(a.overslaan).toBe(true);
    expect(a.redenOverslaan).toBe("oud_ontbreekt");
  });

  it("zet alternatief + markeert inactief bij 'gereed'", () => {
    const a = bepaalImportActie(match({ status: "gereed" }), OPTIES);
    expect(a).toMatchObject({
      overslaan: false,
      zetAlternatief: true,
      markeerInactief: true,
      maakNieuwAan: false,
    });
  });

  it("maakt nieuw artikel aan bij 'nieuw_ontbreekt' als optie aan staat", () => {
    const a = bepaalImportActie(match({ status: "nieuw_ontbreekt", nieuw_id: null }), OPTIES);
    expect(a.maakNieuwAan).toBe(true);
    expect(a.zetAlternatief).toBe(true);
  });

  it("maakt géén nieuw artikel aan als de optie uit staat", () => {
    const a = bepaalImportActie(match({ status: "nieuw_ontbreekt", nieuw_id: null }), {
      ...OPTIES,
      maakNieuweArtikelenAan: false,
    });
    expect(a.maakNieuwAan).toBe(false);
  });

  it("behoudt conflict standaard (overslaan)", () => {
    const a = bepaalImportActie(
      match({ status: "conflict", huidig_alternatief: "20059999" }),
      OPTIES,
    );
    expect(a.overslaan).toBe(true);
    expect(a.redenOverslaan).toBe("conflict_behouden");
  });

  it("overschrijft conflict bij expliciete keuze 'overschrijf'", () => {
    const a = bepaalImportActie(match({ status: "conflict", huidig_alternatief: "20059999" }), {
      ...OPTIES,
      conflictBesluiten: { "26000080": "overschrijf" },
    });
    expect(a.overslaan).toBe(false);
    expect(a.zetAlternatief).toBe(true);
  });

  it("markeert bij 'al_ingesteld' alleen inactief, zet geen alternatief", () => {
    const a = bepaalImportActie(match({ status: "al_ingesteld", oud_actief: true }), OPTIES);
    expect(a.zetAlternatief).toBe(false);
    expect(a.markeerInactief).toBe(true);
    expect(a.overslaan).toBe(false);
  });

  it("slaat 'al_ingesteld' over als het oude artikel al inactief is en niets meer te doen valt", () => {
    const a = bepaalImportActie(match({ status: "al_ingesteld", oud_actief: false }), OPTIES);
    expect(a.overslaan).toBe(true);
    expect(a.redenOverslaan).toBe("niets_te_doen");
  });
});
