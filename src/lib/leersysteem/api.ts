import { supabase } from '@/integrations/supabase/client'
import { logActie } from '@/lib/beheer/log'
import type { WinkelwagenCorrectie, BeheerNotificatie } from './types'

export async function slaCorrectieOp(correctie: WinkelwagenCorrectie): Promise<void> {
  // Cast om Supabase-types/Json mismatch met bijdragen (jsonb) op te lossen.
  const { error } = await supabase
    .from('winkelwagen_correcties')
    .insert(correctie as never)
  if (error) throw error
}

export async function haalNotificatiesOp(): Promise<BeheerNotificatie[]> {
  const { data, error } = await supabase
    .from('beheer_notificaties')
    .select('*')
    .eq('status', 'open')
    .order('aantal_correcties', { ascending: false })
  if (error) throw error
  return (data ?? []) as BeheerNotificatie[]
}

export async function telOpenNotificaties(): Promise<number> {
  const { count, error } = await supabase
    .from('beheer_notificaties')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open')
  if (error) return 0
  return count ?? 0
}

export async function verwerkNotificatie(
  id: string,
  status: 'goedgekeurd' | 'afgewezen',
  afgehandeldDoor = 'beheerder'
): Promise<void> {
  const { error } = await supabase
    .from('beheer_notificaties')
    .update({
      status,
      afgehandeld_door: afgehandeldDoor,
      afgehandeld_op: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

/** Veilige set van bron-tabellen die we automatisch durven aanpassen. */
const AUTO_BRON_TABELLEN: Record<string, { qtyKol?: string }> = {
  standaard_materialen_templates: { qtyKol: 'standaard_hoeveelheid' },
  ls_rek_regels: { qtyKol: 'hoeveelheid' },
  rmu_veld_regels: { qtyKol: 'hoeveelheid' },
  rmu_veld_artikelen: { qtyKol: 'hoeveelheid' },
  rmu_zekeringen: { qtyKol: 'hoeveelheid' },
  trafo_regels: { qtyKol: 'hoeveelheid' },
  prov_regels: { qtyKol: 'hoeveelheid' },
  ms_kabel_regels: { qtyKol: 'hoeveelheid' },
  ms_mof_materialen: { qtyKol: 'hoeveelheid' },
  ls_mof_materialen: { qtyKol: 'hoeveelheid' },
  ggi_artikelen: { qtyKol: 'hoeveelheid' },
  station_vaste_artikelen: { qtyKol: 'hoeveelheid' },
}

export type VoorstelKind =
  | 'auto_hoeveelheid'
  | 'auto_verwijderen'
  | 'auto_toevoegen_standaard'
  | 'handmatig'

export interface VoorstelPreview {
  kind: VoorstelKind
  reden: string
  tabel?: string
  qtyKol?: string
  bron_id?: string
  nieuwe_hoeveelheid?: number
  artikel_nummer?: string
  case_type?: string
}

/** Bereken vooraf welk concreet voorstel uit een notificatie zou volgen. */
export function berekenVoorstel(notificatie: BeheerNotificatie): VoorstelPreview {
  // Fallback voor 'toegevoegd' zonder bekende flow/bron: altijd kunnen doorvoeren
  // naar de standaard-materialenlijst voor dit case_type. Beheerder houdt nog
  // steeds de keuze (Afwijzen blijft mogelijk).
  if (notificatie.actie === 'toegevoegd') {
    const heeftBron = !!notificatie.bron_tabel && !!notificatie.bron_id
    const contextOk = notificatie.config_context?.context_volledig !== false
    if (!heeftBron || !contextOk || notificatie.meerdere_bronnen) {
      const aantal =
        notificatie.gemiddelde_wijziging != null
          ? Math.max(1, Math.round(notificatie.gemiddelde_wijziging))
          : 1
      return {
        kind: 'auto_toevoegen_standaard',
        reden:
          'Geen specifieke flow gevonden — voeg toe aan standaard materialen voor dit case-type.',
        tabel: 'standaard_materialen_templates',
        qtyKol: 'standaard_hoeveelheid',
        artikel_nummer: notificatie.artikel_nummer,
        case_type: notificatie.case_type,
        nieuwe_hoeveelheid: aantal,
      }
    }
  }
  if (notificatie.config_context?.context_volledig === false) {
    return { kind: 'handmatig', reden: 'Context onvolledig — handmatig beoordelen.' }
  }
  if (notificatie.meerdere_bronnen) {
    return { kind: 'handmatig', reden: 'Meerdere bronnen — beheerder kiest welke regel.' }
  }
  if (!notificatie.bron_tabel || !notificatie.bron_id) {
    return { kind: 'handmatig', reden: 'Bron onbekend — voeg/wijzig regel handmatig in beheer.' }
  }
  const meta = AUTO_BRON_TABELLEN[notificatie.bron_tabel]
  if (!meta) {
    return {
      kind: 'handmatig',
      reden: `Bron-tabel '${notificatie.bron_tabel}' niet veilig automatisch aan te passen.`,
      tabel: notificatie.bron_tabel,
      bron_id: notificatie.bron_id,
    }
  }
  if (notificatie.actie === 'verwijderd') {
    return {
      kind: 'auto_verwijderen',
      reden: 'Eén bronregel — wordt verwijderd na goedkeuring.',
      tabel: notificatie.bron_tabel,
      bron_id: notificatie.bron_id,
    }
  }
  if (notificatie.actie === 'hoeveelheid_gewijzigd' && notificatie.gemiddelde_wijziging != null && meta.qtyKol) {
    return {
      kind: 'auto_hoeveelheid',
      reden: 'Eén bronregel — hoeveelheid wordt na goedkeuring aangepast.',
      tabel: notificatie.bron_tabel,
      qtyKol: meta.qtyKol,
      bron_id: notificatie.bron_id,
      nieuwe_hoeveelheid: Math.round(notificatie.gemiddelde_wijziging),
    }
  }
  return { kind: 'handmatig', reden: 'Nieuwe artikelen worden handmatig aan een regel gekoppeld.' }
}

/**
 * Huidige staat van de bronregel voor de before/after-preview in de
 * goedkeuren-dialoog. Bepaalt óók of automatisch doorvoeren veilig is
 * (regel bestaat nog, geen hoeveelheid-formule die overschreven zou worden).
 */
export interface VoorstelDetails {
  voorstel: VoorstelPreview
  /** Waarom automatisch doorvoeren niet kan — null als het veilig kan. */
  blokkade: string | null
  /** Huidige hoeveelheid in de bronregel of bestaande standaard-template. */
  huidigeHoeveelheid: number | null
  /** Gevulde hoeveelheid_formule op de bronregel, indien aanwezig. */
  formule: string | null
  /** Ruwe bronrij (voor weergave bij verwijderen). */
  bronRij: Record<string, unknown> | null
}

export async function haalVoorstelDetails(
  notificatie: BeheerNotificatie
): Promise<VoorstelDetails> {
  const voorstel = berekenVoorstel(notificatie)
  const basis: VoorstelDetails = {
    voorstel,
    blokkade: null,
    huidigeHoeveelheid: null,
    formule: null,
    bronRij: null,
  }

  if (voorstel.kind === 'handmatig') {
    return { ...basis, blokkade: voorstel.reden }
  }

  if (voorstel.kind === 'auto_toevoegen_standaard') {
    const { data: art } = await supabase
      .from('artikelen')
      .select('id, actief')
      .eq('artikel_nummer', notificatie.artikel_nummer)
      .maybeSingle()
    if (!art) {
      return {
        ...basis,
        blokkade: `Artikel ${notificatie.artikel_nummer} staat niet in de catalogus.`,
      }
    }
    const { data: bestaand } = await supabase
      .from('standaard_materialen_templates')
      .select('standaard_hoeveelheid')
      .eq('case_type', notificatie.case_type)
      .eq('artikel_id', art.id)
      .maybeSingle()
    return {
      ...basis,
      huidigeHoeveelheid: bestaand ? Number(bestaand.standaard_hoeveelheid) : null,
    }
  }

  // auto_hoeveelheid / auto_verwijderen — bronrij ophalen
  if (!voorstel.tabel || !voorstel.bron_id) {
    return { ...basis, blokkade: 'Bron onbekend — handmatig aanpassen in Beheer.' }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rij, error } = await (supabase as never as any)
    .from(voorstel.tabel)
    .select('*')
    .eq('id', voorstel.bron_id)
    .maybeSingle()
  if (error) return { ...basis, blokkade: `Bronregel kon niet worden gelezen: ${error.message}` }
  if (!rij) {
    return {
      ...basis,
      blokkade: 'De bronregel bestaat niet meer — handmatig opnieuw beoordelen in Beheer.',
    }
  }
  const formule =
    typeof rij.hoeveelheid_formule === 'string' && rij.hoeveelheid_formule.trim() !== ''
      ? (rij.hoeveelheid_formule as string)
      : null
  const huidige =
    voorstel.qtyKol && rij[voorstel.qtyKol] != null ? Number(rij[voorstel.qtyKol]) : null
  const details: VoorstelDetails = {
    voorstel,
    blokkade: null,
    huidigeHoeveelheid: huidige,
    formule,
    bronRij: rij as Record<string, unknown>,
  }
  if (voorstel.kind === 'auto_hoeveelheid' && formule) {
    details.blokkade =
      `Deze regel berekent de hoeveelheid met een formule (${formule}). ` +
      'Automatisch een vast getal instellen zou de formule uitschakelen — pas de regel handmatig aan.'
  }
  return details
}

export async function voerGoedgekeurdeWijzigingDoor(
  notificatie: BeheerNotificatie,
  opts?: { nieuweHoeveelheid?: number }
): Promise<void> {
  const voorstel = berekenVoorstel(notificatie)

  // Fallback: toegevoegd-artikel zonder herleidbare flow → toevoegen aan
  // standaard_materialen_templates voor dit case_type. Werkt ook wanneer
  // context_volledig=false of bron_tabel ontbreekt.
  if (voorstel.kind === 'auto_toevoegen_standaard') {
    if (!notificatie.artikel_nummer) {
      throw new Error('Artikelnummer ontbreekt — kan niet toevoegen.')
    }
    if (!notificatie.case_type) {
      throw new Error('Case-type ontbreekt — kan niet toevoegen aan standaard materialen.')
    }

    const { data: art, error: artErr } = await supabase
      .from('artikelen')
      .select('id')
      .eq('artikel_nummer', notificatie.artikel_nummer)
      .maybeSingle()
    if (artErr) throw artErr
    if (!art) {
      throw new Error(`Artikel ${notificatie.artikel_nummer} niet gevonden in assortiment.`)
    }

    const { data: bestaand, error: dupErr } = await supabase
      .from('standaard_materialen_templates')
      .select('id, standaard_hoeveelheid')
      .eq('case_type', notificatie.case_type)
      .eq('artikel_id', art.id)
      .maybeSingle()
    if (dupErr) throw dupErr

    const aantal = opts?.nieuweHoeveelheid ?? voorstel.nieuwe_hoeveelheid ?? 1

    if (bestaand) {
      const { error } = await supabase
        .from('standaard_materialen_templates')
        .update({ standaard_hoeveelheid: aantal })
        .eq('id', bestaand.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('standaard_materialen_templates')
        .insert({
          case_type: notificatie.case_type,
          artikel_id: art.id,
          standaard_hoeveelheid: aantal,
        })
      if (error) throw error
    }
    await logActie({
      actie: 'standaardmateriaal_aangepast',
      omschrijving:
        `Leersysteem: artikel ${notificatie.artikel_nummer} ` +
        `${bestaand ? 'bijgewerkt in' : 'toegevoegd aan'} standaard materialen (${notificatie.case_type}), aantal ${aantal}.`,
      artikel_nummer: notificatie.artikel_nummer,
      tabel: 'standaard_materialen_templates',
      rij_id: bestaand?.id ?? null,
      oude_waarde: bestaand ? { standaard_hoeveelheid: bestaand.standaard_hoeveelheid } : null,
      nieuwe_waarde: { standaard_hoeveelheid: aantal },
      aantal_aangepast: 1,
      details: { notificatie_id: notificatie.id, aantal_correcties: notificatie.aantal_correcties },
      uitgevoerd_door: 'leersysteem',
    })
    return
  }

  if (voorstel.kind === 'handmatig') {
    throw new Error(voorstel.reden)
  }

  if (!notificatie.bron_tabel || !notificatie.bron_id) {
    throw new Error('Bron ontbreekt — handmatig aanpassen in Beheer.')
  }
  const meta = AUTO_BRON_TABELLEN[notificatie.bron_tabel]
  if (!meta) {
    throw new Error(
      `Automatisch doorvoeren op bron-tabel '${notificatie.bron_tabel}' wordt nog niet ondersteund — pas handmatig aan.`,
    )
  }

  // Controleer eerst of de bronregel nog bestaat — voorkomt dat we een
  // verouderd voorstel "stilletjes" doorvoeren op een regel die inmiddels weg is.
  // We halen de hele rij op zodat de oude waarde in het beheer-log komt.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bestaand, error: checkErr } = await (supabase as never as any)
    .from(notificatie.bron_tabel)
    .select('*')
    .eq('id', notificatie.bron_id)
    .maybeSingle()
  if (checkErr) throw checkErr
  if (!bestaand) {
    throw new Error('De bronregel bestaat niet meer — handmatig opnieuw beoordelen in Beheer.')
  }

  if (voorstel.kind === 'auto_verwijderen') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as never as any)
      .from(notificatie.bron_tabel)
      .delete()
      .eq('id', notificatie.bron_id)
    if (error) throw error
    await logActie({
      actie: 'regel_aangepast',
      omschrijving:
        `Leersysteem: regel verwijderd uit ${notificatie.bron_tabel} ` +
        `(artikel ${notificatie.artikel_nummer}, ${notificatie.aantal_correcties} correcties).`,
      artikel_nummer: notificatie.artikel_nummer,
      tabel: notificatie.bron_tabel,
      rij_id: notificatie.bron_id,
      oude_waarde: bestaand,
      nieuwe_waarde: null,
      aantal_aangepast: 1,
      details: { notificatie_id: notificatie.id },
      uitgevoerd_door: 'leersysteem',
    })
    return
  }

  const nieuweHoeveelheid = opts?.nieuweHoeveelheid ?? voorstel.nieuwe_hoeveelheid
  if (voorstel.kind === 'auto_hoeveelheid' && nieuweHoeveelheid != null && meta.qtyKol) {
    // Formule-guard: een vast getal instellen zou de formule uitschakelen.
    const formule = (bestaand as Record<string, unknown>).hoeveelheid_formule
    if (typeof formule === 'string' && formule.trim() !== '') {
      throw new Error(
        `Deze regel berekent de hoeveelheid met een formule (${formule}) — pas de regel handmatig aan in Beheer.`,
      )
    }
    const oudeWaarde = (bestaand as Record<string, unknown>)[meta.qtyKol]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as never as any)
      .from(notificatie.bron_tabel)
      .update({ [meta.qtyKol]: nieuweHoeveelheid })
      .eq('id', notificatie.bron_id)
    if (error) throw error
    await logActie({
      actie: 'regel_aangepast',
      omschrijving:
        `Leersysteem: ${notificatie.bron_tabel}.${meta.qtyKol} van ${String(oudeWaarde)} naar ` +
        `${nieuweHoeveelheid} (artikel ${notificatie.artikel_nummer}, ${notificatie.aantal_correcties} correcties).`,
      artikel_nummer: notificatie.artikel_nummer,
      tabel: notificatie.bron_tabel,
      rij_id: notificatie.bron_id,
      oude_waarde: { [meta.qtyKol]: oudeWaarde },
      nieuwe_waarde: { [meta.qtyKol]: nieuweHoeveelheid },
      aantal_aangepast: 1,
      details: { notificatie_id: notificatie.id },
      uitgevoerd_door: 'leersysteem',
    })
    return
  }

  throw new Error('Onbekend voorstel — handmatig aanpassen in Beheer.')
}


