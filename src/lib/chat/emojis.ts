import { stickerInfo } from "./sticker";

// Normale Smileys (Unicode-Emojis) zusaetzlich zu den TanzRaum-Stickern – in Chats, Nachrichten und Spotlights
export const EMOJI_GRUPPEN: { titel: string; zeichen: string; emojis: string[] }[] = [
  { titel: "Smileys", zeichen: "😀", emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😍", "🥰", "😘", "😋", "😜", "🤪", "😎", "🤩", "🥳", "😏", "😌", "🤗", "🤭", "🤔", "😮", "😲", "😳", "🥺", "😢", "😭", "😤", "😡", "😱", "😴", "🤒", "🤧", "🥶", "🥵", "🤯", "😬", "🙄", "😇", "🤓", "🫶"] },
  { titel: "Gesten", zeichen: "👍", emojis: ["👍", "👎", "👏", "🙌", "🙏", "🤝", "💪", "👌", "✌️", "🤞", "🤟", "🤙", "👋", "✋", "👊", "🫡", "💃", "🕺", "👯", "🤸", "🙋", "🤷", "🙈", "🙉", "🙊"] },
  { titel: "Herzen", zeichen: "❤️", emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💖", "💗", "💓", "💕", "💞", "💘", "💝", "❣️", "💯", "✨", "⭐", "🌟", "💫", "🔥", "⚡"] },
  { titel: "Tanz & Feiern", zeichen: "🎉", emojis: ["🎉", "🎊", "🥂", "🍾", "🎈", "🎁", "🏆", "🥇", "🥈", "🥉", "🏅", "🎖️", "👑", "🎭", "🎪", "🎵", "🎶", "🎤", "🥁", "🎺", "📸", "🎬", "🌹", "💐", "🤡", "🃏"] },
  { titel: "Alltag", zeichen: "☀️", emojis: ["☀️", "🌙", "🌈", "☔", "❄️", "🍀", "🌸", "🍕", "🍔", "🍟", "🍩", "🍫", "☕", "🧃", "🚗", "🚌", "🚆", "✈️", "🏠", "🏫", "⏰", "📅", "📍", "✅", "❌", "❓", "❗", "👀", "💤"] },
];
export const EMOJIS = EMOJI_GRUPPEN.flatMap((g) => g.emojis);
export const SCHNELL_EMOJIS = ["👍", "❤️", "😂", "👏", "🔥", "😮"];

// Reaktion/Ebene: TanzRaum-Sticker (Kennung wie „t01“) oder ein normales Emoji
export function istEmoji(wert: string | null | undefined): boolean {
  return !!wert && wert.length <= 16 && /\p{Extended_Pictographic}/u.test(wert) && !/[A-Za-z0-9<>"'`]/.test(wert);
}
export const istReaktion = (wert: string | null | undefined) => !!wert && (!!stickerInfo(wert) || istEmoji(wert));
