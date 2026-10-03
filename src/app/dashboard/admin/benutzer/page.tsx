import Link from "next/link";
import { redirect } from "next/navigation";
import { History, List, Search, UserX, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { BenutzerZeile, type Benutzer } from "@/components/admin/BenutzerLoeschen";
import { BenutzerListe, type ListenBenutzer, type ListenFilter } from "@/components/admin/BenutzerListe";

export const metadata = { title: "Benutzer – TanzRaum-Administration" };

type Aktion = { id: string; ziel_name: string | null; aktion: string; grund: string | null; erstellt_am: string };
const AKTION_TEXT: Record<string, string> = {
  loeschen_geplant: "Löschung in 14 Tagen",
  loeschen_sofort: "Sofort gelöscht",
  loeschen_abgebrochen: "Löschung abgebrochen",
};

type Parameter = { q?: string; lq?: string; tarif?: string; status?: string; verein?: string; rolle?: string; sort?: string; dir?: string; seite?: string; pro?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nurWenn = (wert: string | undefined, erlaubt: string[]) => (wert && erlaubt.includes(wert) ? wert : "");

export default async function BenutzerSeite({ searchParams }: { searchParams: Promise<Parameter> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) redirect("/dashboard");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  // Vollstaendige Liste: Filter, Sortierung und Seite werden serverseitig angewendet (admin_benutzer_liste, nur TanzRaum-Admin)
  const filter: ListenFilter = {
    lq: (sp.lq ?? "").trim().slice(0, 100),
    tarif: nurWenn(sp.tarif, ["free", "basic", "verein"]),
    status: nurWenn(sp.status, ["aktiv", "deaktiviert"]),
    verein: sp.verein && UUID.test(sp.verein) ? sp.verein : "",
    rolle: nurWenn(sp.rolle, ["admin", "trainer", "betreuer", "mitglied", "eltern"]),
    sort: nurWenn(sp.sort, ["registriert", "name", "handle", "tarif", "verein"]) || "registriert",
    dir: sp.dir === "asc" ? "asc" : sp.dir === "desc" ? "desc" : (sp.sort ?? "registriert") === "registriert" ? "desc" : "asc",
    pro: [20, 50, 100].includes(Number(sp.pro)) ? Number(sp.pro) : 50,
  };
  const seite = Math.max(1, Math.min(100000, Number.parseInt(sp.seite ?? "1", 10) || 1));
  const [{ data: treffer }, { data: offen }, { data: verlauf }, { data: listeRoh }] = await Promise.all([
    q.length >= 2 ? supabase.rpc("admin_benutzer_suche", { p_q: q }) : Promise.resolve({ data: [] }),
    supabase.rpc("admin_benutzer_suche", { p_q: "" }),
    supabase.from("admin_konto_aktionen").select("id, ziel_name, aktion, grund, erstellt_am").order("erstellt_am", { ascending: false }).limit(20),
    supabase.rpc("admin_benutzer_liste", {
      p_q: filter.lq.length >= 2 ? filter.lq : null,
      p_tarif: filter.tarif || null,
      p_status: filter.status || null,
      p_verein_id: filter.verein || null,
      p_rolle: filter.rolle || null,
      p_sortierung: filter.sort,
      p_absteigend: filter.dir === "desc",
      p_seite: seite,
      p_pro_seite: filter.pro,
    }),
  ]);
  const listenDaten = (listeRoh ?? null) as { gesamt?: number; seite?: number; zeilen?: ListenBenutzer[]; vereine?: { id: string; name: string }[] } | null;
  const liste = (treffer ?? []) as Benutzer[];
  const geplant = (offen ?? []) as Benutzer[];
  const aktionen = (verlauf ?? []) as Aktion[];

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
      <Link href="/dashboard/admin" className="text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        ← Administration
      </Link>
      <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
        <Users size={24} className="text-brand-red" /> Benutzer
      </h1>
      <p className="text-[13.5px] text-brand-ink-soft">
        Konten finden, ansehen und löschen. Angezeigt werden nur Name, @Name, gekürzte E-Mail, Tarif, Vereinsname und Rolle – keine Vereins- oder
        Mitgliederdaten, keine Chats. Vereinsmitglieder entfernt zuerst ihr Verein; laufende BASIC-Lizenzen und offene Überweisungen müssen vorher erledigt
        sein.
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

      <section id="benutzerliste" className={`${KARTE} scroll-mt-20`}>
        <KarteKopf
          icon={List}
          titel="Alle Benutzer"
          untertitel="Alle registrierten TanzRaum-Konten. Vereinsmitglieder ohne eigenes Konto stehen nur in der Mitgliederverwaltung ihres Vereins."
        />
        {listenDaten ? (
          <BenutzerListe
            zeilen={listenDaten.zeilen ?? []}
            gesamt={Number(listenDaten.gesamt ?? 0)}
            seite={Number(listenDaten.seite ?? seite)}
            filter={filter}
            vereine={listenDaten.vereine ?? []}
          />
        ) : (
          <p className="form-error">Die Benutzerliste konnte gerade nicht geladen werden.</p>
        )}
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
