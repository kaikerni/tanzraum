import Link from "next/link";
import { redirect } from "next/navigation";
import { Car, History, Lock, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { getFahrten, fahrtDatum, type Fahrt } from "@/lib/fahrgemeinschaften";
import { getTermine } from "@/lib/kalender/getKalender";
import { FahrtFormular, type KalenderVorschlag } from "@/components/fahrgemeinschaften/FahrtFormular";
import { FahrtKarte } from "@/components/fahrgemeinschaften/FahrtKarte";

export const metadata = { title: "Fahrgemeinschaften – TanzRaum" };

const KEIN_ZUGANG: Record<string, { titel: string; text: string; link?: [string, string] }> = {
  kein_verein: {
    titel: "Nur innerhalb eines Vereins",
    text: "Fahrgemeinschaften organisieren die Mitglieder eines Vereins untereinander. Sobald du einem Verein mit Vereinslizenz angehörst, kannst du hier Fahrten anbieten und suchen.",
    link: ["/dashboard/verein", "Zu „Mein Verein“"],
  },
  keine_lizenz: {
    titel: "Teil der Vereinslizenz",
    text: "Fahrgemeinschaften gibt es mit der Vereinslizenz. Der Vereinsadmin kann sie unter „Mein Tarif“ buchen.",
    link: ["/dashboard/tarif", "Zu „Mein Tarif“"],
  },
  bereich_aus: {
    titel: "Bereich ausgeschaltet",
    text: "Dein Verein hat die Fahrgemeinschaften ausgeschaltet. Der Vereinsadmin kann sie in der Vereinsverwaltung wieder einschalten.",
  },
};

function heute(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}

export default async function FahrgemeinschaftenSeite({ searchParams }: { searchParams: Promise<{ neu?: string; vergangen?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/fahrgemeinschaften");
  const { neu, vergangen } = await searchParams;
  const zeigeVergangene = vergangen === "1";

  const daten = await getFahrten(supabase, zeigeVergangene);
  if (!daten || !daten.zugang) {
    const hinweis = KEIN_ZUGANG[daten && !daten.zugang ? daten.grund : "kein_verein"];
    return (
      <div className="mx-auto flex max-w-[720px] flex-col gap-4">
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Fahrgemeinschaften</h1>
        <section className={`${KARTE} flex flex-col items-center gap-3 py-10 text-center`}>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-bg text-brand-ink-soft">
            <Lock size={26} />
          </div>
          <p className="text-[16px] font-bold text-brand-ink">{hinweis.titel}</p>
          <p className="max-w-md text-[14px] text-brand-ink-soft">{hinweis.text}</p>
          {hinweis.link && (
            <Link href={hinweis.link[0]} className="mt-2 text-[13.5px] font-semibold text-brand-red">
              {hinweis.link[1]}
            </Link>
          )}
        </section>
      </div>
    );
  }

  // Vorschlaege aus dem Vereinskalender (nur Termine, die die Person ohnehin sieht)
  let vorschlaege: KalenderVorschlag[] = [];
  if (!zeigeVergangene && daten.darf_schreiben) {
    const von = heute();
    const bis = new Date(Date.now() + 120 * 86400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
    const termine = await getTermine(supabase, von, bis);
    vorschlaege = termine
      .filter((t) => t.vereinId === daten.verein_id && t.art !== "privat" && t.art !== "sitzung")
      .slice(0, 40)
      .map((t) => ({ id: t.id, titel: t.titel, datum: t.datum, ort: t.ort, von: t.von }));
  }

  const nachTag = new Map<string, Fahrt[]>();
  for (const f of zeigeVergangene ? [...daten.fahrten].reverse() : daten.fahrten) {
    nachTag.set(f.datum, [...(nachTag.get(f.datum) ?? []), f]);
  }
  const angebote = daten.fahrten.filter((f) => f.art === "angebot" && f.status === "offen").length;
  const gesuche = daten.fahrten.filter((f) => f.art === "gesuch" && f.status === "offen").length;

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Fahrgemeinschaften</h1>
          <p className="text-[14px] text-brand-ink-soft">
            Gemeinsam zu Turnieren, Auftritten und Training – nur für die Mitglieder von <strong className="text-brand-ink">{daten.verein_name.replace(/\.$/, "")}</strong>.
          </p>
        </div>
        <Link
          href={zeigeVergangene ? "/dashboard/fahrgemeinschaften" : "/dashboard/fahrgemeinschaften?vergangen=1"}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-line bg-white px-3 text-[13px] font-semibold text-brand-ink hover:bg-brand-bg"
        >
          <History size={15} /> {zeigeVergangene ? "Kommende Fahrten" : "Vergangene Fahrten"}
        </Link>
      </div>

      {!zeigeVergangene && daten.darf_schreiben && (
        <details id="neu" open={neu === "1"} className={`${KARTE} group`}>
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[15px] font-bold text-brand-ink">
            <Plus size={18} className="text-brand-red" /> Fahrt anbieten oder Mitfahrt suchen
          </summary>
          <div className="mt-4">
            <FahrtFormular vorschlaege={vorschlaege} />
          </div>
        </details>
      )}
      {!daten.darf_schreiben && (
        <p className="rounded-xl bg-brand-gold-wash px-4 py-3 text-[13px] text-brand-ink">
          Deine Eltern haben Nachrichten ausgeschaltet. Du kannst die Fahrten sehen – eintragen können dich deine Eltern.
        </p>
      )}

      {!zeigeVergangene && daten.fahrten.length > 0 && (
        <p className="text-[13px] text-brand-ink-soft">
          {angebote} {angebote === 1 ? "Fahrt wird" : "Fahrten werden"} angeboten · {gesuche} {gesuche === 1 ? "Mitfahrt wird" : "Mitfahrten werden"} gesucht
        </p>
      )}

      {daten.fahrten.length === 0 ? (
        <section className={`${KARTE} flex flex-col items-center gap-3 py-10 text-center`}>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-red-wash text-brand-red">
            <Car size={26} />
          </div>
          <p className="text-[16px] font-bold text-brand-ink">{zeigeVergangene ? "Keine vergangenen Fahrten" : "Noch keine Fahrten eingetragen"}</p>
          {!zeigeVergangene && (
            <p className="max-w-md text-[14px] text-brand-ink-soft">
              Du fährst zum nächsten Turnier oder suchst eine Mitfahrgelegenheit? Trag es oben ein – dein Verein wird benachrichtigt, sobald jemand reagiert.
            </p>
          )}
        </section>
      ) : (
        [...nachTag.entries()].map(([tag, fahrten]) => (
          <section key={tag} className="flex flex-col gap-3">
            <h2 className="text-[13px] font-bold uppercase tracking-wide text-brand-ink-soft">{fahrtDatum(tag)}</h2>
            {fahrten.map((f) => (
              <FahrtKarte key={f.id} fahrt={f} darfSchreiben={daten.darf_schreiben} vergangen={zeigeVergangene} />
            ))}
          </section>
        ))
      )}
      {zeigeVergangene && <p className="text-[12px] text-brand-ink-faint">Vergangene Fahrten werden 30 Tage nach dem Fahrtdatum automatisch gelöscht.</p>}
    </div>
  );
}
