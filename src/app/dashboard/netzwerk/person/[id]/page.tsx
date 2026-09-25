import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Building2, MapPin, Theater, Lock, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPerson } from "@/lib/netzwerk/tanzraumNetzwerk";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { PersonAktionen } from "@/components/netzwerk/PersonAktionen";
import { farbeFuer, initialen } from "@/components/chat/ChatAvatar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FUNKTION: Record<string, string> = { trainer: "Trainer/in", betreuer: "Betreuer/in", mitglied: "Tänzer/in" };

export default async function PersonSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?weiter=/dashboard/netzwerk/person/${id}`);
  const person = await getPerson(supabase, id);
  if (!person) notFound();
  const rollen = [...new Set(person.vereine.map((v) => v.rolle))].join(" · ");

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-4">
      <Link href="/dashboard/netzwerk?ansicht=liste" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> Netzwerk
      </Link>

      <section className={`${KARTE} flex flex-col gap-4`}>
        <div className="flex items-center gap-4">
          {person.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.avatarUrl} alt="" className="h-20 w-20 shrink-0 rounded-full border-[3px] border-brand-gold object-cover" />
          ) : (
            <span className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-[3px] border-brand-gold text-[26px] font-bold text-white ${farbeFuer(person.name)}`}>
              {initialen(person.name)}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-[24px] font-extrabold leading-tight tracking-tight text-brand-ink">{person.name}</h1>
            {person.handle && !person.name.startsWith("@") && <p className="text-[13px] text-brand-ink-faint">@{person.handle}</p>}
            {rollen && <p className="text-[14px] font-semibold text-brand-red">🩰 {rollen}</p>}
            <div className="mt-0.5 flex flex-wrap gap-x-3 text-[13px] text-brand-ink-soft">
              {person.vereine.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Building2 size={14} /> {person.vereine.map((v) => v.name).join(", ")}
                </span>
              )}
              {person.ort && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={14} /> {person.ort}
                </span>
              )}
            </div>
          </div>
        </div>
        {person.privat && (
          <p className="flex items-center gap-2 rounded-xl bg-brand-bg px-3 py-2 text-[13px] text-brand-ink-soft">
            <Lock size={14} /> Privates Konto – weitere Angaben sieht nur, wer im selben Verein oder vernetzt ist.
          </p>
        )}
        {!person.ich && <PersonAktionen person={person} />}
      </section>

      {person.vereine.length > 0 && (
        <section className={KARTE}>
          <KarteKopf icon={Building2} titel="Vereine" />
          <ul className="flex flex-col gap-1.5">
            {person.vereine.map((v) => (
              <li key={v.id}>
                <Link href={`/dashboard/netzwerk/verein/${v.id}`} className="flex items-center justify-between gap-2 rounded-xl bg-brand-bg px-3 py-2.5 hover:bg-brand-line">
                  <span className="text-[14px] font-semibold text-brand-ink">🏠 {v.name}</span>
                  <span className="text-[12.5px] text-brand-ink-soft">
                    {v.rolle}
                    {v.ort ? ` · ${v.ort}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {person.gruppen.length > 0 && (
        <section className={KARTE}>
          <KarteKopf icon={Theater} titel="Tanzgruppen" />
          <ul className="flex flex-wrap gap-2">
            {person.gruppen.map((g) => (
              <li key={g.id} className="rounded-xl border border-brand-line px-3 py-2 text-[13px]">
                <p className="font-semibold text-brand-ink">🩰 {g.name}</p>
                <p className="text-brand-ink-soft">
                  {[g.verein, g.disziplin, g.altersklasse, g.funktion && g.funktion !== "mitglied" ? FUNKTION[g.funktion] : null].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={KARTE} id="spotlights">
        <KarteKopf icon={Sparkles} titel="Spotlights" />
        <p className="text-[13.5px] text-brand-ink-soft">Gerade keine aktuellen Spotlights.</p>
      </section>
    </div>
  );
}
