"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CreditCard, Building2, Landmark } from "lucide-react";
import { zahlungAufruf } from "./zahlungAufruf";
import { ueberweisungBeantragen, vereinFuerLizenzAnlegen } from "@/app/dashboard/tarif/actions";
import { TARIF_LEISTUNGEN } from "@/lib/tarif-leistungen";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";
import { euro, gratisMonate, jahrHinweis, jahrKurz, type BezahlTarif, type Periode, type Preise } from "@/lib/tarife";
import { LEISTUNGSBEGINN_TEXT } from "@/lib/recht/leistungsbeginn";

type AdminVerein = { id: string; name: string; lizenz: boolean };

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
  ueberweisungMoeglich = false,
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
  ueberweisungMoeglich?: boolean;
}) {
  const [periode, setPeriode] = useState<Periode>(startPeriode);
  const [laedt, setLaedt] = useState<string | null>(null);
  const [leistungsbeginn, setLeistungsbeginn] = useState(false);
  const [fehler, setFehler] = useState<{ tarif: BezahlTarif; text: string } | null>(null);
  const kaufbar = adminVereine.filter((v) => !v.lizenz);
  const [vereinId, setVereinId] = useState<string>(
    kaufbar.find((v) => v.id === vorgewaehlterVerein)?.id ?? kaufbar[0]?.id ?? "",
  );
  const [neu, anlegen] = useActionState(vereinFuerLizenzAnlegen, LEERES_ERGEBNIS);
  const router = useRouter();
  const inklusive = jahrKurz(preise, "basic");
  const [ueLaeuft, ueStarten] = useTransition();
  const [ueMeldung, setUeMeldung] = useState<{ error: string | null; ok?: string | null } | null>(null);

  function perUeberweisung() {
    setUeMeldung(null);
    ueStarten(async () => {
      const r = await ueberweisungBeantragen(vereinId, leistungsbeginn);
      setUeMeldung(r);
      if (!r.error) {
        router.refresh();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  async function kaufen(tarif: BezahlTarif, anbieter: "stripe" | "paypal") {
    setFehler(null);
    setLaedt(`${tarif}-${anbieter}`);
    const { daten, fehler } = await zahlungAufruf<{ url?: string }>("zahlung-starten", {
      tarif,
      periode,
      anbieter,
      verein_id: tarif === "verein" ? vereinId || null : null,
      leistungsbeginn,
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
        <label className="flex items-start gap-2 text-[12px] leading-snug text-brand-ink-soft">
          <input
            type="checkbox"
            checked={leistungsbeginn}
            onChange={(e) => setLeistungsbeginn(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-red"
          />
          <span>
            {LEISTUNGSBEGINN_TEXT}{" "}
            <Link href="/nutzungsbedingungen#widerruf" target="_blank" className="font-semibold text-brand-red hover:underline">
              Widerrufsbelehrung
            </Link>
          </span>
        </label>
        <button
          type="button"
          disabled={gesperrt || laedt !== null || !leistungsbeginn}
          onClick={() => kaufen(tarif, "stripe")}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-brand-red px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-brand-red-deep disabled:opacity-50"
        >
          <CreditCard size={16} />{" "}
          {laedt === `${tarif}-stripe` ? "Weiter zu Stripe …" : tarif === "verein" ? "SEPA-Lastschrift" : "Karte, Apple/Google Pay, Lastschrift"}
        </button>
        {tarif === "verein" && (
          <p className="text-[12px] text-brand-ink-soft">Freischaltung nach Zahlungseingang, bei Lastschrift in der Regel 3–5 Werktage.</p>
        )}
        <button
          type="button"
          disabled={gesperrt || laedt !== null || !leistungsbeginn}
          onClick={() => kaufen(tarif, "paypal")}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-brand-line bg-white px-4 py-2 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg disabled:opacity-50"
        >
          {laedt === `${tarif}-paypal` ? "Weiter zu PayPal …" : "Mit PayPal bezahlen"}
        </button>
        {tarif === "verein" && ueberweisungMoeglich && periode === "jahr" && (
          <button
            type="button"
            disabled={gesperrt || laedt !== null || ueLaeuft || !leistungsbeginn}
            onClick={perUeberweisung}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-brand-line bg-white px-4 py-2 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg disabled:opacity-50"
          >
            <Landmark size={16} /> {ueLaeuft ? "Wird beauftragt …" : "Per Überweisung (ohne Gebühren)"}
          </button>
        )}
        {tarif === "verein" && ueberweisungMoeglich && periode === "monat" && (
          <p className="text-[12px] text-brand-ink-soft">
            Per Überweisung?{" "}
            <button type="button" onClick={() => setPeriode("jahr")} className="font-semibold text-brand-red underline">
              Bei jährlicher Zahlung möglich
            </button>
          </p>
        )}
        {tarif === "verein" && ueMeldung?.error && <p className="form-error">{ueMeldung.error}</p>}
        {tarif === "verein" && ueMeldung?.ok && <p className="form-success">{ueMeldung.ok}</p>}
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
            oder {euro(preise[tarif].monat)} pro Monat bei monatlicher Zahlung
            {gratis > 0 && (
              <span className="mt-1 block w-fit rounded-full bg-brand-green-wash px-2.5 py-0.5 text-[12px] font-bold text-brand-green">{jahrKurz(preise, tarif)}</span>
            )}
            {jahrHinweis(preise, tarif) && <span className="mt-1 block">{jahrHinweis(preise, tarif)}</span>}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 text-[12.5px] text-brand-ink-soft">
            <span>oder {euro(preise[tarif].jahr)} pro Jahr bei jährlicher Zahlung</span>
            <button type="button" onClick={() => setPeriode("jahr")} className="w-fit text-left font-semibold text-brand-green hover:underline">
              💡 Jährlich zahlen{gratis > 0 ? ` – ${jahrKurz(preise, tarif)}` : ""} →
            </button>
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
      <ul className="flex flex-col gap-2 text-[13.5px] text-brand-ink">
        {TARIF_LEISTUNGEN[tarif].map((l) => (
          <li key={l.text} className={`flex gap-2 ${l.bald ? "text-brand-ink-soft" : ""}`}>
            <Check size={16} className={`mt-0.5 shrink-0 ${l.bald ? "text-brand-ink-soft" : "text-brand-red"}`} />
            <span>
              {l.text}
              {l.bald && <span className="ml-1.5 rounded-full bg-brand-bg px-2 py-0.5 text-[11px] font-semibold">bald</span>}
            </span>
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
              {p === "monat" ? (
                "Monatlich"
              ) : (
                <span className="inline-flex items-center gap-2">
                  Jährlich
                  {inklusive && <span className="rounded-full bg-brand-green px-2 py-0.5 text-[11px] font-bold text-white">{inklusive}</span>}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* FREE */}
        <section className={karte(effektiv === "free")}>
          <div>
            <div className="text-[19px] font-extrabold text-brand-ink">Free</div>
            <div className="text-[28px] font-extrabold text-brand-ink">0 €</div>
            <div className="text-[12.5px] text-brand-ink-soft">dauerhaft kostenlos</div>
          </div>
          <Liste tarif="free" />
          {effektiv === "free" && <div className={hinweis}>Dein aktueller Tarif</div>}
        </section>

        {/* BASIC */}
        <section className={karte(wunsch === "basic" || persoenlich === "basic")}>
          <div>
            <div className="text-[19px] font-extrabold text-brand-ink">Basic</div>
            <div className="text-[12.5px] text-brand-ink-soft">für dich persönlich</div>
          </div>
          <Preis tarif="basic" />
          <Liste tarif="basic" />
          <div className="mt-auto">
            {persoenlich === "basic" ? (
              <div className={hinweis}>Deine BASIC-Lizenz ist eingerichtet (siehe oben)</div>
            ) : vereinszugang ? (
              <div className={hinweis}>Über {vereinName ?? "deinen Verein"} hast du bereits VEREIN-Zugang – BASIC brauchst du nicht.</div>
            ) : (
              <Kaufknoepfe tarif="basic" />
            )}
          </div>
        </section>

        {/* VEREIN */}
        <section id="verein" className={karte(wunsch === "verein")}>
          <div>
            <div className="text-[19px] font-extrabold text-brand-ink">Verein</div>
            <div className="text-[12.5px] text-brand-ink-soft">Lizenz für deinen ganzen Verein</div>
          </div>
          <Preis tarif="verein" />
          <Liste tarif="verein" />
          <p className="text-[12px] text-brand-ink-soft">
            Unbegrenzt viele Mitglieder. Wer aktiv im Verein ist, ist automatisch abgedeckt; wer aus dem Verein entfernt wird,
            verliert die Abdeckung. Eine eigene BASIC-Lizenz wird währenddessen pausiert – keine doppelte Zahlung.
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
                Deine Vereine haben bereits eine Lizenz oder eine beauftragte Überweisung (siehe oben).{" "}
                <Link href="/dashboard/verein" className="text-brand-red underline">
                  Zum Verein
                </Link>
              </div>
            ) : (
              <form action={anlegen} className="flex flex-col gap-2">
                <p className="text-[12.5px] text-brand-ink-soft">
                  Die Lizenz kauft der Vereinsadmin. Du hast noch keinen Verein, den du verwaltest – registriere ihn hier (du wirst
                  Vereinsadmin) und schließe danach die Lizenz ab.
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
                <SendenButton laedtText="Wird registriert …" variante="sekundaer">
                  Verein registrieren
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
