import { stickerInfo, stickerUrl } from "@/lib/chat/sticker";

// Zeigt eine Reaktion: TanzRaum-Sticker als Bild, normales Emoji als Zeichen
export function ReaktionsBild({ wert, groesse = 20 }: { wert: string; groesse?: number }) {
  const s = stickerInfo(wert);
  if (s) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={stickerUrl(wert)} alt={s.name} title={s.name} style={{ width: groesse, height: groesse }} className="object-contain" />;
  }
  return (
    <span aria-label={wert} style={{ fontSize: Math.round(groesse * 0.85), lineHeight: `${groesse}px`, width: groesse, height: groesse }} className="inline-flex items-center justify-center">
      {wert}
    </span>
  );
}
