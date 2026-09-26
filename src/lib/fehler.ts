// Datenbankfehler in verstaendliche Meldungen uebersetzen -- keine PGRST-/SQL-Texte an Nutzer.
// Eigene Pruefungen in der DB (Trigger) liefern Code 23514 mit bereits deutscher Meldung.
export function freundlicherFehler(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "Das hat nicht geklappt. Bitte versuche es erneut.";
  switch (error.code) {
    case "23514":
    case "P0001":
      return error.message ?? "Diese Änderung ist nicht erlaubt.";
    case "23505":
      return "Das ist bereits so eingetragen.";
    case "42501":
      return "Dafür fehlt dir die Berechtigung.";
    case "23503":
      return "Der Eintrag wird noch an anderer Stelle verwendet.";
    default:
      console.error("[TanzRaum] Datenbankfehler", error);
      return "Das hat nicht geklappt. Bitte versuche es erneut.";
  }
}
