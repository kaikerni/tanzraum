"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CreditCard, Building2, Landmark } from "lucide-react";
import { zahlungAufruf } from "./zahlungAufruf";
import { ueberweisungBeantragen, vereinsgruendungVorbereiten } from "@/app/dashboard/tarif/actions";
import { TARIF_EINLEITUNG, TARIF_LEISTUNGEN, TURNIER_ANMELDUNG_HINWEIS, leistungText } from "@/lib/tarif-leistungen";
import { euro, gratisMonate, jahrKurz, type BezahlTarif, type Periode, type Preise, type VereinsgruendungStatus } from "@/lib/tarife";
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
  speicher,
  gruendung = null,
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
  // Speicherkontingente in MB (zentral, speicher_kontingente_oeffentlich)
  speicher?: Record<string, number>;
  // Verein gruenden (ohne eigenen Verein): Bestellung + Zahlung, Verein entsteht erst nach bestaetigter Zahlung
  gruendung?: VereinsgruendungStatus | null;
}) {
  const [periode, setPeriode] = useState<Periode>(startPeriode);
  const [laedt, setLaedt] = useState<string | null>(null);
  const [leistungsbeginn, setLeistungsbeginn] = useState(false);
  const [fehler, setFehler] = useState<{ tarif: BezahlTarif; text: string } | null>(null);
  const kaufbar = adminVereine.filter((v) => !v.lizenz);
  const [vereinId, setVereinId] = useState<string>(
    kaufbar.find((v) => v.id === vorgewaehlterVerein)?.id ?? kaufbar[0]?.id ?? "",
  );
  // Gruendungsmodus: keine eigenen Vereine als Vereinsadmin -> Lizenz fuer einen neuen Verein (Name/Kuerzel)
  const gruendungsModus = adminVereine.length === 0;
  const [gName, setGName] = useState(gruendung?.bestellung?.name ?? "");
  const [gKuerzel, setGKuerzel] = useState(gruendung?.bestellung?.kuerzel ?? "");
  const gNameOk = gName.trim().length >= 2;
  const router = useRouter();
  const inklusive = jahrKurz(preise, "basic");
  const [ueLaeuft, ueStarten] = useTransition();
  const [ueMeldung, setUeMeldung] = useState<{ error: string | null; ok?: string | null } | null>(null);

  function perUeberweisung() {
    setUeMeldung(null);
    ueStarten(async () => {
      if (gruendungsModus) {
        const v = await vereinsgruendungVorbereiten(gName, gKuerzel);
        if (v.error) return setUeMeldung(v);
      }
      const r = await ueberweisungBeantragen(gruendungsModus ? null : vereinId, leistungsbeginn);
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
    // Vereinsgruendung: zuerst nur die Bestellung speichern – der Verein entsteht erst nach bestaetigter Zahlung
    if (tarif === "verein" && gruendungsModus) {
      const v = await vereinsgruendungVorbereiten(gName, gKuerzel);
      if (v.error) {
        setLaedt(null);
        setFehler({ tarif, text: v.error });
        return;
      }
    }
    const { daten, fehler } = await zahlungAufruf<{ url?: string }>("zahlung-starten", {
      tarif,
      periode,
      anbieter,
      verein_id: tarif === "verein" && !gruendungsModus ? vereinId || null : null,
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

  // Verein gruenden: Name/Kuerzel + Zahlung. Vor bestaetigter Zahlung entsteht kein Verein (serverseitig erzwungen).
  // Als Funktion (nicht als Komponente) aufgerufen, damit die Eingabefelder beim Tippen nicht neu entstehen.
  function vereinGruenden() {
    const b = gruendung?.bestellung ?? null;
    if (gruendung?.im_verein) {
      return (
        <div className={hinweis}>
          Du bist bereits einem Verein zugeordnet. In TanzRaum ist jede Person genau einem Verein zugeordnet – einen eigenen Verein kannst du gründen,
          wenn du dort nicht mehr Mitglied bist.
        </div>
      );
    }
    if (b?.zahlung?.laeuft) {
      return (
        <div className={hinweis}>
          Deine Vereinsgründung „{b.name}“ ist bestellt, die Zahlung läuft (siehe oben). Dein Verein wird angelegt, sobald sie bestätigt ist.
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 rounded-xl border border-brand-line bg-brand-bg/60 p-3">
          <p className="flex items-center gap-2 text-[14px] font-bold text-brand-ink">
            <Building2 size={16} className="text-brand-gold" /> Verein gründen
          </p>
          <p className="text-[12.5px] leading-snug text-brand-ink-soft">
            Gib den Namen deines Vereins an und wähle die Zahlungsart. Dein Verein wird angelegt, sobald die Zahlung bestätigt ist – du wirst
            automatisch Vereinsadmin. Vorher entsteht kein Verein.
          </p>
          <label className="field">
            <span>Vereinsname</span>
            <input value={gName} onChange={(e) => setGName(e.target.value)} maxLength={120} required placeholder="z. B. Karnevalsclub Musterstadt" />
          </label>
          <label className="field">
            <span>Kürzel (optional)</span>
            <input value={gKuerzel} onChange={(e) => setGKuerzel(e.target.value)} maxLength={20} placeholder="z. B. KCM" />
          </label>
        </div>
        <Kaufknoepfe tarif="verein" gesperrt={!gNameOk} />
      </div>
    );
  }

  function Preis({ tarif }: { tarif: BezahlTarif }) {
    const p = preise[tarif][periode];
    const gratis = gratisMonate(preise, tarif);
    const anderer = periode === "jahr" ? `${euro(preise[tarif].monat)} / Monat` : `${euro(preise[tarif].jahr)} / Jahr`;
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[28px] font-extrabold leading-none text-brand-ink">{euro(p)}</span>
          <span className="text-[14px] font-semibold text-brand-ink-soft">/ {periode === "jahr" ? "Jahr" : "Monat"}</span>
          <span className="text-[12.5px] text-brand-ink-soft">oder {anderer}</span>
        </div>
        {gratis > 0 &&
          (periode === "jahr" ? (
            <span className="w-fit rounded-full bg-brand-green-wash px-2.5 py-0.5 text-[12px] font-bold text-brand-green">💡 Jährlich zahlen – {jahrKurz(preise, tarif)}</span>
          ) : (
            <button
              type="button"
              onClick={() => setPeriode("jahr")}
              className="w-fit rounded-full bg-brand-green-wash px-2.5 py-0.5 text-left text-[12px] font-bold text-brand-green hover:underline"
            >
              💡 Jährlich zahlen – {jahrKurz(preise, tarif)} →
            </button>
          ))}
        <p className="text-[12px] leading-snug text-brand-ink-soft">
          Abrechnung monatlich bzw. jährlich im Voraus. Verlängert sich automatisch und ist zum Ende der jeweiligen Laufzeit kündbar.
        </p>
      </div>
    );
  }

  function Liste({ tarif }: { tarif: "free" | BezahlTarif }) {
    return (
      <div className="flex flex-col gap-2">
        {tarif !== "free" && <p className="text-[13px] font-bold text-brand-ink">{TARIF_EINLEITUNG[tarif]}</p>}
        <ul className="flex flex-col gap-1.5 text-[13.5px] leading-snug text-brand-ink">
          {TARIF_LEISTUNGEN[tarif].map((l) => (
            <li key={l.text} className={`flex gap-2 ${l.bald ? "text-brand-ink-soft" : ""}`}>
              <Check size={16} className={`mt-0.5 shrink-0 ${l.bald ? "text-brand-ink-soft" : FARBE[tarif].haken}`} />
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {leistungText(l.text, speicher)}
                {l.bald && <span className="ml-1.5 rounded-full bg-brand-bg px-2 py-0.5 text-[11px] font-semibold">bald</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Jeder Tarif mit eigener Akzentfarbe (Kopfleiste und Haken), der passende bzw. gewuenschte Tarif zusaetzlich hervorgehoben
  const FARBE = {
    free: { leiste: "border-t-brand-ink-faint", haken: "text-brand-ink-soft", punkt: "bg-brand-ink-faint" },
    basic: { leiste: "border-t-brand-red", haken: "text-brand-red", punkt: "bg-brand-red" },
    verein: { leiste: "border-t-brand-gold", haken: "text-brand-gold", punkt: "bg-brand-gold" },
  } as const;
  const karte = (tarif: "free" | BezahlTarif, hervor: boolean) =>
    `flex min-w-0 flex-col gap-4 rounded-[var(--radius-l)] border border-t-4 bg-white p-4 shadow-[var(--shadow)] sm:p-5 ${FARBE[tarif].leiste} ${
      hervor ? "border-x-brand-red/40 border-b-brand-red/40 ring-2 ring-brand-red/15" : "border-x-brand-line border-b-brand-line"
    }`;
  const hinweis = "rounded-xl bg-brand-bg px-3 py-2 text-[13px] font-semibold text-brand-ink";
  const Kopf = ({ tarif, titel, zusatz }: { tarif: "free" | BezahlTarif; titel: string; zusatz: string }) => (
    <div className="flex flex-col gap-0.5">
      <h3 className="flex items-center gap-2 text-[19px] font-extrabold text-brand-ink">
        <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${FARBE[tarif].punkt}`} />
        {titel}
      </h3>
      <div className="text-[13px] font-semibold text-brand-ink-soft">{zusatz}</div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[18px] font-bold text-brand-ink">Tarife</h2>
        <div className="inline-flex max-w-full rounded-full border border-brand-line bg-white p-1 text-[13px]">
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
        <section className={karte("free", effektiv === "free")}>
          <Kopf tarif="free" titel="Free" zusatz="dauerhaft kostenlos" />
          <div className="flex flex-col gap-1.5">
            <div className="text-[28px] font-extrabold leading-none text-brand-ink">0 €</div>
            <p className="text-[13px] leading-snug text-brand-ink-soft">
              Für alle, die TanzRaum entdecken und die wichtigsten Funktionen kostenlos nutzen möchten.
            </p>
          </div>
          <Liste tarif="free" />
          <p className="text-[12.5px] font-semibold text-brand-ink-soft">Keine Vereinsmitgliedschaft erforderlich.</p>
          {effektiv === "free" && <div className={`mt-auto ${hinweis}`}>Dein aktueller Tarif</div>}
        </section>

        {/* BASIC */}
        <section className={karte("basic", wunsch === "basic" || persoenlich === "basic")}>
          <Kopf tarif="basic" titel="Basic" zusatz="Für dich persönlich" />
          <Preis tarif="basic" />
          <Liste tarif="basic" />
          <p className="text-[12.5px] leading-snug text-brand-ink-soft">
            Basic ist deine persönliche TanzRaum-Lizenz. Du brauchst dafür keinen Verein und keine Vereinsmitgliedschaft.
          </p>
          <div className="mt-auto flex flex-col gap-2">
            {persoenlich === "basic" ? (
              <div className={hinweis}>Deine BASIC-Lizenz ist eingerichtet (siehe oben)</div>
            ) : vereinszugang ? (
              <div className={hinweis}>Über {vereinName ?? "deinen Verein"} hast du bereits VEREIN-Zugang – BASIC brauchst du nicht.</div>
            ) : (
              <>
                <p className="text-[12px] text-brand-ink-soft">
                  <span className="font-semibold text-brand-ink">Zahlung:</span> Karte · Apple Pay · Google Pay · Lastschrift · PayPal
                </p>
                <Kaufknoepfe tarif="basic" />
              </>
            )}
          </div>
        </section>

        {/* VEREIN */}
        <section id="verein" className={karte("verein", wunsch === "verein")}>
          <Kopf tarif="verein" titel="Verein" zusatz="Eine Lizenz für euren gesamten Verein" />
          <Preis tarif="verein" />
          <Liste tarif="verein" />
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
              vereinGruenden()
            )}
          </div>
        </section>
      </div>

      {/* Vereinslizenz – Erklaerung (entspricht der bestehenden Lizenzlogik: Abdeckung aktiver Mitglieder, BASIC-Pause) */}
      <section className="flex flex-col gap-2 rounded-[var(--radius-l)] border border-brand-gold/40 bg-brand-gold-wash/40 p-4 sm:p-5">
        <h3 className="flex items-center gap-2 text-[16px] font-extrabold text-brand-ink">
          <Building2 size={18} className="text-brand-gold" /> Eine Lizenz. Der ganze Verein.
        </h3>
        <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-[13.5px] leading-snug text-brand-ink md:grid-cols-2">
          <li>Unbegrenzt viele aktive Mitglieder können über die Vereinslizenz abgedeckt werden.</li>
          <li>Wer aktiv eurem Verein zugeordnet ist, ist automatisch über die Vereinslizenz abgedeckt.</li>
          <li>Wird ein Mitglied aus dem Verein entfernt, endet seine Abdeckung durch die Vereinslizenz.</li>
          <li>Eine eigene Basic-Lizenz wird während der Abdeckung durch die Vereinslizenz pausiert, sodass keine doppelte Zahlung entsteht.</li>
        </ul>
      </section>

      <div className="flex flex-col gap-1 text-[12px] text-brand-ink-soft">
        <p>🏆 {TURNIER_ANMELDUNG_HINWEIS} TanzRaum stellt Turnierinformationen, Ausschreibungen, Starterlisten und Ergebnisse bereit.</p>
        <p>
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
    </div>
  );
}
