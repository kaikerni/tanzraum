import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Building2, Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getNetzwerkModus, getNetzwerkProfil, NETZWERK_TITEL } from "@/lib/netzwerk/getNetzwerk";
import { KARTE } from "@/components/dashboard/Karten";
import { ChatAvatar } from "@/components/chat/ChatAvatar";
import { NetzwerkAktion } from "@/components/netzwerk/NetzwerkAktion";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NetzwerkProfilSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?weiter=/dashboard/trainer-netzwerk/${id}`);

  const modus = await getNetzwerkModus(supabase);
  if (!modus) redirect("/dashboard/trainer-netzwerk");
  const p = await getNetzwerkProfil(supabase, id);
  if (!p) notFound();

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4">
      <Link href="/dashboard/trainer-netzwerk" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> {NETZWERK_TITEL[modus]}
      </Link>

      <section className={`${KARTE} flex flex-col gap-4`}>
        <div className="flex items-center gap-4">
          <ChatAvatar typ="dm" name={p.anzeige} avatarUrl={p.avatarUrl} groesse={72} />
          <div className="min-w-0">
            <h1 className="text-[22px] font-extrabold leading-tight tracking-tight text-brand-ink">{p.anzeige}</h1>
            {p.handle && <p className="text-[13.5px] text-brand-ink-soft">@{p.handle}</p>}
            {p.status === "verbunden" && p.verbundenSeit && (
              <p className="text-[12.5px] text-brand-green">
                Verbunden seit {new Date(p.verbundenSeit).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "long" })}
              </p>
            )}
          </div>
        </div>
        {p.status === "eingehend" && <p className="text-[13.5px] font-semibold text-brand-ink">{p.anzeige} möchte sich mit dir verbinden.</p>}
        <NetzwerkAktion userId={p.userId} name={p.anzeige} status={p.status} mitTrennen />
        {p.status === "abgelehnt" && (
          <p className="text-[12.5px] text-brand-ink-faint">Deine letzte Anfrage wurde abgelehnt. Eine neue Anfrage ist nach 30 Tagen möglich.</p>
        )}
      </section>

      {p.vereine.length > 0 && (
        <section className={`${KARTE} flex flex-col gap-4`}>
          {p.vereine.map((v) => (
            <div key={v.verein} className="flex flex-col gap-2">
              <p className="flex items-center gap-2 text-[15px] font-bold text-brand-ink">
                <Building2 size={17} /> {v.verein}
                {v.ort && <span className="text-[13px] font-normal text-brand-ink-soft">· {v.ort}</span>}
              </p>
              {v.rolle && <p className="text-[13.5px] text-brand-ink-soft">{v.rolle}</p>}
              {v.gruppen.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {v.gruppen.map((g, i) => (
                    <li key={i} className="flex items-center gap-2 text-[13.5px] text-brand-ink">
                      <Layers size={14} className="text-brand-ink-faint" />
                      {g.name ?? "Gruppe"}
                      <span className="text-brand-ink-soft">{[g.disziplin, g.altersklasse].filter(Boolean).join(" · ")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
