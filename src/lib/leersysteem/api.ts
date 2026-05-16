import { supabase } from '@/integrations/supabase/client'
import type { WinkelwagenCorrectie, BeheerNotificatie } from './types'

export async function slaCorrectieOp(correctie: WinkelwagenCorrectie): Promise<void> {
  const { error } = await supabase
    .from('winkelwagen_correcties')
    .insert(correctie)
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

export async function voerGoedgekeurdeWijzigingDoor(
  notificatie: BeheerNotificatie
): Promise<void> {
  if (notificatie.actie === 'verwijderd') {
    const { data: artData } = await supabase
      .from('artikelen')
      .select('id')
      .eq('artikel_nummer', notificatie.artikel_nummer)
      .single()
    if (artData) {
      await supabase
        .from('standaard_materialen_templates')
        .delete()
        .eq('case_type', notificatie.case_type)
        .eq('artikel_id', artData.id)
    }
  } else if (
    notificatie.actie === 'hoeveelheid_gewijzigd' &&
    notificatie.gemiddelde_wijziging != null
  ) {
    const { data: artData } = await supabase
      .from('artikelen')
      .select('id')
      .eq('artikel_nummer', notificatie.artikel_nummer)
      .single()
    if (artData) {
      await supabase
        .from('standaard_materialen_templates')
        .update({ standaard_hoeveelheid: Math.round(notificatie.gemiddelde_wijziging) })
        .eq('case_type', notificatie.case_type)
        .eq('artikel_id', artData.id)
    }
  }
  // 'toegevoegd' vereist handmatige actie via beheer pagina
}
