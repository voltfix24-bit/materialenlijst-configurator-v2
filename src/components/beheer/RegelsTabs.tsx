// Barrel: de losse regeltabs staan nu elk in ./regels/ (SRP) en delen hun
// data-access via ./regels/regelsRepo (DIP). Deze re-export houdt de bestaande
// imports in beheer.tsx ongewijzigd.
export { GgiRegelsTab } from "./regels/GgiRegelsTab";
export { TrafoRegelsTab } from "./regels/TrafoRegelsTab";
export { LsRekRegelsTab } from "./regels/LsRekRegelsTab";
export { ProvRegelsTab } from "./regels/ProvRegelsTab";
export { MsKabelRegelsTab } from "./regels/MsKabelRegelsTab";

// === RMU veld regels ===
// Vriendelijke versie staat in RmuVeldRegelsTab.tsx
export { RmuVeldRegelsTab } from "./RmuVeldRegelsTab";
