export type CorrectieActie = 'hoeveelheid_gewijzigd' | 'verwijderd' | 'toegevoegd'
export type CorrectieScope = 'eenmalig' | 'altijd' | 'soms'
export type NotificatieStatus = 'open' | 'goedgekeurd' | 'afgewezen'
export type NotificatieType = 'standaard_aanpassen' | 'artikel_verwijderen' | 'artikel_toevoegen'

export interface WinkelwagenCorrectie {
  id?: string
  case_id: string
  case_type: string
  sub_type: string
  artikel_nummer: string
  korte_omschrijving: string
  actie: CorrectieActie
  oude_hoeveelheid: number | null
  nieuwe_hoeveelheid: number | null
  reden: string
  scope: CorrectieScope
  engineer_id?: string
  created_at?: string
  /** Tabel waaruit het artikel kwam in de winkelwagen, bv. 'ls_rek_regels'. */
  bron_tabel?: string | null
  /** Database-id van de regel/rij in die tabel. */
  bron_id?: string | null
  /** Mens-leesbare herkomst, bv. "LS-rek vervangen · 12 richtingen". */
  bron_herkomst?: string | null
  /** True wanneer het artikel uit meer dan één regel/bron komt — auto-approve uitgesloten. */
  meerdere_bronnen?: boolean
  /** Alle bijdragen (bron + sectie + hoeveelheid). */
  bijdragen?: unknown[] | null
  /** Snapshot van de relevante case-configuratievelden op moment van correctie. */
  config_snapshot?: Record<string, unknown> | null
}

export interface BeheerNotificatie {
  id: string
  type: NotificatieType
  case_type: string
  sub_type: string
  artikel_nummer: string
  korte_omschrijving: string | null
  actie: string
  gemiddelde_wijziging: number | null
  aantal_correcties: number
  correctie_ids: string[]
  status: NotificatieStatus
  afgehandeld_door: string | null
  afgehandeld_op: string | null
  created_at: string
  updated_at: string
  bron_tabel: string | null
  bron_id: string | null
  bron_herkomst: string | null
  meerdere_bronnen: boolean
  bijdragen: unknown | null
}

export interface CorrectieDialoogData {
  artikel_nummer: string
  korte_omschrijving: string
  actie: CorrectieActie
  oude_hoeveelheid: number | null
  nieuwe_hoeveelheid: number | null
  bron_tabel?: string | null
  bron_id?: string | null
  bron_herkomst?: string | null
  meerdere_bronnen?: boolean
  bijdragen?: unknown
}
