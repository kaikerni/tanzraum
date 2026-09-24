"use client";

import { useState } from "react";

// Schlanke Emoji-Auswahl ohne externe Bibliothek (auf dem Handy gibt es zusaetzlich die Emoji-Tastatur).
const KATEGORIEN: { name: string; zeichen: string; emojis: string }[] = [
  { name: "Smileys", zeichen: "😀", emojis: "😀😃😄😁😆😅😂🤣🥲😊😇🙂😉😌😍🥰😘😗😙😚😋😛😝😜🤪🤨🧐🤓😎🥳🤩😏😒😞😔😟😕🙁😣😖😫😩🥺😢😭😤😠😡🤬🤯😳🥵🥶😱😨😰😥😓🤗🤔🫣🤭🤫🤥😶😐😑😬🙄😯😦😧😮😲🥱😴🤤😪😵🤐🥴🤢🤮🤧😷🤒🤕🤑🤠😈👻💀🤡💩🙈🙉🙊" },
  { name: "Gesten", zeichen: "👍", emojis: "👍👎👌✌️🤞🤟🤘🤙👈👉👆👇☝️✋🤚🖐️🖖👋🤝🙏👏🙌👐🤲💪🦵🦶👀👄💋🫶" },
  { name: "Herzen", zeichen: "❤️", emojis: "❤️🧡💛💚💙💜🖤🤍🤎💔❣️💕💞💓💗💖💘💝✨⭐🌟💫🔥💥" },
  { name: "Tanz & Karneval", zeichen: "💃", emojis: "💃🕺👯‍♀️👯‍♂️🩰🎭🎉🎊🎈🥳🎺🥁🎷🎶🎵🎤🎧🏆🥇🥈🥉🏅🎖️👑🎩🪶👢🤹‍♀️🤸‍♀️📸🎬" },
  { name: "Alltag", zeichen: "📅", emojis: "📅⏰⌛🚗🚌🚆✈️🏠🏫🏟️☕🍕🍔🍟🍰🎂🍫🍬🍿🥤🍺🥂🍾☀️🌧️❄️⛄🌈📱💻📎📌✏️📝✅❌⚠️❓❗💯" },
];

export function EmojiAuswahl({ onWahl }: { onWahl: (e: string) => void }) {
  const [kategorie, setKategorie] = useState(0);
  const liste = Array.from(new Intl.Segmenter("de", { granularity: "grapheme" }).segment(KATEGORIEN[kategorie].emojis), (s) => s.segment);
  return (
    <div className="border-t border-brand-line bg-white">
      <div className="flex gap-1 border-b border-brand-line px-2 py-1" role="tablist" aria-label="Emoji-Kategorien">
        {KATEGORIEN.map((k, i) => (
          <button
            key={k.name}
            type="button"
            role="tab"
            aria-selected={kategorie === i}
            aria-label={k.name}
            onClick={() => setKategorie(i)}
            className={`flex h-9 w-10 items-center justify-center rounded-lg text-[20px] ${kategorie === i ? "bg-brand-bg" : ""}`}
          >
            {k.zeichen}
          </button>
        ))}
      </div>
      <div className="grid h-[200px] grid-cols-8 gap-0.5 overflow-y-auto p-2 sm:grid-cols-10">
        {liste.map((e, i) => (
          <button key={`${e}-${i}`} type="button" onClick={() => onWahl(e)} className="flex h-10 items-center justify-center rounded-lg text-[24px] hover:bg-brand-bg" aria-label={e}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
