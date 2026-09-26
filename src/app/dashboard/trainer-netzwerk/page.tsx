import Link from "next/link";
import { redirect } from "next/navigation";
import { Handshake, Inbox, Users, Search, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getNetzwerkKontakte, getNetzwerkModus, NETZWERK_TITEL } from "@/lib/netzwerk/getNetzwerk";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { ChatAvatar } from "@/components/chat/ChatAvatar";
import { NetzwerkSuche } from "@/components/netzwerk/NetzwerkSuche";
import { NetzwerkAktion } from "@/components/netzwerk/NetzwerkAktion";

export const metadata = { title: "Netzwerk – TanzRaum" };

export default async function NetzwerkSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/trainer-netzwerk");

  const modus = await getNetzwerkModus(supabase);
  if (!modus) {
    return (
      <div className="mx-auto flex max-w-[720px] flex-col gap-4">
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Trainer-Netzwerk</h1>
        <p className={`${KARTE} text-[14px] text-brand-ink-soft`}>
          Das Trainer-Netzwerk steht Trainerinnen, Trainern und Vereins-Admins in Vereinen mit Vereinslizenz zur Verfügung. Mit dem
          persönlichen Basic-Tarif (ohne Verein) nutzt du das TanzRaum-Netzwerk.
        </p>
      </div>
    );
  }

  const kontakte = await getNetzwerkKontakte(supabase);
  const eingehend = kontakte.filter((k) => k.status === "eingehend");
  const ausstehend = kontakte.filter((k) => k.status === "ausstehend");
  const verbunden = kontakte.filter((k) => k.status === "verbunden");
  const titel = NETZWERK_TITEL[modus];

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">{titel}</h1>
        <p className="text-[14px] text-brand-ink-soft">
          {modus === "trainer"
            ? "Vernetze dich mit Trainerinnen, Trainern und Vereins-Admins anderer TanzRaum-Vereine – ohne private Handynummern auszutauschen."
            : "Vernetze dich mit anderen TanzRaum-Mitgliedern – ohne private Handynummern auszutauschen."}
        </p>
      </div>

      <section className={KARTE}>
        <KarteKopf
          icon={Search}
          titel={modus === "trainer" ? "Trainer finden" : "Mitglieder finden"}
          untertitel={
            modus === "trainer"
              ? "Gefunden werden nur Trainer/innen und Vereins-Admins aus Vereinen mit Vereinslizenz, deren Konto nicht privat ist."
              : "Gefunden werden TanzRaum-Mitglieder, deren Konto nicht privat ist."
          }
        />
        <NetzwerkSuche platzhalter="Name oder @Nutzername" />
      </section>

      {eingehend.length > 0 && (
        <section className={`${KARTE} border-brand-gold/40`}>
          <KarteKopf icon={Inbox} titel={`Anfragen an dich (${eingehend.length})`} />
          <ul className="flex flex-col gap-3">
            {eingehend.map((k) => (
              <li key={k.userId} className="flex flex-col gap-2 rounded-2xl bg-brand-gold-wash/50 p-3 sm:flex-row sm:items-center">
                <Link href={`/dashboard/trainer-netzwerk/${k.userId}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <ChatAvatar typ="dm" name={k.anzeige} avatarUrl={k.avatarUrl} groesse={42} />
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-semibold text-brand-ink">{k.anzeige}</p>
                    <p className="truncate text-[12.5px] text-brand-ink-soft">{k.vereine ?? (k.handle ? `@${k.handle}` : "")}</p>
                  </div>
                </Link>
                <NetzwerkAktion userId={k.userId} name={k.anzeige} status="eingehend" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={KARTE}>
        <KarteKopf icon={Users} titel={`Meine Verbindungen${verbunden.length ? ` (${verbunden.length})` : ""}`} />
        {verbunden.length === 0 ? (
          <p className="text-[13.5px] text-brand-ink-soft">
            Noch keine Verbindungen. Suche oben nach Namen – nach dem Annehmen entsteht ein direkter Chat im TanzRaum-Messenger.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-brand-line">
            {verbunden.map((k) => (
              <li key={k.userId} className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                <Link href={`/dashboard/trainer-netzwerk/${k.userId}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <ChatAvatar typ="dm" name={k.anzeige} avatarUrl={k.avatarUrl} groesse={42} />
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-semibold text-brand-ink">{k.anzeige}</p>
                    <p className="truncate text-[12.5px] text-brand-ink-soft">{k.vereine ?? (k.handle ? `@${k.handle}` : "")}</p>
                  </div>
                </Link>
                <NetzwerkAktion userId={k.userId} name={k.anzeige} status="verbunden" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {ausstehend.length > 0 && (
        <section className={KARTE}>
          <KarteKopf icon={Handshake} titel="Gesendete Anfragen" />
          <ul className="flex flex-col divide-y divide-brand-line">
            {ausstehend.map((k) => (
              <li key={k.userId} className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                <Link href={`/dashboard/trainer-netzwerk/${k.userId}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <ChatAvatar typ="dm" name={k.anzeige} avatarUrl={k.avatarUrl} groesse={38} />
                  <p className="truncate text-[14px] font-semibold text-brand-ink">{k.anzeige}</p>
                </Link>
                <NetzwerkAktion userId={k.userId} name={k.anzeige} status="ausstehend" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="flex items-start gap-2 px-1 text-[12.5px] text-brand-ink-faint">
        <ShieldCheck size={15} className="mt-0.5 shrink-0" />
        Wer nicht gefunden werden möchte, stellt sein Konto in den Einstellungen auf „privat“. Blockierte Personen können dich weder
        finden noch anfragen.
      </p>
    </div>
  );
}
