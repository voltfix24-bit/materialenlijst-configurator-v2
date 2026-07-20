/** Label- en badge-helpers voor RMU-velden, gedeeld door RMU- en provisorium-secties. */

export function veldLabel(merk: string, veldType: "F" | "C" | "V", veldNummer: number): string {
  if (merk === "Siemens") {
    if (veldType === "F") return "T-veld — Trafo richting";
    if (veldType === "C") return `R-veld ${veldNummer} — Kabelrichting`;
    return `R-veld ${veldNummer} — Vermogensveld`;
  }
  if (veldType === "F") return "F-veld — Trafo richting";
  if (veldType === "C") return `C-veld ${veldNummer} — Kabelrichting`;
  return `V-veld ${veldNummer} — Vermogensveld`;
}

export function veldBadge(merk: string, veldType: "F" | "C" | "V"): string {
  if (merk === "Siemens") return veldType === "F" ? "T" : "R";
  return veldType;
}
