import Link from "next/link";
import { Medal, CalendarClock, Info, Plus } from "lucide-react";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { EhrungenKopf, EHRUNGEN_PFAD, KeinZugriff, mitVerein } from "@/components/ehrungen/EhrungenKopf";
import { StatusBadge, TypBadge } from "@/components/ehrungen/Badges";
import { AktualisierenKnopf, SchnellAktionen } from "@/components/ehrungen/EhrungenFormulare";
import { ehrungsKontext } from "@/lib/ehrungen/kontext";
import { getVorgaenge } from "@/lib/ehrungen/daten";
import { HINWEIS_VORSCHLAG, OFFEN, STATUS, datum, grundlageZeilen, type Status, type Vorgang } from "@/lib/ehrungen/typen";

export const metadata = { title: "Ehrungen & Orden – TanzRaum" };

const ZAEHLER: Status[] = ["moeglich", "geprueft", "vorgemerkt", "bestellt", "erhalten", "eingeplant"];
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

function stichtag(v: Vorgang): string | null {
  return v.eingeplantAm ?? v.wunschDatum ?? v.faelligAm;
}

export default async function EhrungenUebersicht({ searchParams }: { searchParams: Promise<{ verein?: string }> }) {
  const { verein: gewaehlt } = await searchParams;
  const { supabase, verein, vereine, ohneLizenz } = await ehrungsKontext(gewaehlt);
  if (!verein) return <KeinZugriff ohneLizenz={ohneLizenz} />;

  // Neue moegliche Ehrungen automatisch erkennen (idempotent; nur Vereinsadmins, geprueft in der Datenbank)
  await supabase.rpc("ehrungen_aktualisieren", { p_verein_id: verein.vereinId });
  const vorgaenge = await getVorgaenge(supabase, verein.vereinId);

  const anzahl = (s: Status) => vorgaenge.filter((v) => v.status === s).length;
  const kandidaten = vorgaenge.filter((v) => v.status === "moeglich");
  const heute = new Date().toISOString().slice(0, 10);
  const inEinemJahr = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  const kommend = vorgaenge
    .filter((v) => OFFEN.includes(v.status) && v.status !== "moeglich")
    .concat(kandidaten)
    .filter((v) => {
      const d = stichtag(v);
      return d && d <= inEinemJahr;
    })
    .sort((a, b) => (stichtag(a) ?? "").localeCompare(stichtag(b) ?? ""));
  const nachMonat = new Map<string, Vorgang[]>();
  for (const v of kommend) {
    const d = stichtag(v)!;
    const k = d < heute ? "bereits fällig" : `${MONATE[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
    nachMonat.set(k, [...(nachMonat.get(k) ?? []), v]);
  }
  const basis = EHRUNGEN_PFAD;

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <EhrungenKopf
        verein={verein}
        vereine={vereine}
        aktiv="uebersicht"
        rechts={
          <Link
            href={mitVerein(`${basis}/neu`, verein.vereinId)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-brand-red px-3.5 text-[13px] font-semibold text-white hover:bg-brand-red-deep"
          >
            <Plus size={15} /> Ehrung manuell hinzufügen
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {ZAEHLER.map((s) => (
          <Link
            key={s}
            href={mitVerein(`${basis}/liste?status=${s}`, verein.vereinId)}
            className="rounded-[var(--radius-l)] border border-brand-line bg-white p-3 shadow-[var(--shadow)] hover:border-brand-red/40"
          >
            <span className="block text-[24px] font-extrabold leading-none text-brand-ink">{anzahl(s)}</span>
            <span className="mt-1 block text-[12.5px] font-medium text-brand-ink-soft">
              {STATUS[s].zeichen} {s === "moeglich" ? "mögliche Ehrungen" : STATUS[s].label.toLowerCase()}
            </span>
          </Link>
        ))}
      </section>

      <section className={KARTE}>
        <KarteKopf
          icon={Medal}
          titel="Ehrungskandidaten"
          untertitel={HINWEIS_VORSCHLAG}
          rechts={<AktualisierenKnopf vereinId={verein.vereinId} />}
        />
        {kandidaten.length === 0 ? (
          <p className="rounded-xl bg-brand-bg px-4 py-5 text-[13.5px] text-brand-ink-soft">
            Aktuell keine möglichen Ehrungen. Vorschläge entstehen aus den{" "}
            <Link href={mitVerein(`${basis}/mitglieder`, verein.vereinId)} className="font-semibold text-brand-red">
              Mitglieds- und Tätigkeitszeiten
            </Link>{" "}
            und den{" "}
            <Link href={mitVerein(`${basis}/auszeichnungen`, verein.vereinId)} className="font-semibold text-brand-red">
              Regeln der Auszeichnungen
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {kandidaten.map((v) => (
              <li key={v.id} className="flex flex-col gap-2 rounded-xl border border-brand-line p-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-brand-ink">
                    {v.personName} · <Link href={`${basis}/${v.id}`} className="hover:text-brand-red">{v.auszeichnung}</Link>
                  </p>
                  <p className="flex flex-wrap items-center gap-1.5 pt-1 text-[12.5px] text-brand-ink-soft">
                    <TypBadge typ={v.typ} />
                    {v.organisation && <span>{v.organisation}</span>}
                    <span>· voraussichtlich {datum(v.faelligAm)}</span>
                  </p>
                  <p className="pt-1 text-[12.5px] text-brand-ink-soft">Grund: {v.grundlageText ?? grundlageZeilen(v.grundlage)[0]}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5 md:items-end">
                  <SchnellAktionen vorgangId={v.id} />
                  <Link href={`${basis}/${v.id}`} className="text-[12.5px] font-semibold text-brand-red">
                    Bearbeiten ›
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={KARTE}>
        <KarteKopf icon={CalendarClock} titel="Kommende Ehrungen" untertitel="Nächste 12 Monate (Fälligkeit, Wunsch- oder Verleihungstermin)" />
        {kommend.length === 0 ? (
          <p className="text-[13.5px] text-brand-ink-soft">In den nächsten 12 Monaten stehen keine Ehrungen an.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {[...nachMonat.entries()].map(([monat, liste]) => (
              <div key={monat}>
                <h3 className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-brand-ink-soft">
                  {monat} · {liste.length} Ehrung{liste.length === 1 ? "" : "en"}
                </h3>
                <ul className="divide-y divide-brand-line rounded-xl border border-brand-line">
                  {liste.map((v) => (
                    <li key={v.id}>
                      <Link href={`${basis}/${v.id}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 hover:bg-brand-bg">
                        <span className="min-w-0 text-[13.5px]">
                          <span className="font-semibold text-brand-ink">{v.personName}</span>
                          <span className="text-brand-ink-soft"> · {v.auszeichnung} · {datum(stichtag(v))}</span>
                        </span>
                        <StatusBadge status={v.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="flex gap-2 rounded-xl bg-brand-amber-wash px-3.5 py-3 text-[12.5px] text-brand-ink">
        <Info size={16} className="mt-0.5 shrink-0 text-[#8a5a00]" />
        TanzRaum unterstützt die Vorbereitung. Die Verantwortung für die Prüfung der Voraussetzungen und die korrekte Bestellung bzw. Beantragung liegt beim
        Verein. Verbandsdaten stammen teilweise aus einer ungeprüften Arbeitsgrundlage – bitte vor einer Bestellung mit den aktuellen Unterlagen des Verbandes
        abgleichen.
      </p>
    </div>
  );
}
