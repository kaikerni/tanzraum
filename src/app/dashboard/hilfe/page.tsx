import Link from "next/link";
import { RechtsLinks } from "@/components/recht/RechtsLinks";
import { LifeBuoy, Mail, KeyRound, MessageSquare, Trophy } from "lucide-react";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";

export const metadata = { title: "Support & Hilfe – TanzRaum" };

const FRAGEN: { frage: string; antwort: React.ReactNode }[] = [
  {
    frage: "Ich habe mein Passwort vergessen.",
    antwort: (
      <>
        Auf der Anmeldeseite auf „Passwort vergessen?“ tippen – du bekommst einen Link per E-Mail. Angemeldet kannst du dein
        Passwort unter <Link href="/dashboard/einstellungen" className="font-semibold text-brand-red">Einstellungen</Link> ändern.
      </>
    ),
  },
  {
    frage: "Wie komme ich in meinen Verein?",
    antwort: "Über einen Einladungslink oder eine Einladungs-E-Mail deines Vereinsadmins. Einfach öffnen und „Einladung annehmen“ tippen.",
  },
  {
    frage: "Warum sehe ich manche Bereiche nicht?",
    antwort: "Welche Bereiche du siehst, hängt von deinem Tarif und deiner Rolle im Verein ab. Vereinsfunktionen schaltet die Vereinslizenz frei.",
  },
  {
    frage: "Wie melde ich mich für ein Turnier?",
    antwort: (
      <>
        Die offizielle Meldung macht dein Verein beim Verband. In{" "}
        <Link href="/dashboard/turniere" className="font-semibold text-brand-red">Turniere</Link> siehst du geplante Starts und
        sagst deinem Verein, ob du dabei bist.
      </>
    ),
  },
  {
    frage: "Ich bekomme keine E-Mails von TanzRaum.",
    antwort: "Schau bitte im Spam-Ordner nach E-Mails von noreply@tanzraum.app und markiere sie als „kein Spam“.",
  },
];

export default function HilfeSeite() {
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4">
      <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Support &amp; Hilfe</h1>
      <section className={KARTE}>
        <KarteKopf icon={LifeBuoy} titel="Häufige Fragen" />
        <div className="flex flex-col divide-y divide-brand-line">
          {FRAGEN.map((f) => (
            <details key={f.frage} className="group py-3">
              <summary className="cursor-pointer list-none text-[14px] font-semibold text-brand-ink">{f.frage}</summary>
              <p className="mt-2 text-[13.5px] leading-relaxed text-brand-ink-soft">{f.antwort}</p>
            </details>
          ))}
        </div>
      </section>
      <section className={KARTE}>
        <KarteKopf icon={Mail} titel="Kontakt zum TanzRaum-Team" />
        <p className="text-[14px] text-brand-ink-soft">
          Schreib uns an{" "}
          <a href="mailto:info@tanzraum.app" className="font-semibold text-brand-red">
            info@tanzraum.app
          </a>
          . Beschreibe kurz, was passiert ist und auf welchem Gerät – dann können wir schnell helfen.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[12.5px] text-brand-ink-soft">
          <span className="inline-flex items-center gap-1"><KeyRound size={13} /> Konto &amp; Anmeldung</span>
          <span className="inline-flex items-center gap-1"><MessageSquare size={13} /> TanzRaum-Messenger</span>
          <span className="inline-flex items-center gap-1"><Trophy size={13} /> Turniere</span>
        </div>
      </section>
      <RechtsLinks className="justify-center" />
    </div>
  );
}
