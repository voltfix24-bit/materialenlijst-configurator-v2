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
}

export interface CorrectieDialoogData {
  artikel_nummer: string
  korte_omschrijving: string
  actie: CorrectieActie
  oude_hoeveelheid: number | null
  nieuwe_hoeveelheid: number | null
}
