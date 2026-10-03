import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EinladungAnnehmen } from "./EinladungAnnehmen";
import { AuthSeite } from "@/components/auth/AuthSeite";

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
      <AuthSeite>
        <div className="auth-card flex flex-col gap-4">
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
                {vorschau.persoenlich ? (
                  <>
                    Das ist deine persönliche Einladung von <strong>{vorschau.verein_name}</strong>. Dein Verein führt dich bereits als Mitglied
                    {vorschau.gruppe_name ? (
                      <>
                        {" "}
                        (Gruppe <strong>{vorschau.gruppe_name}</strong>)
                      </>
                    ) : null}{" "}
                    – mit deinem TanzRaum-Konto bist du dann direkt dabei.
                  </>
                ) : vorschau.admin_einladung ? (
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
      </AuthSeite>
    );
  }

  const [{ data }, { data: vor }, { data: wechselNoetig }] = UUID.test(token)
    ? await Promise.all([
        supabase.rpc("einladung_info", { p_token: token }).maybeSingle(),
        supabase.rpc("einladung_vorschau", { p_token: token }).maybeSingle(),
        supabase.rpc("einladung_wechsel_noetig", { p_token: token }),
      ])
    : [{ data: null }, { data: null }, { data: null }];
  const wechsel = wechselNoetig === true;
  // Person ist einem anderen Verein zugeordnet: deutlicher Hinweis, Annehmen = ausdrueckliche Zustimmung zum Wechsel
  const wechselHinweisVorlage = (vereinName: string | null) => wechsel ? (
    <p className="rounded-xl border border-brand-gold/50 bg-brand-gold-wash px-3 py-2.5 text-[13.5px] text-brand-ink">
      Du bist derzeit einem anderen Verein zugeordnet. Wenn du die Anfrage annimmst, wird deine bisherige Vereinszuordnung beendet und dein TanzRaum-Konto{" "}
      {vereinName ?? "dem neuen Verein"} zugeordnet – sobald dein bisheriger Verein dich freigibt. Dein Konto, Profil, Spotlights und Nachrichten bleiben
      erhalten; Vereinsdaten deines bisherigen Vereins werden nicht übertragen.
    </p>
  ) : null;
  // deno-lint-ignore no-explicit-any
  const info = data as any;
  // Persoenliche Einladung (importiertes/angelegtes Vereinsmitglied): Konto wird mit dem Mitglied verbunden
  // deno-lint-ignore no-explicit-any
  const persoenlich = !!(vor as any)?.persoenlich;
  // deno-lint-ignore no-explicit-any
  const gruppeName = info?.gruppe_name ?? (vor as any)?.gruppe_name ?? null;

  return (
    <AuthSeite>
      <div className="auth-card flex flex-col gap-4">
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
        ) : persoenlich ? (
          <>
            <h1>Einladung zu {info.verein_name}</h1>
            <p className="subtitle">
              {info.eingeladen_von ? <strong>{info.eingeladen_von}</strong> : "Dein Verein"} hat dich persönlich zu TanzRaum eingeladen. Du bist bei{" "}
              <strong>{info.verein_name}</strong> bereits als Mitglied eingetragen
              {gruppeName ? (
                <>
                  {" "}
                  (Gruppe <strong>{gruppeName}</strong>)
                </>
              ) : null}
              . Mit „Einladung annehmen“ wird dein TanzRaum-Konto mit deinem Vereinsmitglied verbunden.
            </p>
            {wechselHinweisVorlage(info.verein_name)}
            <EinladungAnnehmen token={token} wechsel={wechsel} />
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
              beizutreten. {wechsel ? "" : "Mit „Einladung annehmen“ bist du dabei."}
            </p>
            {wechselHinweisVorlage(info.verein_name)}
            <EinladungAnnehmen token={token} wechsel={wechsel} />
          </>
        )}
        <Link href="/dashboard" className="text-center text-[13px] text-brand-ink-soft hover:text-brand-ink">
          Zum Dashboard
        </Link>
      </div>
    </AuthSeite>
  );
}
