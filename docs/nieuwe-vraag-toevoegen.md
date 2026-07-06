# Een nieuwe vraag toevoegen aan de configurator

Er zijn twee routes, afhankelijk van hoe complex de vraag is.

## Route 1 — via Beheer, zonder code (voor 90% van de gevallen)

**Beheer → Automations → Eigen vragen → "Vraag toevoegen".**

1. **Label**: de vraag zoals de engineer hem ziet, bv. *"Is er graafwerk nodig?"*
2. **Type**:
   - **Ja / nee** — simpele toggle;
   - **Keuzelijst** — eigen opties, één per regel (bv. `klein` / `middel` / `groot`);
   - **Aantal** — een getal (bv. *"Aantal extra mantelbuizen"*).
3. **Plaats in**: kies waar de vraag verschijnt —
   - onderaan een **bestaand hoofdstuk** (Type opdracht, Provisorium, MS,
     Trafo & Vult kabel, LS of Overig), onder het kopje "Extra vragen";
   - in een **eigen hoofdstuk** met zelfgekozen naam (maak hoofdstukken aan
     in het blok "Eigen hoofdstukken" bovenaan de tab) — elk eigen hoofdstuk
     wordt een eigen sectie-kaart in de configurator;
   - of laat staan op het standaardhoofdstuk "Eigen vragen".
4. **Geldt voor case types**: vink aan bij welke van de 4 type cases de vraag
   verschijnt. Niets aangevinkt = alle vier.
5. **Artikelen koppelen**: klap de vraag open → "Artikel koppelen". Per regel:
   - **Bij antwoord**: bij welk antwoord dit artikel meekomt (`*` = elk niet-leeg antwoord);
   - **Artikel + hoeveelheid**;
   - Bij een **aantal**-vraag: zet "× ingevuld aantal" aan om de hoeveelheid te
     vermenigvuldigen met het ingevulde getal (bv. 2 klemmen per mantelbuis).

De vraag verschijnt direct in de configurator (sectie **Eigen vragen**) en in de
**Proefcase-simulator**. De artikelen komen in de winkelwagen met herkomst
*"[vraag]: [antwoord]"* en een bewerk-link terug naar deze tab. Antwoorden
worden per case opgeslagen in `config_json.maatwerkAntwoorden` onder de
`vraag_key`. Verwijderen of deactiveren van de vraag kan altijd; bestaande
cases behouden hun antwoord maar krijgen de artikelen niet meer.

**Let op**: wijzig de `vraag_key` (automatisch afgeleid van het label) niet
nadat er cases mee zijn opgeslagen — het antwoord wordt onder die sleutel
bewaard.

## Route 2 — via code (alleen voor vragen met complexe afhankelijkheden)

Nodig wanneer het antwoord andere vragen moet beïnvloeden (zoals trafo-kVA →
zekering + vultkabel) of een eigen berekening vereist. Vast stappenpad:

1. **Configuratieveld** — `src/lib/configurator/types.ts`: veld toevoegen aan
   `MaterialenConfig` + default in `emptyConfig()`. (Opslag/herstel via
   `config_json` werkt dan automatisch.)
2. **Regeltabel** — nieuwe migratie in `supabase/migrations/` naar het patroon
   van bv. `trafo_regels`: conditie-kolommen (`conditie_*`), `artikel_id`,
   `hoeveelheid` (+ evt. `hoeveelheid_formule`), `actief`, `sort_order`,
   RLS-policy `public_all`. Ook toevoegen aan
   `src/integrations/supabase/types.ts`.
3. **Stamdata** — query in `src/lib/configurator/queries.ts` (`useStamdata`),
   incl. `isLoading`. Fixtures bijwerken:
   `src/lib/configurator/__fixtures__/stamdata.ts`.
4. **Berekening** — module in `src/lib/configurator/berekenen/` naar het
   patroon van `maatwerk.ts`/`trafo.ts`; aanroepen in `berekenen.ts`. Gebruik
   `add()` altijd mét `{ tabel, id }` zodat herkomst en deep-links werken.
5. **Sectie/bron-registratie** — in `types.ts`: `BronTabel`-union +
   `BRON_TABEL_DEFS` (en evt. `PreviewSectie` + `PREVIEW_SECTIE_DEFS`).
6. **Vraag-UI** — sectie of veld in
   `src/components/configurator/MaterialenConfigurator.tsx` (+ completion in
   het `completion`-object) en dezelfde vraag in
   `src/components/beheer/ProefcaseTab.tsx`.
7. **Beheer-tab** — CRUD-tab naar het patroon van `RegelsTabs.tsx`,
   registreren in `src/routes/beheer.tsx`.
8. **Preview-deps** — de nieuwe query toevoegen aan de dependency-arrays van
   de `preview`-useMemo in `MaterialenConfigurator.tsx` en `ProefcaseTab.tsx`.
9. **Test** — dekkingstest in `src/lib/configurator/berekenen.coverage.test.ts`
   of een eigen testbestand; draai `npx vitest run`.

Controlepunt na afloop: vul de vraag in de **Proefcase-simulator** in — de
artikelen moeten verschijnen mét werkende "Bewerken"-link.
