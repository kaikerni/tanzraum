import Link from "next/link";
import { MapPin, Users, Clock } from "lucide-react";
import { MerkenKnopf } from "./MerkenKnopf";
import { tageBis, zeitraum, type Turnier } from "@/lib/turniere/getTurniere";

function DatumsKachel({ iso }: { iso: string }) {
  const [j, m, t] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(j, m - 1, t));
  return (
    <div className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-brand-gold-wash py-1.5 text-brand-gold">
      <span className="text-[11px] font-bold uppercase">{d.toLocaleDateString("de-DE", { timeZone: "UTC", weekday: "short" })}</span>
      <span className="text-[20px] font-extrabold leading-none text-brand-ink">{t}</span>
      <span className="text-[11px] font-semibold">{d.toLocaleDateString("de-DE", { timeZone: "UTC", month: "short" })}</span>
    </div>
  );
}

export function TurnierKarte({ t, heute }: { t: Turnier; heute: string }) {
  const frist = t.meldeschluss ? tageBis(t.meldeschluss, heute) : null;
  return (
    <li className="relative flex gap-3 rounded-2xl border border-brand-line bg-white p-3 transition-shadow hover:shadow-md">
      <DatumsKachel iso={t.ersterTag} />
      <div className="min-w-0 flex-1">
        <Link href={`/dashboard/turniere/${t.id}`} className="block text-[14.5px] font-bold leading-snug text-brand-ink after:absolute after:inset-0">
          {t.name}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-brand-ink-soft">
          <span>{zeitraum(t.ersterTag, t.letzterTag)}</span>
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} /> {t.ort}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {t.unsereStarts > 0 && (
            <span className="status-badge zugesagt">
              <Users size={12} /> Wir starten{t.unsereStarts > 1 ? ` (${t.unsereStarts})` : ""}
            </span>
          )}
          {t.vereinId && <span className="status-badge offen">Vereinsturnier</span>}
          {t.kategorie && <span className="rounded-full bg-brand-bg px-2.5 py-0.5 text-[11.5px] font-semibold text-brand-ink-soft">{t.kategorie}</span>}
          {t.typ && t.typ !== t.kategorie && t.typ !== "Vereinsturnier" && (
            <span className="rounded-full bg-brand-bg px-2.5 py-0.5 text-[11.5px] font-semibold text-brand-ink-soft">{t.typ}</span>
          )}
          {t.verband && <span className="rounded-full bg-brand-bg px-2.5 py-0.5 text-[11.5px] font-semibold text-brand-ink-soft">{t.verband}</span>}
          {frist !== null && frist >= 0 && frist <= 21 && (
            <span className="status-badge abgesagt">
              <Clock size={12} /> Meldeschluss {frist === 0 ? "heute" : `in ${frist} Tag${frist === 1 ? "" : "en"}`}
            </span>
          )}
        </div>
      </div>
      <div className="relative z-10 self-start">
        <MerkenKnopf turnierId={t.id} gemerkt={t.gemerkt} />
      </div>
    </li>
  );
}
