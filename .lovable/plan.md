## Doel

De maandelijkse Liander-assortimentslijst-sync mag niet stilletjes inactieve artikelen in de winkelwagen of export laten lekken, en moet vooraf laten zien welke beheer-regels geraakt worden, met een veilige (preview-first) manier om naar `alternatief_artikel_nummer` te migreren.

## Scope (wat verandert)

### A. UI/Parser alignment (gap #1)
- `excel.ts`: van hardcoded `SHEET = "Verbruik"` naar export van constante + JSDoc-comment.
- `AssortimentTab.tsx`: UI-tekst aanpassen naar **"Sheet 'Verbruik' wordt ingelezen"**. Inline hint toevoegen dat de Liander-template dit als data-sheet gebruikt.
- Parser-validatie: als sheet `Verbruik` ontbreekt → duidelijke foutmelding met lijst van gevonden sheets (geen stille crash).
- Status-normalisatie in parser (`Actief` / `Uitgelopen` / leeg) zodat sync-laag consistente waarden krijgt.

### B. Impactanalyse vóór "Doorvoeren" (gap #6, #10)
Nieuwe module `src/lib/assortiment/impact.ts`:
- Functie `berekenImpact(uitgelopenIds, gewijzigdIds)` die in parallel telt hoeveel rijen uit elk van de 13 beheer-tabellen + 3 rmu_config kolommen + 3 trafo_vult_kabel kolommen naar deze artikelen verwijzen.
- Resultaat: `{ artikel_id, artikel_nummer, alternatief_artikel_nummer | null, gebruikt_in: { tabel, kolom, count }[] }[]`.

In `AssortimentTab.tsx` na de diff een vierde sectie **"Impact"**:
- Per uitgelopen artikel: rij met `oud → alternatief` (of `geen alternatief`), totaal gebruik, en per-tabel breakdown (uitklap).
- Knop **"Doorvoeren"** wordt geblokkeerd bij >0 hard-impact zonder alternatief tenzij de gebruiker expliciet "ik weet wat ik doe" aanvinkt. Bij wel-alternatief wordt een aparte knop **"Alternatieven migreren"** getoond (zie D).

### C. Inactieve artikelen niet meer naar winkelwagen (gap #3)
- `src/lib/configurator/berekenen/shared.ts` — `makeFindArtNr` & `add()`:
  - Negeer artikelen met `actief === false`.
  - Console-warn in dev (`import.meta.env.DEV`) met artikelnummer + sectie/herkomst (label doorgeven via `add()`).
  - Markeer het preview-item met `inactief: true` op `PreviewItem` (nieuw veld), zodat de winkelwagen-rij visueel een waarschuwing kan tonen.
- `src/components/winkelwagen/Winkelwagen.tsx`: bij `item.inactief` een amber badge "Inactief artikel" en tooltip "Dit artikel komt niet meer voor in de huidige Liander-template".
- `src/lib/configurator/queries.ts`: artikelen-query niet filteren op `actief` (we hebben de inactieve nodig om correct te kunnen waarschuwen i.p.v. ze stil weg te laten); de gate gebeurt in `add()`.

### D. Veilige alternatief-migratie (gap #2)
Nieuwe module `src/lib/assortiment/alternatief.ts` + paneel in `AssortimentTab`:
- `voorbereidAlternatiefMigratie()` levert per artikel-met-alternatief de affected rows (impact uit B), inclusief check of het alternatief zelf bestaat én actief is.
- UI: tabel met `oud_nr → nieuw_nr`, `alternatief beschikbaar/actief?`, `# rijen geraakt`, checkbox per regel.
- Knop **"Geselecteerde migraties doorvoeren"** → `voerAlternatiefMigratieDoor(selectedIds)`:
  - Voor elke geselecteerde mapping: UPDATE elk van de 13 tabellen + rmu_config kolommen + trafo_vult_kabel kolommen waarin `artikel_id = oud` → `artikel_id = nieuw_id`.
  - Per-stap error capture; eindrapport `{ tabel, kolom, success_count, failed: [{id, error}] }`.
  - Toast met samenvatting; rapport opgeslagen in `app_instellingen` onder `assortiment.alternatief_migratie.last_run`.
- Geen automatische trigger vanuit `voerSyncDoor` — strikt aparte, expliciete actie.

### E. Sync rapportage & partial success (gap #4, #5)
- `voerSyncDoor()` retourneert `SyncResult { inserted, updated, deactivated, status_updated, errors: { stap, detail }[] }`.
- Bij uitgelopen: ook `status = 'Uitgelopen'` zetten (niet alleen `actief=false`).
- Elke stap (insert/update/deactivate) wrappen in try/catch en errors aggregeren i.p.v. throwen op de eerste; toast toont succescount + failure count + uitklapbare details.
- Logregel in `app_instellingen` uitbreiden met `last_sync_result` JSON zodat history terug te zien is.

### F. Datakwaliteit uitbreiding (gap #9)
`DataKwaliteitTab.tsx` extra checks:
- **Alternatief-keten**: actief artikel heeft `alternatief_artikel_nummer` gezet (verdacht), of inactief artikel heeft alternatief dat zelf ook inactief is, of het alternatief bestaat niet.
- **Configurator-coverage**: opgeslagen `case_materialen` met `artikel.actief = false`.
- Per finding link `Migreer naar alternatief` die direct de migratie-UI in AssortimentTab opent (router state + scrollIntoView).

### G. Export-waarschuwing (gap #7)
`src/lib/assortiment/excel.ts` `exporteerNaarTemplate`:
- Naast `unmatched`: nieuwe arrays `inactief[]` (winkelwagen-item heeft `artikel.actief=false`) en `gemigreerd[]` (gebruikt alternatief tijdens match).
- Toast in `routes/cases/$id.tsx` toont: matched/unmatched/inactief — bij >0 inactief blokkeren we **niet** maar tonen we een waarschuwingstoast met de eerste 5 artikelnummers.
- Geen automatische alternatief-substitutie tijdens export (zou stille datawijziging zijn); alternatieven worden alleen via de expliciete migratie-flow (D) doorgevoerd.

## Wat niet verandert

- UI-architectuur en bestaande upload/preview-flow blijven intact.
- Geen redesign van AssortimentTab, alleen extra secties onder de bestaande diff.
- Geen automatische destructieve vervanging — alternatief-migratie is opt-in per regel.
- Berekeningsmodules (`berekenen/*`) blijven inhoudelijk ongewijzigd; alleen `shared.ts` krijgt de actief-gate.

## Technische details

### Nieuwe bestanden
- `src/lib/assortiment/impact.ts` — impactanalyse helpers + types.
- `src/lib/assortiment/alternatief.ts` — alternatief-migratie helpers.
- `src/lib/assortiment/__tests__/impact.test.ts` + `sync.test.ts` (vitest) — regressie op diff + impactanalyse.

### Gewijzigde bestanden
```text
src/lib/assortiment/excel.ts            sheet const + parser-validatie + export-waarschuwingen
src/lib/assortiment/sync.ts             SyncResult, partial-success, status update bij uitgelopen
src/components/beheer/AssortimentTab.tsx UI tekst-fix + Impact-sectie + Alternatief-migratie paneel
src/components/beheer/DataKwaliteitTab.tsx alternatief-keten + case_materialen checks
src/components/winkelwagen/Winkelwagen.tsx visuele markering inactieve items
src/lib/configurator/berekenen/shared.ts actief-gate in add()/makeFindArtNr + dev warn
src/lib/configurator/types.ts           PreviewItem.inactief?: boolean
src/lib/configurator/queries.ts         alternatief_artikel_nummer meeladen in artikelen-select
src/routes/cases/$id.tsx                export-toast uitbreiden met inactief-waarschuwing
```

### Database
Geen schemawijzigingen nodig — `alternatief_artikel_nummer`, `actief` en `status` bestaan al op `artikelen`. Alleen het gebruik wijzigt.

### Volgorde van werken
1. `excel.ts` + `AssortimentTab.tsx` tekst-alignment + parser-validatie (kort, geïsoleerd).
2. `shared.ts` + `Winkelwagen.tsx` + `queries.ts` + `types.ts` — actief-gate in winkelwagen.
3. `impact.ts` + Impact-sectie in `AssortimentTab.tsx`.
4. `sync.ts` partial-success refactor.
5. `alternatief.ts` + migratie-paneel.
6. `DataKwaliteitTab.tsx` extra checks.
7. Export-waarschuwing in `excel.ts` + `routes/cases/$id.tsx`.
8. Tests + snel preview-rondje.

## Verificatie

- `bunx vitest run` — bestaande 55 tests blijven groen, nieuwe tests voor `berekenImpact` en `voerSyncDoor` partial-success scenario.
- Handmatig in preview: upload van een vooraf geprepareerde test-xlsx en doorlopen van diff → impact → optionele migratie → sync; controleren dat inactief-badge in winkelwagen verschijnt en export-toast waarschuwt.

## Risico's

- Veel UI tegelijk in `AssortimentTab.tsx` — splitsen we in deelcomponenten (`DiffSectie`, `ImpactSectie`, `AlternatiefSectie`) om bestand leesbaar te houden.
- Sync-rapportage in `app_instellingen` kan groeien — beperken tot laatste run.
