---
name: structurele-verbeterronde
description: Voer een gestructureerde SOLID-refactorronde uit op een Lovable-app zonder gedragswijziging — inspectie, plan, akkoord, bouw. Gebruik wanneer de gebruiker vraagt om een codebase op te schonen, te refactoren, monoliet-bestanden op te splitsen, of "verbeterronde/refactor/opschonen" noemt.
---

# Structurele verbeterronde

Herhaalbare workflow om een Lovable-app op te schonen zonder gedragswijziging. Gebaseerd op de refactor die eerder in dit project is uitgevoerd (configurator opgesplitst, repositories geïntroduceerd, hooks geëxtraheerd, tests toegevoegd).

## Invoervelden

Vraag de gebruiker deze waarden vóór je begint (alleen wat nog onbekend is):

- **stack** — bijv. "TanStack Start + React + TS + Tailwind + Supabase". Voorkomt frameworkgokken.
- **scope** — hele app of specifieke map/feature (bijv. `src/components/configurator/`).
- **branch** — werk direct op main of op een refactor-branch (default: vraag de gebruiker een branch aan te maken via GitHub-sync).
- **grens per bestand** — regelaantal waarboven splitsen verplicht is (default 500).
- **no-go zones** — bestanden/mappen die niet aangeraakt mogen worden (auto-gen, `src/integrations/supabase/*`, `routeTree.gen.ts`, migraties).

## Werkwijze (strikt in deze volgorde)

### Stap 1 — Inspectie (geen wijzigingen)
Rapporteer:
- Monoliet-bestanden > grens (regelaantal, verantwoordelijkheden).
- Verspreide data-access (bijv. Supabase-calls direct in componenten).
- Herhaalde logica / copy-paste patronen.
- Ontbrekende tests op kritieke pure functies.
- Dode code, ongebruikte exports, `any`-types.
- Inconsistente datastrategie (loader vs hook vs directe fetch).

Output: korte lijst per categorie met bestandspad + regelnummers.

### Stap 2 — Plan
Presenteer een genummerd refactorplan met per stap:
- Wat wordt verplaatst/opgesplitst/geëxtraheerd.
- Welke nieuwe bestanden/mappen ontstaan.
- Welke tests toegevoegd worden.
- Bevestiging: **geen gedragswijziging**.

**Wacht op akkoord voordat je bouwt.**

### Stap 3 — Bouwen (na akkoord)
Werk stap voor stap. Na elke stap:
- Draai typecheck en testsuite.
- Rapporteer: bestanden gewijzigd, regels verplaatst, tests groen.
- Ga pas verder na "ok".

## Refactor-patronen (pas toe waar relevant)

| Patroon | Toepassing |
|---|---|
| **SRP-splitsing** | Componenten > grens opsplitsen in `sections/` of `parts/` submap; pure verplaatsing van inline sub-componenten. |
| **Repository-laag (DIP)** | Verspreide Supabase-calls bundelen in `src/lib/data/*Repo.ts`; hooks/componenten importeren repo's, niet de client. |
| **Hook-extractie** | State + effect + handler-clusters uit componenten naar `useX`-hooks; pure helpers apart voor testbaarheid. |
| **Registry-patroon (OCP)** | Bij herhaalde switch-cases per type: registreer handlers/calculators in een map zodat nieuwe types toegevoegd worden zonder bestaande code te wijzigen. |
| **Types centraliseren** | Domeintypes uit componenten naar `src/lib/**/types.ts`. |
| **Testen van pure helpers** | Elke geëxtraheerde pure functie krijgt een unit test. |

## Guardrails

- **Nooit gedrag wijzigen** in een refactor-ronde. Business-logic changes zijn een aparte opdracht.
- **Nooit** auto-gen bestanden aanraken (`routeTree.gen.ts`, `src/integrations/supabase/*.ts`, `types.ts`).
- **Nooit** database migraties draaien in een refactor-ronde.
- **Nooit** UI/UX veranderen tenzij expliciet gevraagd.
- Bij twijfel over gedrag: **vragen, niet gokken**.

## Afsluiting

Lever een eindrapport met:
- Bestanden gewijzigd/toegevoegd/verwijderd (aantallen).
- Regels vóór/na op de grootste bestanden.
- Testsuite: X/X passing.
- Typecheck: clean.
- Wat niet meegenomen is en waarom.
