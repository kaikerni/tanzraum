import Link from "next/link";
import { ArrowLeft, History, LifeBuoy } from "lucide-react";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { ehrungsKontext } from "@/lib/ehrungen/kontext";
import { KeinZugriff } from "@/components/ehrungen/EhrungenKopf";
import { FernwartungFormular } from "@/components/verwaltung/FernwartungFormular";
import { SendenButton } from "@/components/ui/SendenButton";
import { fernwartungWiderrufen } from "../actions";

export const metadata = { title: "Fernwartung – Vereinsverwaltung" };

type Anfrage = {
  id: string;
  typ: string | null;
  beschreibung: string | null;
  fernzugriff_gewuenscht: boolean;
  code: string | null;
  status: string | null;
  erstellt_am: string;
  laeuft_ab_am: string | null;
  widerrufen_am: string | null;
};
type Protokoll = { id: string; aktion: string; zeitpunkt: string };

const zeit = (iso: string) => new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "medium", timeStyle: "short" });

function aktiv(a: Anfrage) {
  return a.fernzugriff_gewuenscht && !a.widerrufen_am && (a.status ?? "offen") !== "widerrufen" && !!a.laeuft_ab_am && new Date(a.laeuft_ab_am) > new Date();
}

// Support-Anfrage durch den Vereinsadmin: zeitlich begrenzt, pro Fall, protokolliert, jederzeit widerrufbar
export default async function FernwartungSeite({ searchParams }: { searchParams: Promise<{ verein?: string }> }) {
  const { verein: gewaehlt } = await searchParams;
  const { supabase, verein, ohneLizenz } = await ehrungsKontext(gewaehlt);
  if (!verein) return <KeinZugriff ohneLizenz={ohneLizenz} />;
  const [{ data: anfragenRoh }, { data: protokollRoh }] = await Promise.all([
    supabase
      .from("fernwartungs_anfragen")
      .select("id, typ, beschreibung, fernzugriff_gewuenscht, code, status, erstellt_am, laeuft_ab_am, widerrufen_am")
      .eq("verein_id", verein.vereinId)
      .order("erstellt_am", { ascending: false })
      .limit(20),
    supabase.from("fernwartung_protokoll").select("id, aktion, zeitpunkt").eq("verein_id", verein.vereinId).order("zeitpunkt", { ascending: false }).limit(50),
  ]);
  const anfragen = (anfragenRoh ?? []) as Anfrage[];
  const protokoll = (protokollRoh ?? []) as Protokoll[];

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-4">
      <Link href={`/dashboard/vereinsverwaltung?verein=${verein.vereinId}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> Vereinsverwaltung
      </Link>
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Fernwartung & Support</h1>
        <p className="text-[14px] text-brand-ink-soft">
          {verein.vereinName} · Der TanzRaum-Support hilft bei der Einrichtung. Ein Zugriff ist nur mit eurer Freigabe möglich, gilt 24 Stunden, wird
          protokolliert und kann jederzeit widerrufen werden. Mitgliederdaten, Anträge und Chats bleiben für den Support immer gesperrt.
        </p>
      </div>
      <section className={KARTE}>
        <KarteKopf icon={LifeBuoy} titel="Support anfragen" />
        <FernwartungFormular vereinId={verein.vereinId} />
      </section>
      {anfragen.length > 0 && (
        <section className={KARTE}>
          <KarteKopf icon={LifeBuoy} titel="Eure Anfragen" />
          <ul className="divide-y divide-brand-line">
            {anfragen.map((a) => (
              <li key={a.id} className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-[13.5px]">
                  <div className="font-semibold text-brand-ink">
                    {a.typ ?? "Sonstiges"}
                    {aktiv(a) ? (
                      <span className="ml-2 rounded-full bg-brand-gold-wash px-2 py-0.5 text-[11.5px] font-semibold text-brand-gold">Zugriff aktiv bis {zeit(a.laeuft_ab_am!)}</span>
                    ) : (
                      <span className="ml-2 rounded-full bg-brand-bg px-2 py-0.5 text-[11.5px] font-semibold text-brand-ink-soft">
                        {a.widerrufen_am ? "widerrufen" : a.fernzugriff_gewuenscht ? "abgelaufen" : "ohne Fernzugriff"}
                      </span>
                    )}
                  </div>
                  {a.beschreibung && <p className="text-brand-ink-soft">{a.beschreibung}</p>}
                  <p className="text-[12px] text-brand-ink-faint">
                    {zeit(a.erstellt_am)}
                    {a.code ? ` · Code ${a.code}` : ""}
                  </p>
                </div>
                {aktiv(a) && (
                  <form action={fernwartungWiderrufen}>
                    <input type="hidden" name="anfrage_id" value={a.id} />
                    <SendenButton variante="gefahr" laedtText="Wird widerrufen …">
                      Zugriff widerrufen
                    </SendenButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className={KARTE}>
        <KarteKopf icon={History} titel="Protokoll" />
        {protokoll.length === 0 ? (
          <p className="text-[13px] text-brand-ink-soft">Bisher hat der Support nichts geändert.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {protokoll.map((p) => (
              <li key={p.id} className="flex gap-3">
                <span className="shrink-0 text-brand-ink-soft">{zeit(p.zeitpunkt)}</span>
                <span className="text-brand-ink">{p.aktion}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
