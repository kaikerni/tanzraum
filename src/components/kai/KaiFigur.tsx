import Image from "next/image";
import { kaiBild } from "@/lib/kai/posen";
import type { KaiPose } from "@/lib/kai/typen";

// Kai als Bild – immer freigestellt (transparent), nie mit Hintergrundflaeche.
// form="voll": ganze Figur im Seitenverhaeltnis des Masterbilds (2:3), in einen Rahmen mit fester Groesse eingepasst.
// form="portrait": Kopf mit Federhut, rund beschnitten (fuer Knoepfe und kleine Hinweise).
export function KaiFigur({
  form = "voll",
  pose = "begruessung",
  className = "",
  sizes,
  alt = "Kai, der TanzRaum-Begleiter",
  priority = false,
}: {
  form?: "voll" | "portrait";
  pose?: KaiPose;
  /** Groesse des Rahmens (z. B. "h-48 w-32" oder "h-10 w-10") */
  className?: string;
  sizes?: string;
  alt?: string;
  priority?: boolean;
}) {
  const bild = kaiBild(pose);
  if (form === "portrait") {
    return (
      <span className={`relative block shrink-0 overflow-hidden rounded-full ring-2 ring-brand-gold/70 ${className}`}>
        <Image src={bild.portrait} alt={alt} fill sizes={sizes ?? "64px"} className="object-cover" priority={priority} />
      </span>
    );
  }
  return (
    <span className={`relative block shrink-0 ${className}`}>
      <Image src={bild.voll} alt={alt} fill sizes={sizes ?? "256px"} className="object-contain object-bottom" priority={priority} />
    </span>
  );
}
