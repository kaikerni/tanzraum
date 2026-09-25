"use client";

import { useState } from "react";
import { STICKER, STICKER_SAETZE, stickerUrl, type StickerSatz } from "@/lib/chat/sticker";

// Schlanke Emoji-Auswahl ohne externe Bibliothek (auf dem Handy gibt es zusaetzlich die Emoji-Tastatur),
// dazu die TanzRaum-Sticker (Taenzerin, Gardist), die per Antippen direkt gesendet werden.
const KATEGORIEN: { name: string; zeichen: string; emojis: string }[] = [
  { name: "Smileys", zeichen: "😀", emojis: "😀😃😄😁😆😅😂🤣🥲😊😇🙂😉😌😍🥰😘😗😙😚😋😛😝😜🤪🤨🧐🤓😎🥳🤩😏😒😞😔😟😕🙁😣😖😫😩🥺😢😭😤😠😡🤬🤯😳🥵🥶😱😨😰😥😓🤗🤔🫣🤭🤫🤥😶😐😑😬🙄😯😦😧😮😲🥱😴🤤😪😵🤐🥴🤢🤮🤧😷🤒🤕🤑🤠😈👻💀🤡💩🙈🙉🙊" },
  { name: "Gesten", zeichen: "👍", emojis: "👍👎👌✌️🤞🤟🤘🤙👈👉👆👇☝️✋🤚🖐️🖖👋🤝🙏👏🙌👐🤲💪🦵🦶👀👄💋🫶" },
  { name: "Herzen", zeichen: "❤️", emojis: "❤️🧡💛💚💙💜🖤🤍🤎💔❣️💕💞💓💗💖💘💝✨⭐🌟💫🔥💥" },
  { name: "Tanz & Karneval", zeichen: "💃", emojis: "💃🕺👯‍♀️👯‍♂️🩰🎭🎉🎊🎈🥳🎺🥁🎷🎶🎵🎤🎧🏆🥇🥈🥉🏅🎖️👑🎩🪶👢🤹‍♀️🤸‍♀️📸🎬" },
  { name: "Alltag", zeichen: "📅", emojis: "📅⏰⌛🚗🚌🚆✈️🏠🏫🏟️☕🍕🍔🍟🍰🎂🍫🍬🍿🥤🍺🥂🍾☀️🌧️❄️⛄🌈📱💻📎📌✏️📝✅❌⚠️❓❗💯" },
];

type Tab = { art: "emoji"; index: number } | { art: "sticker"; satz: StickerSatz };

export function EmojiAuswahl({
  onWahl,
  onSticker,
  stickerSperre = false,
}: {
  onWahl: (e: string) => void;
  onSticker?: (id: string) => void;
  stickerSperre?: boolean;
}) {
  const [tab, setTab] = useState<Tab>({ art: "emoji", index: 0 });
  const emojis =
    tab.art === "emoji"
      ? Array.from(new Intl.Segmenter("de", { granularity: "grapheme" }).segment(KATEGORIEN[tab.index].emojis), (s) => s.segment)
      : [];
  const sticker = tab.art === "sticker" ? STICKER.filter((s) => s.satz === tab.satz) : [];
  const tabKlasse = (aktiv: boolean) => `flex h-9 w-10 shrink-0 items-center justify-center rounded-lg text-[20px] ${aktiv ? "bg-brand-bg" : ""}`;
  return (
    <div className="border-t border-brand-line bg-white">
      <div className="flex gap-1 overflow-x-auto border-b border-brand-line px-2 py-1" role="tablist" aria-label="Emojis und Sticker">
        {KATEGORIEN.map((k, i) => (
          <button
            key={k.name}
            type="button"
            role="tab"
            aria-selected={tab.art === "emoji" && tab.index === i}
            aria-label={k.name}
            onClick={() => setTab({ art: "emoji", index: i })}
            className={tabKlasse(tab.art === "emoji" && tab.index === i)}
          >
            {k.zeichen}
          </button>
        ))}
        {onSticker && (
          <>
            <span className="mx-1 my-1.5 w-px shrink-0 bg-brand-line" aria-hidden />
            {STICKER_SAETZE.map(({ satz, titel }) => {
              const aktiv = tab.art === "sticker" && tab.satz === satz;
              const vorschau = STICKER.find((s) => s.satz === satz)!;
              return (
                <button
                  key={satz}
                  type="button"
                  role="tab"
                  aria-selected={aktiv}
                  aria-label={`Sticker ${titel}`}
                  title={`Sticker ${titel}`}
                  onClick={() => setTab({ art: "sticker", satz })}
                  className={tabKlasse(aktiv)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={stickerUrl(vorschau.id)} alt="" className="h-8 w-8 object-contain" />
                </button>
              );
            })}
          </>
        )}
      </div>
      {tab.art === "emoji" ? (
        <div className="grid h-[200px] grid-cols-8 gap-0.5 overflow-y-auto p-2 sm:grid-cols-10">
          {emojis.map((e, i) => (
            <button key={`${e}-${i}`} type="button" onClick={() => onWahl(e)} className="flex h-10 items-center justify-center rounded-lg text-[24px] hover:bg-brand-bg" aria-label={e}>
              {e}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid h-[240px] grid-cols-4 gap-1 overflow-y-auto p-2 sm:grid-cols-6">
          {sticker.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={stickerSperre}
              onClick={() => onSticker?.(s.id)}
              title={s.name}
              aria-label={`Sticker senden: ${s.name}`}
              className="flex aspect-square items-center justify-center rounded-xl p-1 transition-transform hover:scale-105 hover:bg-brand-bg disabled:opacity-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={stickerUrl(s.id)} alt="" loading="lazy" className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
