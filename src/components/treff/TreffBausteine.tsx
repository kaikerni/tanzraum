import Link from "next/link";
import { CheckCircle2, Lock, MessageSquare, Pin, Star } from "lucide-react";
import { NutzerAvatar } from "@/components/ui/NutzerAvatar";
import { KENNZEICHEN } from "@/lib/team/rechte";
import { istBearbeitet, zeitRelativ, type ThemaListe } from "@/lib/treff/treff";

// Profilanzeige im Treff: Profilbild, @Nutzername, Verein (falls vorhanden) – nie Vor-/Nachname, nie „Kein Verein“
export function AutorZeile({
  handle,
  avatarUrl,
  verein,
  kennzeichen,
  zeit,
  bearbeitet,
  klein = false,
}: {
  handle: string | null;
  avatarUrl: string | null;
  verein: string | null;
  kennzeichen: string | null;
  zeit?: string;
  bearbeitet?: string | null;
  klein?: boolean;
}) {
  const name = handle ? `@${handle}` : "Gelöschtes Konto";
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <NutzerAvatar name={name} avatarUrl={avatarUrl} groesse={klein ? 32 : 40} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className={`font-bold text-brand-ink ${klein ? "text-[13.5px]" : "text-[14.5px]"}`}>{handle ?? "Gelöschtes Konto"}</span>
          {kennzeichen && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${kennzeichen === "admin" ? "bg-brand-gold-wash text-brand-ink" : "bg-brand-blue-wash text-brand-blue"}`}>
              {KENNZEICHEN[kennzeichen] ?? kennzeichen}
            </span>
          )}
        </div>
        {(verein || zeit) && (
          <div className="truncate text-[12px] text-brand-ink-soft">
            {verein}
            {verein && zeit ? " · " : ""}
            {zeit && zeitRelativ(zeit)}
            {zeit && bearbeitet && istBearbeitet(zeit, bearbeitet) ? " · bearbeitet" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

export function ThemaKarte({ t, kompakt = false }: { t: ThemaListe; kompakt?: boolean }) {
  return (
    <Link href={`/dashboard/treff/thema/${t.id}`} className="flex flex-col gap-2 rounded-2xl border border-brand-line bg-white p-3.5 hover:border-brand-red">
      <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-semibold">
        <span className="rounded-full bg-brand-bg px-2 py-0.5 text-brand-ink-soft">
          {t.kategorie_emoji} {t.kategorie}
        </span>
        {t.angepinnt && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-red-wash px-2 py-0.5 text-brand-red">
            <Pin size={11} /> Angepinnt
          </span>
        )}
        {t.empfohlen && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-gold-wash px-2 py-0.5 text-brand-ink">
            <Star size={11} /> TanzRaum empfiehlt
          </span>
        )}
        {t.beantwortet && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-green-wash px-2 py-0.5 text-brand-green">
            <CheckCircle2 size={11} /> Beantwortet
          </span>
        )}
        {t.geschlossen && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-bg px-2 py-0.5 text-brand-ink-soft">
            <Lock size={11} /> Geschlossen
          </span>
        )}
      </div>
      <h3 className="text-[15.5px] font-bold leading-snug text-brand-ink [overflow-wrap:anywhere]">{t.titel}</h3>
      {!kompakt && <p className="line-clamp-2 text-[13px] text-brand-ink-soft [overflow-wrap:anywhere]">{t.auszug}</p>}
      <div className="flex items-center justify-between gap-2">
        <AutorZeile handle={t.autor_handle} avatarUrl={t.autor_avatar} verein={t.autor_verein} kennzeichen={t.autor_kennzeichen} zeit={t.erstellt_am} klein />
        <span className="flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-brand-ink-soft" title={`Letzte Aktivität ${zeitRelativ(t.letzte_aktivitaet)}`}>
          <MessageSquare size={14} /> {t.antworten}
        </span>
      </div>
    </Link>
  );
}

// FREE (oder ohne Schreibrecht): lesen ja, schreiben ab BASIC
export function SchreibHinweis({ unter16, gesperrtBis }: { unter16: boolean; gesperrtBis: string | null }) {
  if (gesperrtBis)
    return (
      <p className="rounded-2xl bg-brand-red-wash px-4 py-3 text-[13.5px] text-brand-red">
        Du bist im TanzRaum Treff {gesperrtBis === "unbefristet" ? "dauerhaft" : `bis ${new Date(gesperrtBis).toLocaleDateString("de-DE")}`} für das Schreiben gesperrt. Lesen kannst du weiterhin.
      </p>
    );
  if (unter16) return <p className="rounded-2xl bg-brand-bg px-4 py-3 text-[13.5px] text-brand-ink-soft">Mitschreiben im TanzRaum Treff ist ab 16 Jahren möglich. Lesen kannst du alles.</p>;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-brand-gold/40 bg-brand-gold-wash/50 px-4 py-3 sm:flex-row sm:items-center">
      <p className="flex-1 text-[14px] font-semibold text-brand-ink">Mitdiskutieren mit TanzRaum BASIC</p>
      <Link href="/dashboard/tarif?wunsch=basic" className="btn-primary mt-0 inline-flex min-h-10 items-center justify-center px-4 text-[14px]">
        BASIC entdecken
      </Link>
    </div>
  );
}
