import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, Rocket } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { UpdateFormular, UpdateSchalter } from "@/components/admin/UpdateFormular";
import { AnkuendigungAktionen } from "@/components/admin/AnkuendigungFormular";
import { kategorieLabel, datumKurz } from "@/lib/updates/getUpdates";
import { TANZRAUM_BUILD, TANZRAUM_VERSION } from "@/lib/version";

export const metadata = { title: "Updates & Neuigkeiten – TanzRaum-Administration" };

type Eintrag = {
  id: string;
  titel: string;
  art: string;
  kurztext: string | null;
  version: string | null;
  kategorie: string | null;
  sichtbar_ab: string;
  sichtbar_bis: string | null;
  gelesen: number;
  auf_landingpage: boolean;
  im_benutzerbereich: boolean;
  wichtig: boolean;
  kai_hinweis: boolean;
};

export default async function UpdatesSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) redirect("/dashboard");
  const { data } = await supabase.rpc("ankuendigungen_admin");
  const liste = ((data ?? []) as Eintrag[]).filter((a) => a.art === "neuheit");
  const jetzt = Date.now();

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <Link href="/dashboard/admin" className="text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        ← Administration
      </Link>
      <section className={`${KARTE} flex flex-wrap items-center gap-3`}>
        <Rocket size={22} className="text-brand-red" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-brand-ink">
            Aktuell ausgeliefert: TanzRaum {TANZRAUM_VERSION} · Build {TANZRAUM_BUILD}
          </p>
          <p className="text-[12.5px] text-brand-ink-soft">
            Versionsnummer in package.json, Build = Commit beim Bauen. Nutzer erhalten neue Versionen automatisch beim nächsten Laden.
          </p>
        </div>
      </section>
      <section className={KARTE}>
        <KarteKopf
          icon={Sparkles}
          titel="+ Update erstellen"
          untertitel="Nur relevante neue Funktionen – keine rein technischen Änderungen. Erscheint je nach Auswahl auf der Landingpage, unter „Was ist neu?“ und bei Kai."
        />
        <UpdateFormular version={TANZRAUM_VERSION} />
      </section>
      <section className={KARTE}>
        <KarteKopf icon={Sparkles} titel="Veröffentlichte Updates" />
        {liste.length === 0 ? (
          <p className="text-[13.5px] text-brand-ink-soft">Noch keine Updates.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-brand-line">
            {liste.map((a) => {
              const aktiv = !a.sichtbar_bis || new Date(a.sichtbar_bis).getTime() > jetzt;
              return (
                <li key={a.id} className="flex flex-col gap-1.5 py-3">
                  <span className="text-[14.5px] font-bold text-brand-ink [overflow-wrap:anywhere]">{a.titel}</span>
                  <span className="text-[12.5px] text-brand-ink-soft">
                    {kategorieLabel(a.kategorie)}
                    {a.version ? ` · Version ${a.version}` : ""} · {datumKurz(a.sichtbar_ab)} · {aktiv ? "sichtbar" : "beendet"} · {a.gelesen} gelesen
                  </span>
                  {a.kurztext && <span className="text-[13px] text-brand-ink [overflow-wrap:anywhere]">{a.kurztext}</span>}
                  <UpdateSchalter
                    id={a.id}
                    werte={{ auf_landingpage: a.auf_landingpage, im_benutzerbereich: a.im_benutzerbereich, wichtig: a.wichtig, kai_hinweis: a.kai_hinweis }}
                  />
                  <AnkuendigungAktionen id={a.id} laeuft={aktiv} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
