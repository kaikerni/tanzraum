import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Flag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { MeldungBearbeiten } from "@/components/admin/MeldungBearbeiten";

export const metadata = { title: "Meldungen – TanzRaum-Administration" };

const GRUND: Record<string, string> = {
  unangemessen: "Unangemessener Inhalt",
  belaestigung: "Belästigung",
  unerwuenschter_kontakt: "Unerwünschter Kontakt",
  jugendgefaehrdend: "Jugendgefährdender Inhalt",
  spam: "Spam",
  sonstiges: "Sonstiger Verstoß",
};

const datum = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(iso));

export default async function MeldungenSeite({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) redirect("/dashboard");

  const { status } = await searchParams;
  const filter = status === "erledigt" ? "erledigt" : status === "alle" ? null : "offen";
  const { data } = await supabase.rpc("meldungen_admin", { p_status: filter });
  // deno-lint-ignore no-explicit-any
  const meldungen = (data ?? []) as any[];
  const pfade = meldungen.map((m) => m.spotlight_pfad).filter(Boolean) as string[];
  const urls = new Map<string, string>();
  if (pfade.length) {
    const { data: signiert } = await supabase.storage.from("spotlights").createSignedUrls(pfade, 600);
    for (const s of signiert ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <Link href="/dashboard/admin" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> Administration
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
          <Flag size={22} className="text-brand-red" /> Meldungen
        </h1>
        <nav className="flex gap-1 rounded-xl bg-brand-bg p-1">
          {[
            ["offen", "Offen"],
            ["erledigt", "Erledigt"],
            ["alle", "Alle"],
          ].map(([wert, label]) => (
            <Link
              key={wert}
              href={wert === "offen" ? "/dashboard/admin/meldungen" : `/dashboard/admin/meldungen?status=${wert}`}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${(filter ?? "alle") === wert ? "bg-white text-brand-ink shadow-sm" : "text-brand-ink-soft"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="text-[13px] text-brand-ink-soft">
        Gemeldete Spotlights bleiben erhalten, bis die Meldung erledigt ist. Private Chats sind hier bewusst nicht einsehbar.
      </p>

      {meldungen.length === 0 ? (
        <section className={KARTE}>
          <p className="text-[14px] text-brand-ink-soft">Keine Meldungen.</p>
        </section>
      ) : (
        meldungen.map((m) => (
          <section key={m.id} className={`${KARTE} flex flex-col gap-3`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`status-badge ${m.status === "offen" ? "abgesagt" : "zugesagt"}`}>{m.status === "offen" ? "Offen" : "Erledigt"}</span>
              <span className="text-[12.5px] text-brand-ink-faint">{datum(m.erstellt_am)}</span>
            </div>
            <div className="text-[14px] text-brand-ink">
              <p>
                <strong>{GRUND[m.grund] ?? m.grund}</strong> – gemeldet von {m.melder}
              </p>
              <p>
                Betrifft:{" "}
                {m.ziel_user_id ? (
                  <Link href={`/dashboard/netzwerk/person/${m.ziel_user_id}`} className="font-semibold text-brand-red">
                    {m.ziel}
                  </Link>
                ) : (
                  m.ziel
                )}
                {m.ziel_gesperrt && <span className="ml-2 status-badge abgesagt">gesperrt</span>}
                {m.anzahl_zum_ziel > 1 && <span className="ml-2 text-[12.5px] text-brand-ink-soft">({m.anzahl_zum_ziel} Meldungen zu dieser Person)</span>}
              </p>
              {m.text && <p className="mt-1 whitespace-pre-wrap rounded-lg bg-brand-bg px-3 py-2 text-[13.5px]">„{m.text}“</p>}
            </div>
            {m.spotlight_id && (
              <div className="flex flex-wrap items-start gap-3 rounded-xl border border-brand-line p-2.5">
                {m.spotlight_pfad && urls.get(m.spotlight_pfad) ? (
                  m.spotlight_typ === "video" ? (
                    <video src={urls.get(m.spotlight_pfad)} controls playsInline className="max-h-[260px] rounded-lg bg-black" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={urls.get(m.spotlight_pfad)} alt="Gemeldetes Spotlight" className="max-h-[260px] rounded-lg" />
                  )
                ) : (
                  <span className="text-[13px] text-brand-ink-soft">{m.spotlight_typ ? "Text-Spotlight" : "Spotlight nicht mehr vorhanden"}</span>
                )}
                {m.spotlight_text && <p className="max-w-[360px] whitespace-pre-wrap text-[13.5px] text-brand-ink">{m.spotlight_text}</p>}
                {m.spotlight_entfernt && <span className="status-badge abgesagt">entfernt</span>}
              </div>
            )}
            {m.status === "offen" ? (
              <MeldungBearbeiten id={m.id} mitSpotlight={!!m.spotlight_id && !m.spotlight_entfernt} zielGesperrt={m.ziel_gesperrt} />
            ) : (
              m.admin_notiz && <p className="text-[13px] text-brand-ink-soft">Notiz: {m.admin_notiz}</p>
            )}
          </section>
        ))
      )}
    </div>
  );
}
