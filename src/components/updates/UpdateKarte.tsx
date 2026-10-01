import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { datumKurz, kategorieLabel, sichererLink } from "@/lib/updates/getUpdates";

export type UpdateAnzeige = {
  id: string;
  version: string | null;
  titel: string;
  kurztext: string | null;
  text: string;
  kategorie: string | null;
  datum: string;
  bildUrl: string | null;
  linkUrl: string | null;
  linkText: string | null;
};

// Ein Update (Release-Information): kompakt (Kurztext + „Mehr erfahren“) oder ausfuehrlich (ganzer Text)
export function UpdateKarte({ u, ausfuehrlich = false, mehrHref }: { u: UpdateAnzeige; ausfuehrlich?: boolean; mehrHref?: string }) {
  const link = sichererLink(u.linkUrl);
  const intern = link?.startsWith("/");
  return (
    <article id={`update-${u.id}`} className="flex min-w-0 scroll-mt-20 flex-col gap-3 rounded-[var(--radius-l)] border border-brand-line bg-white p-4 shadow-[var(--shadow)] sm:p-5">
      {u.bildUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={u.bildUrl} alt="" loading="lazy" className="max-h-56 w-full rounded-xl object-cover" />
      )}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-semibold text-brand-ink-soft">
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-gold-wash px-2.5 py-0.5 text-brand-gold">
          <Sparkles size={12} /> {kategorieLabel(u.kategorie)}
        </span>
        {u.version && <span>Version {u.version}</span>}
        <span>· {datumKurz(u.datum)}</span>
      </div>
      <h3 className="text-[17px] font-extrabold leading-snug text-brand-ink [overflow-wrap:anywhere]">{u.titel}</h3>
      {u.kurztext && <p className="text-[14.5px] font-medium text-brand-ink [overflow-wrap:anywhere]">{u.kurztext}</p>}
      {ausfuehrlich && u.text && <p className="whitespace-pre-line text-[14px] leading-relaxed text-brand-ink-soft [overflow-wrap:anywhere]">{u.text}</p>}
      <div className="flex flex-wrap gap-2">
        {!ausfuehrlich && mehrHref && (
          <Link href={mehrHref} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-brand-line px-4 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg">
            Mehr erfahren <ArrowRight size={15} />
          </Link>
        )}
        {ausfuehrlich && link && (
          <a
            href={link}
            {...(intern ? {} : { target: "_blank", rel: "noopener noreferrer" })}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-ink px-4 text-[13.5px] font-semibold text-white hover:bg-brand-navy"
          >
            {u.linkText || "Ansehen"} <ArrowRight size={15} />
          </a>
        )}
      </div>
    </article>
  );
}
