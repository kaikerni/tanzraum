import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Building2, MapPin, Theater, GraduationCap, Users, Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getVereinProfil } from "@/lib/netzwerk/tanzraumNetzwerk";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { farbeFuer, initialen } from "@/components/chat/ChatAvatar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function VereinSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?weiter=/dashboard/netzwerk/verein/${id}`);
  const v = await getVereinProfil(supabase, id);
  if (!v) notFound();
  const weitere = Math.max(0, v.mitgliederAnzahl - v.mitglieder.length);

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <Link href="/dashboard/netzwerk" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> Netzwerk
      </Link>

      <section className={`${KARTE} flex flex-col gap-3`}>
        <div className="flex items-center gap-4">
          {v.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.logoUrl} alt="" className="h-20 w-20 shrink-0 rounded-2xl border border-brand-line bg-white object-contain" />
          ) : (
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-brand-red text-white">
              <Building2 size={34} />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-[24px] font-extrabold leading-tight tracking-tight text-brand-ink">🏠 {v.name}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-brand-ink-soft">
              {v.ort && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={14} /> {[v.plz, v.ort].filter(Boolean).join(" ")}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Users size={14} /> {v.mitgliederAnzahl} TanzRaum-Mitglieder
              </span>
              {v.webseite && (
                <a href={v.webseite} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-red">
                  <Globe size={14} /> Webseite
                </a>
              )}
            </div>
          </div>
        </div>
        {v.beschreibung && <p className="whitespace-pre-line text-[14px] text-brand-ink">{v.beschreibung}</p>}
        {v.lat !== null && (
          <Link href={`/dashboard/netzwerk?verein=${v.id}`} className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl border border-brand-line px-3.5 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg">
            <MapPin size={15} className="text-brand-red" /> Auf der TanzRaum Map zeigen
          </Link>
        )}
      </section>

      <section className={KARTE}>
        <KarteKopf icon={Theater} titel="Tanzgruppen" />
        {v.gruppen.length === 0 ? (
          <p className="text-[13.5px] text-brand-ink-soft">Noch keine Tanzgruppen eingetragen.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {v.gruppen.map((g) => (
              <li key={g.id} id={`gruppe-${g.id}`} className="scroll-mt-20 rounded-xl border border-brand-line px-3 py-2.5 target:border-brand-red target:bg-brand-red-wash">
                <p className="text-[14px] font-bold text-brand-ink">🩰 {g.name}</p>
                <p className="text-[12.5px] text-brand-ink-soft">{[g.disziplin, g.altersklasse].filter(Boolean).join(" · ") || "–"}</p>
                {g.trainer && <p className="text-[12.5px] text-brand-ink-soft">🎓 {g.trainer}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {v.trainer.length > 0 && (
        <section className={KARTE}>
          <KarteKopf icon={GraduationCap} titel="Trainer & Vorstand" />
          <ul className="flex flex-wrap gap-2">
            {v.trainer.map((t) => (
              <li key={t.id}>
                <Link href={`/dashboard/netzwerk/person/${t.id}`} className="inline-flex items-center gap-2 rounded-full border border-brand-line py-1 pl-1 pr-3 text-[13px] hover:bg-brand-bg">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold text-white ${farbeFuer(t.name)}`}>{initialen(t.name)}</span>
                  <span>
                    <span className="font-semibold text-brand-ink">{t.name}</span> <span className="text-brand-ink-soft">· {t.rolle}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={KARTE}>
        <KarteKopf icon={Users} titel="Mitglieder" untertitel={v.ichMitglied ? undefined : "Angezeigt werden Mitglieder, die im Netzwerk auffindbar sind."} />
        {v.mitglieder.length === 0 ? (
          <p className="text-[13.5px] text-brand-ink-soft">Keine öffentlich sichtbaren Mitglieder.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {v.mitglieder.map((m) => (
              <li key={m.id}>
                <Link href={`/dashboard/netzwerk/person/${m.id}`} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-brand-bg">
                  {m.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-bold text-white ${farbeFuer(m.name)}`}>{initialen(m.name)}</span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-brand-ink">{m.name}</span>
                    <span className="block truncate text-[12px] text-brand-ink-soft">{m.rolle}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {weitere > 0 && <p className="mt-2 text-[12.5px] text-brand-ink-faint">und {weitere} weitere Mitglieder</p>}
      </section>
    </div>
  );
}
