import type { PreviewItem } from '@/lib/configurator/types'
import type { CorrectieActie, CorrectieContext } from './types'

/** Top-level configuratievelden die we NIET als blinde snapshot meenemen —
 *  dit zijn grote sub-objecten die alleen ruis opleveren in groepering. */
const SNAPSHOT_BLACKLIST = new Set([
  'msRichtingen',
  'lsMoffen',
  'rmuConfig',
  'provRmuConfig',
  'msKabelTraces',
  'lsKabelTraces',
  'rmuVelden',
  'provRmuVelden',
  'iNetArtikelen',
  'lsRekBeveiligingen',
])

const CASE_TYPE_LABELS: Record<string, string> = {
  NSA: 'NSA',
  nsa: 'NSA',
  provisorium: 'Provisorium',
  compact: 'Compact',
  compact_prov: 'Compact met Provisorium',
}

const SUB_TYPE_LABELS: Record<string, string> = {
  cs_zonder_prov: 'CS zonder prov.',
  cs_met_prov: 'CS met prov.',
  renovatie_prov: 'Renovatie prov.',
  renovatie_nsa: 'Renovatie NSA',
}

const SECTIE_LABELS: Record<string, string> = {
  standaard: 'Standaard materialen',
  provisorium: 'Provisorium',
  rmu: 'RMU',
  trafo: 'Trafo',
  vultKabel: 'Vult kabel',
  lsRek: 'LS-rek',
  msVerbindingen: 'MS verbindingen',
  lsVerbindingen: 'LS verbindingen',
  ggi: 'GGI',
}

/** Snapshot van top-level configuratievelden (scalairen). */
function bouwConfigFields(
  config: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!config) return null
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(config)) {
    if (SNAPSHOT_BLACKLIST.has(k)) continue
    if (v === null || v === undefined || v === '') continue
    if (typeof v === 'object') continue
    out[k] = v
  }
  return Object.keys(out).length ? out : null
}

export interface Semantiek {
  sectie_key: string | null
  sectie_label: string | null
  vraag_key: string | null
  vraag_label: string | null
  gekozen_antwoord: string | null
  relevante_config: Record<string, unknown> | null
}

function pickStr(c: Record<string, unknown> | null | undefined, k: string): string | null {
  if (!c) return null
  const v = c[k]
  if (v == null || v === '') return null
  return String(v)
}

function pickObj(c: Record<string, unknown> | null | undefined, k: string): Record<string, unknown> | null {
  if (!c) return null
  const v = c[k]
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
}

export interface SemantiekExtra {
  bronTabel?: string | null
  bronHerkomst?: string | null
  artikelNummer?: string | null
}

/** Lengtecategorie om versnippering te voorkomen. */
function lengteCategorie(meters: number | null | undefined): string | null {
  if (meters == null) return null
  const m = Number(meters)
  if (!Number.isFinite(m) || m < 0) return null
  if (m === 0) return '0m'
  if (m <= 10) return '1-10m'
  if (m <= 25) return '11-25m'
  if (m <= 50) return '26-50m'
  return '>50m'
}

const MOF_SOORT_MAP: Record<string, string> = {
  verbinding: 'verbindingsmof',
  verbindingsmof: 'verbindingsmof',
  aftakmof: 'aftakmof',
  aftak: 'aftakmof',
  eindmof: 'eindmof',
  eind: 'eindmof',
  'rechte mof': 'verbindingsmof',
  rechtemof: 'verbindingsmof',
}

function normaliseerMofSoort(s: string | null | undefined): string | null {
  if (!s) return null
  const key = String(s).toLowerCase().trim()
  if (MOF_SOORT_MAP[key]) return MOF_SOORT_MAP[key]
  if (/aftak/.test(key)) return 'aftakmof'
  if (/eind/.test(key)) return 'eindmof'
  if (/verbind|recht/.test(key)) return 'verbindingsmof'
  return null
}

const MS_KABEL_TOKENS = ['3x240AL', '3x150AL', '3x95AL', '240AL_singel', '630AL_singel', '240AL', '630AL']
const LS_KABEL_TOKENS = ['4x150AL', '4x95AL', '4x50AL', '4x25AL', 'GPLK', 'kunststof']

function detectKabelType(s: string | null | undefined, lijst: string[]): string | null {
  if (!s) return null
  for (const k of lijst) {
    const re = new RegExp(k.replace(/[+]/g, '\\+'), 'i')
    if (re.test(s)) return k
  }
  return null
}

interface VerbindingenExtra {
  bronTabel?: string | null
  bronHerkomst?: string | null
  artikelNummer?: string | null
}

function emptySemantiek(sectie_key: string | null, sectie_label: string | null): Semantiek {
  return {
    sectie_key,
    sectie_label,
    vraag_key: null,
    vraag_label: null,
    gekozen_antwoord: null,
    relevante_config: null,
  }
}

function semantiekVerbindingen(
  sectie: 'msVerbindingen' | 'lsVerbindingen',
  sectie_key: string | null,
  sectie_label: string | null,
  config: Record<string, unknown>,
  extra: VerbindingenExtra,
): Semantiek {
  const isMs = sectie === 'msVerbindingen'
  const prefix = isMs ? 'ms' : 'ls'
  const bronTabel = extra.bronTabel ?? null
  const herk = extra.bronHerkomst ?? null

  const isMof =
    bronTabel === 'ms_mof_materialen' ||
    bronTabel === 'ls_mof_materialen' ||
    /mof/i.test(herk ?? '')
  const isTrace =
    bronTabel === 'ms_kabel_regels' ||
    (!isMof && /trace|kabel/i.test(herk ?? ''))

  const kabelLijst = isMs ? MS_KABEL_TOKENS : LS_KABEL_TOKENS

  if (!isMs && isMof) {
    const moffen = Array.isArray(config.lsMoffen)
      ? (config.lsMoffen as Array<Record<string, unknown>>)
      : []
    let mof: Record<string, unknown> | null = null
    if (moffen.length === 1) mof = moffen[0]
    if (!mof && herk) {
      const mIdx = herk.match(/mof\s*(\d+)/i)
      if (mIdx) mof = moffen[Number(mIdx[1]) - 1] ?? null
    }
    const soort =
      normaliseerMofSoort(mof ? String(mof.type ?? '') : null) ??
      normaliseerMofSoort(herk)
    const bestaand =
      (mof && mof.bestaandType ? String(mof.bestaandType) : '') ||
      detectKabelType(herk, LS_KABEL_TOKENS) ||
      null
    const kanZwaaien =
      mof && typeof mof.kanZwaaien === 'boolean' ? (mof.kanZwaaien as boolean) : null
    const lengte = mof ? Number(mof.kabelLengteMeters) : NaN
    const cat = lengteCategorie(Number.isFinite(lengte) ? lengte : null)

    if (!soort && !bestaand) return emptySemantiek(sectie_key, sectie_label)
    const tokens = [prefix, 'mof']
    if (soort) tokens.push(soort)
    if (bestaand) tokens.push(bestaand)
    if (kanZwaaien === true) tokens.push('zwaai-ja')
    else if (kanZwaaien === false) tokens.push('zwaai-nee')
    if (cat) tokens.push(cat)
    const compleet = !!soort && !!bestaand
    return {
      sectie_key,
      sectie_label,
      vraag_key: 'ls_mof_context',
      vraag_label: 'LS mof context',
      gekozen_antwoord: compleet ? tokens.join('/') : null,
      relevante_config: {
        mofSoort: soort,
        bestaandKabel: bestaand,
        kanZwaaien,
        lengteCategorie: cat,
        bronTabel,
      },
    }
  }

  if (isMs && isMof) {
    const richtingen = Array.isArray(config.msRichtingen)
      ? (config.msRichtingen as Array<Record<string, unknown>>)
      : []
    const traces = Array.isArray(config.msKabelTraces)
      ? (config.msKabelTraces as Array<Record<string, unknown>>)
      : []
    let r: Record<string, unknown> | null = null
    if (richtingen.length === 1) r = richtingen[0]
    if (!r && herk) {
      const mIdx = herk.match(/richting\s*(\d+)/i)
      if (mIdx) r = richtingen[Number(mIdx[1]) - 1] ?? null
    }
    const mofCfg = (r?.mofTijdelijk ?? null) as Record<string, unknown> | null
    const isEind = mofCfg?.isEindmof === true
    const soortHerk = normaliseerMofSoort(herk)
    const soort = isEind ? 'eindmof' : soortHerk ?? 'verbindingsmof'
    const nieuw =
      (mofCfg && mofCfg.nieuwType ? String(mofCfg.nieuwType) : '') ||
      detectKabelType(herk, MS_KABEL_TOKENS) ||
      null
    const bestaand = (mofCfg && mofCfg.bestaandType ? String(mofCfg.bestaandType) : '') || null
    const traceId = r?.kabelTraceId ? String(r.kabelTraceId) : null
    const trace = traceId ? traces.find((t) => String(t.id) === traceId) ?? null : null
    const cat = lengteCategorie(trace ? Number(trace.lengteMeters) : null)

    if (!nieuw && !bestaand && !soortHerk && !isEind) {
      return emptySemantiek(sectie_key, sectie_label)
    }
    const tokens = [prefix, 'mof', soort]
    if (nieuw) tokens.push(nieuw)
    if (bestaand) tokens.push(`op-${bestaand}`)
    if (cat) tokens.push(cat)
    const compleet = !!(nieuw || bestaand)
    return {
      sectie_key,
      sectie_label,
      vraag_key: 'ms_mof_context',
      vraag_label: 'MS mof context',
      gekozen_antwoord: compleet ? tokens.join('/') : null,
      relevante_config: {
        mofSoort: soort,
        nieuwKabel: nieuw,
        bestaandKabel: bestaand,
        lengteCategorie: cat,
        bronTabel,
      },
    }
  }

  if (isTrace) {
    const tracesRaw = isMs
      ? (Array.isArray(config.msKabelTraces) ? (config.msKabelTraces as Array<Record<string, unknown>>) : [])
      : (Array.isArray(config.lsKabelTraces) ? (config.lsKabelTraces as Array<Record<string, unknown>>) : [])
    let t: Record<string, unknown> | null = null
    if (tracesRaw.length === 1) t = tracesRaw[0]
    if (!t && herk) {
      const mIdx = herk.match(/trace\s*(\d+)/i)
      if (mIdx) t = tracesRaw[Number(mIdx[1]) - 1] ?? null
    }
    const kabel =
      (t && t.kabelType ? String(t.kabelType) : null) ||
      detectKabelType(herk, kabelLijst) ||
      null
    const lengte = t ? Number(t.lengteMeters) : NaN
    const cat = lengteCategorie(Number.isFinite(lengte) ? lengte : null)
    if (!kabel && !cat) return emptySemantiek(sectie_key, sectie_label)
    const tokens = [prefix, 'trace']
    if (kabel) tokens.push(kabel)
    if (cat) tokens.push(cat)
    const compleet = !!kabel
    return {
      sectie_key,
      sectie_label,
      vraag_key: isMs ? 'ms_trace_context' : 'ls_trace_context',
      vraag_label: isMs ? 'MS kabeltrace' : 'LS kabeltrace',
      gekozen_antwoord: compleet ? tokens.join('/') : null,
      relevante_config: { kabelType: kabel, lengteCategorie: cat, bronTabel },
    }
  }

  // Fallback: legacy korte semantiek (geen bron-info)
  if (isMs) {
    const richtingen = Array.isArray(config.msRichtingen) ? (config.msRichtingen as unknown[]).length : 0
    if (richtingen === 0) return emptySemantiek(sectie_key, sectie_label)
    return {
      sectie_key,
      sectie_label,
      vraag_key: 'ms_aantal_richtingen',
      vraag_label: 'MS aantal richtingen',
      gekozen_antwoord: `${richtingen} richting${richtingen === 1 ? '' : 'en'}`,
      relevante_config: { aantal_richtingen: richtingen },
    }
  }
  const aantal = Array.isArray(config.lsMoffen) ? (config.lsMoffen as unknown[]).length : 0
  if (aantal === 0) return emptySemantiek(sectie_key, sectie_label)
  return {
    sectie_key,
    sectie_label,
    vraag_key: 'ls_aantal_moffen',
    vraag_label: 'LS aantal moffen',
    gekozen_antwoord: `${aantal} mof${aantal === 1 ? '' : 'fen'}`,
    relevante_config: { aantal_ls_moffen: aantal },
  }
}


/** Bepaal sectie/vraag/antwoord op basis van sectie + config snapshot.
 *  Geeft null wanneer er onvoldoende context is om semantisch te groeperen.
 *  `extra` mag bron-info bevatten zodat per-bronregel semantiek (zoals RMU
 *  veldregels) verfijnd kan worden. */
export function bepaalSemantiek(
  sectie: string | null,
  config: Record<string, unknown> | null | undefined,
  extra?: SemantiekExtra,
): Semantiek {
  const sectie_key = sectie ?? null
  const sectie_label = sectie ? SECTIE_LABELS[sectie] ?? sectie : null

  const empty: Semantiek = {
    sectie_key,
    sectie_label,
    vraag_key: null,
    vraag_label: null,
    gekozen_antwoord: null,
    relevante_config: null,
  }
  if (!sectie || !config) return empty

  switch (sectie) {
    case 'lsRek': {
      const actie = pickStr(config, 'lsRekActie')
      const type = pickStr(config, 'lsRekType')
      const schroef = pickStr(config, 'lsRekSchroefpatroon')
      const bevAanp = config.lsRekBeveiligingAanpassen === true
      const ov = config.lsRekOvStuurpunt === true
      const extraStroken = Number(config.lsRekExtraStroken ?? 0)
      const aansluitKabels = Number(config.lsRekAanSluitenKabels ?? 0)
      const aantalBev = Number(config.lsRekAantalBeveiligingen ?? 0)
      const bevArtikelen = Array.isArray(config.lsRekBeveiligingen)
        ? (config.lsRekBeveiligingen as unknown[]).filter((x) => typeof x === 'string' && x).length
        : 0

      const moffenActief = config.lsMoffenActief === true
      const lsMoffenRaw = Array.isArray(config.lsMoffen) ? (config.lsMoffen as Array<Record<string, unknown>>) : []
      const moffen = moffenActief ? lsMoffenRaw : []
      const aantalMoffen = moffen.reduce((s, m) => s + (Number(m.aantal) || 0), 0)
      const mofTypes = Array.from(new Set(moffen.map((m) => String(m.type ?? '')).filter(Boolean))).sort()
      const bestaandeTypes = Array.from(new Set(moffen.map((m) => String(m.bestaandType ?? '')).filter(Boolean))).sort()
      const heeftZwaaiNee = moffen.some((m) => m.kanZwaaien === false)
      const heeftZwaaiJa = moffen.some((m) => m.kanZwaaien === true)
      const opnieuwMax = moffen.reduce((s, m) => Math.max(s, Number(m.opnieuwAantal) || 0), 0)
      const kabelMeters = moffen.reduce((s, m) => s + (Number(m.kabelLengteMeters) || 0), 0)

      const tracesRaw = Array.isArray(config.lsKabelTraces) ? (config.lsKabelTraces as Array<Record<string, unknown>>) : []
      const traces = tracesRaw.filter((t) => Number(t.lengteMeters) > 0)

      if (!actie && !type && !moffenActief && traces.length === 0) return empty

      // Compact maar onderscheidend antwoord. Volgorde: basis → schroef/OV → moffen → trace.
      const parts: string[] = []
      if (actie || type) parts.push([actie, type ? `${type}r` : null].filter(Boolean).join('/'))
      if (schroef) parts.push(schroef)
      if (bevAanp) parts.push('bev-aanp')
      if (ov) parts.push('+OV')
      if (extraStroken > 0) parts.push('+stroken')
      if (aansluitKabels > 0) parts.push('+aansluitk')
      if (aantalBev > 0 || bevArtikelen > 0) parts.push(`mespatroon×${aantalBev || bevArtikelen}`)
      if (moffenActief) {
        const mofToken = [
          'mof',
          mofTypes.length ? mofTypes.join('+') : null,
          bestaandeTypes.length ? `op ${bestaandeTypes.join('+')}` : null,
          heeftZwaaiNee ? 'zwaai-nee' : heeftZwaaiJa ? 'zwaai-ja' : null,
        ]
          .filter(Boolean)
          .join(' ')
        parts.push(mofToken)
      } else {
        parts.push('geen-mof')
      }
      if (traces.length > 0) parts.push(`trace×${traces.length}`)

      const gekozen_antwoord = parts.join(' / ')

      return {
        sectie_key,
        sectie_label,
        vraag_key: 'lsrek_volledig',
        vraag_label: 'LS-rek configuratie',
        gekozen_antwoord,
        relevante_config: {
          lsRekActie: actie,
          lsRekType: type,
          lsRekSchroefpatroon: schroef,
          lsRekBeveiligingAanpassen: bevAanp,
          lsRekOvStuurpunt: ov,
          lsRekExtraStroken: extraStroken,
          lsRekAanSluitenKabels: aansluitKabels,
          lsRekAantalBeveiligingen: aantalBev,
          lsRekAantalBeveiligingArtikelen: bevArtikelen,
          lsMoffenActief: moffenActief,
          lsMofTypes: mofTypes,
          lsMofBestaandeTypes: bestaandeTypes,
          lsMofAantal: aantalMoffen,
          lsMofKanZwaaien: heeftZwaaiNee ? false : heeftZwaaiJa ? true : null,
          lsMofOpnieuwAantalMax: opnieuwMax,
          lsMofKabelMetersTotaal: kabelMeters,
          lsKabelTracesAantal: traces.length,
          lsKabelTracesMetersTotaal: traces.reduce((s, t) => s + (Number(t.lengteMeters) || 0), 0),
        },
      }
    }
    case 'rmu': {
      const merk = pickStr(config, 'rmuMerk')
      const rmuConfig = pickObj(config, 'rmuConfig')
      const code = rmuConfig ? pickStr(rmuConfig, 'code') : null
      const aantalVelden = rmuConfig ? Number(rmuConfig.aantal_velden ?? 0) : 0
      const aantalF = rmuConfig ? Number(rmuConfig.aantal_f ?? 0) : 0
      const aantalC = rmuConfig ? Number(rmuConfig.aantal_c ?? 0) : 0
      const aantalV = rmuConfig ? Number(rmuConfig.aantal_v ?? 0) : 0
      const inetStr = pickStr(config, 'rmuInet')
      const inet = inetStr === 'ja' ? 'ja' : inetStr === 'nee' ? 'nee' : null
      const kva = pickStr(config, 'trafoKva')
      const velden = Array.isArray(config.rmuVelden)
        ? (config.rmuVelden as Array<Record<string, unknown>>)
        : []

      const bronTabel = extra?.bronTabel ?? null
      const herk = extra?.bronHerkomst ?? null
      const isVeldRegel = bronTabel === 'rmu_veld_regels' || bronTabel === 'rmu_veld_artikelen'
      const isZekering = bronTabel === 'rmu_zekeringen'

      // Veldcontext uit herkomst-label
      let veldType: string | null = null
      let veldNummer: number | null = null
      let kabelType: string | null = null
      let isReserve: boolean | null = null
      if (herk) {
        const mNr = herk.match(/veld\s*(\d+)/i)
        if (mNr) veldNummer = Number(mNr[1])
        const mLetter =
          herk.match(/\bveld(?:en)?\s+([FCV])\b/i) ||
          herk.match(/\b([FCV])-veld\b/i) ||
          herk.match(/\(([FCV])\)/)
        if (mLetter) veldType = mLetter[1].toUpperCase()
        const mKabel = herk.match(/(240AL|630AL)/i)
        if (mKabel) kabelType = mKabel[1].toUpperCase()
        if (/\breserve\b/i.test(herk)) isReserve = true
      }
      // Aanvullen vanuit rmuVelden snapshot
      if (veldNummer != null && veldType && velden.length) {
        const found = velden.find(
          (v) =>
            Number(v.veldNummer) === veldNummer &&
            String(v.veldType).toUpperCase() === veldType,
        )
        if (found) {
          kabelType = kabelType ?? (found.kabelType ? String(found.kabelType) || null : null)
          isReserve = isReserve ?? (typeof found.isReserve === 'boolean' ? (found.isReserve as boolean) : null)
        }
      }

      if (!merk && !code) return empty

      const heeftBasis = !!merk && !!code
      const veldContextHerkend = !!(veldType || veldNummer != null || kabelType)
      const useTokenFormat = isVeldRegel || isZekering || !!inet
      const heeftContextVoldoende = heeftBasis && (!isVeldRegel || veldContextHerkend)

      let gekozen_antwoord: string
      if (useTokenFormat) {
        const tokens: string[] = []
        if (merk) tokens.push(merk)
        if (code) tokens.push(code)
        if (aantalVelden) tokens.push(`${aantalVelden}v`)
        if (inet) tokens.push(`iNet-${inet}`)
        if (isVeldRegel) {
          if (veldType) tokens.push(`veld-${veldType}`)
          if (veldNummer != null) tokens.push(`#${veldNummer}`)
          if (kabelType) tokens.push(kabelType)
          if (isReserve) tokens.push('reserve')
          if (!veldContextHerkend) tokens.push('veld-onbekend')
        }
        if (isZekering && kva) tokens.push(`trafo-${kva}kVA`)
        gekozen_antwoord = tokens.join('/')
      } else {
        gekozen_antwoord = [merk, code].filter(Boolean).join(' / ')
      }

      return {
        sectie_key,
        sectie_label,
        vraag_key: isVeldRegel
          ? 'rmu_veld_regel'
          : isZekering
            ? 'rmu_zekering'
            : 'rmu_merk_config',
        vraag_label: isVeldRegel
          ? 'RMU veldregel'
          : isZekering
            ? 'RMU zekering'
            : 'RMU merk + configuratie',
        gekozen_antwoord: heeftContextVoldoende ? gekozen_antwoord : null,
        relevante_config: {
          rmuMerk: merk,
          rmuConfigCode: code,
          rmuAantalVelden: aantalVelden || null,
          rmuAantalF: aantalF || null,
          rmuAantalC: aantalC || null,
          rmuAantalV: aantalV || null,
          rmuInet: inet,
          trafoKva: isZekering ? kva : null,
          veldType,
          veldNummer,
          kabelType,
          isReserve,
          bronTabel,
        },
      }
    }
    case 'trafo':
    case 'vultKabel': {
      const actie = pickStr(config, 'trafoActie')
      const kva = pickStr(config, 'trafoKva')
      const lengte = pickStr(config, 'trafoKabelLengte')
      if (!actie && !kva) return empty
      return {
        sectie_key,
        sectie_label,
        vraag_key: sectie === 'trafo' ? 'trafo_actie_kva' : 'vultkabel_kva_lengte',
        vraag_label: sectie === 'trafo' ? 'Trafo actie + vermogen' : 'Vult-kabel vermogen + lengte',
        gekozen_antwoord: [actie, kva ? `${kva} kVA` : null, lengte ? `${lengte} m` : null]
          .filter(Boolean)
          .join(' / '),
        relevante_config: { trafoActie: actie, trafoKva: kva, trafoKabelLengte: lengte },
      }
    }
    case 'provisorium': {
      const merk = pickStr(config, 'provRmuMerk')
      const provConfig = pickObj(config, 'provRmuConfig')
      const code = provConfig ? pickStr(provConfig, 'code') : null
      const kva = pickStr(config, 'provZekeringKva')
      if (!merk && !code && !kva) return empty
      return {
        sectie_key,
        sectie_label,
        vraag_key: 'prov_rmu_config',
        vraag_label: 'Provisorium RMU + zekering',
        gekozen_antwoord: [merk, code, kva ? `${kva} kVA` : null].filter(Boolean).join(' / '),
        relevante_config: { provRmuMerk: merk, provRmuConfigCode: code, provZekeringKva: kva },
      }
    }
    case 'msVerbindingen':
    case 'lsVerbindingen': {
      return semantiekVerbindingen(sectie, sectie_key, sectie_label, config, extra ?? {})
    }
    case 'ggi': {
      const v = config.ggiVervangen
      if (v == null) return empty
      return {
        sectie_key,
        sectie_label,
        vraag_key: 'ggi_vervangen',
        vraag_label: 'GGI vervangen',
        gekozen_antwoord: v ? 'ja' : 'nee',
        relevante_config: { ggiVervangen: v },
      }
    }
    case 'standaard': {
      const sub = pickStr(config, 'subType')
      if (!sub) return empty
      return {
        sectie_key,
        sectie_label,
        vraag_key: 'sub_type',
        vraag_label: 'Sub type',
        gekozen_antwoord: SUB_TYPE_LABELS[sub] ?? sub,
        relevante_config: { subType: sub },
      }
    }
    default:
      return empty
  }
}

/** Bepaal canonical bron + meerdere_bronnen vlag uit PreviewItem.bijdragen. */
export function bepaalBron(item: PreviewItem) {
  const bijdragen = item.bijdragen ?? []
  const aantal = bijdragen.length
  if (aantal !== 1) {
    return {
      tabel: null as string | null,
      id: null as string | null,
      herkomst: null as string | null,
      meerdere: aantal > 1,
      bijdragen: bijdragen as unknown[],
    }
  }
  const b = bijdragen[0]
  return {
    tabel: b.bronTabel ?? null,
    id: b.bronId ?? null,
    herkomst: b.herkomst ?? null,
    meerdere: false,
    bijdragen: bijdragen as unknown[],
  }
}

/** Bouw een korte, leesbare zin voor beheer-notificaties. */
export function bouwLeesbareZin(args: {
  caseType: string
  subType: string
  semantiek: Semantiek
  artikelNummer: string
  actie: CorrectieActie
  oude?: number | null
  nieuwe?: number | null
}): string {
  const ct = CASE_TYPE_LABELS[args.caseType] ?? args.caseType
  const st = SUB_TYPE_LABELS[args.subType] ?? args.subType
  const head = [ct, st].filter(Boolean).join(' / ')
  const s = args.semantiek
  const ctx = [s.sectie_label, s.vraag_label && s.gekozen_antwoord ? `${s.vraag_label} = ${s.gekozen_antwoord}` : null]
    .filter(Boolean)
    .join(' / ')
  const actieTxt =
    args.actie === 'verwijderd'
      ? `wordt artikel ${args.artikelNummer} vaak verwijderd`
      : args.actie === 'toegevoegd'
        ? `wordt artikel ${args.artikelNummer} vaak handmatig toegevoegd`
        : `wordt artikel ${args.artikelNummer} vaak aangepast van ${args.oude ?? '?'} naar ${args.nieuwe ?? '?'}`
  return `Bij ${head}${ctx ? ` / ${ctx}` : ''} ${actieTxt}.`
}

/** Centrale opbouw van CorrectieContext zodat ieder correctie-pad dezelfde
 *  structuur opslaat. Gebruik altijd dit i.p.v. handmatig objecten maken. */
export function bouwCorrectieContext(args: {
  caseType: string
  subType: string
  actie: CorrectieActie
  item?: PreviewItem | null
  artikelNummer?: string
  sectie?: string | null
  bronTabel?: string | null
  bronId?: string | null
  bronHerkomst?: string | null
  meerdereBronnen?: boolean
  bijdragen?: unknown[] | null
  configSnapshot?: Record<string, unknown> | null
  oudeHoeveelheid?: number | null
  nieuweHoeveelheid?: number | null
}): CorrectieContext {
  const bron = args.item ? bepaalBron(args.item) : null
  const tabel = args.bronTabel ?? bron?.tabel ?? null
  const id = args.bronId ?? bron?.id ?? null
  const herkomst = args.bronHerkomst ?? bron?.herkomst ?? null
  const meerdere = args.meerdereBronnen ?? bron?.meerdere ?? false
  const bijdragen = args.bijdragen ?? bron?.bijdragen ?? null
  const sectie = args.sectie ?? args.item?.sectie ?? null
  const artikelNummer = args.artikelNummer ?? args.item?.artikel_nummer ?? ''
  const fields = bouwConfigFields(args.configSnapshot ?? null)
  const semantiek = bepaalSemantiek(sectie, args.configSnapshot ?? null, {
    bronTabel: tabel,
    bronHerkomst: herkomst,
    artikelNummer,
  })
  const context_volledig = !!(semantiek.vraag_key && semantiek.gekozen_antwoord)
  const leesbare_zin = bouwLeesbareZin({
    caseType: args.caseType,
    subType: args.subType,
    semantiek,
    artikelNummer,
    actie: args.actie,
    oude: args.oudeHoeveelheid,
    nieuwe: args.nieuweHoeveelheid,
  })

  return {
    case_type: args.caseType,
    sub_type: args.subType,
    sectie,
    sectie_key: semantiek.sectie_key,
    sectie_label: semantiek.sectie_label,
    vraag_key: semantiek.vraag_key,
    vraag_label: semantiek.vraag_label,
    gekozen_antwoord: semantiek.gekozen_antwoord,
    relevante_config: semantiek.relevante_config,
    regel_uitleg: herkomst,
    vraag_of_bron: semantiek.vraag_label ?? herkomst,
    herkomst,
    gekozen_waarden: fields,
    artikel_nummer: artikelNummer,
    actie: args.actie,
    bron_tabel: tabel,
    bron_id: id,
    meerdere_bronnen: meerdere,
    bijdragen,
    config_fields: fields,
    context_volledig,
    leesbare_zin,
  }
}
