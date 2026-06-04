import { describe, it, expect } from 'vitest'
import { bepaalSemantiek, bouwCorrectieContext } from './context'
import { bouwContextKey } from './types'

describe('bepaalSemantiek', () => {
  it('herkent LS-rek basis vraag/antwoord uit configuratie', () => {
    const s = bepaalSemantiek('lsRek', { lsRekActie: 'vervangen', lsRekType: '12' })
    expect(s.vraag_key).toBe('lsrek_volledig')
    expect(s.gekozen_antwoord).toContain('vervangen/12r')
    expect(s.gekozen_antwoord).toContain('geen-mof')
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

describe('bepaalSemantiek LS-rek details', () => {
  const base = { lsRekActie: 'vervangen' as const }

  it('onderscheidt 8 vs 12 richtingen', () => {
    const a = bepaalSemantiek('lsRek', { ...base, lsRekType: '8' }).gekozen_antwoord
    const b = bepaalSemantiek('lsRek', { ...base, lsRekType: '12' }).gekozen_antwoord
    expect(a).not.toBe(b)
    expect(a).toContain('8r')
    expect(b).toContain('12r')
  })

  it('onderscheidt vervangen vs gehandhaafd', () => {
    const a = bepaalSemantiek('lsRek', { lsRekActie: 'vervangen', lsRekType: '12' }).gekozen_antwoord
    const b = bepaalSemantiek('lsRek', { lsRekActie: 'gehandhaafd', lsRekType: '12' }).gekozen_antwoord
    expect(a).not.toBe(b)
  })

  it('onderscheidt OV-stuurpunt ja vs nee', () => {
    const a = bepaalSemantiek('lsRek', { ...base, lsRekType: '12', lsRekOvStuurpunt: true }).gekozen_antwoord
    const b = bepaalSemantiek('lsRek', { ...base, lsRekType: '12', lsRekOvStuurpunt: false }).gekozen_antwoord
    expect(a).not.toBe(b)
    expect(a).toContain('+OV')
    expect(b).not.toContain('+OV')
  })

  it('onderscheidt LS-mof ja vs nee', () => {
    const ja = bepaalSemantiek('lsRek', {
      ...base,
      lsRekType: '12',
      lsMoffenActief: true,
      lsMoffen: [{ type: 'aftakmof', bestaandType: '4x150AL', aantal: 1, kanZwaaien: true }],
    }).gekozen_antwoord
    const nee = bepaalSemantiek('lsRek', { ...base, lsRekType: '12', lsMoffenActief: false }).gekozen_antwoord
    expect(ja).not.toBe(nee)
    expect(ja).toContain('mof')
    expect(nee).toContain('geen-mof')
  })

  it('onderscheidt verschillende mof-types', () => {
    const a = bepaalSemantiek('lsRek', {
      ...base,
      lsRekType: '12',
      lsMoffenActief: true,
      lsMoffen: [{ type: 'aftakmof', bestaandType: '4x150AL', aantal: 1, kanZwaaien: true }],
    }).gekozen_antwoord
    const b = bepaalSemantiek('lsRek', {
      ...base,
      lsRekType: '12',
      lsMoffenActief: true,
      lsMoffen: [{ type: 'rechte mof', bestaandType: '4x150AL', aantal: 1, kanZwaaien: true }],
    }).gekozen_antwoord
    expect(a).not.toBe(b)
  })

  it('onderscheidt kabel omzwaaien ja vs nee', () => {
    const ja = bepaalSemantiek('lsRek', {
      ...base,
      lsRekType: '12',
      lsMoffenActief: true,
      lsMoffen: [{ type: 'aftakmof', bestaandType: '4x150AL', aantal: 1, kanZwaaien: true }],
    }).gekozen_antwoord
    const nee = bepaalSemantiek('lsRek', {
      ...base,
      lsRekType: '12',
      lsMoffenActief: true,
      lsMoffen: [{ type: 'aftakmof', bestaandType: '4x150AL', aantal: 1, kanZwaaien: false, opnieuwAantal: 1 }],
    }).gekozen_antwoord
    expect(ja).not.toBe(nee)
    expect(ja).toContain('zwaai-ja')
    expect(nee).toContain('zwaai-nee')
  })

  it('onderscheidt beveiliging-aanpassen en schroefpatroon', () => {
    const a = bepaalSemantiek('lsRek', {
      ...base,
      lsRekType: '12',
      lsRekBeveiligingAanpassen: true,
      lsRekSchroefpatroon: '35A',
    }).gekozen_antwoord
    const b = bepaalSemantiek('lsRek', {
      ...base,
      lsRekType: '12',
      lsRekBeveiligingAanpassen: true,
      lsRekSchroefpatroon: '50A',
    }).gekozen_antwoord
    expect(a).not.toBe(b)
    expect(a).toContain('bev-aanp')
    expect(a).toContain('35A')
    expect(b).toContain('50A')
  })

  it('herkent LS-kabel trace zonder mof', () => {
    const s = bepaalSemantiek('lsRek', {
      lsRekActie: 'gehandhaafd',
      lsKabelTraces: [{ lengteMeters: 25 }],
    })
    expect(s.vraag_key).toBe('lsrek_volledig')
    expect(s.gekozen_antwoord).toContain('trace×1')
  })

  it('zet context_volledig=true alleen bij echte LS-rek context', () => {
    const leeg = bepaalSemantiek('lsRek', {})
    expect(leeg.vraag_key).toBeNull()
    const ok = bepaalSemantiek('lsRek', { lsRekActie: 'vervangen', lsRekType: '12' })
    expect(ok.vraag_key).toBe('lsrek_volledig')
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
    const a = bouwContextKey({ ...base, sectie_key: 'lsRek', vraag_key: 'lsrek_volledig', gekozen_antwoord: 'vervangen/8r / geen-mof' })
    const b = bouwContextKey({ ...base, sectie_key: 'lsRek', vraag_key: 'lsrek_volledig', gekozen_antwoord: 'vervangen/12r / geen-mof' })
    expect(a).not.toBe(b)
  })

  it('RMU Magnefix vs ABB geven verschillende keys', () => {
    const a = bouwContextKey({ ...base, sectie: 'rmu', sectie_key: 'rmu', vraag_key: 'rmu_merk_config', gekozen_antwoord: 'Magnefix / FCVC' })
    const b = bouwContextKey({ ...base, sectie: 'rmu', sectie_key: 'rmu', vraag_key: 'rmu_merk_config', gekozen_antwoord: 'ABB / FCVC' })
    expect(a).not.toBe(b)
  })

  it('gelijke context geeft gelijke key', () => {
    const a = bouwContextKey({ ...base, sectie_key: 'lsRek', vraag_key: 'lsrek_volledig', gekozen_antwoord: 'vervangen/12r / geen-mof' })
    const b = bouwContextKey({ ...base, sectie_key: 'lsRek', vraag_key: 'lsrek_volledig', gekozen_antwoord: 'vervangen/12r / geen-mof' })
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
    expect(c.vraag_key).toBe('lsrek_volledig')
    expect(c.gekozen_antwoord).toContain('vervangen/12r')
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

describe('bepaalSemantiek RMU details', () => {
  const baseCfg = {
    rmuMerk: 'Magnefix',
    rmuConfig: { code: 'FCVC', aantal_velden: 4, aantal_f: 1, aantal_c: 2, aantal_v: 1 },
    rmuInet: 'ja',
    trafoKva: '630',
    rmuVelden: [
      { veldType: 'C', veldNummer: 1, kabelType: '240AL', isReserve: false },
      { veldType: 'V', veldNummer: 1, kabelType: '630AL', isReserve: false },
    ],
  }

  it('onderscheidt ABB vs Magnefix', () => {
    const a = bepaalSemantiek('rmu', { ...baseCfg, rmuMerk: 'ABB' }).gekozen_antwoord
    const b = bepaalSemantiek('rmu', { ...baseCfg, rmuMerk: 'Magnefix' }).gekozen_antwoord
    expect(a).not.toBe(b)
    expect(a).toContain('ABB')
    expect(b).toContain('Magnefix')
  })

  it('onderscheidt configuratiecode FCVC vs KKKT', () => {
    const a = bepaalSemantiek('rmu', { ...baseCfg, rmuConfig: { code: 'FCVC' } }).gekozen_antwoord
    const b = bepaalSemantiek('rmu', { ...baseCfg, rmuConfig: { code: 'KKKT' } }).gekozen_antwoord
    expect(a).not.toBe(b)
  })

  it('onderscheidt iNet ja vs nee', () => {
    const a = bepaalSemantiek('rmu', { ...baseCfg, rmuInet: 'ja' }).gekozen_antwoord
    const b = bepaalSemantiek('rmu', { ...baseCfg, rmuInet: 'nee' }).gekozen_antwoord
    expect(a).not.toBe(b)
    expect(a).toContain('iNet-ja')
    expect(b).toContain('iNet-nee')
  })

  it('onderscheidt veld C vs veld V uit veldregel herkomst', () => {
    const a = bepaalSemantiek('rmu', baseCfg, {
      bronTabel: 'rmu_veld_regels',
      bronHerkomst: 'RMU velden C veld 1',
    }).gekozen_antwoord
    const b = bepaalSemantiek('rmu', baseCfg, {
      bronTabel: 'rmu_veld_regels',
      bronHerkomst: 'RMU velden V veld 1',
    }).gekozen_antwoord
    expect(a).not.toBe(b)
    expect(a).toContain('veld-C')
    expect(b).toContain('veld-V')
  })

  it('veldregel: context_volledig=true bij merk/config/veld bekend', () => {
    const s = bepaalSemantiek('rmu', baseCfg, {
      bronTabel: 'rmu_veld_regels',
      bronHerkomst: 'RMU velden C veld 1',
    })
    expect(s.vraag_key).toBe('rmu_veld_regel')
    expect(s.gekozen_antwoord).not.toBeNull()
    expect(s.gekozen_antwoord).toContain('240AL')
  })

  it('veldregel zonder veld-info → gekozen_antwoord=null (context onvolledig)', () => {
    const s = bepaalSemantiek('rmu', baseCfg, {
      bronTabel: 'rmu_veld_regels',
      bronHerkomst: 'iets zonder veldinfo',
    })
    expect(s.vraag_key).toBe('rmu_veld_regel')
    expect(s.gekozen_antwoord).toBeNull()
  })

  it('zonder merk én config → empty (context_volledig=false)', () => {
    const s = bepaalSemantiek('rmu', { rmuInet: 'ja' })
    expect(s.vraag_key).toBeNull()
  })

  it('bestaande simpele rmu test blijft compatibel', () => {
    const s = bepaalSemantiek('rmu', { rmuMerk: 'Magnefix', rmuConfig: { code: 'FCVC' } })
    expect(s.vraag_key).toBe('rmu_merk_config')
    expect(s.gekozen_antwoord).toBe('Magnefix / FCVC')
  })

  it('zekering bron met kVA krijgt rmu_zekering context', () => {
    const s = bepaalSemantiek('rmu', baseCfg, { bronTabel: 'rmu_zekeringen' })
    expect(s.vraag_key).toBe('rmu_zekering')
    expect(s.gekozen_antwoord).toContain('trafo-630kVA')
  })
})

