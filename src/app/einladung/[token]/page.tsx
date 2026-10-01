import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { EinladungAnnehmen } from "./EinladungAnnehmen";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EinladungSeite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Ohne Anmeldung: nur Verein + Rolle zeigen. Eine Einladung ist kein Konto – erst registrieren bzw. anmelden,
  // danach hier „Einladung annehmen“.
  if (!user) {
    const { data: v } = UUID.test(token) ? await supabase.rpc("einladung_vorschau", { p_token: token }).maybeSingle() : { data: null };
    // deno-lint-ignore no-explicit-any
    const vorschau = v as any;
    const weiter = encodeURIComponent(`/einladung/${token}`);
    return (
      <div className="auth-page">
        <div className="auth-card flex flex-col gap-4">
          <Image src="/tanzraum-logo-header.webp" alt="TanzRaum" width={1392} height={207} className="h-10 w-auto self-start" />
          {!vorschau ? (
            <>
              <h1>Einladung nicht gefunden</h1>
              <p className="subtitle">Der Link ist ungültig. Bitte frag nach einem neuen Einladungslink.</p>
            </>
          ) : !vorschau.gueltig ? (
            <>
              <h1>Einladung nicht mehr gültig</h1>
              <p className="subtitle">{vorschau.grund}</p>
            </>
          ) : (
            <>
              <h1>{vorschau.admin_einladung ? "Einladung als Vereinsadmin" : `Einladung zu ${vorschau.verein_name}`}</h1>
              <p className="subtitle">
                {vorschau.admin_einladung ? (
                  <>
                    Du wurdest eingeladen, <strong>Vereinsadmin</strong> von <strong>{vorschau.verein_name}</strong> zu werden.
                  </>
                ) : (
                  <>
                    Du wurdest eingeladen, als <strong>{vorschau.rolle ?? "Mitglied"}</strong>{" "}
                    {vorschau.gruppe_name ? (
                      <>
                        der Gruppe <strong>{vorschau.gruppe_name}</strong> im Verein <strong>{vorschau.verein_name}</strong>
                      </>
                    ) : (
                      <>
                        dem Verein <strong>{vorschau.verein_name}</strong>
                      </>
                    )}{" "}
                    beizutreten.
                  </>
                )}
              </p>
              <p className="text-[13.5px] text-brand-ink-soft">
                Dafür brauchst du ein eigenes TanzRaum-Konto. Registriere dich (oder melde dich an) – danach kommst du hierher zurück und nimmst
                die Einladung an.
              </p>
              <Link href={`/signup?weiter=${weiter}`} className="btn-primary text-center">
                Jetzt registrieren
              </Link>
              <Link href={`/login?weiter=${weiter}`} className="text-center text-[14px] font-semibold text-brand-red">
                Ich habe schon ein Konto – anmelden
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  const { data } = UUID.test(token)
    ? await supabase.rpc("einladung_info", { p_token: token }).maybeSingle()
    : { data: null };
  // deno-lint-ignore no-explicit-any
  const info = data as any;

  return (
    <div className="auth-page">
      <div className="auth-card flex flex-col gap-4">
        <Image src="/tanzraum-logo-header.webp" alt="TanzRaum" width={1392} height={207} className="h-10 w-auto self-start" />
        {!info ? (
          <>
            <h1>Einladung nicht gefunden</h1>
            <p className="subtitle">Der Link ist ungültig. Bitte frag im Verein nach einem neuen Einladungslink.</p>
          </>
        ) : !info.gueltig ? (
          <>
            <h1>Einladung nicht mehr gültig</h1>
            <p className="subtitle">{info.grund}</p>
          </>
        ) : (
          <>
            <h1>
              {/admin/i.test(info.rolle ?? "")
                ? `Vereinsadmin von ${info.verein_name}`
                : info.gruppe_name
                ? `Einladung zur Gruppe ${info.gruppe_name}`
                : `Einladung zu ${info.verein_name}`}
            </h1>
            <p className="subtitle">
              {info.eingeladen_von ? (
                <>
                  <strong>{info.eingeladen_von}</strong> lädt dich ein
                </>
              ) : (
                "Du wurdest eingeladen"
              )}
              , als <strong>{info.rolle ?? "Mitglied"}</strong>{" "}
              {info.gruppe_name ? (
                <>
                  der Gruppe <strong>{info.gruppe_name}</strong> im Verein <strong>{info.verein_name}</strong>
                </>
              ) : (
                <>
                  dem Verein <strong>{info.verein_name}</strong>
                </>
              )}{" "}
              beizutreten. Mit „Einladung annehmen“ bist du dabei.
            </p>
            <EinladungAnnehmen token={token} />
          </>
        )}
        <Link href="/dashboard" className="text-center text-[13px] text-brand-ink-soft hover:text-brand-ink">
          Zum Dashboard
        </Link>
      </div>
    </div>
  );
}
