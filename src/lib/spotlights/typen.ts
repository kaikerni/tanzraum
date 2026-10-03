// Ob Spotlights erscheinen, entscheidet der Schalter der TanzRaum-Administration (spotlightsFuerMich in getSpotlights.ts).

export type SpotlightPerson = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  anzahl: number;
  ungesehen: number;
  neuestes: string;
  ich: boolean;
  // Vorschau fuer die Story-Kachel (neuestes Foto bzw. Text-Hintergrund)
  vorschauUrl?: string | null;
  vorschauHintergrund?: string | null;
};

// Story-Ebenen: frei positionierbar ueber Foto/Video/Hintergrund. x/y relativ (0–1, Mittelpunkt), skala, drehung in Grad.
export type TextStil = "klassisch" | "kraeftig" | "schrift" | "neon" | "schreibmaschine";
export type Strich = { farbe: string; breite: number; punkte: [number, number][] };
type EbeneBasis = { id: string; x: number; y: number; skala: number; drehung: number };
export type Ebene = EbeneBasis &
  (
    | { typ: "text"; text: string; stil: TextStil; farbe: string; hinterlegt: boolean; ausrichtung: "links" | "mitte" | "rechts" }
    | { typ: "sticker"; sticker: string }
    | { typ: "emoji"; emoji: string }
    | { typ: "standort"; ort: string }
    | { typ: "erwaehnung"; user_id: string; name: string }
    | { typ: "zeichnung"; striche: Strich[] }
  );
export type StoryMusik = { pfad: string; titel: string; interpret: string | null; start: number; dauer: number; lautstaerke: number };

export type Spotlight = {
  id: string;
  mediaTyp: "foto" | "video" | "text";
  url: string | null;
  text: string | null;
  hintergrund: string | null;
  sticker: string | null;
  sichtbarkeit: "netzwerk" | "kontakte";
  erstelltAm: string;
  ablaufAm: string;
  gesehen: boolean;
  meineReaktion: string | null;
  ansichten: number | null;
  reaktionen: { name: string; sticker: string }[] | null;
  ebenen: Ebene[];
  musik: StoryMusik | null;
  storyId: string | null;
};

export const HINTERGRUENDE: Record<string, string> = {
  rot: "linear-gradient(145deg,#e11d2e,#a8121f)",
  gold: "linear-gradient(145deg,#f2d58c,#c9921f)",
  navy: "linear-gradient(145deg,#3b4356,#1b2130)",
  lila: "linear-gradient(145deg,#8a6ff0,#5b3fd1)",
  gruen: "linear-gradient(145deg,#5fcf8f,#1f9d55)",
  rosa: "linear-gradient(145deg,#fdecee,#f6a5ad)",
};

export function vorZeit(iso: string, jetzt = Date.now()): string {
  const min = Math.max(0, Math.round((jetzt - new Date(iso).getTime()) / 60000));
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  return `vor ${Math.round(min / 60)} Std.`;
}
