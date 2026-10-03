import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, FileText, Folder, HardDrive, Image as BildIcon, Music, Trash2, Upload, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import { getDateien, getSpeicher, groesseText, type Datei, type Speicher } from "@/lib/dateien/getDateien";
import { SpeicherReduziert } from "@/components/speicher/SpeicherReduziert";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { Hochladen } from "@/components/dateien/Hochladen";
import { dateiLoeschen } from "./actions";

export const metadata = { title: "TeamCloud – TanzRaum" };

function DateiIcon({ mime }: { mime: string }) {
  if (mime.startsWith("audio/")) return <Music size={18} className="text-brand-purple" />;
  if (mime.startsWith("video/")) return <Video size={18} className="text-brand-blue" />;
  if (mime.startsWith("image/")) return <BildIcon size={18} className="text-brand-green" />;
  return <FileText size={18} className="text-brand-ink-soft" />;
}

function SpeicherBalken({ s }: { s: Speicher }) {
  const anteil = s.limit > 0 ? Math.min(100, (s.belegt / s.limit) * 100) : 0;
  const farbe = anteil >= 90 ? "bg-brand-red" : anteil >= 70 ? "bg-brand-amber" : "bg-brand-green";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="font-semibold text-brand-ink">
          {groesseText(s.belegt)} von {groesseText(s.limit)} belegt
        </span>
        <span className="text-brand-ink-soft">
          {s.dateien} {s.dateien === 1 ? "Datei" : "Dateien"} · noch {groesseText(Math.max(0, s.limit - s.belegt))} frei
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-brand-bg" role="progressbar" aria-valuenow={Math.round(anteil)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${farbe}`} style={{ width: `${anteil}%` }} />
      </div>
    </div>
  );
}

function DateiListe({ dateien, darfLoeschen }: { dateien: Datei[]; darfLoeschen: boolean }) {
  if (dateien.length === 0) return <p className="rounded-xl bg-brand-bg px-3.5 py-3 text-[13px] text-brand-ink-soft">Noch keine Dateien.</p>;
  const gruppen = new Map<string, Datei[]>();
  for (const d of dateien) {
    const o = d.ordner ?? "";
    gruppen.set(o, [...(gruppen.get(o) ?? []), d]);
  }
  // Ohne Ordner zuerst, danach alphabetisch
  const sortiert = [...gruppen.entries()].sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b, "de")));
  return (
    <div className="flex flex-col gap-4">
      {sortiert.map(([ordner, liste]) => (
        <div key={ordner || "_"}>
          {(ordner || sortiert.length > 1) && (
            <p className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-wide text-brand-ink-soft">
              <Folder size={14} /> {ordner || "Ohne Ordner"}
            </p>
          )}
          <ul className="divide-y divide-brand-line rounded-xl border border-brand-line">
            {liste.map((d) => (
              <li key={d.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <DateiIcon mime={d.mime} />
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold text-brand-ink">{d.name}</p>
                    <p className="text-[12px] text-brand-ink-soft">
                      {groesseText(d.groesse)} · {new Date(d.hochgeladenAm).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}
                    </p>
                  </div>
                </div>
                {d.url && d.mime.startsWith("audio/") && (
                  // Musik direkt anhoeren
                  <audio controls preload="none" src={d.url} className="h-9 w-full sm:w-64" />
                )}
                <div className="flex shrink-0 items-center gap-1.5">
                  {d.url && (
                    <a
                      href={`${d.url}&download=${encodeURIComponent(d.name)}`}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-line bg-white px-3 text-[12.5px] font-semibold text-brand-ink hover:bg-brand-bg"
                    >
                      <Download size={15} /> Laden
                    </a>
                  )}
                  {darfLoeschen && (
                    <form action={dateiLoeschen}>
                      <input type="hidden" name="datei_id" value={d.id} />
                      <button
                        type="submit"
                        title="Löschen"
                        className="inline-flex min-h-9 items-center rounded-lg border border-brand-red/40 bg-white px-2.5 text-brand-red hover:bg-brand-red-wash"
                      >
                        <Trash2 size={15} />
                        <span className="sr-only">{d.name} löschen</span>
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// TeamCloud des Vereins und eigene Dateien (ab BASIC) – Kontingente zentral in der Datenbank (Admin: Speicher & Kontingente)
export default async function DateienSeite({ searchParams }: { searchParams: Promise<{ bereich?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/dateien");
  const daten = await getDashboardData(supabase, user.id);
  if (!daten) redirect("/login");

  const verein = daten.vereine.find((v) => v.vereinTarif === "verein" && !v.vereinGesperrt) ?? null;
  const [vereinSpeicher, eigenerSpeicher] = await Promise.all([
    verein ? getSpeicher(supabase, verein.vereinId) : Promise.resolve(null),
    getSpeicher(supabase, null),
  ]);
  const eigeneErlaubt = !!eigenerSpeicher && (eigenerSpeicher.darfHochladen || eigenerSpeicher.dateien > 0);
  const { bereich } = await searchParams;
  const zeigeEigene = bereich === "eigen" || !vereinSpeicher;

  if (!vereinSpeicher && !eigeneErlaubt) {
    return (
      <div className="mx-auto flex max-w-[720px] flex-col gap-4">
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">TeamCloud</h1>
        <section className={`${KARTE} flex flex-col items-center gap-3 py-10 text-center`}>
          <HardDrive size={30} className="text-brand-ink-soft" />
          <p className="text-[15px] font-bold text-brand-ink">Dateien gibt es ab BASIC oder über die Verein-Lizenz deines Vereins.</p>
          <Link href="/dashboard/tarif" className="text-[13.5px] font-semibold text-brand-red">
            Tarife ansehen →
          </Link>
        </section>
      </div>
    );
  }

  const vereinId = zeigeEigene ? null : verein!.vereinId;
  const speicher = (zeigeEigene ? eigenerSpeicher : vereinSpeicher)!;
  const dateien = await getDateien(supabase, vereinId, user.id);
  const ordner = [...new Set(dateien.map((d) => d.ordner).filter((o): o is string => !!o))];

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-4">
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">TeamCloud</h1>
        <p className="text-[14px] text-brand-ink-soft">
          {zeigeEigene ? "Deine eigenen Dateien – nur für dich sichtbar." : `${verein!.vereinName} · Musik, Dokumente und Pläne für alle Mitglieder.`}
        </p>
      </div>

      {vereinSpeicher && eigeneErlaubt && (
        <nav className="flex gap-2" aria-label="Bereich">
          {[
            { href: "/dashboard/dateien", label: `Verein`, an: !zeigeEigene },
            { href: "/dashboard/dateien?bereich=eigen", label: "Meine Dateien", an: zeigeEigene },
          ].map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-current={t.an ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 text-[13px] font-semibold ${t.an ? "bg-brand-red text-white" : "border border-brand-line bg-white text-brand-ink hover:bg-brand-bg"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}

      <section className={KARTE}>
        <KarteKopf icon={HardDrive} titel="Speicher" />
        <SpeicherBalken s={speicher} />
        <SpeicherReduziert belegt={speicher.belegt} limit={speicher.limit} />
      </section>

      {speicher.darfHochladen ? (
        <section className={KARTE}>
          <KarteKopf icon={Upload} titel="Hochladen" />
          <Hochladen vereinId={vereinId} ordnerVorschlaege={ordner} />
        </section>
      ) : (
        !zeigeEigene && <p className="text-[12.5px] text-brand-ink-soft">Hochladen und Löschen können Vereinsadmin und Trainer.</p>
      )}

      <section className={KARTE}>
        <KarteKopf icon={Folder} titel="Dateien" />
        <DateiListe dateien={dateien} darfLoeschen={speicher.darfHochladen} />
      </section>
    </div>
  );
}
