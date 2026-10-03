import { stickerInfo } from "./sticker";

// TanzRaum-Smileys im Nachrichtentext: als kurzer Code „:t01:“ gespeichert (vorhandene Sticker-Assets, keine Kopien).
// So sind mehrere Smileys in einer Nachricht und Text + Smileys kombinierbar. Die Schutzpruefung prueft den Text ohne
// diese Codes (supabase/functions/_shared/schutzpruefung.ts) – ein Code kann keinen Inhalt verstecken.
export const SMILEY_CODE = /:([a-z]{1,3}\d{1,3}):/g;

export const smileyCode = (id: string) => `:${id}:`;

export type TextTeil = { art: "text"; text: string } | { art: "smiley"; id: string };

// Text in Textteile und gueltige TanzRaum-Smileys zerlegen (unbekannte Codes bleiben Text)
export function textTeile(text: string): TextTeil[] {
  const teile: TextTeil[] = [];
  let letzt = 0;
  for (const m of text.matchAll(SMILEY_CODE)) {
    if (!stickerInfo(m[1])) continue;
    const start = m.index ?? 0;
    if (start > letzt) teile.push({ art: "text", text: text.slice(letzt, start) });
    teile.push({ art: "smiley", id: m[1] });
    letzt = start + m[0].length;
  }
  if (letzt < text.length) teile.push({ art: "text", text: text.slice(letzt) });
  return teile;
}

export const hatSmileyCodes = (text: string) => textTeile(text).some((t) => t.art === "smiley");

// Nur Smileys (ohne weiteren Text) – werden groesser angezeigt
export function nurSmileys(text: string): number {
  const teile = textTeile(text);
  if (teile.some((t) => t.art === "text" && t.text.trim() !== "")) return 0;
  return teile.filter((t) => t.art === "smiley").length;
}

// Genau ein TanzRaum-Smiley und sonst nichts: wird wie bisher als grosser Sticker gesendet
export function einzelnerSmiley(text: string): string | null {
  const teile = textTeile(text.trim());
  return teile.length === 1 && teile[0].art === "smiley" ? teile[0].id : null;
}

// Fuer reine Textanzeigen (Chatliste, Benachrichtigungen): Codes durch den Smiley-Namen ersetzen
export function smileyCodesAlsText(text: string): string {
  return textTeile(text)
    .map((t) => (t.art === "text" ? t.text : `[${stickerInfo(t.id)?.name ?? "Smiley"}]`))
    .join("");
}
