import type { SupabaseClient } from "@supabase/supabase-js";

// TanzRaum Team: Rechte-Katalog fuer die Oberflaeche. Massgeblich ist die Datenbank (team_rechte_katalog(), team_darf()) –
// hier stehen nur Beschriftungen. Ein Bereich (ohne Punkt) schaltet den Bereich frei, Aktionen brauchen ihren Bereich.

export type RechtGruppe = { bereich: string; label: string; emoji: string; text: string; aktionen: { recht: string; label: string }[] };

export const RECHTE_GRUPPEN: RechtGruppe[] = [
  {
    bereich: "treff",
    label: "TanzRaum Treff",
    emoji: "💬",
    text: "Moderation der Community",
    aktionen: [
      { recht: "treff.themen_erstellen", label: "Themen erstellen" },
      { recht: "treff.themen_bearbeiten", label: "Themen bearbeiten" },
      { recht: "treff.themen_loeschen", label: "Themen löschen" },
      { recht: "treff.beitraege_bearbeiten", label: "Beiträge bearbeiten" },
      { recht: "treff.beitraege_loeschen", label: "Beiträge löschen" },
      { recht: "treff.themen_verschieben", label: "Themen verschieben" },
      { recht: "treff.themen_schliessen", label: "Themen schließen" },
      { recht: "treff.themen_oeffnen", label: "Themen öffnen" },
      { recht: "treff.themen_anpinnen", label: "Themen anpinnen" },
      { recht: "treff.themen_entpinnen", label: "Themen entpinnen" },
      { recht: "treff.empfehlen", label: "⭐ TanzRaum empfiehlt markieren" },
      { recht: "treff.meldungen_bearbeiten", label: "Meldungen bearbeiten" },
      { recht: "treff.nutzer_melden", label: "Nutzer melden" },
      { recht: "treff.nutzer_sperren", label: "Nutzer sperren (Treff)" },
      { recht: "treff.nutzer_entfernen", label: "Nutzer entfernen (Treff)" },
    ],
  },
  {
    bereich: "workshops",
    label: "Workshops",
    emoji: "🎓",
    text: "Eingereichte Workshops prüfen und pflegen",
    aktionen: [
      { recht: "workshops.ansehen", label: "Eingereichte ansehen" },
      { recht: "workshops.erstellen", label: "Erstellen" },
      { recht: "workshops.bearbeiten", label: "Bearbeiten" },
      { recht: "workshops.freigeben", label: "Freigeben" },
      { recht: "workshops.ablehnen", label: "Ablehnen" },
      { recht: "workshops.archivieren", label: "Archivieren" },
      { recht: "workshops.loeschen", label: "Löschen" },
    ],
  },
  {
    bereich: "wissen",
    label: "Wissensbeiträge (Treff)",
    emoji: "📚",
    text: "Redaktionelle Wissensbeiträge im TanzRaum Treff",
    aktionen: [
      { recht: "wissen.erstellen", label: "Erstellen" },
      { recht: "wissen.bearbeiten", label: "Bearbeiten" },
      { recht: "wissen.veroeffentlichen", label: "Veröffentlichen" },
      { recht: "wissen.loeschen", label: "Löschen" },
    ],
  },
  {
    bereich: "news",
    label: "News",
    emoji: "📣",
    text: "TanzRaum-Ankündigungen und „Updates & Neuigkeiten“",
    aktionen: [{ recht: "news.verwalten", label: "Ankündigungen verwalten" }],
  },
  {
    bereich: "spotlight",
    label: "Spotlight",
    emoji: "✨",
    text: "Gemeldete Spotlights prüfen",
    aktionen: [{ recht: "spotlight.meldungen_bearbeiten", label: "Spotlight-Meldungen bearbeiten" }],
  },
  {
    bereich: "chat",
    label: "Chat",
    emoji: "💬",
    text: "TanzRaum Chat und Gruppenchats moderieren (nur gemeldete bzw. blockierte Auszüge)",
    aktionen: [
      { recht: "chat.oeffentlich_moderieren", label: "Öffentlichen Chat moderieren" },
      { recht: "chat.gruppen_moderieren", label: "Gruppenchats moderieren" },
      { recht: "chat.meldungen_bearbeiten", label: "Chat-Meldungen bearbeiten" },
      { recht: "chat.nachrichten_loeschen", label: "Nachrichten entfernen" },
      { recht: "chat.nutzer_stummschalten", label: "Nutzer stummschalten (Chat-Schreibsperre)" },
    ],
  },
  {
    bereich: "nutzer",
    label: "Nutzerverwaltung",
    emoji: "👤",
    text: "Konten finden (nur @Nutzername) und sperren",
    aktionen: [
      { recht: "nutzer.ansehen", label: "Nutzer suchen" },
      { recht: "nutzer.sperren", label: "Konten sperren/entsperren" },
    ],
  },
];

export const ALLE_RECHTE = RECHTE_GRUPPEN.flatMap((g) => [g.bereich, ...g.aktionen.map((a) => a.recht)]);

export function rechtLabel(recht: string): string {
  for (const g of RECHTE_GRUPPEN) {
    if (g.bereich === recht) return g.label;
    const a = g.aktionen.find((x) => x.recht === recht);
    if (a) return `${g.label}: ${a.label}`;
  }
  return recht;
}

export type MeineTeamRechte = { admin: boolean; team: boolean; moderator: boolean; alleRechte: boolean; rechte: Set<string> };

// Nur Anzeige – jede Aktion prueft ihr Recht in der Datenbank erneut
export async function meineTeamRechte(supabase: SupabaseClient): Promise<MeineTeamRechte> {
  const { data } = await supabase.rpc("meine_team_rechte");
  const d = (data ?? {}) as { admin?: boolean; team?: boolean; moderator?: boolean; alle_rechte?: boolean; rechte?: string[] };
  return {
    admin: d.admin === true,
    team: d.team === true,
    moderator: d.moderator === true,
    alleRechte: d.alle_rechte === true,
    rechte: new Set(Array.isArray(d.rechte) ? d.rechte : []),
  };
}

// Aktion erlaubt? (Admin immer; sonst Bereich + Aktion)
export function darfTeam(r: MeineTeamRechte, recht: string): boolean {
  if (r.admin) return true;
  return r.rechte.has(recht) && r.rechte.has(recht.split(".")[0]);
}

export const KENNZEICHEN: Record<string, string> = {
  admin: "👑 TanzRaum-Admin",
  moderator: "🛡 TanzRaum Team · Moderator",
  team: "🛡 TanzRaum Team",
};
