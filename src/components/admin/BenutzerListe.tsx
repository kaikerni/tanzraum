"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Building2, ChevronLeft, ChevronRight, KeyRound, Search, Shield } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Meldung, type AktionsErgebnis } from "@/components/ui/SendenButton";
import { NutzerAvatar } from "@/components/ui/NutzerAvatar";
import { BenutzerZeile, type Benutzer } from "@/components/admin/BenutzerLoeschen";
import { Freischaltkarte } from "@/components/admin/LizenzVerwaltung";

// Eine Zeile aus admin_benutzer_liste (nur registrierte Konten; gekuerzte E-Mail, keine Inhalte)
export type ListenBenutzer = {
  user_id: string;
  vorname: string | null;
  nachname: string | null;
  name: string | null;
  handle: string | null;
  avatar_url: string | null;
  email_maskiert: string | null;
  tarif: string;
  lizenzart: string | null;
  manuell: boolean;
  lizenz_bis: string | null;
  verein_id: string | null;
  verein: string | null;
  vereinslizenz: boolean | null;
  mitglied_aktiv: boolean;
  rolle: string | null;
  rolle_typ: string | null;
  ist_admin: boolean;
  gesperrt: boolean;
  registriert_am: string;
  zuletzt_angemeldet: string | null;
  loeschen_ab: string | null;
  loeschung_durch_admin: boolean;
  blockiert: string | null;
};

export type ListenFilter = { lq: string; tarif: string; status: string; verein: string; rolle: string; sort: string; dir: string; pro: number };

const datum = (d: string | null) => (d ? new Date(d).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }) : "–");
const zahl = (n: number) => n.toLocaleString("de-DE");

const TARIF_STIL: Record<string, string> = {
  free: "border-brand-line bg-brand-bg text-brand-ink-soft",
  basic: "border-brand-red bg-brand-red text-white",
  verein: "border-brand-gold/60 bg-brand-gold-wash text-brand-ink",
};
const LIZENZ_KURZ: Record<string, string> = { MANUAL_FREE: "kostenlos (manuell)", TEAM_FREE: "Team", PAID_BASIC: "bezahlt", VEREIN: "über Verein" };
const ROLLEN: { id: string; text: string }[] = [
  { id: "admin", text: "Vereinsadmin" },
  { id: "trainer", text: "Trainer" },
  { id: "betreuer", text: "Betreuer" },
  { id: "mitglied", text: "Tänzer" },
  { id: "eltern", text: "Eltern" },
];
const SORTIERUNG: { id: string; text: string }[] = [
  { id: "registriert", text: "Registrierung" },
  { id: "name", text: "Name" },
  { id: "handle", text: "@Name" },
  { id: "tarif", text: "Tarif" },
  { id: "verein", text: "Verein" },
];

function anzeigeName(b: ListenBenutzer) {
  return b.name ?? (b.handle ? `@${b.handle}` : "Ohne Namen");
}

function TarifBadge({ b }: { b: ListenBenutzer }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`rounded-full border px-2 py-0.5 text-[11.5px] font-extrabold tracking-wide ${TARIF_STIL[b.tarif] ?? TARIF_STIL.free}`}>{b.tarif.toUpperCase()}</span>
      {b.lizenzart && b.lizenzart !== "PAID_BASIC" && (
        <span className={`text-[11.5px] font-semibold ${b.manuell ? "text-brand-blue" : "text-brand-ink-soft"}`}>{LIZENZ_KURZ[b.lizenzart] ?? b.lizenzart}</span>
      )}
    </span>
  );
}

function StatusBadge({ b }: { b: ListenBenutzer }) {
  if (b.loeschen_ab) return <span className="rounded-full bg-brand-gold-wash px-2 py-0.5 text-[11.5px] font-semibold text-brand-ink">Löschung geplant</span>;
  if (b.gesperrt) return <span className="rounded-full bg-brand-red-wash px-2 py-0.5 text-[11.5px] font-semibold text-brand-red">Deaktiviert</span>;
  return <span className="rounded-full bg-brand-green-wash px-2 py-0.5 text-[11.5px] font-semibold text-brand-green">Aktiv</span>;
}

function VereinText({ b }: { b: ListenBenutzer }) {
  if (!b.verein) return <span className="text-brand-ink-faint">–</span>;
  return (
    <span className="min-w-0">
      <span className="block truncate text-brand-ink">{b.verein}</span>
      <span className="block truncate text-[12px] text-brand-ink-soft">
        {b.rolle ?? "Mitglied"}
        {!b.mitglied_aktiv ? " · inaktiv" : ""}
        {b.vereinslizenz === false ? " · ohne Vereinslizenz" : ""}
      </span>
    </span>
  );
}

// Vollstaendige Benutzerliste (Administration → Benutzer): Filter, Sortierung und Seiten serverseitig ueber die URL
export function BenutzerListe({
  zeilen,
  gesamt,
  seite,
  filter,
  vereine,
}: {
  zeilen: ListenBenutzer[];
  gesamt: number;
  seite: number;
  filter: ListenFilter;
  vereine: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pfad = usePathname();
  const params = useSearchParams();
  const [suche, setSuche] = useState(filter.lq);
  const [auswahl, setAuswahl] = useState<ListenBenutzer | null>(null);
  const [tarifAendern, setTarifAendern] = useState(false);
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);

  const seiten = Math.max(1, Math.ceil(gesamt / filter.pro));
  const von = gesamt === 0 ? 0 : (seite - 1) * filter.pro + 1;
  const bis = Math.min(gesamt, seite * filter.pro);

  // URL mit geaenderten Parametern (Filteraenderung springt auf Seite 1); die bestehende Kontosuche (q) bleibt erhalten
  const url = (aenderung: Record<string, string | null>, seiteBehalten = false) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(aenderung)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    if (!seiteBehalten && !("seite" in aenderung)) p.delete("seite");
    const s = p.toString();
    return `${pfad}${s ? `?${s}` : ""}#benutzerliste`;
  };
  const setze = (aenderung: Record<string, string | null>) => router.push(url(aenderung), { scroll: false });
  const sortLink = (id: string) => url({ sort: id, dir: filter.sort === id ? (filter.dir === "asc" ? "desc" : "asc") : id === "registriert" ? "desc" : "asc" });
  const SortKopf = ({ id, text, className = "" }: { id: string; text: string; className?: string }) => (
    <th className={`px-3 py-2 text-left text-[12px] font-bold uppercase tracking-wide text-brand-ink-soft ${className}`}>
      <Link href={sortLink(id)} scroll={false} className="inline-flex items-center gap-1 hover:text-brand-ink">
        {text}
        {filter.sort === id && (filter.dir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
      </Link>
    </th>
  );
  const auswahlFeld = "min-h-10 w-full rounded-xl border border-brand-line bg-white px-2.5 text-[13.5px] text-brand-ink";

  const oeffnen = (b: ListenBenutzer) => {
    setMeldung(null);
    setTarifAendern(false);
    setAuswahl(b);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Filter */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const s = suche.trim();
          setze({ lq: s.length >= 2 ? s : null });
        }}
        className="flex flex-col gap-2"
      >
        <div className="flex gap-2">
          <label className="field min-w-0 flex-1">
            <span className="sr-only">In der Liste suchen</span>
            <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Name, @Name, E-Mail oder Verein (ab 2 Zeichen)" autoComplete="off" maxLength={100} />
          </label>
          <button type="submit" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-brand-ink px-4 text-[13.5px] font-semibold text-white">
            <Search size={16} /> <span className="hidden sm:inline">Filtern</span>
          </button>
        </div>
        {suche.trim().length === 1 && <p className="text-[12.5px] text-brand-ink-soft">Bitte mindestens 2 Zeichen eingeben.</p>}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-brand-ink-soft">
            Tarif
            <select className={auswahlFeld} value={filter.tarif} onChange={(e) => setze({ tarif: e.target.value })}>
              <option value="">Alle</option>
              <option value="free">FREE</option>
              <option value="basic">BASIC</option>
              <option value="verein">VEREIN</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-brand-ink-soft">
            Status
            <select className={auswahlFeld} value={filter.status} onChange={(e) => setze({ status: e.target.value })}>
              <option value="">Alle</option>
              <option value="aktiv">Aktiv</option>
              <option value="deaktiviert">Deaktiviert</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-brand-ink-soft">
            Verein
            <select className={auswahlFeld} value={filter.verein} onChange={(e) => setze({ verein: e.target.value })}>
              <option value="">Alle Vereine</option>
              {vereine.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-brand-ink-soft">
            Rolle
            <select className={auswahlFeld} value={filter.rolle} onChange={(e) => setze({ rolle: e.target.value })}>
              <option value="">Alle</option>
              {ROLLEN.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.text}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-[12px] font-semibold text-brand-ink-soft md:col-span-1">
            Sortierung
            <select
              className={auswahlFeld}
              value={`${filter.sort}:${filter.dir}`}
              onChange={(e) => {
                const [sort, dir] = e.target.value.split(":");
                setze({ sort, dir });
              }}
            >
              {SORTIERUNG.flatMap((s) => [
                <option key={`${s.id}:desc`} value={`${s.id}:desc`}>
                  {s.id === "registriert" ? "Neueste zuerst" : `${s.text} Z–A`}
                </option>,
                <option key={`${s.id}:asc`} value={`${s.id}:asc`}>
                  {s.id === "registriert" ? "Älteste zuerst" : `${s.text} A–Z`}
                </option>,
              ])}
            </select>
          </label>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-brand-ink-soft">
        <span>
          <strong className="text-brand-ink">
            {zahl(von)}–{zahl(bis)}
          </strong>{" "}
          von <strong className="text-brand-ink">{zahl(gesamt)}</strong> {gesamt === 1 ? "Benutzer" : "Benutzern"}
        </span>
        <label className="flex items-center gap-2">
          pro Seite
          <select className="min-h-9 rounded-lg border border-brand-line bg-white px-2 text-[13px] text-brand-ink" value={filter.pro} onChange={(e) => setze({ pro: e.target.value })}>
            {[20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {zeilen.length === 0 ? (
        <p className="rounded-xl bg-brand-bg px-3.5 py-3 text-[13.5px] text-brand-ink-soft">Keine Benutzer gefunden.</p>
      ) : (
        <>
          {/* Desktop: Tabelle */}
          <div className="hidden overflow-hidden rounded-2xl border border-brand-line lg:block">
            <table className="w-full table-fixed text-[13.5px]">
              <thead className="bg-brand-bg">
                <tr>
                  <SortKopf id="name" text="Benutzer" className="w-[28%]" />
                  <th className="w-[19%] px-3 py-2 text-left text-[12px] font-bold uppercase tracking-wide text-brand-ink-soft">E-Mail</th>
                  <SortKopf id="tarif" text="Tarif" className="w-[14%]" />
                  <SortKopf id="verein" text="Verein · Rolle" className="w-[18%]" />
                  <th className="w-[9%] px-3 py-2 text-left text-[12px] font-bold uppercase tracking-wide text-brand-ink-soft">Status</th>
                  <SortKopf id="registriert" text="Seit" className="w-[12%]" />
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-line bg-white">
                {zeilen.map((b) => (
                  <tr key={b.user_id} onClick={() => oeffnen(b)} className="cursor-pointer hover:bg-brand-bg/60">
                    <td className="px-3 py-2.5">
                      <button type="button" onClick={() => oeffnen(b)} className="flex w-full min-w-0 items-center gap-2.5 text-left">
                        <NutzerAvatar name={anzeigeName(b)} avatarUrl={b.avatar_url} groesse={34} />
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-brand-ink">{anzeigeName(b)}</span>
                          <span className="block truncate text-[12px] text-brand-ink-soft">
                            {b.handle ? `@${b.handle}` : "ohne @Name"}
                            {b.ist_admin ? " · TanzRaum-Admin" : ""}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="truncate px-3 py-2.5 text-brand-ink-soft">{b.email_maskiert ?? "–"}</td>
                    <td className="px-3 py-2.5">
                      <TarifBadge b={b} />
                    </td>
                    <td className="px-3 py-2.5">
                      <VereinText b={b} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge b={b} />
                    </td>
                    <td className="px-3 py-2.5 text-brand-ink-soft">
                      <span className="block">{datum(b.registriert_am)}</span>
                      {b.zuletzt_angemeldet && <span className="block text-[11.5px]">zuletzt {datum(b.zuletzt_angemeldet)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Handy/Tablet: Karten */}
          <ul className="flex flex-col gap-2 lg:hidden">
            {zeilen.map((b) => (
              <li key={b.user_id}>
                <button type="button" onClick={() => oeffnen(b)} className="flex w-full min-w-0 flex-col gap-2 rounded-2xl border border-brand-line bg-white p-3 text-left hover:bg-brand-bg/60">
                  <span className="flex w-full min-w-0 items-center gap-2.5">
                    <NutzerAvatar name={anzeigeName(b)} avatarUrl={b.avatar_url} groesse={38} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-bold text-brand-ink">{anzeigeName(b)}</span>
                      <span className="block truncate text-[12px] text-brand-ink-soft">
                        {b.handle ? `@${b.handle}` : "ohne @Name"} · {b.email_maskiert ?? "–"}
                      </span>
                    </span>
                    <StatusBadge b={b} />
                  </span>
                  <span className="flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-brand-ink-soft">
                    <TarifBadge b={b} />
                    {b.verein && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <Building2 size={13} className="shrink-0 text-brand-gold" />
                        <span className="truncate">
                          {b.verein}
                          {b.rolle ? ` · ${b.rolle}` : ""}
                        </span>
                      </span>
                    )}
                    <span>seit {datum(b.registriert_am)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Seiten */}
      {seiten > 1 && (
        <nav aria-label="Seiten" className="flex flex-wrap items-center justify-center gap-1.5">
          <SeitenLink href={url({ seite: String(seite - 1) }, true)} aus={seite <= 1}>
            <ChevronLeft size={16} /> <span className="hidden sm:inline">vorherige</span>
          </SeitenLink>
          {seitenNummern(seite, seiten).map((n, i) =>
            n === 0 ? (
              <span key={`l${i}`} className="px-1 text-brand-ink-faint">
                …
              </span>
            ) : (
              <SeitenLink key={n} href={url({ seite: String(n) }, true)} aktiv={n === seite}>
                {n}
              </SeitenLink>
            ),
          )}
          <SeitenLink href={url({ seite: String(seite + 1) }, true)} aus={seite >= seiten}>
            <span className="hidden sm:inline">nächste</span> <ChevronRight size={16} />
          </SeitenLink>
        </nav>
      )}

      {/* Detailansicht */}
      {auswahl && (
        <Dialog titel={anzeigeName(auswahl)} untertitel={auswahl.handle ? `@${auswahl.handle}` : undefined} onSchliessen={() => setAuswahl(null)} breit>
          {tarifAendern ? (
            <div className="flex flex-col gap-3">
              <button type="button" onClick={() => setTarifAendern(false)} className="w-fit text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
                ← Zurück zur Übersicht
              </button>
              <Freischaltkarte
                person={{
                  userId: auswahl.user_id,
                  name: anzeigeName(auswahl),
                  handle: auswahl.handle,
                  avatarUrl: auswahl.avatar_url,
                  email: auswahl.email_maskiert,
                  tarif: auswahl.tarif,
                }}
                onFertig={(r) => {
                  setMeldung(r);
                  setTarifAendern(false);
                  router.refresh();
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {meldung && <Meldung ergebnis={meldung} />}
              <div className="flex items-center gap-3 rounded-2xl bg-brand-bg p-3">
                <NutzerAvatar name={anzeigeName(auswahl)} avatarUrl={auswahl.avatar_url} groesse={52} />
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-bold text-brand-ink">{anzeigeName(auswahl)}</p>
                  <p className="truncate text-[12.5px] text-brand-ink-soft">{auswahl.email_maskiert ?? "ohne E-Mail"}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <StatusBadge b={auswahl} />
                    {auswahl.ist_admin && <span className="rounded-full bg-brand-ink px-2 py-0.5 text-[11.5px] font-semibold text-white">TanzRaum-Admin</span>}
                  </div>
                </div>
              </div>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-2.5 text-[13.5px] sm:grid-cols-2">
                <Angabe titel="Vorname">{auswahl.vorname || "–"}</Angabe>
                <Angabe titel="Nachname">{auswahl.nachname || "–"}</Angabe>
                <Angabe titel="Tarif">
                  <TarifBadge b={auswahl} />
                  {auswahl.lizenzart === "MANUAL_FREE" && (
                    <span className="mt-0.5 block text-[12px] text-brand-ink-soft">
                      Manuelle Freischaltung {auswahl.lizenz_bis ? `bis ${datum(auswahl.lizenz_bis)}` : "· unbefristet"}
                    </span>
                  )}
                </Angabe>
                <Angabe titel="Verein · Rolle">
                  <VereinText b={auswahl} />
                </Angabe>
                <Angabe titel="Registriert">{datum(auswahl.registriert_am)}</Angabe>
                <Angabe titel="Zuletzt angemeldet">{datum(auswahl.zuletzt_angemeldet)}</Angabe>
              </dl>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setTarifAendern(true)}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-line bg-white px-3 text-[13px] font-semibold text-brand-ink hover:bg-brand-bg"
                >
                  <KeyRound size={15} /> Tarif ändern / freischalten
                </button>
                <Link
                  href={`/dashboard/admin/lizenzen?q=${encodeURIComponent(auswahl.handle ?? auswahl.name ?? "")}`}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-line bg-white px-3 text-[13px] font-semibold text-brand-ink hover:bg-brand-bg"
                >
                  Lizenzen & Freischaltungen
                </Link>
                {auswahl.verein_id && (
                  <Link
                    href={`/dashboard/admin/tarife/verein/${auswahl.verein_id}`}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-line bg-white px-3 text-[13px] font-semibold text-brand-ink hover:bg-brand-bg"
                  >
                    <Building2 size={15} /> Verein in der Administration
                  </Link>
                )}
                <Link
                  href={`/dashboard/admin/team?user=${auswahl.user_id}`}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-line bg-white px-3 text-[13px] font-semibold text-brand-ink hover:bg-brand-bg"
                >
                  <Shield size={15} /> TanzRaum Team
                </Link>
              </div>

              <div className="rounded-2xl border border-brand-line px-3">
                <p className="pt-3 text-[12px] font-bold uppercase tracking-wide text-brand-ink-faint">Konto löschen</p>
                {/* bestehender, abgesicherter Loeschprozess (Grund, Zeitpunkt, Bestaetigung, Protokoll) */}
                <ul>
                  <BenutzerZeile b={alsBenutzer(auswahl)} />
                </ul>
              </div>
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}

function Angabe({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] font-semibold text-brand-ink-faint">{titel}</dt>
      <dd className="min-w-0 text-brand-ink">{children}</dd>
    </div>
  );
}

function SeitenLink({ href, children, aktiv = false, aus = false }: { href: string; children: React.ReactNode; aktiv?: boolean; aus?: boolean }) {
  const stil = "inline-flex min-h-10 min-w-10 items-center justify-center gap-1 rounded-xl border px-2.5 text-[13px] font-semibold";
  if (aus) return <span className={`${stil} border-brand-line text-brand-ink-faint`}>{children}</span>;
  return (
    <Link href={href} scroll={false} aria-current={aktiv ? "page" : undefined} className={`${stil} ${aktiv ? "border-brand-red bg-brand-red text-white" : "border-brand-line bg-white text-brand-ink hover:bg-brand-bg"}`}>
      {children}
    </Link>
  );
}

// 1 … 4 5 [6] 7 8 … 20  (0 = Auslassung)
function seitenNummern(aktuell: number, seiten: number): number[] {
  const menge = new Set([1, seiten, aktuell - 1, aktuell, aktuell + 1].filter((n) => n >= 1 && n <= seiten));
  const liste = [...menge].sort((a, b) => a - b);
  const aus: number[] = [];
  liste.forEach((n, i) => {
    if (i > 0 && n - liste[i - 1] > 1) aus.push(0);
    aus.push(n);
  });
  return aus;
}

// Fuer die bestehende Loeschzeile (gleiche Angaben wie admin_benutzer_suche)
function alsBenutzer(b: ListenBenutzer): Benutzer {
  return {
    user_id: b.user_id,
    name: b.name,
    handle: b.handle,
    email_maskiert: b.email_maskiert,
    tarif: b.tarif,
    registriert_am: b.registriert_am,
    gesperrt: b.gesperrt,
    verein: b.verein,
    ist_admin: b.ist_admin,
    loeschen_ab: b.loeschen_ab,
    loeschung_durch_admin: b.loeschung_durch_admin,
    blockiert: b.blockiert,
  };
}
