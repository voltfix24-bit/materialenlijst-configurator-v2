export interface ArtikelStam {
  id: string;
  artikel_nummer: string;
  korte_omschrijving: string;
  eenheid: string;
  actief?: boolean;
  status?: string | null;
  alternatief_artikel_nummer?: string | null;
}
