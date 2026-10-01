import type { GruppeUebersicht } from "./getVerein";

// Gruppenstaerke kommt immer aus den zugeordneten Personen (nie manuell): Tanzpaar/Solist = Teilnehmer, sonst Tänzer
export function staerkeText(g: Pick<GruppeUebersicht, "anzahl" | "besetzung">): string {
  if (g.besetzung === "paar" || g.besetzung === "solo") return `${g.anzahl} Teilnehmer`;
  return `${g.anzahl} Tänzer`;
}
