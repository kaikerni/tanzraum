"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MailPlus, Send, Ban } from "lucide-react";
import { SendenButton, Meldung, LEERES_ERGEBNIS, type AktionsErgebnis } from "@/components/ui/SendenButton";
import {
  freischaltungEinladen,
  freischaltungEinladungErneutSenden,
  freischaltungEinladungWiderrufen,
  type FreischaltungEinladung,
} from "@/app/dashboard/admin/lizenzen/actions";

const STATUS: Record<FreischaltungEinladung["status"], { text: string; farbe: string }> = {
  ausstehend: { text: "ausstehend", farbe: "bg-brand-gold-wash text-brand-ink" },
  aktiv: { text: "aktiv", farbe: "bg-brand-green-wash text-brand-green" },
  abgelaufen: { text: "abgelaufen", farbe: "bg-brand-bg text-brand-ink-soft" },
  widerrufen: { text: "widerrufen", farbe: "bg-brand-red-wash text-brand-red" },
};

const datum = (iso: string | null) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }) : null;

// Kostenlose Sonderfreischaltung (nur TanzRaum-Admin): Einladung per E-Mail, aktiv erst nach Annahme durch die Person.
// Keine Vereinsfunktion – VEREIN ist hier ein persoenlicher Zugang ohne Verein, Mitgliedschaft oder Vereinslizenz.
export function FreischaltungEinladungen({ einladungen }: { einladungen: FreischaltungEinladung[] }) {
  const [ergebnis, aktion] = useActionState(freischaltungEinladen, LEERES_ERGEBNIS);
  const [laufzeit, setLaufzeit] = useState<"unbegrenzt" | "befristet">("unbegrenzt");
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();
  const router = useRouter();
  const heute = new Date().toISOString().slice(0, 10);
  // nach erfolgreichem Senden wird das Formular geleert – Laufzeit wieder auf „unbegrenzt“
  useEffect(() => {
    if (ergebnis.ok) setLaufzeit("unbegrenzt");
  }, [ergebnis]);

  const ausfuehren = (f: () => Promise<AktionsErgebnis>) =>
    starte(async () => {
      const r = await f();
      setMeldung(r);
      if (!r.error) router.refresh();
    });

  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-l)] border border-brand-line bg-white p-4 shadow-[var(--shadow)] sm:p-5">
      <div>
        <h2 className="flex items-center gap-2 text-[17px] font-bold text-brand-ink">
          <MailPlus size={19} className="text-brand-red" /> Kostenlos einladen
        </h2>
        <p className="text-[12.5px] text-brand-ink-soft">
          Für Trainer, Partner, Tester, Presse oder besondere Nutzer – eine Vereinsmitgliedschaft ist nicht nötig. Die Person erhält eine E-Mail; der Zugang
          wird erst aktiviert, wenn sie die Einladung mit dieser E-Mail-Adresse annimmt. VEREIN ist hier ein persönlicher Zugang – es entsteht kein Verein, keine
          Mitgliedschaft und keine Vereinslizenz.
        </p>
      </div>
      <form action={aktion} className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="field md:col-span-2">
          <span>E-Mail-Adresse</span>
          <input name="email" type="email" required autoComplete="off" placeholder="name@beispiel.de" />
        </label>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-[13px] font-semibold text-brand-ink">Tarif</legend>
          {(["basic", "verein"] as const).map((t) => (
            <label key={t} className="flex min-h-9 items-center gap-2 text-[14px] text-brand-ink">
              <input type="radio" name="tarif" value={t} defaultChecked={t === "basic"} className="h-4 w-4 accent-brand-red" />
              {t.toUpperCase()}
            </label>
          ))}
        </fieldset>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-[13px] font-semibold text-brand-ink">Laufzeit</legend>
          <label className="flex min-h-9 items-center gap-2 text-[14px] text-brand-ink">
            <input type="radio" name="laufzeit" value="unbegrenzt" checked={laufzeit === "unbegrenzt"} onChange={() => setLaufzeit("unbegrenzt")} className="h-4 w-4 accent-brand-red" />
            unbegrenzt
          </label>
          <label className="flex min-h-9 items-center gap-2 text-[14px] text-brand-ink">
            <input type="radio" name="laufzeit" value="befristet" checked={laufzeit === "befristet"} onChange={() => setLaufzeit("befristet")} className="h-4 w-4 accent-brand-red" />
            befristet
          </label>
          {laufzeit === "befristet" && (
            <label className="field">
              <span>Kostenlos bis</span>
              <input name="bis" type="date" min={heute} required />
            </label>
          )}
        </fieldset>
        <label className="field md:col-span-2">
          <span>Interner Vermerk (optional)</span>
          <input name="notiz" maxLength={500} placeholder="z. B. Influencer Kooperation, Tester, 12 Monate kostenlos" />
        </label>
        <div className="flex flex-col gap-2 md:col-span-2">
          <Meldung ergebnis={ergebnis} />
          <SendenButton laedtText="Wird gesendet …" className="w-fit">
            Einladung senden
          </SendenButton>
        </div>
      </form>

      <div className="flex flex-col gap-2">
        <h3 className="text-[14px] font-bold text-brand-ink">Einladungen ({einladungen.length})</h3>
        {meldung && <Meldung ergebnis={meldung} />}
        {einladungen.length === 0 ? (
          <p className="text-[13px] text-brand-ink-soft">Noch keine Einladungen.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-brand-line rounded-xl border border-brand-line">
            {einladungen.map((e) => (
              <li key={e.id} className="flex flex-col gap-1.5 px-3 py-2.5 text-[13px] sm:flex-row sm:items-center sm:gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-brand-ink [overflow-wrap:anywhere]">{e.email}</span>
                    <span className="rounded-full bg-brand-bg px-2 py-0.5 text-[11px] font-bold text-brand-ink">{e.tarif.toUpperCase()}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS[e.status].farbe}`}>{STATUS[e.status].text}</span>
                  </div>
                  <div className="text-[12px] text-brand-ink-soft">
                    {e.nutzer ? `Nutzer: ${e.nutzer} · ` : "noch kein Konto · "}
                    gesendet: {datum(e.gesendetAm) ?? "–"} · angenommen: {e.angenommen ? `ja (${datum(e.angenommenAm)})` : "nein"} · gültig bis:{" "}
                    {e.bis ? datum(e.bis) : "unbegrenzt"}
                    {e.notiz ? ` · ${e.notiz}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {e.status === "ausstehend" && (
                    <button
                      type="button"
                      disabled={laeuft}
                      onClick={() => ausfuehren(() => freischaltungEinladungErneutSenden(e.id))}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-brand-line px-2.5 text-[12.5px] font-semibold text-brand-ink hover:bg-brand-bg disabled:opacity-50"
                    >
                      <Send size={14} /> Erneut senden
                    </button>
                  )}
                  {(e.status === "ausstehend" || e.status === "aktiv") && (
                    <button
                      type="button"
                      disabled={laeuft}
                      onClick={() => {
                        if (window.confirm(e.status === "aktiv" ? "Freischaltung beenden und Einladung widerrufen?" : "Einladung widerrufen?"))
                          ausfuehren(() => freischaltungEinladungWiderrufen(e.id));
                      }}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-brand-line px-2.5 text-[12.5px] font-semibold text-brand-red hover:bg-brand-red-wash disabled:opacity-50"
                    >
                      <Ban size={14} /> Widerrufen
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
