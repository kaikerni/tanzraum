import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Music, Search, Upload, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import { SpeicherReduziert } from "@/components/speicher/SpeicherReduziert";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { MusikHochladen, type GruppeAuswahl } from "@/components/musik/MusikHochladen";
import { MusikTitelZeile } from "@/components/musik/MusikTitelZeile";
import { MUSIK_ARTEN, MUSIK_ART_LABEL, MUSIK_BUCKET, MUSIK_SPALTEN, mb, type MusikTitel } from "@/lib/musik";

export const metadata = { title: "Musik – TanzRaum" };

type Filter = { q?: string; gruppe?: string; art?: string };

function Speicher({ belegt, limit }: { belegt: number; limit: number }) {
  const anteil = limit > 0 ? Math.min(100, (belegt / limit) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[12.5px] text-brand-ink-soft">
        {mb(belegt)} von {mb(limit)} belegt
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-brand-bg">
        <div className={`h-full rounded-full ${anteil >= 90 ? "bg-brand-red" : "bg-brand-green"}`} style={{ width: `${anteil}%` }} />
      </div>
      <SpeicherReduziert belegt={belegt} limit={limit} />
    </div>
  );
}

export default async function MusikSeite({ searchParams }: { searchParams: Promise<Filter> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/musik");
  const daten = await getDashboardData(supabase, user.id);
  if (!daten) redirect("/login");
  const f = await searchParams;

  // Plattformweit von der TanzRaum-Administration ausgeschaltet (z. B. bis genug Speicher gebucht ist)
  const { data: musikAn } = await supabase.rpc("musik_freigegeben");
  if (musikAn !== true) {
    return (
      <div className="mx-auto flex max-w-[720px] flex-col gap-4">
        <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
          <Music size={24} className="text-brand-red" /> Musik
        </h1>
        <section className={`${KARTE} flex flex-col items-center gap-2 py-10 text-center`}>
          <p className="text-[16px] font-bold text-brand-ink">Der Musikbereich ist gerade nicht verfügbar</p>
          <p className="max-w-md text-[14px] text-brand-ink-soft">Er wird in einem der nächsten Updates freigeschaltet.</p>
          <Link href="/dashboard" className="mt-2 text-[13.5px] font-semibold text-brand-red">
            Zurück zum Dashboard
          </Link>
        </section>
      </div>
    );
  }

  const verein = daten.vereine.find((v) => !v.vereinGesperrt && v.vereinTarif === "verein") ?? null;
  const [{ data: eigeneErlaubt }, verwaltenRes] = await Promise.all([
    supabase.rpc("darf_eigene_dateien"),
    verein ? supabase.rpc("darf_musik_verwalten", { p_verein_id: verein.vereinId }) : Promise.resolve({ data: false }),
  ]);
  const darfVerwalten = verwaltenRes.data === true;
  const darfEigene = eigeneErlaubt === true;

  const [{ data: vereinRoh }, { data: eigeneRoh }, { data: gruppenRoh }, { data: vereinSpeicher }, { data: eigenerSpeicher }] = await Promise.all([
    verein ? supabase.from("musik_titel").select(MUSIK_SPALTEN).eq("verein_id", verein.vereinId).order("titel").limit(1000) : Promise.resolve({ data: [] }),
    supabase.from("musik_titel").select(MUSIK_SPALTEN).eq("user_id", user.id).order("titel").limit(1000),
    verein ? supabase.from("gruppen").select("id, name").eq("verein_id", verein.vereinId).order("name") : Promise.resolve({ data: [] }),
    darfVerwalten && verein ? supabase.rpc("musik_speicher", { p_verein_id: verein.vereinId }) : Promise.resolve({ data: null }),
    darfEigene ? supabase.rpc("musik_speicher", { p_verein_id: null }) : Promise.resolve({ data: null }),
  ]);
  const vereinTitel = (vereinRoh ?? []) as MusikTitel[];
  const eigeneTitel = (eigeneRoh ?? []) as MusikTitel[];
  const gruppen = (gruppenRoh ?? []) as GruppeAuswahl[];

  // Kurzlebige Links (1 Stunde) nur fuer die angezeigten Titel
  const pfade = [...vereinTitel, ...eigeneTitel].map((t) => t.datei_pfad);
  const urls = new Map<string, string>();
  if (pfade.length) {
    const { data } = await supabase.storage.from(MUSIK_BUCKET).createSignedUrls(pfade, 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  const q = (f.q ?? "").trim().toLowerCase();
  const passt = (t: MusikTitel) =>
    (!q || [t.titel, t.interpret, t.notiz].some((w) => w?.toLowerCase().includes(q))) &&
    (!f.art || t.art === f.art) &&
    (!f.gruppe || (f.gruppe === "alle" ? t.gruppen.length === 0 : t.gruppen.includes(f.gruppe)));
  const vereinGefiltert = vereinTitel.filter(passt);
  const speicher = (s: unknown) => s as { belegt: number; limit: number } | null;

  const keinZugang = !verein && !darfEigene;

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
          <Music size={24} className="text-brand-red" /> Musik
        </h1>
        <p className="text-[13.5px] text-brand-ink-soft">
          Musik für Training und Auftritte – direkt im Browser anhören, auch auf dem Handy. Dateien liegen privat gespeichert und sind nur für
          Berechtigte abspielbar.
        </p>
      </div>

      {keinZugang && (
        <section className={`${KARTE} flex flex-col items-center gap-2 py-10 text-center`}>
          <p className="text-[16px] font-bold text-brand-ink">Musik gibt es ab BASIC bzw. im Verein mit Vereinslizenz</p>
          <Link href="/dashboard/tarif" className="text-[13.5px] font-semibold text-brand-red">
            Tarife ansehen →
          </Link>
        </section>
      )}

      {verein && (
        <section className={KARTE}>
          <KarteKopf
            icon={Building2}
            titel={`Vereinsmusik · ${verein.vereinName}`}
            untertitel={darfVerwalten ? "Du verwaltest die Musik (Vereinsadmin/Trainer). Mitglieder hören die Titel ihrer Gruppen." : "Musik deiner Gruppen – zum Üben zu Hause."}
          />
          {darfVerwalten && (
            <details className="mb-4 rounded-xl border border-brand-line p-3" open={vereinTitel.length === 0}>
              <summary className="flex cursor-pointer list-none items-center gap-2 text-[14.5px] font-bold text-brand-ink">
                <Upload size={16} className="text-brand-red" /> Musik hochladen
              </summary>
              <div className="mt-3 flex flex-col gap-3">
                {speicher(vereinSpeicher) && <Speicher {...speicher(vereinSpeicher)!} />}
                <MusikHochladen vereinId={verein.vereinId} gruppen={gruppen} />
              </div>
            </details>
          )}
          {vereinTitel.length > 0 && (
            <form className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_auto]" action="/dashboard/musik">
              <label className="field min-w-0">
                <span className="sr-only">Suche</span>
                <input name="q" defaultValue={f.q ?? ""} placeholder="Titel, Interpret, Notiz …" />
              </label>
              <label className="field">
                <span className="sr-only">Gruppe</span>
                <select name="gruppe" defaultValue={f.gruppe ?? ""}>
                  <option value="">Alle Gruppen</option>
                  <option value="alle">Ganzer Verein</option>
                  {gruppen.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="sr-only">Verwendung</span>
                <select name="art" defaultValue={f.art ?? ""}>
                  <option value="">Alle Verwendungen</option>
                  {MUSIK_ARTEN.map((a) => (
                    <option key={a} value={a}>
                      {MUSIK_ART_LABEL[a]}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-ink px-4 text-[13.5px] font-semibold text-white">
                <Search size={16} /> Filtern
              </button>
            </form>
          )}
          {vereinGefiltert.length === 0 ? (
            <p className="rounded-xl bg-brand-bg px-3.5 py-3 text-[13px] text-brand-ink-soft">
              {vereinTitel.length === 0
                ? darfVerwalten
                  ? "Noch keine Vereinsmusik – lade oben den ersten Titel hoch."
                  : "Für deine Gruppen ist noch keine Musik hinterlegt."
                : "Keine Titel für diese Auswahl."}
            </p>
          ) : (
            <ul className="divide-y divide-brand-line rounded-xl border border-brand-line">
              {vereinGefiltert.map((t) => (
                <MusikTitelZeile key={t.id} t={t} url={urls.get(t.datei_pfad) ?? null} darfVerwalten={darfVerwalten} gruppen={gruppen} />
              ))}
            </ul>
          )}
        </section>
      )}

      {darfEigene && (
        <section className={KARTE}>
          <KarteKopf icon={User} titel="Meine Musik" untertitel="Nur für dich sichtbar – z. B. für Solo-Training oder eigene Choreografien." />
          <details className="mb-4 rounded-xl border border-brand-line p-3" open={eigeneTitel.length === 0}>
            <summary className="flex cursor-pointer list-none items-center gap-2 text-[14.5px] font-bold text-brand-ink">
              <Upload size={16} className="text-brand-red" /> Eigene Musik hochladen
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              {speicher(eigenerSpeicher) && <Speicher {...speicher(eigenerSpeicher)!} />}
              <MusikHochladen vereinId={null} gruppen={[]} />
            </div>
          </details>
          {eigeneTitel.length === 0 ? (
            <p className="rounded-xl bg-brand-bg px-3.5 py-3 text-[13px] text-brand-ink-soft">Noch keine eigene Musik.</p>
          ) : (
            <ul className="divide-y divide-brand-line rounded-xl border border-brand-line">
              {eigeneTitel.map((t) => (
                <MusikTitelZeile key={t.id} t={t} url={urls.get(t.datei_pfad) ?? null} darfVerwalten gruppen={[]} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
