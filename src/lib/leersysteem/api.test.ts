import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BeheerNotificatie, CorrectieContext } from './types'

vi.mock('@/integrations/supabase/client', () => {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data: { id: 'r1' }, error: null })),
    update: vi.fn(async () => ({ error: null })),
    delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
  }
  return {
    supabase: {
      from: vi.fn(() => builder),
    },
  }
})

import { berekenVoorstel, voerGoedgekeurdeWijzigingDoor } from './api'

function maakContext(overrides: Partial<CorrectieContext> = {}): CorrectieContext {
  return {
    case_type: 'nsa',
    sub_type: 'standaard',
    sectie: 'lsRek',
    sectie_key: 'lsRek',
    sectie_label: 'LS-rek',
    vraag_key: 'lsrek_actie_type',
    vraag_label: 'LS-rek actie + type',
    gekozen_antwoord: 'vervangen / 12 richtingen',
    relevante_config: null,
    regel_uitleg: null,
    vraag_of_bron: null,
    leesbare_zin: null,
    context_volledig: true,
    herkomst: null,
    gekozen_waarden: null,
    artikel_nummer: '20000001',
    actie: 'hoeveelheid_gewijzigd',
    bron_tabel: 'ls_rek_regels',
    bron_id: 'r1',
    bijdragen: null,
    meerdere_bronnen: false,
    config_fields: null,
    ...overrides,
  }
}

function maakNotificatie(overrides: Partial<BeheerNotificatie> = {}): BeheerNotificatie {
  return {
    id: 'n1',
    type: 'standaard_aanpassen',
    case_type: 'nsa',
    sub_type: 'standaard',
    artikel_nummer: '20000001',
    korte_omschrijving: 'Test',
    actie: 'hoeveelheid_gewijzigd',
    gemiddelde_wijziging: 4,
    aantal_correcties: 3,
    correctie_ids: [],
    status: 'open',
    afgehandeld_door: null,
    afgehandeld_op: null,
    created_at: '',
    updated_at: '',
    bron_tabel: 'ls_rek_regels',
    bron_id: 'r1',
    bron_herkomst: null,
    meerdere_bronnen: false,
    bijdragen: null,
    config_context: maakContext(),
    sectie: 'lsRek',
    context_key: null,
    ...overrides,
  }
}

describe('berekenVoorstel — context_volledig guard', () => {
  it('blokkeert auto-voorstel als context_volledig=false', () => {
    const n = maakNotificatie({ config_context: maakContext({ context_volledig: false }) })
    const v = berekenVoorstel(n)
    expect(v.kind).toBe('handmatig')
    expect(v.reden).toMatch(/context onvolledig/i)
  })

  it('houdt bestaande auto-flow bij context_volledig=true en één bron', () => {
    const v = berekenVoorstel(maakNotificatie())
    expect(v.kind).toBe('auto_hoeveelheid')
    expect(v.tabel).toBe('ls_rek_regels')
    expect(v.nieuwe_hoeveelheid).toBe(4)
  })
})

describe('voerGoedgekeurdeWijzigingDoor — context_volledig guard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gooit duidelijke fout bij context_volledig=false', async () => {
    const n = maakNotificatie({ config_context: maakContext({ context_volledig: false }) })
    await expect(voerGoedgekeurdeWijzigingDoor(n)).rejects.toThrow(/context onvolledig/i)
  })

  it('voert wijziging gewoon door bij context_volledig=true', async () => {
    await expect(voerGoedgekeurdeWijzigingDoor(maakNotificatie())).resolves.toBeUndefined()
  })
})
