"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import {
  STICKER,
  STICKER_KATEGORIEN,
  STICKER_SAETZE,
  stickerInfo,
  stickerUrl,
  type Sticker,
  type StickerKategorie,
  type StickerSatz,
} from "@/lib/chat/sticker";
import { EMOJI_GRUPPEN } from "@/lib/chat/emojis";

// TanzRaum-Sticker (eigene Assets) und – wenn onEmoji gesetzt ist – zusaetzlich die normalen Smileys.
type Tab = { art: "zuletzt" } | { art: "satz"; satz: StickerSatz } | { art: "kategorie"; kategorie: StickerKategorie } | { art: "emoji"; gruppe: number };

const SPEICHER = "tanzraum-smileys-zuletzt";

function zuletztLesen(): string[] {
  try {
    const liste = JSON.parse(localStorage.getItem(SPEICHER) ?? "[]");
    return Array.isArray(liste) ? liste.filter((id) => typeof id === "string" && stickerInfo(id)) : [];
  } catch {
    return [];
  }
}

export function zuletztMerken(id: string) {
  try {
    localStorage.setItem(SPEICHER, JSON.stringify([id, ...zuletztLesen().filter((x) => x !== id)].slice(0, 24)));
  } catch {
    // ohne Speicher geht es auch
  }
}

export function SmileyAuswahl({
  onWahl,
  onEmoji,
  gesperrt = false,
  hoehe = "h-[240px]",
}: {
  onWahl: (id: string) => void;
  // Normale Smileys (Unicode) – z. B. in den Text einfuegen oder als Reaktion setzen
  onEmoji?: (emoji: string) => void;
  gesperrt?: boolean;
  hoehe?: string;
}) {
  const [zuletzt, setZuletzt] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>({ art: "satz", satz: "taenzerin" });

  useEffect(() => {
    const z = zuletztLesen();
    setZuletzt(z);
    if (z.length > 0) setTab({ art: "zuletzt" });
  }, []);

  const liste: Sticker[] =
    tab.art === "zuletzt"
      ? zuletzt.map((id) => stickerInfo(id)!).filter(Boolean)
      : tab.art === "satz"
        ? STICKER.filter((s) => s.satz === tab.satz)
        : tab.art === "kategorie"
          ? STICKER.filter((s) => s.kategorie === tab.kategorie)
          : [];

  const tabs: { key: string; titel: string; aktiv: boolean; waehlen: () => void; bild?: string; zeichen?: string }[] = [
    ...(zuletzt.length > 0
      ? [{ key: "zuletzt", titel: "Zuletzt verwendet", aktiv: tab.art === "zuletzt", waehlen: () => setTab({ art: "zuletzt" }) }]
      : []),
    ...STICKER_SAETZE.map((s) => ({
      key: s.satz,
      titel: s.titel,
      bild: s.vorschau,
      aktiv: tab.art === "satz" && tab.satz === s.satz,
      waehlen: () => setTab({ art: "satz", satz: s.satz }),
    })),
    ...STICKER_KATEGORIEN.map((k) => ({
      key: k.kategorie,
      titel: k.titel,
      bild: k.vorschau,
      aktiv: tab.art === "kategorie" && tab.kategorie === k.kategorie,
      waehlen: () => setTab({ art: "kategorie", kategorie: k.kategorie }),
    })),
    ...(onEmoji
      ? EMOJI_GRUPPEN.map((g, i) => ({
          key: `emoji-${i}`,
          titel: g.titel,
          zeichen: g.zeichen,
          aktiv: tab.art === "emoji" && tab.gruppe === i,
          waehlen: () => setTab({ art: "emoji", gruppe: i }),
        }))
      : []),
  ];
  const aktiverTitel = tabs.find((t) => t.aktiv)?.titel ?? "";

  return (
    <div className="border-t border-brand-line bg-white">
      <div className="flex gap-1 overflow-x-auto border-b border-brand-line px-2 py-1" role="tablist" aria-label="TanzRaum-Smileys">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.aktiv}
            aria-label={t.titel}
            title={t.titel}
            onClick={t.waehlen}
            className={`flex h-10 w-11 shrink-0 items-center justify-center rounded-lg ${t.aktiv ? "bg-brand-red-wash ring-1 ring-brand-red/30" : "hover:bg-brand-bg"}`}
          >
            {t.zeichen ? (
              <span className="text-[22px] leading-none">{t.zeichen}</span>
            ) : t.bild ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={stickerUrl(t.bild)} alt="" className="h-8 w-8 object-contain" />
            ) : (
              <Clock size={18} className="text-brand-ink-soft" />
            )}
          </button>
        ))}
      </div>
      <p className="px-3 pt-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-brand-ink-faint">{aktiverTitel}</p>
      {tab.art === "emoji" && onEmoji ? (
        <div className={`grid ${hoehe} grid-cols-7 content-start gap-0.5 overflow-y-auto p-2 sm:grid-cols-10`}>
          {EMOJI_GRUPPEN[tab.gruppe].emojis.map((e) => (
            <button
              key={e}
              type="button"
              disabled={gesperrt}
              onClick={() => onEmoji(e)}
              aria-label={e}
              className="flex aspect-square items-center justify-center rounded-xl text-[26px] leading-none hover:bg-brand-bg disabled:opacity-50"
            >
              {e}
            </button>
          ))}
        </div>
      ) : (
      <div className={`grid ${hoehe} grid-cols-4 content-start gap-1 overflow-y-auto p-2 sm:grid-cols-6`}>
        {liste.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={gesperrt}
            onClick={() => {
              zuletztMerken(s.id);
              onWahl(s.id);
            }}
            title={s.name}
            aria-label={s.name}
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
