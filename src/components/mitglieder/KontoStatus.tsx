"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, Loader2, Mail, Share2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { einladungenSenden, einladungsLinks, einladungZurueckziehen, stammdatenAendern, stammdatenEntfernen, type EinladungsLink } from "@/app/dashboard/mitglieder/actions";
import { datumKurz, einladungsLink, type KontoStatus, type RegisterEintrag } from "@/lib/mitglieder/register";

export type KontoFilter = "alle" | KontoStatus;

export const STATUS_TEXT: Record<KontoStatus, { punkt: string; text: string; kurz: string; klasse: string }> = {
  konto: { punkt: "🟢", text: "TanzRaum-Konto vorhanden", kurz: "Konto vorhanden", klasse: "bg-brand-green-wash text-brand-green" },
  eingeladen: { punkt: "🟠", text: "Einladung ausstehend", kurz: "Einladung ausstehend", klasse: "bg-brand-gold-wash text-brand-gold" },
  ohne: { punkt: "⚪", text: "Noch kein TanzRaum-Konto", kurz: "Noch kein Konto", klasse: "bg-brand-bg text-brand-ink-soft" },
};

export function StatusPille({ status, ohneEmail = false }: { status: KontoStatus; ohneEmail?: boolean }) {
  const s = STATUS_TEXT[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${s.klasse}`}>
      <span aria-hidden>{s.punkt}</span> {status === "ohne" && ohneEmail ? "Keine E-Mail-Adresse" : s.text}
    </span>
  );
}

function vorname(e: RegisterEintrag) {
  return e.vorname || e.name;
}

export function KopierKnopf({ text, label = "Link kopieren", klein = false }: { text: string; label?: string; klein?: boolean }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1800);
        } catch {
          /* Kopieren nicht moeglich */
        }
      }}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-brand-line bg-white font-semibold text-brand-ink hover:bg-brand-bg ${
        klein ? "min-h-9 px-3 text-[12.5px]" : "min-h-11 px-4 text-[13.5px]"
      }`}
    >
      {ok ? <Check size={15} className="text-brand-green" /> : <Copy size={15} />} {ok ? "Kopiert" : label}
    </button>
  );
}

// ── Grosse Statusuebersicht ──────────────────────────────────────────────────────────────────────────
export function KontoStatusKarte({
  anzahl,
  filter,
  setFilter,
  onAlleOhneEinladen,
  onLinks,
}: {
  anzahl: { gesamt: number; konto: number; eingeladen: number; ohne: number; ohneMitEmail: number };
  filter: KontoFilter;
  setFilter: (f: KontoFilter) => void;
  onAlleOhneEinladen: () => void;
  onLinks: () => void;
}) {
  const kacheln: { key: KontoFilter; wert: number; label: string; punkt?: string }[] = [
    { key: "alle", wert: anzahl.gesamt, label: "Vereinsmitglieder" },
    { key: "konto", wert: anzahl.konto, label: "TanzRaum-Konten", punkt: "🟢" },
    { key: "eingeladen", wert: anzahl.eingeladen, label: "Einladung ausstehend", punkt: "🟠" },
    { key: "ohne", wert: anzahl.ohne, label: "Noch kein TanzRaum-Konto", punkt: "⚪" },
  ];
  return (
    <section className="rounded-[var(--radius-l)] border border-brand-line bg-white p-4 shadow-[var(--shadow)] sm:p-5" aria-labelledby="kontostatus-titel">
      <h2 id="kontostatus-titel" className="text-[16px] font-bold text-brand-ink">
        TanzRaum-Mitgliederstatus
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {kacheln.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => setFilter(k.key)}
            aria-pressed={filter === k.key}
            className={`rounded-2xl border px-3.5 py-3 text-left transition-colors ${
              filter === k.key ? "border-brand-red bg-brand-red-wash/40" : "border-brand-line bg-brand-bg/40 hover:bg-brand-bg"
            }`}
          >
            <div className="flex items-center gap-1.5 text-[24px] font-extrabold leading-none text-brand-ink">
              {k.punkt && <span className="text-[15px]" aria-hidden>{k.punkt}</span>}
              {k.wert}
            </div>
            <div className="mt-1 text-[12.5px] leading-snug text-brand-ink-soft">{k.label}</div>
          </button>
        ))}
      </div>
      {(anzahl.ohne > 0 || anzahl.eingeladen > 0 || anzahl.ohneMitEmail > 0) && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {anzahl.ohneMitEmail > 0 && (
            <button type="button" onClick={onAlleOhneEinladen} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-red px-4 text-[14px] font-semibold text-white hover:bg-brand-red-deep">
              <Mail size={16} /> {anzahl.ohneMitEmail === 1 ? "1 Mitglied einladen" : `${anzahl.ohneMitEmail} Mitglieder einladen`}
            </button>
          )}
          <button type="button" onClick={onLinks} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-line bg-white px-4 text-[14px] font-semibold text-brand-ink hover:bg-brand-bg">
            <Link2 size={16} /> Einladungslinks
          </button>
        </div>
      )}
      <p className="mt-3 text-[12.5px] text-brand-ink-soft">
        „Noch kein TanzRaum-Konto“ heißt nur: Diese Person hat sich noch nicht registriert. Vereinsmitglied ist sie trotzdem.
      </p>
    </section>
  );
}

// ── E-Mail-Einladung (einzeln oder mehrere) ──────────────────────────────────────────────────────────
export function EinladenDialog({ vereinId, eintraege, onSchliessen }: { vereinId: string; eintraege: RegisterEintrag[]; onSchliessen: () => void }) {
  const router = useRouter();
  const mitEmail = eintraege.filter((e) => e.email);
  const ohneEmail = eintraege.filter((e) => !e.email);
  const erneut = mitEmail.filter((e) => e.gesendetAm);
  const [laeuft, setLaeuft] = useState(false);
  const [fortschritt, setFortschritt] = useState(0);
  const [ergebnis, setErgebnis] = useState<{ gesendet: number; fehler: { name: string; text: string }[] } | null>(null);
  const einzeln = eintraege.length === 1 ? eintraege[0] : null;

  async function senden() {
    setLaeuft(true);
    let gesendet = 0;
    const fehler: { name: string; text: string }[] = [];
    const ids = mitEmail.map((e) => e.id);
    // In kleinen Paketen, damit der Fortschritt sichtbar bleibt
    for (let i = 0; i < ids.length; i += 10) {
      const r = await einladungenSenden(vereinId, ids.slice(i, i + 10));
      if (r.error) {
        fehler.push({ name: "", text: r.error });
        break;
      }
      gesendet += r.gesendet;
      for (const f of r.fehler) fehler.push({ name: eintraege.find((e) => e.id === f.mitgliedId)?.name ?? "", text: f.text });
      setFortschritt(Math.min(ids.length, i + 10));
      if (r.fehler.some((f) => f.text.startsWith("Versandlimit"))) break;
    }
    setErgebnis({ gesendet, fehler });
    setLaeuft(false);
    router.refresh();
  }

  const titel = ergebnis
    ? ergebnis.gesendet === 1
      ? "Einladung gesendet"
      : `${ergebnis.gesendet} Einladungen gesendet`
    : einzeln
      ? `${einzeln.name} zu TanzRaum einladen?`
      : `${mitEmail.length} ${mitEmail.length === 1 ? "Einladung" : "Einladungen"} versenden?`;

  return (
    <Dialog
      titel={titel}
      onSchliessen={laeuft ? () => {} : onSchliessen}
      fuss={
        ergebnis ? (
          <button type="button" onClick={onSchliessen} className="min-h-12 w-full rounded-2xl bg-brand-ink px-5 text-[15px] font-bold text-white">
            Fertig
          </button>
        ) : (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onSchliessen} disabled={laeuft} className="min-h-12 rounded-2xl px-5 text-[15px] font-semibold text-brand-ink-soft hover:bg-brand-bg">
              Abbrechen
            </button>
            {mitEmail.length > 0 && (
              <button type="button" onClick={senden} disabled={laeuft} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand-red px-5 text-[15px] font-bold text-white disabled:opacity-60">
                {laeuft ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                {laeuft ? `${fortschritt} von ${mitEmail.length} …` : mitEmail.length === 1 ? "Einladung senden" : "Einladungen senden"}
              </button>
            )}
          </div>
        )
      }
    >
      {ergebnis ? (
        <div className="flex flex-col gap-3 text-[14px] text-brand-ink">
          {ergebnis.gesendet > 0 && (
            <p className="rounded-xl bg-brand-green-wash px-3.5 py-3 font-semibold text-brand-green">
              ✓ {ergebnis.gesendet === 1 ? "Die Einladung wurde gesendet." : `${ergebnis.gesendet} Einladungen wurden gesendet.`} Der Status steht jetzt auf „Einladung ausstehend“.
            </p>
          )}
          {ergebnis.fehler.length > 0 && (
            <div className="rounded-xl bg-brand-red-wash/50 px-3.5 py-3">
              <p className="font-semibold text-brand-red">Nicht gesendet:</p>
              <ul className="mt-1 list-disc pl-5 text-[13px]">
                {ergebnis.fehler.slice(0, 12).map((f, i) => (
                  <li key={i}>{f.name ? `${f.name}: ` : ""}{f.text}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-brand-ink">
          {einzeln ? (
            einzeln.email ? (
              <p>
                {vorname(einzeln)} erhält eine E-Mail an <strong className="[overflow-wrap:anywhere]">{einzeln.email}</strong> mit einem persönlichen Link zur Registrierung bei TanzRaum.
              </p>
            ) : null
          ) : (
            <p>Die ausgewählten Mitglieder erhalten eine E-Mail mit ihrem persönlichen Registrierungslink.</p>
          )}
          <p className="rounded-xl bg-brand-bg px-3.5 py-2.5 text-[13px] font-semibold">Es wird kein Konto automatisch erstellt. Jedes Mitglied registriert sich selbst.</p>
          {erneut.length > 0 && (
            <p className="text-[13px] text-brand-ink-soft">
              {erneut.length === 1 && einzeln
                ? `Die Einladung wurde zuletzt am ${datumKurz(einzeln.gesendetAm)} gesendet und wird erneut verschickt.`
                : `${erneut.length} davon wurden schon eingeladen und erhalten die Einladung erneut.`}
            </p>
          )}
          {ohneEmail.length > 0 && (
            <p className="rounded-xl bg-brand-gold-wash px-3.5 py-2.5 text-[13px] text-brand-ink">
              {einzeln
                ? "Dieses Mitglied kann erst per E-Mail eingeladen werden, wenn eine E-Mail-Adresse hinterlegt wurde. Den persönlichen Einladungslink kannst du trotzdem kopieren und z. B. per WhatsApp weitergeben."
                : `${ohneEmail.length} ${ohneEmail.length === 1 ? "Mitglied hat" : "Mitglieder haben"} keine E-Mail-Adresse – für sie kannst du stattdessen den Einladungslink kopieren.`}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}

// ── Persoenliche Einladungslinks (einzeln oder Sammelansicht) ────────────────────────────────────────
export function LinksDialog({ vereinId, eintraege, basisUrl, onSchliessen }: { vereinId: string; eintraege: RegisterEintrag[]; basisUrl: string; onSchliessen: () => void }) {
  const router = useRouter();
  const [links, setLinks] = useState<EinladungsLink[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [, starte] = useTransition();
  const einzeln = eintraege.length === 1 ? eintraege[0] : null;
  const kannTeilen = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    let aktiv = true;
    einladungsLinks(vereinId, eintraege.map((e) => e.id)).then((r) => {
      if (!aktiv) return;
      if (r.error) setFehler(r.error);
      else setLinks(r.links ?? []);
    });
    return () => {
      aktiv = false;
    };
  }, [vereinId, eintraege]);

  function schliessen() {
    starte(() => router.refresh());
    onSchliessen();
  }

  const liste = (links ?? [])
    .map((l) => ({ ...l, eintrag: eintraege.find((e) => e.id === l.mitgliedId), url: einladungsLink(basisUrl, l.token) }))
    .filter((l) => l.eintrag)
    .sort((a, b) => (a.eintrag!.nachname + a.eintrag!.vorname).localeCompare(b.eintrag!.nachname + b.eintrag!.vorname, "de"));
  const alle = liste.map((l) => `${l.eintrag!.name}: ${l.url}`).join("\n");

  return (
    <Dialog
      titel={einzeln ? `${einzeln.name} zu TanzRaum einladen` : "Persönliche Einladungslinks"}
      untertitel={einzeln ? "Persönlicher Einladungslink" : `${eintraege.length} Mitglieder`}
      onSchliessen={schliessen}
      breit={!einzeln}
      fuss={
        !einzeln && liste.length > 1 ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <KopierKnopf text={alle} label="Alle Links kopieren" />
          </div>
        ) : undefined
      }
    >
      {fehler && <p className="form-error">{fehler}</p>}
      {!links && !fehler && (
        <p className="flex items-center gap-2 py-6 text-[14px] text-brand-ink-soft">
          <Loader2 size={18} className="animate-spin" /> Links werden vorbereitet …
        </p>
      )}
      {einzeln && liste[0] && (
        <div className="flex flex-col gap-3">
          <input readOnly value={liste[0].url} onFocus={(e) => e.currentTarget.select()} aria-label="Persönlicher Einladungslink" className="min-h-11 w-full rounded-xl border border-brand-line bg-brand-bg/50 px-3 text-[13px] text-brand-ink" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <KopierKnopf text={liste[0].url} />
            {kannTeilen && (
              <button
                type="button"
                onClick={() => navigator.share({ title: "Einladung zu TanzRaum", text: `Hallo ${vorname(einzeln)}, hier ist deine persönliche Einladung zu TanzRaum:`, url: liste[0].url }).catch(() => {})}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-brand-line bg-white px-4 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg"
              >
                <Share2 size={15} /> Teilen
              </button>
            )}
          </div>
          <p className="text-[13px] leading-relaxed text-brand-ink-soft">
            Du kannst den Link z. B. per WhatsApp, Signal, SMS, E-Mail oder im Vereinschat weitergeben. Er gehört nur zu {vorname(einzeln)}, gilt 30 Tage und kann nur einmal verwendet werden.{" "}
            {vorname(einzeln)} registriert sich damit selbst – danach steht der Status automatisch auf „TanzRaum-Konto vorhanden“.
          </p>
        </div>
      )}
      {!einzeln && links && (
        <ul className="flex flex-col divide-y divide-brand-line">
          {liste.map((l) => (
            <li key={l.mitgliedId} className="flex flex-wrap items-center gap-2 py-2.5">
              <span className="min-w-0 flex-1 basis-[160px]">
                <span className="block text-[14px] font-semibold text-brand-ink [overflow-wrap:anywhere]">{l.eintrag!.name}</span>
                {l.eintrag!.gruppeName && <span className="block text-[12px] text-brand-ink-soft">{l.eintrag!.gruppeName}</span>}
              </span>
              <KopierKnopf text={l.url} klein />
            </li>
          ))}
          {liste.length === 0 && <li className="py-4 text-[13.5px] text-brand-ink-soft">Für die Auswahl gibt es keine offenen Einladungen (alle haben schon ein Konto).</li>}
        </ul>
      )}
    </Dialog>
  );
}

// ── Zeile: Vereinsmitglied ohne TanzRaum-Konto ───────────────────────────────────────────────────────
export function RegisterZeile({
  e,
  gruppen,
  gewaehlt,
  onWaehlen,
  onEinladen,
  onLink,
}: {
  e: RegisterEintrag;
  gruppen: { id: string; name: string }[];
  gewaehlt: boolean;
  onWaehlen: (an: boolean) => void;
  onEinladen: () => void;
  onLink: () => void;
}) {
  const [offen, setOffen] = useState(false);
  const initialen = `${e.vorname[0] ?? ""}${e.nachname[0] ?? ""}`.toUpperCase();
  const info =
    e.status === "eingeladen"
      ? e.gesendetAm
        ? `Einladung zuletzt gesendet: ${datumKurz(e.gesendetAm)}`
        : `Einladungslink erstellt am ${datumKurz(e.einladungErstellt)}`
      : e.einladungAbgelaufen
        ? "Die letzte Einladung ist abgelaufen."
        : null;
  return (
    <li className="px-3 py-3 sm:px-4">
      <div className="flex items-start gap-3">
        <label className="flex h-10 w-6 shrink-0 cursor-pointer items-center justify-center">
          <input type="checkbox" checked={gewaehlt} onChange={(x) => onWaehlen(x.target.checked)} aria-label={`${e.name} auswählen`} className="h-5 w-5 accent-[var(--color-brand-red,#e11d2e)]" />
        </label>
        <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-bg text-[12.5px] font-bold text-brand-ink-soft sm:flex">{initialen}</span>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => setOffen((x) => !x)} aria-expanded={offen} className="block w-full text-left">
            <span className="block text-[14.5px] font-semibold text-brand-ink [overflow-wrap:anywhere]">{e.name}</span>
            <span className="block text-[12.5px] text-brand-ink-soft [overflow-wrap:anywhere]">
              {e.gruppeName ?? "keine Gruppe"}
              {e.mitgliedsnummer ? ` · Nr. ${e.mitgliedsnummer}` : ""}
            </span>
          </button>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <StatusPille status={e.status} ohneEmail={!e.email && e.status === "ohne"} />
            {info && <span className="text-[12px] text-brand-ink-soft">{info}</span>}
          </div>
          {!e.email && (
            <p className="mt-1 text-[12px] text-brand-ink-soft">Dieses Mitglied kann erst per E-Mail eingeladen werden, wenn eine E-Mail-Adresse hinterlegt wurde.</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {e.email && (
              <button type="button" onClick={onEinladen} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-brand-red px-3.5 text-[13px] font-semibold text-white hover:bg-brand-red-deep">
                <Mail size={15} /> {e.status === "eingeladen" && e.gesendetAm ? "Erneut senden" : "Einladen"}
              </button>
            )}
            <button type="button" onClick={onLink} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-line bg-white px-3.5 text-[13px] font-semibold text-brand-ink hover:bg-brand-bg">
              <Link2 size={15} /> {e.status === "eingeladen" ? "Einladungslink" : "Link kopieren"}
            </button>
          </div>
          {offen && <RegisterDetail e={e} gruppen={gruppen} />}
        </div>
      </div>
    </li>
  );
}

function RegisterDetail({ e, gruppen }: { e: RegisterEintrag; gruppen: { id: string; name: string }[] }) {
  const router = useRouter();
  const [email, setEmail] = useState(e.email ?? "");
  const [nummer, setNummer] = useState(e.mitgliedsnummer ?? "");
  const [gruppe, setGruppe] = useState(e.gruppeId ?? "");
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  const [entfernen, setEntfernen] = useState(false);
  const [laeuft, starte] = useTransition();
  const ausfuehren = (f: () => Promise<{ error: string | null; ok?: string | null }>) =>
    starte(async () => {
      const r = await f();
      setMeldung({ text: r.error ?? r.ok ?? "", fehler: !!r.error });
      if (!r.error) router.refresh();
    });
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-brand-line bg-brand-bg/40 p-3.5">
      <form
        onSubmit={(x) => {
          x.preventDefault();
          ausfuehren(() => stammdatenAendern(e.id, { email, mitgliedsnummer: nummer, gruppe_id: gruppe }));
        }}
        className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
      >
        <label className="field">
          <span>E-Mail-Adresse</span>
          <input type="email" value={email} onChange={(x) => setEmail(x.target.value)} maxLength={254} placeholder="fehlt noch" />
        </label>
        <label className="field">
          <span>Mitgliedsnummer</span>
          <input value={nummer} onChange={(x) => setNummer(x.target.value)} maxLength={50} />
        </label>
        <label className="field">
          <span>Gruppe</span>
          <select value={gruppe} onChange={(x) => setGruppe(x.target.value)}>
            <option value="">keine Gruppe</option>
            {gruppen.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-3">
          <button type="submit" disabled={laeuft} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-ink px-4 text-[13px] font-semibold text-white disabled:opacity-60">
            {laeuft && <Loader2 size={15} className="animate-spin" />} Speichern
          </button>
        </div>
      </form>
      <p className="text-[12px] text-brand-ink-soft">Die Gruppe wird übernommen, sobald sich das Mitglied mit seinem Einladungslink registriert hat.</p>
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-brand-line pt-3">
        {e.status === "eingeladen" && (
          <button type="button" disabled={laeuft} onClick={() => ausfuehren(() => einladungZurueckziehen(e.id))} className="text-[12.5px] font-semibold text-brand-ink-soft hover:text-brand-ink hover:underline">
            Einladung zurückziehen
          </button>
        )}
        {entfernen ? (
          <span className="flex flex-wrap items-center gap-2 text-[12.5px]">
            {e.name} aus den Mitgliederdaten entfernen?
            <button type="button" disabled={laeuft} onClick={() => ausfuehren(() => stammdatenEntfernen(e.id))} className="font-semibold text-brand-red hover:underline">
              Ja, entfernen
            </button>
            <button type="button" onClick={() => setEntfernen(false)} className="text-brand-ink-soft hover:underline">
              Abbrechen
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setEntfernen(true)} className="text-[12.5px] font-semibold text-brand-red hover:underline">
            Eintrag entfernen
          </button>
        )}
      </div>
      {meldung && <p className={meldung.fehler ? "form-error" : "text-[13px] font-semibold text-brand-green"}>{meldung.text}</p>}
    </div>
  );
}
