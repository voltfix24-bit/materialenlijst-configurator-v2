import { describe, it, expect } from 'vitest'
import { bepaalSemantiek, bouwCorrectieContext } from './context'
import { bouwContextKey } from './types'

describe('bepaalSemantiek', () => {
  it('herkent LS-rek vraag/antwoord uit configuratie', () => {
    const s = bepaalSemantiek('lsRek', { lsRekActie: 'vervangen', lsRekType: '12' })
    expect(s.vraag_key).toBe('lsrek_actie_type')
    expect(s.gekozen_antwoord).toBe('vervangen / 12 richtingen')
  })

  it('herkent RMU merk + configuratiecode', () => {
    const s = bepaalSemantiek('rmu', { rmuMerk: 'Magnefix', rmuConfig: { code: 'FCVC' } })
    expect(s.vraag_key).toBe('rmu_merk_config')
    expect(s.gekozen_antwoord).toBe('Magnefix / FCVC')
  })

  it('herkent trafo vermogen', () => {
    const s = bepaalSemantiek('trafo', { trafoActie: 'nieuw', trafoKva: '630' })
    expect(s.gekozen_antwoord).toContain('630 kVA')
  })

  it('geeft lege semantiek terug zonder config', () => {
    const s = bepaalSemantiek('lsRek', null)
    expect(s.vraag_key).toBeNull()
    expect(s.gekozen_antwoord).toBeNull()
  })
})

describe('bouwContextKey', () => {
  const base = {
    case_type: 'compact_prov',
    sub_type: 'renovatie_prov',
    sectie: 'lsRek',
    bron_tabel: 'ls_rek_regels',
    bron_id: 'r1',
    actie: 'hoeveelheid_gewijzigd',
    artikel_nummer: '20000001',
  }

  it('verschillende gekozen antwoorden geven verschillende keys (LS-rek 8 vs 12)', () => {
    const a = bouwContextKey({ ...base, sectie_key: 'lsRek', vraag_key: 'lsrek_actie_type', gekozen_antwoord: 'vervangen / 8 richtingen' })
    const b = bouwContextKey({ ...base, sectie_key: 'lsRek', vraag_key: 'lsrek_actie_type', gekozen_antwoord: 'vervangen / 12 richtingen' })
    expect(a).not.toBe(b)
  })

  it('RMU Magnefix vs ABB geven verschillende keys', () => {
    const a = bouwContextKey({ ...base, sectie: 'rmu', sectie_key: 'rmu', vraag_key: 'rmu_merk_config', gekozen_antwoord: 'Magnefix / FCVC' })
    const b = bouwContextKey({ ...base, sectie: 'rmu', sectie_key: 'rmu', vraag_key: 'rmu_merk_config', gekozen_antwoord: 'ABB / FCVC' })
    expect(a).not.toBe(b)
  })

  it('gelijke context geeft gelijke key', () => {
    const a = bouwContextKey({ ...base, sectie_key: 'lsRek', vraag_key: 'lsrek_actie_type', gekozen_antwoord: 'vervangen / 12 richtingen' })
    const b = bouwContextKey({ ...base, sectie_key: 'lsRek', vraag_key: 'lsrek_actie_type', gekozen_antwoord: 'vervangen / 12 richtingen' })
    expect(a).toBe(b)
  })
})

describe('bouwCorrectieContext', () => {
  it('vult semantische velden en context_volledig wanneer config aanwezig', () => {
    const c = bouwCorrectieContext({
      caseType: 'compact_prov',
      subType: 'renovatie_prov',
      actie: 'hoeveelheid_gewijzigd',
      artikelNummer: '20000001',
      sectie: 'lsRek',
      bronTabel: 'ls_rek_regels',
      bronId: 'r1',
      meerdereBronnen: false,
      bijdragen: null,
      configSnapshot: { lsRekActie: 'vervangen', lsRekType: '12', subType: 'renovatie_prov' },
      oudeHoeveelheid: 8,
      nieuweHoeveelheid: 12,
    })
    expect(c.vraag_key).toBe('lsrek_actie_type')
    expect(c.gekozen_antwoord).toBe('vervangen / 12 richtingen')
    expect(c.context_volledig).toBe(true)
    expect(c.leesbare_zin).toContain('LS-rek')
    expect(c.leesbare_zin).toContain('12')
    expect(c.leesbare_zin).toContain('20000001')
  })

  it('markeert context_volledig=false wanneer semantiek ontbreekt', () => {
    const c = bouwCorrectieContext({
      caseType: 'NSA',
      subType: 'renovatie_nsa',
      actie: 'verwijderd',
      artikelNummer: '20000002',
      sectie: null,
      meerdereBronnen: false,
      configSnapshot: null,
    })
    expect(c.context_volledig).toBe(false)
    expect(c.vraag_key).toBeNull()
  })

  it('respecteert meerdere_bronnen vlag', () => {
    const c = bouwCorrectieContext({
      caseType: 'NSA',
      subType: 'renovatie_nsa',
      actie: 'hoeveelheid_gewijzigd',
      artikelNummer: '20000003',
      sectie: 'rmu',
      meerdereBronnen: true,
      configSnapshot: { rmuMerk: 'ABB' },
    })
    expect(c.meerdere_bronnen).toBe(true)
  })
})
