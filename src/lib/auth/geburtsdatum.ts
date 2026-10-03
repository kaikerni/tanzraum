// Pruefung des Geburtsdatums (Jugendschutz). Die eigentliche Absicherung liegt in der Datenbank.
export function geburtsdatumFehler(wert: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(wert)) return "Bitte gib dein Geburtsdatum ein.";
  const d = new Date(`${wert}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== wert) return "Bitte gib ein gültiges Geburtsdatum ein.";
  if (wert < "1900-01-01" || d.getTime() > Date.now()) return "Bitte gib ein gültiges Geburtsdatum ein.";
  return null;
}
