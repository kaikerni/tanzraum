import { Users, Building2 } from "lucide-react";
import type { ChatTyp } from "@/lib/chat/getChat";

const FARBEN = ["bg-brand-red", "bg-brand-blue", "bg-brand-green", "bg-brand-purple", "bg-brand-gold", "bg-brand-navy-soft"];

export function farbeFuer(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return FARBEN[Math.abs(h) % FARBEN.length];
}

export function initialen(name: string) {
  const teile = name.replace(/^@/, "").split(/\s+/).filter(Boolean);
  return ((teile[0]?.[0] ?? "?") + (teile.length > 1 ? (teile[teile.length - 1][0] ?? "") : "")).toUpperCase();
}

export function ChatAvatar({ typ, name, avatarUrl, groesse = 48 }: { typ: ChatTyp; name: string; avatarUrl?: string | null; groesse?: number }) {
  const stil = { width: groesse, height: groesse };
  if (typ === "dm") {
    if (avatarUrl) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={avatarUrl} alt="" style={stil} className="shrink-0 rounded-full object-cover" />;
    }
    return (
      <span style={stil} className={`flex shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white ${farbeFuer(name)}`}>
        {initialen(name)}
      </span>
    );
  }
  const Icon = typ === "verein" ? Building2 : Users;
  const farbe = typ === "verein" ? "bg-brand-blue-wash text-brand-blue" : "bg-brand-green-wash text-brand-green";
  return (
    <span style={stil} className={`flex shrink-0 items-center justify-center rounded-full ${farbe}`}>
      <Icon size={Math.round(groesse * 0.45)} />
    </span>
  );
}

export function zeitKurz(iso: string) {
  const d = new Date(iso);
  const tag = (x: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(x);
  const heute = tag(new Date());
  const gestern = tag(new Date(Date.now() - 864e5));
  if (tag(d) === heute) return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  if (tag(d) === gestern) return "Gestern";
  if (Date.now() - d.getTime() < 6 * 864e5) return d.toLocaleDateString("de-DE", { weekday: "long", timeZone: "Europe/Berlin" });
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Berlin" });
}
