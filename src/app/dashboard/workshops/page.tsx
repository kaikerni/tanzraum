import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, GraduationCap, MapPin, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { darfTeam, meineTeamRechte } from "@/lib/team/rechte";
import { BUNDESLAENDER, KATEGORIE_LABEL, STATUS_LABEL, WORKSHOP_KATEGORIEN, WORKSHOP_SPALTEN, datumText, heuteBerlin, uhrzeitText, type Workshop } from "@/lib/workshops/workshops";

export const metadata = { title: "Workshops – TanzRaum" };

function Eintrag({ w, vergangen }: { w: Workshop; vergangen: boolean }) {
  const d = new Date(`${w.datum}T12:00:00`);
  return (
    <Link href={`/dashboard/workshops/${w.id}`} className={`flex items-start gap-3 rounded-2xl border border-brand-line bg-white p-3 hover:border-brand-red ${vergangen ? "opacity-80" : ""}`}>
      <span className={`flex w-14 shrink-0 flex-col items-center rounded-xl py-1.5 ${vergangen ? "bg-brand-bg text-brand-ink-soft" : "bg-brand-red-wash text-brand-red"}`}>
        <span className="text-[20px] font-extrabold leading-none">{d.toLocaleDateString("de-DE", { day: "2-digit" })}</span>
        <span className="text-[11px] font-bold uppercase">{d.toLocaleDateString("de-DE", { month: "short" })}</span>
        <span className="text-[10.5px]">{d.getFullYear()}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15.5px] font-bold leading-snug text-brand-ink [overflow-wrap:anywhere]">{w.titel}</span>
        <span className="block text-[12.5px] text-brand-ink-soft">
          {datumText(w)}
          {uhrzeitText(w) ? ` · ${uhrzeitText(w)}` : ""}
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-[13px] text-brand-ink">
          <MapPin size={13} className="shrink-0 text-brand-red" />
          <span className="truncate">
            {w.ort} · {w.bundesland}
          </span>
        </span>
        <span className="mt-1 flex flex-wrap gap-1.5 text-[11.5px] font-semibold">
          <span className="rounded-full bg-brand-bg px-2 py-0.5 text-brand-ink-soft">{w.ausrichter}</span>
          {w.kategorie && <span className="rounded-full bg-brand-gold-wash px-2 py-0.5 text-brand-ink">{KATEGORIE_LABEL[w.kategorie]}</span>}
          {vergangen && <span className="rounded-full bg-brand-bg px-2 py-0.5 text-brand-ink-soft">vergangen</span>}
        </span>
      </span>
    </Link>
  );
}

// 🎓 Workshops: nur mit TanzRaum-Konto, nur freigegebene; kommende chronologisch, vergangene separat (nie geloescht)
export default async function WorkshopsSeite({
  searchParams,
}: {
  searchParams: Promise<{ ansicht?: string; bundesland?: string; kategorie?: string; von?: string; bis?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/workshops");
  const sp = await searchParams;
  const vergangen = sp.ansicht === "vergangen";
  const bundesland = (BUNDESLAENDER as readonly string[]).includes(sp.bundesland ?? "") ? sp.bundesland! : "";
  const kategorie = WORKSHOP_KATEGORIEN.some((k) => k.id === sp.kategorie) ? sp.kategorie! : "";
  const von = /^\d{4}-\d{2}-\d{2}$/.test(sp.von ?? "") ? sp.von! : "";
  const bis = /^\d{4}-\d{2}-\d{2}$/.test(sp.bis ?? "") ? sp.bis! : "";
  const heute = heuteBerlin();

  let abfrage = supabase.from("workshops").select(WORKSHOP_SPALTEN).eq("status", "freigegeben");
  abfrage = vergangen
    ? abfrage.or(`datum_bis.lt.${heute},and(datum_bis.is.null,datum.lt.${heute})`).order("datum", { ascending: false })
    : abfrage.or(`datum_bis.gte.${heute},and(datum_bis.is.null,datum.gte.${heute})`).order("datum", { ascending: true });
  if (bundesland) abfrage = abfrage.eq("bundesland", bundesland);
  if (kategorie) abfrage = abfrage.eq("kategorie", kategorie);
  if (von) abfrage = abfrage.gte("datum", von);
  if (bis) abfrage = abfrage.lte("datum", bis);

  const [{ data }, { data: eigene }, rechte, { data: status }] = await Promise.all([
    abfrage.limit(200),
    supabase.from("workshops").select("id, titel, datum, status").eq("eingereicht_von", user.id).neq("status", "freigegeben").order("erstellt_am", { ascending: false }),
    meineTeamRechte(supabase),
    supabase.rpc("treff_mein_status"),
  ]);
  const liste = ((data ?? []) as Workshop[]).filter((w) => (vergangen ? (w.datum_bis ?? w.datum) < heute : (w.datum_bis ?? w.datum) >= heute));
  const pruefer = darfTeam(rechte, "workshops.freigeben") || darfTeam(rechte, "workshops.ablehnen") || darfTeam(rechte, "workshops.ansehen");
  let offen = 0;
  if (pruefer) {
    const { data: p } = await supabase.rpc("workshops_pruefen");
    offen = ((p ?? []) as { status: string }[]).filter((x) => x.status === "eingereicht").length;
  }
  const unter16 = (status as { unter_16?: boolean } | null)?.unter_16 === true;
  const filterAktiv = !!(bundesland || kategorie || von || bis);
  const reiter = (aktiv: boolean) => `rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold ${aktiv ? "bg-brand-ink text-white" : "border border-brand-line bg-white text-brand-ink-soft"}`;
  const filterParams = new URLSearchParams({ ...(bundesland ? { bundesland } : {}), ...(kategorie ? { kategorie } : {}), ...(von ? { von } : {}), ...(bis ? { bis } : {}) });

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
            <GraduationCap size={26} className="text-brand-red" /> Workshops
          </h1>
          <p className="text-[14px] text-brand-ink-soft">Workshops rund um den karnevalistischen Tanzsport – Technik, Akrobatik, Choreografie, Fortbildungen und mehr.</p>
        </div>
        {!unter16 && (
          <Link href="/dashboard/workshops/neu" className="btn-primary mt-0 inline-flex min-h-11 items-center gap-1.5">
            <Plus size={17} /> Workshop einreichen
          </Link>
        )}
      </div>

      {pruefer && (
        <Link href="/dashboard/workshops/pruefen" className={`${KARTE} flex items-center gap-3 !py-3 hover:border-brand-red`}>
          <ClipboardCheck size={20} className="text-brand-blue" />
          <span className="flex-1 text-[14px] font-semibold text-brand-ink">Workshops prüfen</span>
          {offen > 0 && <span className="rounded-full bg-brand-red px-2.5 py-0.5 text-[13px] font-bold text-white">{offen} eingereicht</span>}
        </Link>
      )}

      {(eigene ?? []).length > 0 && (
        <section className={KARTE}>
          <h2 className="mb-2 text-[15px] font-bold text-brand-ink">Meine Einreichungen</h2>
          <ul className="flex flex-col gap-1.5">
            {((eigene ?? []) as { id: string; titel: string; datum: string; status: string }[]).map((e) => (
              <li key={e.id}>
                <Link href={`/dashboard/workshops/${e.id}`} className="flex flex-wrap items-center gap-2 rounded-xl px-2 py-1.5 text-[13.5px] hover:bg-brand-bg">
                  <span className="font-semibold text-brand-ink">{e.titel}</span>
                  <span className="text-brand-ink-soft">· {datumText({ datum: e.datum, datum_bis: null })}</span>
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[11.5px] font-bold ${e.status === "abgelehnt" ? "bg-brand-red-wash text-brand-red" : "bg-brand-gold-wash text-brand-ink"}`}>
                    {STATUS_LABEL[e.status] ?? e.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href={`/dashboard/workshops?${filterParams}`} className={reiter(!vergangen)}>
          Kommende Workshops
        </Link>
        <Link href={`/dashboard/workshops?${new URLSearchParams({ ansicht: "vergangen", ...Object.fromEntries(filterParams) })}`} className={reiter(vergangen)}>
          Vergangene Workshops
        </Link>
      </div>

      <form action="/dashboard/workshops" className={`${KARTE} grid gap-2 !py-3 sm:grid-cols-2 lg:grid-cols-5`}>
        {vergangen && <input type="hidden" name="ansicht" value="vergangen" />}
        <label className="field">
          Bundesland
          <select name="bundesland" defaultValue={bundesland}>
            <option value="">Alle Bundesländer</option>
            {BUNDESLAENDER.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Kategorie
          <select name="kategorie" defaultValue={kategorie}>
            <option value="">Alle Kategorien</option>
            {WORKSHOP_KATEGORIEN.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Von
          <input type="date" name="von" defaultValue={von} />
        </label>
        <label className="field">
          Bis
          <input type="date" name="bis" defaultValue={bis} />
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="min-h-11 flex-1 rounded-xl bg-brand-ink px-4 text-[13.5px] font-semibold text-white">
            Filtern
          </button>
          {filterAktiv && (
            <Link href={vergangen ? "/dashboard/workshops?ansicht=vergangen" : "/dashboard/workshops"} className="flex min-h-11 items-center rounded-xl border border-brand-line px-3 text-[13px] font-semibold">
              Zurücksetzen
            </Link>
          )}
        </div>
      </form>

      {liste.length === 0 ? (
        <p className={`${KARTE} text-[14px] text-brand-ink-soft`}>
          {vergangen ? "Keine vergangenen Workshops gefunden." : filterAktiv ? "Für diese Auswahl gibt es gerade keine kommenden Workshops." : "Gerade sind keine kommenden Workshops eingetragen."}
        </p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {liste.map((w) => (
            <li key={w.id}>
              <Eintrag w={w} vergangen={vergangen} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
