## Doel
De "Extra vragen" (maatwerk) worden nu subtiel als een streepje + mini-label onderaan een bestaande sectie getoond, en elk vraaglabel is klein (10px mono uppercase). Ze verdwijnen daardoor optisch. We tillen ze naar hetzelfde visuele niveau als de rest van het formulier — zonder logica te wijzigen.

## Scope (alleen presentatie)
Alle wijzigingen in `src/components/configurator/MaterialenConfigurator.tsx`. Geen datamodel-, berekenings- of opslag-wijzigingen. Antwoorden landen nog steeds in `config.maatwerkAntwoorden`.

## Wijzigingen

### 1. Subkader per groep "Extra vragen" binnen een sectie
Op regel 549-556 wordt de append-blok vervangen door een omkaderd sub-paneel:
- Duidelijk gescheiden van de sectie-inhoud met meer whitespace en een border-top of eigen achtergrondje (`bg-muted/30` of `border rounded-lg`).
- Header met icoon (`ClipboardList` of `HelpCircle`) + tekst "Extra vragen" in normale grootte (`text-sm font-semibold`), niet meer 10px mono.
- Behoudt zijn plek onderaan de bestaande sectie (dus geen SectionCard-promotie).

### 2. Grotere vraaglabels + per-vraag kaartje in `MaatwerkSection`
`MaatwerkSection` (regel 712-758) krijgt een eigen render, zonder `Field`-primitive:
- Iedere vraag komt in een licht omkaderd kaartje (`rounded-lg border border-border bg-background/50 p-4`).
- Vraaglabel: `text-sm font-medium text-foreground` (normale form-vraag stijl) i.p.v. het 10px mono uppercase van `Field`.
- Uitleg (`v.uitleg`) blijft eronder als `text-xs text-muted-foreground`.
- Antwoordinput (PillGroup / Stepper) blijft ongewijzigd.
- Verticale ruimte tussen vragen iets ruimer (`space-y-3`).

### 3. Eigen hoofdstukken profiteren automatisch
De `MaatwerkSection` wordt ook gebruikt in de "Eigen hoofdstukken" `SectionCard` (regel 590). Daar krijgen alle maatwerkvragen dezelfde verbeterde stijl — consistent met de rest.

## Wat blijft ongewijzigd
- `Field`/`FieldRow` primitives (worden elders nog gebruikt).
- Sectie-numering, activeSectie tracking, berekeningen, opslag.
- Volgorde en groepering van vragen (nog steeds via `maatwerkGroepen`).

## Verificatie
- Preview openen in een case met eigen vragen; controleren dat "Extra vragen" duidelijk zichtbaar is binnen bv. de Overig-sectie en dat elke vraag als kaartje leest.
- Dark mode-contrastcheck (`__checkContrast()` in devtools) — nieuwe borders/backgrounds gebruiken semantische tokens, dus AA blijft gehaald.
- Bestaande tests draaien; er zijn geen tests op deze presentatie-laag.
