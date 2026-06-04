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
      const inet = pickStr(config, 'rmuInet')
      if (!merk && !code) return empty
      return {
        sectie_key,
        sectie_label,
        vraag_key: 'rmu_merk_config',
        vraag_label: 'RMU merk + configuratie',
        gekozen_antwoord: [merk, code].filter(Boolean).join(' / '),
        relevante_config: { rmuMerk: merk, rmuConfigCode: code, rmuInet: inet },
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
    case 'msVerbindingen': {
      const richtingen = Array.isArray(config.msRichtingen) ? (config.msRichtingen as unknown[]).length : 0
      if (richtingen === 0) return empty
      return {
        sectie_key,
        sectie_label,
        vraag_key: 'ms_aantal_richtingen',
        vraag_label: 'MS aantal richtingen',
        gekozen_antwoord: `${richtingen} richting${richtingen === 1 ? '' : 'en'}`,
        relevante_config: { aantal_richtingen: richtingen },
      }
    }
    case 'lsVerbindingen': {
      const aantal = Array.isArray(config.lsMoffen) ? (config.lsMoffen as unknown[]).length : 0
      if (aantal === 0) return empty
      return {
        sectie_key,
        sectie_label,
        vraag_key: 'ls_aantal_moffen',
        vraag_label: 'LS aantal moffen',
        gekozen_antwoord: `${aantal} mof${aantal === 1 ? '' : 'fen'}`,
        relevante_config: { aantal_ls_moffen: aantal },
      }
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
  const semantiek = bepaalSemantiek(sectie, args.configSnapshot ?? null)
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
