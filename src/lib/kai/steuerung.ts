// Steuerung von Kai und vorbereitete Erweiterungen.

// Funktions-Schalter fuer spaeter (hier zentral an-/ausschalten)
export const KAI_FUNKTIONEN = {
  // dezentes Einblenden; entfaellt automatisch bei „Bewegung reduzieren“
  animationen: true,
  // Vorlesen der Texte (Web Speech API) – vorbereitet, noch nicht freigeschaltet
  sprache: false,
} as const;

export type KaiModus = "start" | "einrichtung" | "neu";

const EREIGNIS = "tanzraum:kai";

// Von jeder Seite aus: Kai (den Begleiter in der Kopfzeile) oeffnen, z. B. direkt in der Einrichtung
export function kaiOeffnen(modus: KaiModus = "start") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<KaiModus>(EREIGNIS, { detail: modus }));
}

export function aufKaiOeffnen(fn: (modus: KaiModus) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<KaiModus>).detail ?? "start");
  window.addEventListener(EREIGNIS, h);
  return () => window.removeEventListener(EREIGNIS, h);
}

// Vorbereitet: Text vorlesen (nur wenn KAI_FUNKTIONEN.sprache aktiv und der Browser es kann)
export function kaiVorlesen(text: string): boolean {
  if (!KAI_FUNKTIONEN.sprache || typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "de-DE";
  window.speechSynthesis.speak(u);
  return true;
}
