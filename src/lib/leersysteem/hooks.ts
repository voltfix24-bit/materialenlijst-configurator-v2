import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  haalNotificatiesOp,
  telOpenNotificaties,
  verwerkNotificatie,
  voerGoedgekeurdeWijzigingDoor,
  slaCorrectieOp,
} from './api'
import type { WinkelwagenCorrectie, BeheerNotificatie } from './types'
import { toast } from 'sonner'

export function useNotificaties() {
  return useQuery({
    queryKey: ['beheer_notificaties'],
    queryFn: haalNotificatiesOp,
    refetchInterval: 60_000,
  })
}

export function useNotificatieBadge() {
  return useQuery({
    queryKey: ['notificatie_count'],
    queryFn: telOpenNotificaties,
    refetchInterval: 30_000,
  })
}

export function useVerwerkNotificatie() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      notificatie,
      status,
      nieuweHoeveelheid,
    }: {
      notificatie: BeheerNotificatie
      status: 'goedgekeurd' | 'afgewezen'
      /** Door de beheerder in de preview aangepaste hoeveelheid (optioneel). */
      nieuweHoeveelheid?: number
    }) => {
      if (status === 'goedgekeurd') {
        // Eerst proberen door te voeren; als bron onveilig is breekt dit af
        // zónder de notificatie te sluiten.
        await voerGoedgekeurdeWijzigingDoor(notificatie, { nieuweHoeveelheid })
      }
      await verwerkNotificatie(notificatie.id, status)
    },
    onSuccess: (_, { status }) => {
      // Een goedgekeurde wijziging raakt regel-/templatetabellen die overal in
      // de app gecachet zijn (configurator-stamdata, beheer-tabs, simulator).
      // Alles invalideren is hier de veilige keuze.
      qc.invalidateQueries()
      toast.success(
        status === 'goedgekeurd' ? 'Wijziging doorgevoerd' : 'Notificatie afgewezen'
      )
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Doorvoeren mislukt')
    },
  })
}

export function useSlaCorrectieOp() {
  return useMutation({
    mutationFn: (correctie: WinkelwagenCorrectie) => slaCorrectieOp(correctie),
    onError: (err) => console.error('Correctie opslaan mislukt:', err),
  })
}
