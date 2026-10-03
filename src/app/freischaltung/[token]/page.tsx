import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AuthSeite } from "@/components/auth/AuthSeite";
import { FreischaltungAnnehmen } from "./FreischaltungAnnehmen";

export const metadata = { title: "Kostenloser Zugang – TanzRaum" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Vorschau = { tarif: string; bis: string | null; email_maskiert: string; gueltig: boolean; grund: string | null };

// Kostenlose Sonderfreischaltung durch die TanzRaum-Administration. Der Aufruf dieser Seite aktiviert nichts –
// erst „Einladung annehmen“ mit der eingeladenen E-Mail-Adresse.
export default async function FreischaltungSeite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const [{ data: v }, { data: auth }] = await Promise.all([
    UUID.test(token) ? supabase.rpc("freischaltung_einladung_vorschau", { p_token: token }).maybeSingle() : Promise.resolve({ data: null }),
    supabase.auth.getUser(),
  ]);
  const vorschau = v as Vorschau | null;
  const user = auth.user;
  const weiter = encodeURIComponent(`/freischaltung/${token}`);
  const tarif = vorschau?.tarif === "verein" ? "VEREIN" : "BASIC";
  const bis = vorschau?.bis ? new Date(`${vorschau.bis}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }) : null;

  return (
    <AuthSeite>
      <div className="auth-card flex flex-col gap-4">
        {!vorschau ? (
          <>
            <h1>Einladung nicht gefunden</h1>
            <p className="subtitle">Der Link ist ungültig. Bitte wende dich an das TanzRaum-Team.</p>
          </>
        ) : !vorschau.gueltig ? (
          <>
            <h1>Einladung nicht mehr gültig</h1>
            <p className="subtitle">{vorschau.grund}</p>
          </>
        ) : (
          <>
            <h1>Dein kostenloser {tarif}-Zugang</h1>
            <p className="subtitle">
              Das TanzRaum-Team schaltet dich kostenlos für <strong>{tarif}</strong> frei – {bis ? <>bis zum <strong>{bis}</strong></> : <strong>unbefristet</strong>}.
              Es entstehen keine Kosten und nichts verlängert sich kostenpflichtig.
            </p>
            <p className="text-[13px] text-brand-ink-soft">
              Die Einladung gilt für <strong>{vorschau.email_maskiert}</strong>.{" "}
              {tarif === "VEREIN" && "Es ist ein persönlicher Zugang – dafür musst du keinem Verein angehören."}
            </p>
            {user ? (
              <FreischaltungAnnehmen token={token} />
            ) : (
              <>
                <p className="text-[13.5px] text-brand-ink-soft">
                  Melde dich mit dieser E-Mail-Adresse an oder registriere dich neu. Danach kommst du hierher zurück und nimmst die Einladung an.
                </p>
                <Link href={`/signup?weiter=${weiter}`} className="btn-primary text-center">
                  Jetzt registrieren
                </Link>
                <Link href={`/login?weiter=${weiter}`} className="text-center text-[14px] font-semibold text-brand-red">
                  Ich habe schon ein Konto – anmelden
                </Link>
              </>
            )}
          </>
        )}
        {user && (
          <Link href="/dashboard" className="text-center text-[13px] text-brand-ink-soft hover:text-brand-ink">
            Zum Dashboard
          </Link>
        )}
      </div>
    </AuthSeite>
  );
}
