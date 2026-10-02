import { farbeFuer, initialen } from "@/components/chat/ChatAvatar";

// Profilbild oder Initialen (fuer Listen in Admin, Team, Treff)
export function NutzerAvatar({ name, avatarUrl, groesse = 40 }: { name: string; avatarUrl?: string | null; groesse?: number }) {
  const stil = { width: groesse, height: groesse };
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt="" style={stil} className="shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      style={{ ...stil, fontSize: Math.max(11, Math.round(groesse * 0.36)) }}
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${farbeFuer(name)}`}
      aria-hidden
    >
      {initialen(name.replace(/^@/, ""))}
    </span>
  );
}
