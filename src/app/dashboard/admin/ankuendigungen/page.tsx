import Link from "next/link";
import { redirect } from "next/navigation";
import { Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { AnkuendigungFormular, AnkuendigungAktionen } from "@/components/admin/AnkuendigungFormular";
import { ankuendigungBildUrl } from "@/lib/news/getNews";

export const metadata = { title: "Ankündigungen – TanzRaum-Administration" };

type Eintrag = {
  id: string;
  titel: string;
  art: string;
  wichtig: boolean;
  push: boolean;
  zielgruppe: string;
  sichtbar_ab: string;
  sichtbar_bis: string | null;
  gelesen: number;
  bild_pfad: string | null;
  link_url: string | null;
};

const ZIEL: Record<string, string> = { alle: "alle", verantwortliche: "Admins/Trainer/Betreuer", ab16: "ab 16" };
const ART: Record<string, string> = { info: "Information", wartung: "Wartung", neuheit: "Neuheit" };
const zeit = (iso: string) => new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "medium", timeStyle: "short" });

export default async function AnkuendigungenSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) redirect("/dashboard");
  const { data } = await supabase.rpc("ankuendigungen_admin");
  const liste = (data ?? []) as Eintrag[];
  const jetzt = Date.now();

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <Link href="/dashboard/admin" className="text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        ← Administration
      </Link>
      <section className={KARTE}>
        <KarteKopf
          icon={Megaphone}
          titel="Neue Ankündigung"
          untertitel="Erscheint auf den Dashboards aller passenden Nutzer – unabhängig von Verein und Tarif."
        />
        <AnkuendigungFormular />
      </section>
      <section className={KARTE}>
        <KarteKopf icon={Megaphone} titel="Bisherige Ankündigungen" />
        {liste.length === 0 ? (
          <p className="text-[13.5px] text-brand-ink-soft">Noch keine Ankündigungen.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-brand-line">
            {liste.map((a) => {
              const gestartet = new Date(a.sichtbar_ab).getTime() <= jetzt;
              const aktiv = !a.sichtbar_bis || new Date(a.sichtbar_bis).getTime() > jetzt;
              return (
                <li key={a.id} className="flex items-start gap-3 py-3">
                  {a.bild_pfad && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ankuendigungBildUrl(a.bild_pfad) ?? ""} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[14.5px] font-bold text-brand-ink">
                    {a.titel} {a.wichtig && <span className="ml-1 rounded-full bg-brand-red px-2 py-0.5 text-[11px] text-white">Popup</span>}
                  </span>
                  <span className="text-[12.5px] text-brand-ink-soft">
                    {ART[a.art] ?? a.art} · an {ZIEL[a.zielgruppe] ?? a.zielgruppe} · ab {zeit(a.sichtbar_ab)}
                    {a.sichtbar_bis ? ` bis ${zeit(a.sichtbar_bis)}` : ""} · {aktiv ? (gestartet ? "sichtbar" : "geplant") : "beendet"}
                    {a.push ? " · mit Push" : ""} · {a.gelesen} gelesen/ausgeblendet
                  </span>
                  {a.link_url && <span className="truncate text-[12px] text-brand-ink-faint">Link: {a.link_url}</span>}
                  <AnkuendigungAktionen id={a.id} laeuft={aktiv} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
