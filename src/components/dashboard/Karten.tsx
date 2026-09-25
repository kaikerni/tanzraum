import Link from "next/link";
import {
  CalendarCheck,
  Radar,
  Mail,
  Trophy,
  CalendarDays,
  MapPin,
  Users,
  AlertCircle,
  Clock,
  FileText,
  FolderPlus,
  ChevronRight,
  CalendarClock,
  BarChart3,
  Baby,
  type LucideIcon,
} from "lucide-react";
import { KarteKopf } from "./KarteKopf";
import { istFertig } from "@/lib/navigation";
import type {
  MeinKind,
  AltersklassenVerteilung,
  HeuteEintrag,
  NaechstesTurnier,
  RadarEintrag,
  Termin,
} from "@/lib/dashboard/getDashboardUebersicht";
import type { AktuelleNachricht } from "@/lib/dashboard/getNachrichten";

export const KARTE =
  "rounded-[var(--radius-l)] border border-brand-line bg-white p-4 shadow-[var(--shadow)] sm:p-5";

const ZEITZONE = "Europe/Berlin";
const WOCHENTAGE_KURZ = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"];
const WOCHENTAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const MONATE_KURZ = ["JAN", "FEB", "MÄR", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"];

function datumTeile(iso: string) {
  const [j, m, t] = iso.slice(0, 10).split("-").map(Number);
  const d = new Date(Date.UTC(j, m - 1, t));
  return { tag: String(t).padStart(2, "0"), monat: MONATE_KURZ[m - 1], wochentag: WOCHENTAGE_KURZ[d.getUTCDay()], jahr: j, m };
}

export function formatDatum(iso: string | null): string {
  if (!iso) return "";
  const { tag, m, jahr } = datumTeile(iso);
  return `${tag}.${String(m).padStart(2, "0")}.${jahr}`;
}

function uhrzeitJetzt(): string {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: ZEITZONE,
  }).format(new Date());
}

function Leer({ text }: { text: string }) {
  return <p className="rounded-xl bg-brand-bg px-3.5 py-3 text-[13px] text-brand-ink-soft">{text}</p>;
}

/* ---------------- Heute im Verein ---------------- */

export function HeuteKarte({ eintraege, mehrereVereine }: { eintraege: HeuteEintrag[]; mehrereVereine: boolean }) {
  const heute = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: ZEITZONE,
  });
  const jetzt = uhrzeitJetzt();

  return (
    <section className={`${KARTE} h-full`}>
      <KarteKopf icon={CalendarCheck} titel="Heute im Verein" untertitel={heute} alleHref="/dashboard/kalender" />
      {eintraege.length === 0 ? (
        <Leer text="Heute stehen keine Termine an." />
      ) : (
        <ol className="flex flex-col">
          {eintraege.map((e, i) => {
            const von = e.von?.slice(0, 5) ?? null;
            const bis = e.bis?.slice(0, 5) ?? null;
            const vorbei = bis !== null && bis <= jetzt;
            const laeuft = von !== null && von <= jetzt && !vorbei;
            const punkt = vorbei ? "bg-brand-ink-faint" : laeuft ? "bg-brand-amber" : "bg-brand-red";
            const titel = e.gruppeName ?? e.titel;
            const ort = [e.halle, mehrereVereine ? e.vereinName : null].filter(Boolean).join(" · ");
            return (
              <li key={i} className="relative grid grid-cols-[96px_minmax(0,1fr)_auto] items-start gap-3 py-2.5 pl-5">
                {i < eintraege.length - 1 && (
                  <span className="absolute bottom-[-10px] left-[4.5px] top-[22px] w-px bg-brand-line" aria-hidden="true" />
                )}
                <span className={`absolute left-0 top-[15px] h-2.5 w-2.5 rounded-full ring-4 ring-white ${punkt}`} aria-hidden="true" />
                <span className="whitespace-nowrap pt-0.5 text-[12.5px] font-medium tabular-nums text-brand-ink">
                  {von ?? "–"}
                  {bis ? `–${bis}` : ""}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-bold text-brand-ink">
                    {titel}
                    {laeuft && (
                      <span className="ml-2 rounded-full bg-brand-amber-wash px-2 py-0.5 align-middle text-[10.5px] font-semibold text-[#9a5b00]">
                        läuft
                      </span>
                    )}
                  </div>
                  {ort && <div className="truncate text-[12.5px] text-brand-ink-soft">{ort}</div>}
                </div>
                {e.teilnehmerGesamt !== null && (
                  <span
                    className="flex items-center gap-1 pt-0.5 text-[12.5px] font-medium text-brand-ink"
                    title={`${e.teilnehmerErwartet} von ${e.teilnehmerGesamt} erwartet`}
                  >
                    <Users size={14} className="text-brand-green" />
                    {e.teilnehmerErwartet}/{e.teilnehmerGesamt}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/* ---------------- TanzRaum Radar ---------------- */

const RADAR_STIL: Record<string, { zeile: string; kreis: string; icon: LucideIcon }> = {
  hoch: { zeile: "bg-brand-red-wash", kreis: "bg-brand-red", icon: AlertCircle },
  mittel: { zeile: "bg-brand-amber-wash", kreis: "bg-brand-amber", icon: Clock },
  info: { zeile: "bg-brand-blue-wash", kreis: "bg-brand-blue", icon: FileText },
  neu: { zeile: "bg-brand-green-wash", kreis: "bg-brand-green", icon: FolderPlus },
};

const RADAR_ZIEL: Record<string, string> = {
  beitrag: "/dashboard/finanzen",
  abmeldung: "/dashboard/training",
  turnier: "/dashboard/turniere",
  datei: "/dashboard/dateien",
};

export function RadarKarte({ eintraege }: { eintraege: RadarEintrag[] }) {
  const anzahl = eintraege.length;
  return (
    <section className={`${KARTE} h-full`}>
      <KarteKopf
        icon={Radar}
        titel="TanzRaum Radar"
        untertitel={
          anzahl > 0
            ? `${anzahl} ${anzahl === 1 ? "Ding braucht" : "Dinge brauchen"} deine Aufmerksamkeit`
            : "Gerade nichts Dringendes"
        }
        rechts={
          anzahl > 0 ? (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-red px-1.5 text-[11.5px] font-bold text-white">
              {anzahl}
            </span>
          ) : undefined
        }
      />
      {anzahl === 0 ? (
        <Leer text="Keine offenen Hinweise – alles im grünen Bereich." />
      ) : (
        <ul className="flex flex-col gap-2">
          {eintraege.map((r, i) => {
            const stil = RADAR_STIL[r.dringlichkeit] ?? RADAR_STIL.info;
            const Icon = stil.icon;
            const ziel = RADAR_ZIEL[r.typ];
            const inhalt = (
              <>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${stil.kreis}`}>
                  <Icon size={17} strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold leading-snug text-brand-ink">{r.titel}</span>
                  {r.untertitel && (
                    <span className="block truncate text-[12.5px] text-brand-ink-soft" title={r.untertitel}>
                      {r.untertitel}
                    </span>
                  )}
                </span>
              </>
            );
            return (
              <li key={i}>
                {ziel && istFertig(ziel) ? (
                  <Link href={ziel} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${stil.zeile} hover:brightness-[0.98]`}>
                    {inhalt}
                    <ChevronRight size={18} className="shrink-0 text-brand-ink" />
                  </Link>
                ) : (
                  <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${stil.zeile}`}>{inhalt}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---------------- Aktuelle Nachrichten ---------------- */

const AVATAR_FARBEN = ["bg-brand-red text-white", "bg-brand-navy text-white", "bg-brand-amber text-brand-ink", "bg-[#dfe3ea] text-brand-ink"];

function avatarFarbe(name: string) {
  let h = 0;
  for (const z of name) h = (h * 31 + z.charCodeAt(0)) >>> 0;
  return AVATAR_FARBEN[h % AVATAR_FARBEN.length];
}

function nachrichtZeit(iso: string): string {
  const d = new Date(iso);
  const tag = (x: Date) => x.toLocaleDateString("de-DE", { timeZone: ZEITZONE });
  const jetzt = new Date();
  if (tag(d) === tag(jetzt)) {
    return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: ZEITZONE });
  }
  if (tag(d) === tag(new Date(jetzt.getTime() - 86400000))) return "Gestern";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: ZEITZONE });
}

export function NachrichtenKarte({ nachrichten }: { nachrichten: AktuelleNachricht[] }) {
  return (
    <section className={`${KARTE} h-full`}>
      <KarteKopf icon={Mail} titel="Nachrichten" alleHref="/dashboard/nachrichten" />
      {nachrichten.length === 0 ? (
        <Leer text="Keine neuen Nachrichten." />
      ) : (
        <ul className="flex flex-col divide-y divide-brand-line">
          {nachrichten.map((n) => {
            const initialen = n.senderName
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            return (
              <li key={n.id}>
                <Link href={`/dashboard/nachrichten/${n.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-brand-bg">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold ${avatarFarbe(n.senderName)}`}
                  >
                    {initialen}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-brand-ink">{n.senderName}</div>
                    <div className="truncate text-[12.5px] text-brand-ink-soft">{n.inhalt}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="text-[12px] text-brand-ink-soft">{nachrichtZeit(n.gesendetAm)}</span>
                    {n.ungelesen ? (
                      <span className="h-2.5 w-2.5 rounded-full bg-brand-red" aria-label="ungelesen" />
                    ) : (
                      <span className="h-2.5 w-2.5" aria-hidden="true" />
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---------------- Naechste Turniere ---------------- */

export function TurniereKarte({ turniere }: { turniere: NaechstesTurnier[] }) {
  return (
    <section className={`${KARTE} h-full`}>
      <KarteKopf icon={Trophy} titel="Nächste Turniere" alleHref="/dashboard/turniere" />
      {turniere.length === 0 ? (
        <Leer text="Keine bevorstehenden Turniere." />
      ) : (
        <ul className="flex flex-col divide-y divide-brand-line">
          {turniere.map((t) => {
            const d = datumTeile(t.ersterTag);
            return (
              <li key={t.id}>
                <Link href={`/dashboard/turniere/${t.id}`} className="flex items-center gap-3 py-2 hover:bg-brand-bg/60">
                <span className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-brand-red-wash py-1 leading-none text-brand-red">
                  <span className="text-[9.5px] font-semibold">{d.wochentag}</span>
                  <span className="text-[19px] font-bold">{d.tag}</span>
                  <span className="text-[9.5px] font-semibold">{d.monat}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-brand-ink" title={t.name}>
                    {t.name}
                  </div>
                  <div className="flex items-center gap-1 text-[12px] text-brand-ink-soft">
                    <CalendarDays size={12} className="shrink-0" />
                    {t.anzahlTage === 1 ? "1 Tag" : `${t.anzahlTage} Tage`}
                  </div>
                  {t.ort && (
                    <div className="flex items-center gap-1 text-[12px] text-brand-ink-soft">
                      <MapPin size={12} className="shrink-0" />
                      <span className="truncate">{t.ort}</span>
                    </div>
                  )}
                </div>
                {t.neu && (
                  <span className="shrink-0 rounded-full bg-brand-blue-wash px-2.5 py-0.5 text-[11px] font-semibold text-brand-blue">
                    Neu
                  </span>
                )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---------------- Naechste Termine ---------------- */

const TERMIN_TYP: Record<Termin["typ"], { label: string; klasse: string }> = {
  training: { label: "Training", klasse: "kann" },
  termin: { label: "Termin", klasse: "kann" },
  sitzung: { label: "Sitzung", klasse: "kann" },
  privat: { label: "Privat", klasse: "offen" },
  turnier: { label: "Turnier", klasse: "vielleicht" },
};

export function TermineKarte({ termine }: { termine: Termin[] }) {
  return (
    <section className={`${KARTE} h-full`}>
      <KarteKopf icon={CalendarClock} titel="Nächste Termine" alleHref="/dashboard/kalender" />
      {termine.length === 0 ? (
        <Leer text="Aktuell keine bevorstehenden Termine." />
      ) : (
        <ul className="flex flex-col divide-y divide-brand-line">
          {termine.map((t, i) => (
            <li key={i} className="flex items-center gap-3.5 py-2.5">
              <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-bg text-center">
                {t.wiederholend ? (
                  <span className="text-[11px] font-semibold text-brand-ink-soft">
                    {WOCHENTAGE[(t.wochentag ?? 1) - 1]?.slice(0, 2) ?? "–"}
                  </span>
                ) : (
                  <span className="text-[12px] font-bold text-brand-ink">{formatDatum(t.datum).slice(0, 6)}</span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-brand-ink" title={t.titel}>
                  {t.titel}
                </div>
                <div className="truncate text-[12px] text-brand-ink-soft">
                  {t.ort ?? "Ort offen"}
                  {t.wiederholend ? " · wöchentlich" : ""}
                  {t.von ? ` · ${t.von.slice(0, 5)} Uhr` : ""}
                </div>
              </div>
              <span className={`status-badge ${TERMIN_TYP[t.typ].klasse}`}>{TERMIN_TYP[t.typ].label}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------- Mitglieder nach Altersklassen ---------------- */

export function AltersklassenKarte({ altersklassen }: { altersklassen: AltersklassenVerteilung[] }) {
  const max = Math.max(1, ...altersklassen.map((a) => a.anzahl));
  return (
    <section className={`${KARTE} h-full`}>
      <KarteKopf icon={BarChart3} titel="Mitglieder nach Altersklassen" />
      {altersklassen.length === 0 ? (
        <Leer text="Noch keine Mitgliederdaten." />
      ) : (
        <ul className="flex flex-col gap-3">
          {altersklassen.map((a) => (
            <li key={a.altersklasse}>
              <div className="mb-1 flex justify-between text-[12.5px]">
                <span className="font-medium text-brand-ink">{a.altersklasse}</span>
                <span className="tabular-nums text-brand-ink-soft">{a.anzahl}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-brand-bg">
                <div className="h-full rounded-full bg-brand-red" style={{ width: `${(a.anzahl / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------- Meine Kinder (Eltern) ---------------- */

export function KinderKarte({ kinder }: { kinder: MeinKind[] }) {
  return (
    <section className={KARTE}>
      <KarteKopf icon={Baby} titel="Meine Kinder" untertitel="Training und Abmeldungen deiner Kinder heute" />
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {kinder.map((k) => (
          <li key={k.kindVmId} className="rounded-xl border border-brand-line p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[14px] font-bold text-brand-ink">{k.name}</span>
              {k.trainingHeute &&
                (k.heuteAbgemeldet ? (
                  <span className="status-badge abgesagt">heute abgemeldet</span>
                ) : (
                  <span className="status-badge zugesagt">heute Training</span>
                ))}
            </div>
            <div className="mt-0.5 truncate text-[12.5px] text-brand-ink-soft">
              {k.vereinName}
              {k.gruppen ? ` · ${k.gruppen}` : ""}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[12.5px] text-brand-ink">
              <CalendarDays size={13} className="shrink-0 text-brand-ink-soft" />
              {k.trainingHeute ?? "Heute kein Training"}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
