import type { PreviewItem } from '@/lib/configurator/types'
import type { CorrectieActie, CorrectieContext } from './types'

/** Lijst van top-level configuratievelden die we NIET als snapshot meenemen —
 *  dit zijn grote sub-objecten die alleen ruis opleveren in groepering. */
const SNAPSHOT_BLACKLIST = new Set([
  'msRichtingen',
  'lsMoffen',
  'rmuConfig',
  'provRmuConfig',
])

/** Bouw een compacte snapshot van de relevante top-level configuratievelden. */
function bouwConfigFields(
  config: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!config) return null
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(config)) {
    if (SNAPSHOT_BLACKLIST.has(k)) continue
    if (v === null || v === undefined) continue
    if (typeof v === 'object') continue
    out[k] = v
  }
  return Object.keys(out).length ? out : null
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

  return {
    case_type: args.caseType,
    sub_type: args.subType,
    sectie,
    vraag_of_bron: herkomst,
    herkomst,
    gekozen_waarden: fields,
    artikel_nummer: artikelNummer,
    actie: args.actie,
    bron_tabel: tabel,
    bron_id: id,
    meerdere_bronnen: meerdere,
    bijdragen,
    config_fields: fields,
  }
}
