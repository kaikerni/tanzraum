import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, KeyRound, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { EmailAendern, PasswortAendern, PrivatSchalter } from "@/components/einstellungen/KontoSicherheit";

export const metadata = { title: "Einstellungen – TanzRaum" };

const HINWEISE: Record<string, string> = {
  geaendert: "Deine E-Mail-Adresse wurde geändert. Ab sofort meldest du dich mit der neuen Adresse an.",
};

export default async function EinstellungenSeite({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/einstellungen");

  const { email } = await searchParams;
  const { data: profil } = await supabase.from("profiles").select("konto_privat").eq("id", user.id).maybeSingle();
  const hinweis = email ? HINWEISE[email] : undefined;

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4">
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Einstellungen</h1>
        <p className="text-[14px] text-brand-ink-soft">Konto und Sicherheit</p>
      </div>

      {hinweis && <p className="rounded-lg bg-brand-green-wash px-3 py-2 text-[13px] text-brand-green">{hinweis}</p>}

      <section className={KARTE}>
        <KarteKopf
          icon={Mail}
          titel="E-Mail-Adresse"
          untertitel="Zur Sicherheit bestätigst du die Änderung per Link – an deine bisherige und an deine neue Adresse."
        />
        <EmailAendern aktuell={user.email ?? "–"} ausstehend={user.new_email ?? null} />
      </section>

      <section className={KARTE}>
        <KarteKopf icon={EyeOff} titel="Privatsphäre" />
        <PrivatSchalter privat={!!profil?.konto_privat} />
      </section>

      <section className={KARTE}>
        <KarteKopf
          icon={KeyRound}
          titel="Passwort"
          untertitel="Nach der Änderung wirst du auf allen anderen Geräten abgemeldet. Wir informieren dich zusätzlich per E-Mail."
        />
        <PasswortAendern />
        <p className="mt-3 text-[12.5px] text-brand-ink-soft">
          Passwort vergessen? <Link href="/passwort-vergessen" className="font-semibold text-brand-red">Link zum Zurücksetzen anfordern</Link>
        </p>
      </section>
    </div>
  );
}
