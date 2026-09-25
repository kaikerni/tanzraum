export type SpotlightPerson = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  anzahl: number;
  ungesehen: number;
  neuestes: string;
  ich: boolean;
};

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
