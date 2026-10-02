import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, ChevronRight, Flag, GraduationCap, Megaphone, MessageSquareText, Shield, Sparkles, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { RECHTE_GRUPPEN, darfTeam, meineTeamRechte } from "@/lib/team/rechte";

export const metadata = { title: "TanzRaum Team" };

// 🛡 Bereich fuer Teammitglieder: zeigt nur, was ausdruecklich freigegeben ist (jede Aktion prueft die Datenbank erneut)
export default async function TeamBereich() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/team");
  const r = await meineTeamRechte(supabase);
  if (!r.team && !r.admin) redirect("/dashboard");

  const kacheln = [
    darfTeam(r, "workshops.freigeben") || darfTeam(r, "workshops.ablehnen") || darfTeam(r, "workshops.ansehen")
      ? { href: "/dashboard/workshops/pruefen", icon: GraduationCap, titel: "Workshops prüfen", text: "Eingereichte Workshops freigeben oder ablehnen" }
      : null,
    darfTeam(r, "treff.meldungen_bearbeiten")
      ? { href: "/dashboard/treff/meldungen", icon: Flag, titel: "Treff-Meldungen", text: "Gemeldete Themen, Beiträge und Nutzer prüfen" }
      : null,
    r.rechte.has("treff") ? { href: "/dashboard/treff", icon: MessageSquareText, titel: "TanzRaum Treff", text: "Moderation direkt an den Themen" } : null,
    darfTeam(r, "wissen.erstellen") || darfTeam(r, "wissen.bearbeiten") || darfTeam(r, "wissen.veroeffentlichen")
      ? { href: "/dashboard/treff/wissen", icon: BookOpen, titel: "Wissensbeiträge", text: "Wissensbeiträge im TanzRaum Treff erstellen und pflegen" }
      : null,
    darfTeam(r, "news.verwalten") ? { href: "/dashboard/admin/ankuendigungen", icon: Megaphone, titel: "News", text: "TanzRaum-Ankündigungen und Updates" } : null,
    darfTeam(r, "spotlight.meldungen_bearbeiten")
      ? { href: "/dashboard/admin/meldungen", icon: Sparkles, titel: "Spotlight-Meldungen", text: "Gemeldete Spotlights prüfen" }
      : null,
    darfTeam(r, "nutzer.ansehen") || darfTeam(r, "nutzer.sperren")
      ? { href: "/dashboard/team/nutzer", icon: Users, titel: "Nutzerverwaltung", text: "Konten per @Nutzername finden und sperren" }
      : null,
  ].filter((k): k is NonNullable<typeof k> => k !== null);

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
          <Shield size={24} className="text-brand-blue" /> TanzRaum Team
        </h1>
        <p className="text-[13.5px] text-brand-ink-soft">
          {r.admin ? "👑 TanzRaum-Admin – du hast alle Rechte." : `🛡 TanzRaum Team${r.moderator ? " · Moderator" : ""} – du siehst hier nur die Bereiche, die dir der TanzRaum-Admin freigegeben hat.`}
        </p>
      </div>
      {kacheln.length === 0 ? (
        <p className={`${KARTE} text-[13.5px] text-brand-ink-soft`}>Dir wurden noch keine Bereiche freigegeben. Wende dich an den TanzRaum-Admin.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {kacheln.map((k) => (
            <Link key={k.href} href={k.href} className={`${KARTE} flex items-center gap-4 hover:border-brand-red`}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-blue-wash text-brand-blue">
                <k.icon size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold text-brand-ink">{k.titel}</span>
                <span className="block text-[13px] text-brand-ink-soft">{k.text}</span>
              </span>
              <ChevronRight size={18} className="text-brand-ink-soft" />
            </Link>
          ))}
        </div>
      )}
      {!r.admin && (
        <section className={KARTE}>
          <h2 className="mb-2 text-[16px] font-bold text-brand-ink">Deine Rechte</h2>
          <ul className="flex flex-col gap-1.5 text-[13.5px]">
            {RECHTE_GRUPPEN.filter((g) => r.rechte.has(g.bereich)).map((g) => (
              <li key={g.bereich}>
                <strong>
                  {g.emoji} {g.label}:
                </strong>{" "}
                {g.aktionen.filter((a) => r.rechte.has(a.recht)).map((a) => a.label).join(", ") || "nur ansehen"}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
