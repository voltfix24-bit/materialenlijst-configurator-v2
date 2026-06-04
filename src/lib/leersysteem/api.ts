import { supabase } from '@/integrations/supabase/client'
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

export type VoorstelKind = 'auto_hoeveelheid' | 'auto_verwijderen' | 'handmatig'

export interface VoorstelPreview {
  kind: VoorstelKind
  reden: string
  tabel?: string
  qtyKol?: string
  bron_id?: string
  nieuwe_hoeveelheid?: number
}

/** Bereken vooraf welk concreet voorstel uit een notificatie zou volgen. */
export function berekenVoorstel(notificatie: BeheerNotificatie): VoorstelPreview {
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


export async function voerGoedgekeurdeWijzigingDoor(
  notificatie: BeheerNotificatie
): Promise<void> {
  if (notificatie.config_context?.context_volledig === false) {
    throw new Error('Context onvolledig; voorstel moet handmatig beoordeeld worden.')
  }
  if (notificatie.meerdere_bronnen || !notificatie.bron_tabel) {
    throw new Error(
      'Deze notificatie heeft meerdere of onbekende bronnen — pas de regel handmatig aan in Beheer.',
    )
  }
  const meta = AUTO_BRON_TABELLEN[notificatie.bron_tabel]
  if (!meta) {
    throw new Error(
      `Automatisch doorvoeren op bron-tabel '${notificatie.bron_tabel}' wordt nog niet ondersteund — pas handmatig aan.`,
    )
  }
  if (!notificatie.bron_id) {
    throw new Error('Bron-id ontbreekt — handmatig aanpassen in Beheer.')
  }

  // Controleer eerst of de bronregel nog bestaat — voorkomt dat we een
  // verouderd voorstel "stilletjes" doorvoeren op een regel die inmiddels weg is.
  const { data: bestaand, error: checkErr } = await (supabase as never as any)
    .from(notificatie.bron_tabel)
    .select('id')
    .eq('id', notificatie.bron_id)
    .maybeSingle()
  if (checkErr) throw checkErr
  if (!bestaand) {
    throw new Error('De bronregel bestaat niet meer — handmatig opnieuw beoordelen in Beheer.')
  }

  if (notificatie.actie === 'verwijderd') {
    const { error } = await (supabase as never as any)
      .from(notificatie.bron_tabel)
      .delete()
      .eq('id', notificatie.bron_id)
    if (error) throw error
    return
  }

  if (notificatie.actie === 'hoeveelheid_gewijzigd' && notificatie.gemiddelde_wijziging != null) {
    if (!meta.qtyKol) {
      throw new Error('Hoeveelheid-kolom onbekend voor deze bron — handmatig aanpassen.')
    }
    const nieuw = Math.round(notificatie.gemiddelde_wijziging)
    const { error } = await (supabase as never as any)
      .from(notificatie.bron_tabel)
      .update({ [meta.qtyKol]: nieuw })
      .eq('id', notificatie.bron_id)
    if (error) throw error
    return
  }

  throw new Error('Nieuwe artikelen moeten handmatig aan een regel worden toegevoegd in Beheer.')
}


