import Link from "next/link";
import { redirect } from "next/navigation";
import { History, Search, UserX, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { BenutzerZeile, type Benutzer } from "@/components/admin/BenutzerLoeschen";

export const metadata = { title: "Benutzer – TanzRaum-Administration" };

type Aktion = { id: string; ziel_name: string | null; aktion: string; grund: string | null; erstellt_am: string };
const AKTION_TEXT: Record<string, string> = {
  loeschen_geplant: "Löschung in 14 Tagen",
  loeschen_sofort: "Sofort gelöscht",
  loeschen_abgebrochen: "Löschung abgebrochen",
};

export default async function BenutzerSeite({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) redirect("/dashboard");

  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const [{ data: treffer }, { data: offen }, { data: verlauf }] = await Promise.all([
    q.length >= 2 ? supabase.rpc("admin_benutzer_suche", { p_q: q }) : Promise.resolve({ data: [] }),
    supabase.rpc("admin_benutzer_suche", { p_q: "" }),
    supabase.from("admin_konto_aktionen").select("id, ziel_name, aktion, grund, erstellt_am").order("erstellt_am", { ascending: false }).limit(20),
  ]);
  const liste = (treffer ?? []) as Benutzer[];
  const geplant = (offen ?? []) as Benutzer[];
  const aktionen = (verlauf ?? []) as Aktion[];

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4">
      <Link href="/dashboard/admin" className="text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        ← Administration
      </Link>
      <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
        <Users size={24} className="text-brand-red" /> Benutzer
      </h1>
      <p className="text-[13.5px] text-brand-ink-soft">
        Konten finden und löschen. Angezeigt werden nur Name, @Name, gekürzte E-Mail, Tarif und Vereinsname – keine Vereins- oder Mitgliederdaten, keine
        Chats. Vereinsmitglieder entfernt zuerst ihr Verein; laufende BASIC-Lizenzen und offene Überweisungen müssen vorher erledigt sein.
      </p>

      <section className={KARTE}>
        <KarteKopf icon={Search} titel="Konto suchen" untertitel="Name, @Name oder E-Mail (mindestens 2 Zeichen)" />
        <form action="/dashboard/admin/benutzer" className="flex gap-2">
          <label className="field min-w-0 flex-1">
            <span className="sr-only">Suche</span>
            <input name="q" defaultValue={q} placeholder="z. B. Lena, @lena oder lena@…" autoComplete="off" />
          </label>
          <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-ink px-4 text-[13.5px] font-semibold text-white">
            <Search size={16} /> Suchen
          </button>
        </form>
        {q.length >= 2 &&
          (liste.length === 0 ? (
            <p className="mt-3 rounded-xl bg-brand-bg px-3.5 py-3 text-[13px] text-brand-ink-soft">Kein Konto gefunden.</p>
          ) : (
            <ul className="mt-2 divide-y divide-brand-line">
              {liste.map((b) => (
                <BenutzerZeile key={b.user_id} b={b} />
              ))}
            </ul>
          ))}
        {q.length === 1 && <p className="mt-3 text-[13px] text-brand-ink-soft">Bitte mindestens 2 Zeichen eingeben.</p>}
      </section>

      <section className={KARTE}>
        <KarteKopf icon={UserX} titel={`Laufende Löschungen${geplant.length ? ` (${geplant.length})` : ""}`} untertitel="Selbst beantragt oder durch die Administration – endgültig gelöscht wird nachts um 3:50 Uhr." />
        {geplant.length === 0 ? (
          <p className="text-[13.5px] text-brand-ink-soft">Keine Löschungen geplant.</p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {geplant.map((b) => (
              <BenutzerZeile key={b.user_id} b={b} />
            ))}
          </ul>
        )}
      </section>

      <section className={KARTE}>
        <KarteKopf icon={History} titel="Protokoll" untertitel="Letzte Aktionen der Administration" />
        {aktionen.length === 0 ? (
          <p className="text-[13.5px] text-brand-ink-soft">Noch keine Einträge.</p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {aktionen.map((a) => (
              <li key={a.id} className="py-2 text-[13.5px]">
                <strong>{a.ziel_name ?? "Ohne Namen"}</strong> – {AKTION_TEXT[a.aktion] ?? a.aktion}
                {a.grund ? <span className="text-brand-ink-soft"> · {a.grund}</span> : null}
                <span className="text-brand-ink-soft"> · {new Date(a.erstellt_am).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
