"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check, CreditCard, Building2 } from "lucide-react";
import { zahlungAufruf } from "./zahlungAufruf";
import { vereinFuerLizenzAnlegen } from "@/app/dashboard/tarif/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";
import { euro, ersparnis, gratisMonate, type BezahlTarif, type Periode, type Preise } from "@/lib/tarife";

type AdminVerein = { id: string; name: string; lizenz: boolean };

const LEISTUNGEN: Record<"free" | BezahlTarif, string[]> = {
  free: ["Dein TanzRaum-Konto", "Turnierkalender", "Kontaktanfragen im Netzwerk", "Nachrichten mit Vereinskontakten"],
  basic: ["Alles aus FREE", "TanzRaum-Netzwerk mit Map und Suche", "Eigener Kalender, Dateien, Musik", "Nachrichten im Netzwerk"],
  verein: [
    "Vereinslizenz für deinen Verein",
    "Alle aktiven Mitglieder erhalten VEREIN-Zugang",
    "Mitglieder, Anwesenheit, Trainingsplan, Saison, Finanzen",
    "Trainer-Netzwerk für zugeordnete Trainer",
  ],
};

export function TarifKarten({
  preise,
  effektiv,
  persoenlich,
  vereinszugang,
  vereinName,
  adminVereine,
  startPeriode,
  vorgewaehlterVerein,
  wunsch,
}: {
  preise: Preise;
  effektiv: string;
  persoenlich: string;
  vereinszugang: boolean;
  vereinName: string | null;
  adminVereine: AdminVerein[];
  startPeriode: Periode;
  vorgewaehlterVerein: string | null;
  wunsch: string | null;
}) {
  const [periode, setPeriode] = useState<Periode>(startPeriode);
  const [laedt, setLaedt] = useState<string | null>(null);
  const [fehler, setFehler] = useState<{ tarif: BezahlTarif; text: string } | null>(null);
  const kaufbar = adminVereine.filter((v) => !v.lizenz);
  const [vereinId, setVereinId] = useState<string>(
    kaufbar.find((v) => v.id === vorgewaehlterVerein)?.id ?? kaufbar[0]?.id ?? "",
  );
  const [neu, anlegen] = useActionState(vereinFuerLizenzAnlegen, LEERES_ERGEBNIS);

  async function kaufen(tarif: BezahlTarif, anbieter: "stripe" | "paypal") {
    setFehler(null);
    setLaedt(`${tarif}-${anbieter}`);
    const { daten, fehler } = await zahlungAufruf<{ url?: string }>("zahlung-starten", {
      tarif,
      periode,
      anbieter,
      verein_id: tarif === "verein" ? vereinId || null : null,
    });
    if (fehler || !daten?.url) {
      setLaedt(null);
      setFehler({ tarif, text: fehler ?? "Die Zahlung konnte gerade nicht gestartet werden. Bitte versuche es später erneut." });
      return;
    }
    // Weiter zum Zahlungsanbieter. Freigeschaltet wird erst nach dessen Bestaetigung (Webhook).
    window.location.href = daten.url;
  }

  function Kaufknoepfe({ tarif, gesperrt }: { tarif: BezahlTarif; gesperrt?: boolean }) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={gesperrt || laedt !== null}
          onClick={() => kaufen(tarif, "stripe")}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-brand-red px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-brand-red-deep disabled:opacity-50"
        >
          <CreditCard size={16} /> {laedt === `${tarif}-stripe` ? "Weiter zu Stripe …" : "Karte / Lastschrift"}
        </button>
        <button
          type="button"
          disabled={gesperrt || laedt !== null}
          onClick={() => kaufen(tarif, "paypal")}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-brand-line bg-white px-4 py-2 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg disabled:opacity-50"
        >
          {laedt === `${tarif}-paypal` ? "Weiter zu PayPal …" : "Mit PayPal bezahlen"}
        </button>
        {fehler?.tarif === tarif && <p className="form-error">{fehler.text}</p>}
      </div>
    );
  }

  function Preis({ tarif }: { tarif: BezahlTarif }) {
    const p = preise[tarif][periode];
    const gratis = gratisMonate(preise, tarif);
    return (
      <div className="flex flex-col gap-1">
        <div className="text-[28px] font-extrabold leading-none text-brand-ink">
          {euro(p)}
          <span className="text-[14px] font-semibold text-brand-ink-soft"> / {periode === "jahr" ? "Jahr" : "Monat"}</span>
        </div>
        {periode === "jahr" ? (
          <div className="text-[12.5px] text-brand-ink-soft">
            entspricht {euro(Math.round(p / 12))} pro Monat · du sparst {euro(ersparnis(preise, tarif))} gegenüber monatlich
            {gratis > 0 && (
              <span className="mt-1 block w-fit rounded-full bg-brand-gold-wash px-2.5 py-0.5 text-[12px] font-bold text-brand-ink">
                🎁 {gratis} {gratis === 1 ? "MONAT" : "MONATE"} GRATIS
              </span>
            )}
          </div>
        ) : (
          <div className="text-[12.5px] text-brand-ink-soft">
            monatlich kündbar · jährlich {euro(preise[tarif].jahr)} ({gratis > 0 ? `${gratis} Monate gratis` : "günstiger"})
          </div>
        )}
        <div className="text-[12px] text-brand-ink-soft">
          Abrechnung {periode === "jahr" ? "jährlich im Voraus" : "monatlich im Voraus"}, verlängert sich automatisch, jederzeit zum Laufzeitende kündbar.
        </div>
      </div>
    );
  }

  function Liste({ tarif }: { tarif: "free" | BezahlTarif }) {
    return (
      <ul className="flex flex-col gap-1.5 text-[13px] text-brand-ink">
        {LEISTUNGEN[tarif].map((l) => (
          <li key={l} className="flex gap-2">
            <Check size={15} className="mt-0.5 shrink-0 text-brand-green" /> {l}
          </li>
        ))}
      </ul>
    );
  }

  const karte = (hervor: boolean) =>
    `flex flex-col gap-4 rounded-[var(--radius-l)] border bg-white p-5 shadow-[var(--shadow)] ${hervor ? "border-brand-red ring-2 ring-brand-red/20" : "border-brand-line"}`;
  const hinweis = "rounded-xl bg-brand-bg px-3 py-2 text-[13px] font-semibold text-brand-ink";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[18px] font-bold text-brand-ink">Tarife</h2>
        <div className="inline-flex rounded-full border border-brand-line bg-white p-1 text-[13px]">
          {(["monat", "jahr"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriode(p)}
              className={`rounded-full px-3.5 py-1 font-semibold ${periode === p ? "bg-brand-red text-white" : "text-brand-ink-soft"}`}
            >
              {p === "monat" ? "Monatlich" : "Jährlich · 🎁 2 Monate gratis"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* FREE */}
        <section className={karte(effektiv === "free")}>
          <div>
            <div className="text-[13px] font-bold tracking-wide text-brand-ink-soft">FREE</div>
            <div className="text-[28px] font-extrabold text-brand-ink">0 €</div>
            <div className="text-[12.5px] text-brand-ink-soft">dauerhaft kostenlos</div>
          </div>
          <Liste tarif="free" />
          {effektiv === "free" && <div className={hinweis}>Dein aktueller Tarif</div>}
        </section>

        {/* BASIC */}
        <section className={karte(wunsch === "basic" || persoenlich === "basic")}>
          <div className="text-[13px] font-bold tracking-wide text-brand-ink-soft">BASIC · für dich persönlich</div>
          <Preis tarif="basic" />
          <Liste tarif="basic" />
          <div className="mt-auto">
            {persoenlich === "basic" ? (
              <div className={hinweis}>Dein BASIC-Abo ist eingerichtet (siehe oben)</div>
            ) : vereinszugang ? (
              <div className={hinweis}>Über {vereinName ?? "deinen Verein"} hast du bereits VEREIN-Zugang – BASIC brauchst du nicht.</div>
            ) : (
              <Kaufknoepfe tarif="basic" />
            )}
          </div>
        </section>

        {/* VEREIN */}
        <section id="verein" className={karte(wunsch === "verein")}>
          <div className="text-[13px] font-bold tracking-wide text-brand-ink-soft">VEREIN · Lizenz für deinen Verein</div>
          <Preis tarif="verein" />
          <Liste tarif="verein" />
          <p className="text-[12px] text-brand-ink-soft">
            Unbegrenzt viele Mitglieder. Wer aktiv im Verein ist, ist automatisch abgedeckt; wer aus dem Verein entfernt wird,
            verliert die Abdeckung. Ein eigenes BASIC-Abo wird währenddessen pausiert – keine doppelte Zahlung.
          </p>
          <div className="mt-auto flex flex-col gap-3">
            {kaufbar.length > 0 ? (
              <>
                {kaufbar.length > 1 ? (
                  <label className="field">
                    <span>Für welchen Verein?</span>
                    <select value={vereinId} onChange={(e) => setVereinId(e.target.value)}>
                      {kaufbar.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="flex items-center gap-2 text-[13px] text-brand-ink">
                    <Building2 size={16} className="text-brand-gold" /> für <strong>{kaufbar[0].name}</strong>
                  </div>
                )}
                <Kaufknoepfe tarif="verein" gesperrt={!vereinId} />
              </>
            ) : adminVereine.length > 0 ? (
              <div className={hinweis}>
                Deine Vereine haben bereits eine aktive Lizenz.{" "}
                <Link href="/dashboard/verein" className="text-brand-red underline">
                  Zum Verein
                </Link>
              </div>
            ) : (
              <form action={anlegen} className="flex flex-col gap-2">
                <p className="text-[12.5px] text-brand-ink-soft">
                  Die Lizenz kauft der Vereinsadmin. Du hast noch keinen Verein, den du verwaltest – lege ihn hier an (du wirst
                  Vereinsadmin) und kaufe danach die Lizenz.
                </p>
                <label className="field">
                  <span>Vereinsname</span>
                  <input name="name" required placeholder="z. B. Karnevalsclub Musterstadt" />
                </label>
                <label className="field">
                  <span>Kürzel (optional)</span>
                  <input name="kuerzel" placeholder="z. B. KCM" />
                </label>
                <Meldung ergebnis={neu} />
                <SendenButton laedtText="Wird angelegt …" variante="sekundaer">
                  Verein anlegen
                </SendenButton>
              </form>
            )}
          </div>
        </section>
      </div>

      <p className="text-[12px] text-brand-ink-soft">
        Mit dem Kauf akzeptierst du die{" "}
        <Link href="/nutzungsbedingungen" className="underline">
          Nutzungsbedingungen
        </Link>{" "}
        – Hinweise zur Verarbeitung deiner Daten findest du in der{" "}
        <Link href="/datenschutz" className="underline">
          Datenschutzerklärung
        </Link>
        . Freigeschaltet wird dein Tarif, sobald der Zahlungsanbieter die Zahlung bestätigt.
      </p>
    </div>
  );
}
