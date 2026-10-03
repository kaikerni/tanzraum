import { Fragment, type ReactNode } from "react";
import { stickerInfo, stickerUrl } from "@/lib/chat/sticker";
import { nurSmileys, textTeile } from "@/lib/chat/inlineSmileys";

// Nachrichtentext mit eingebetteten TanzRaum-Smileys („:t01:“). Textteile rendert `text` (z. B. mit Links).
// Nur Smileys (bis 3) werden groesser dargestellt.
export function TextMitSmileys({ text, textTeil, gross = true }: { text: string; textTeil?: (t: string, i: number) => ReactNode; gross?: boolean }) {
  const anzahl = gross ? nurSmileys(text) : 0;
  const groesse = anzahl > 0 && anzahl <= 3 ? "h-14 w-14" : "h-[1.6em] w-[1.6em]";
  return (
    <>
      {textTeile(text).map((t, i) =>
        t.art === "smiley" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={stickerUrl(t.id)}
            alt={stickerInfo(t.id)?.name ?? "Smiley"}
            title={stickerInfo(t.id)?.name}
            className={`inline-block ${groesse} object-contain align-[-0.35em]`}
            loading="lazy"
          />
        ) : (
          <Fragment key={i}>{textTeil ? textTeil(t.text, i) : t.text}</Fragment>
        ),
      )}
    </>
  );
}
