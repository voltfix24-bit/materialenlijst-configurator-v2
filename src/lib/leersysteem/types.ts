export type CorrectieActie = 'hoeveelheid_gewijzigd' | 'verwijderd' | 'toegevoegd'
export type CorrectieScope = 'eenmalig' | 'altijd' | 'soms'
export type NotificatieStatus = 'open' | 'goedgekeurd' | 'afgewezen'
export type NotificatieType = 'standaard_aanpassen' | 'artikel_verwijderen' | 'artikel_toevoegen'

/** Rijke configuratie-context voor één correctie. Wordt gebruikt om vergelijkbare
 *  correcties pas te groeperen wanneer ook de context overeenkomt. */
export interface CorrectieContext {
  case_type: string
  sub_type: string
  /** Sectie binnen de configurator (bv. "lsRek", "rmu", "provisorium"). */
  sectie: string | null
  /** Machine-leesbare sectiesleutel (gelijk aan `sectie`). */
  sectie_key: string | null
  /** Mens-leesbaar sectielabel. */
  sectie_label: string | null
  /** Machine-leesbare vraag-sleutel binnen de sectie. */
  vraag_key: string | null
  /** Mens-leesbaar vraaglabel binnen de sectie. */
  vraag_label: string | null
  /** Gekozen antwoord op de vraag, compact en stabiel. */
  gekozen_antwoord: string | null
  /** Subset van configvelden die specifiek bij deze vraag horen. */
  relevante_config: Record<string, unknown> | null
  /** Vrije tekst-uitleg uit de bronregel (`bijdrage.herkomst`). */
  regel_uitleg: string | null
  /** Alias van `vraag_label` (legacy) — vraag of bronregel-label. */
  vraag_of_bron: string | null
  /** Mens-leesbare uitleg "Bij … wordt artikel X vaak …". */
  leesbare_zin: string | null
  /** True wanneer vraag_key + gekozen_antwoord aanwezig zijn. */
  context_volledig: boolean
  herkomst: string | null
  /** Snapshot van top-level configuratiekeuzes (gekozen waarden). */
  gekozen_waarden: Record<string, unknown> | null
  artikel_nummer: string
  actie: CorrectieActie
  bron_tabel: string | null
  bron_id: string | null
  bijdragen: unknown[] | null
  meerdere_bronnen: boolean
  /** Snapshot van de relevante configuratievelden op moment van correctie. */
  config_fields: Record<string, unknown> | null
}



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
  bron_tabel?: string | null
  bron_id?: string | null
  bron_herkomst?: string | null
  meerdere_bronnen?: boolean
  bijdragen?: unknown[] | null
  /** Rijke context (zie CorrectieContext). */
  config_context?: CorrectieContext | null
  /** Sectie waar wijziging bij hoort. */
  sectie?: string | null
  /** Stabiele groepeer-sleutel: case_type|sub_type|sectie|bron_tabel|bron_id|actie|artikel. */
  context_key?: string | null
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
  config_context: CorrectieContext | null
  sectie: string | null
  context_key: string | null
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
  sectie?: string | null
}

/** Bouw stabiele groepeer-sleutel voor een correctie. Bevat semantische
 *  vraag/antwoord-context wanneer beschikbaar zodat verschillende keuzes
 *  binnen dezelfde sectie niet in één leer-groep vallen. */
export function bouwContextKey(args: {
  case_type: string
  sub_type: string
  sectie: string | null
  bron_tabel: string | null
  bron_id: string | null
  actie: string
  artikel_nummer: string
  /** Semantische sleutels — optioneel, maar sterk aangeraden. */
  sectie_key?: string | null
  vraag_key?: string | null
  gekozen_antwoord?: string | null
}): string {
  const norm = (v: string | null | undefined) => (v == null || v === '' ? '-' : v)
  return [
    norm(args.case_type),
    norm(args.sub_type),
    norm(args.sectie_key ?? args.sectie),
    norm(args.vraag_key),
    norm(args.gekozen_antwoord),
    norm(args.bron_tabel),
    norm(args.bron_id),
    norm(args.actie),
    norm(args.artikel_nummer),
  ].join('|')
}

