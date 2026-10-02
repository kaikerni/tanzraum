"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Lock, MessageSquareMore, ShieldAlert, Trash2, Unlock } from "lucide-react";
import { KARTE } from "@/components/dashboard/Karten";
import { Meldung, type AktionsErgebnis } from "@/components/ui/SendenButton";
import { chatEinstellungenSpeichern, chatFallSetzen, chatFreigabeSetzen, chatSperreAufheben } from "@/app/dashboard/admin/moderation/actions";

export type ChatFall = {
  id: string;
  erstellt_am: string;
  status: string;
  grund: string;
  text: string | null;
  automatisch: boolean;
  oeffentlich: boolean;
  chat_name: string;
  auszug: string | null;
  nachricht_id: string | null;
  nachricht_entfernt: boolean;
  melder: string;
  ziel_user_id: string | null;
  ziel: string;
  ziel_gesperrt: boolean;
  ziel_chat_sperre_bis: string | null;
  verstoesse_30_tage: number;
  admin_notiz: string | null;
};
export type ChatSperre = { id: string; nutzer: string; bereich: string; bis: string; grund: string | null; automatisch: boolean };
export type SchutzStatistik = {
  blockiert: number;
  nicht_geprueft: number;
  nicht_geprueft_24h: number;
  sperren: number;
  faelle_offen: number;
  kategorien: Record<string, number>;
  einstellungen: Record<string, number>;
};

const STATUS: Record<string, string> = { offen: "Offen", in_pruefung: "In Prüfung", erledigt: "Erledigt", keine_massnahme: "Keine Maßnahme" };
const GRUND: Record<string, string> = {
  beleidigung: "Beleidigung", belaestigung: "Belästigung", mobbing: "Mobbing", unangemessen: "Unangemessener Inhalt", sexualisiert: "Sexualisierter Inhalt",
  spam: "Spam/Werbung", persoenliche_daten: "Persönliche Daten", regelverstoss: "Regelverstoß", sonstiges: "Sonstiges", schutzpruefung: "Automatische Schutzprüfung",
};
const KATEGORIE: Record<string, string> = {
  beleidigung: "Beleidigung", belaestigung: "Belästigung", mobbing: "Mobbing", drohung: "Drohung", sexuell: "Sexuelle Inhalte", grooming: "Grooming/Anbahnung",
  kontaktdaten: "Kontaktdaten", messenger_wechsel: "Messenger-Wechsel", diskriminierung: "Diskriminierung", spam: "Spam", flut: "Flut", sonstiges: "Sonstiges",
};
const BEREICH: Record<string, string> = { oeffentlich: "TanzRaum Chat", gruppen: "Gruppenchats", alle: "Alle Chats" };
const zeit = (iso: string) => new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const SCHWELLEN: { key: string; label: string; standard: number }[] = [
  { key: "max_laenge_oeffentlich", label: "Max. Zeichen je Nachricht (öffentlich)", standard: 1000 },
  { key: "pro_minute", label: "Nachrichten je Minute", standard: 8 },
  { key: "pro_10_minuten", label: "Nachrichten je 10 Minuten", standard: 40 },
  { key: "duplikat_minuten", label: "Gleiche Nachricht erst wieder nach (Min.)", standard: 10 },
  { key: "fenster_stunden", label: "Verstöße zählen innerhalb (Std.)", standard: 24 },
  { key: "verwarnung_ab", label: "Verwarnung ab Verstoß Nr.", standard: 2 },
  { key: "sperre_ab", label: "Schreibsperre ab Verstoß Nr.", standard: 3 },
  { key: "sperre_minuten", label: "Dauer Schreibsperre (Min.)", standard: 60 },
  { key: "sperre_lang_ab", label: "Lange Schreibsperre ab Verstoß Nr.", standard: 5 },
  { key: "sperre_lang_stunden", label: "Dauer lange Schreibsperre (Std.)", standard: 24 },
  { key: "fall_ab_anzahl", label: "Moderationsfall ab Verstoß Nr.", standard: 3 },
  { key: "fall_ab_schwere", label: "Moderationsfall ab Schwere (1–3)", standard: 3 },
  { key: "oeffentlich_ab_16", label: "Öffentlich schreiben erst ab 16 (1 = ja, 0 = nein)", standard: 1 },
];

export function ChatFreigabe({ aktiv, tarife }: { aktiv: boolean; tarife: string[] }) {
  const router = useRouter();
  const [an, setAn] = useState(aktiv);
  const [wahl, setWahl] = useState<string[]>(tarife);
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();
  return (
    <section className={`${KARTE} flex flex-col gap-3`}>
      <h2 className="flex items-center gap-2 text-[17px] font-bold text-brand-ink">
        <MessageSquareMore size={19} className="text-brand-red" /> TanzRaum Chat – Freigabe
      </h2>
      <label className="flex min-h-11 items-center gap-3 text-[14.5px] font-semibold text-brand-ink">
        <input type="checkbox" checked={an} onChange={(e) => setAn(e.target.checked)} className="h-5 w-5 accent-brand-red" />
        TanzRaum Chat eingeschaltet
      </label>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Für welche Tarife?">
        {(["free", "basic", "verein"] as const).map((t) => (
          <label key={t} className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 text-[14px] font-semibold ${wahl.includes(t) ? "border-brand-red bg-brand-red-wash text-brand-red" : "border-brand-line text-brand-ink"}`}>
            <input type="checkbox" checked={wahl.includes(t)} onChange={(e) => setWahl(e.target.checked ? [...wahl, t] : wahl.filter((x) => x !== t))} className="h-4 w-4 accent-brand-red" />
            {t.toUpperCase()}
          </label>
        ))}
      </div>
      <p className="text-[12.5px] text-brand-ink-soft">
        Nur ausgewählte Tarife sehen und nutzen den Chat. Du und Moderatoren mit Chat-Recht habt immer Zugang. Jede Nachricht wird vor der Veröffentlichung geprüft – ohne
        eingerichtete KI-Prüfung wird nichts veröffentlicht.
      </p>
      <button
        type="button"
        disabled={laeuft}
        onClick={() =>
          starte(async () => {
            const r = await chatFreigabeSetzen(an, wahl);
            setMeldung(r);
            if (!r.error) router.refresh();
          })
        }
        className="btn-primary mt-0 min-h-11 w-fit disabled:opacity-60"
      >
        Speichern
      </button>
      {meldung && <Meldung ergebnis={meldung} />}
    </section>
  );
}

export function SchutzUebersicht({ s }: { s: SchutzStatistik }) {
  const kategorien = Object.entries(s.kategorien ?? {}).sort((a, b) => b[1] - a[1]);
  return (
    <section className={`${KARTE} flex flex-col gap-3`}>
      <h2 className="flex items-center gap-2 text-[17px] font-bold text-brand-ink">
        <Bot size={19} className="text-brand-blue" /> TanzRaum Schutzprüfung (7 Tage)
      </h2>
      {s.nicht_geprueft_24h > 0 && (
        <p className="rounded-xl bg-brand-gold-wash px-3 py-2 text-[13px] text-brand-ink">
          ⚠️ {s.nicht_geprueft_24h} Nachricht{s.nicht_geprueft_24h === 1 ? "" : "en"} konnte{s.nicht_geprueft_24h === 1 ? "" : "n"} in den letzten 24 Std. nicht geprüft werden (KI nicht
          erreichbar bzw. Schlüssel fehlt) und wurde{s.nicht_geprueft_24h === 1 ? "" : "n"} deshalb nicht veröffentlicht.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Blockiert", s.blockiert],
          ["Nicht geprüft", s.nicht_geprueft],
          ["Schreibsperren", s.sperren],
          ["Offene Fälle", s.faelle_offen],
        ].map(([t, z]) => (
          <div key={t} className="rounded-xl bg-brand-bg px-3 py-2">
            <div className="text-[22px] font-extrabold text-brand-ink">{z}</div>
            <div className="text-[12px] text-brand-ink-soft">{t}</div>
          </div>
        ))}
      </div>
      {kategorien.length > 0 && (
        <div className="flex flex-wrap gap-1.5 text-[12px]">
          {kategorien.map(([k, n]) => (
            <span key={k} className="rounded-full bg-brand-bg px-2.5 py-1 text-brand-ink-soft">
              {KATEGORIE[k] ?? k}: <b className="text-brand-ink">{n}</b>
            </span>
          ))}
        </div>
      )}
      <p className="text-[12px] text-brand-ink-faint">Gespeichert werden nur Kategorie, Schwere und Maßnahme – keine Nachrichtentexte. Auszüge gibt es nur in Moderationsfällen.</p>
    </section>
  );
}

function FallKarte({ f, rechte }: { f: ChatFall; rechte: { entfernen: boolean; sperren: boolean } }) {
  const router = useRouter();
  const [notiz, setNotiz] = useState(f.admin_notiz ?? "");
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();
  const tun = (status: string, aktion: { entfernen?: boolean; verwarnen?: boolean; sperreStunden?: number } = {}) =>
    starte(async () => {
      const r = await chatFallSetzen(f.id, status, notiz, aktion);
      setMeldung(r);
      if (!r.error) router.refresh();
    });
  const offen = f.status === "offen" || f.status === "in_pruefung";
  const K = "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-line px-2.5 text-[12.5px] font-semibold hover:bg-brand-bg disabled:opacity-50";
  return (
    <li className={`${KARTE} flex flex-col gap-2`}>
      <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
        <span className={`rounded-full px-2 py-0.5 ${offen ? "bg-brand-red-wash text-brand-red" : "bg-brand-bg text-brand-ink-soft"}`}>{STATUS[f.status] ?? f.status}</span>
        <span className="rounded-full bg-brand-bg px-2 py-0.5 text-brand-ink-soft">{f.chat_name}</span>
        {f.automatisch && <span className="rounded-full bg-brand-blue-wash px-2 py-0.5 text-brand-blue">🤖 automatisch</span>}
        <span className="ml-auto text-brand-ink-faint">{zeit(f.erstellt_am)}</span>
      </div>
      <p className="text-[14px] font-bold text-brand-ink">{GRUND[f.grund] ?? f.grund}</p>
      {f.text && <p className="text-[13px] text-brand-ink-soft [overflow-wrap:anywhere]">{f.text}</p>}
      {f.auszug && <blockquote className="rounded-lg border-l-4 border-brand-red bg-brand-bg px-3 py-2 text-[13.5px] text-brand-ink [overflow-wrap:anywhere]">{f.auszug}</blockquote>}
      <p className="text-[12.5px] text-brand-ink-soft">
        Betroffen: <b className="text-brand-ink">{f.ziel}</b> · {f.verstoesse_30_tage} Verstöße in 30 Tagen
        {f.ziel_chat_sperre_bis && ` · Schreibsperre bis ${zeit(f.ziel_chat_sperre_bis)}`}
        {f.ziel_gesperrt && " · Konto gesperrt"} · gemeldet von {f.melder}
      </p>
      <textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} maxLength={2000} rows={2} placeholder="Interne Notiz / dokumentierte Maßnahme" aria-label="Notiz" className="rounded-xl border border-brand-line px-3 py-2 text-[13.5px] outline-none focus:border-brand-red" />
      <div className="flex flex-wrap gap-1.5">
        {f.status === "offen" && (
          <button type="button" disabled={laeuft} onClick={() => tun("in_pruefung")} className={K}>
            In Prüfung
          </button>
        )}
        {rechte.entfernen && f.nachricht_id && !f.nachricht_entfernt && (
          <button type="button" disabled={laeuft} onClick={() => confirm("Nachricht für alle entfernen?") && tun("erledigt", { entfernen: true })} className={`${K} text-brand-red`}>
            <Trash2 size={14} /> Nachricht entfernen
          </button>
        )}
        {f.ziel_user_id && (
          <button type="button" disabled={laeuft} onClick={() => tun(f.status === "offen" ? "in_pruefung" : f.status, { verwarnen: true })} className={K}>
            Verwarnen
          </button>
        )}
        {rechte.sperren && f.ziel_user_id &&
          [
            [1, "1 Std."],
            [24, "24 Std."],
            [24 * 7, "7 Tage"],
          ].map(([h, t]) => (
            <button key={h} type="button" disabled={laeuft} onClick={() => tun("erledigt", { sperreStunden: Number(h) })} className={K}>
              <Lock size={13} /> Schreibsperre {t}
            </button>
          ))}
        <button type="button" disabled={laeuft} onClick={() => tun("erledigt")} className={`${K} border-brand-green text-brand-green`}>
          Erledigt
        </button>
        <button type="button" disabled={laeuft} onClick={() => tun("keine_massnahme")} className={K}>
          Keine Maßnahme
        </button>
      </div>
      {meldung && <Meldung ergebnis={meldung} />}
    </li>
  );
}

export function ChatFaelle({ faelle, rechte }: { faelle: ChatFall[]; rechte: { entfernen: boolean; sperren: boolean } }) {
  const [filter, setFilter] = useState<"offen" | "alle">("offen");
  const liste = filter === "offen" ? faelle.filter((f) => f.status === "offen" || f.status === "in_pruefung") : faelle;
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex flex-1 items-center gap-2 text-[17px] font-bold text-brand-ink">
          <ShieldAlert size={19} className="text-brand-red" /> Chat-Fälle
        </h2>
        {(["offen", "alle"] as const).map((x) => (
          <button key={x} type="button" onClick={() => setFilter(x)} className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${filter === x ? "bg-brand-ink text-white" : "border border-brand-line bg-white text-brand-ink-soft"}`}>
            {x === "offen" ? "Offen & in Prüfung" : "Alle"}
          </button>
        ))}
      </div>
      {liste.length === 0 ? (
        <p className={`${KARTE} text-[13.5px] text-brand-ink-soft`}>Keine Fälle.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {liste.map((f) => (
            <FallKarte key={f.id} f={f} rechte={rechte} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function ChatSperren({ sperren }: { sperren: ChatSperre[] }) {
  const router = useRouter();
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  return (
    <section className={`${KARTE} flex flex-col gap-2`}>
      <h2 className="flex items-center gap-2 text-[17px] font-bold text-brand-ink">
        <Lock size={18} className="text-brand-ink-soft" /> Aktive Chat-Schreibsperren
      </h2>
      {sperren.length === 0 ? (
        <p className="text-[13.5px] text-brand-ink-soft">Keine aktiven Sperren.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-brand-line">
          {sperren.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 py-2 text-[13.5px]">
              <span className="min-w-0 flex-1">
                <b className="text-brand-ink">{s.nutzer}</b> · {BEREICH[s.bereich] ?? s.bereich} · bis {zeit(s.bis)}
                {s.automatisch && " · automatisch"}
                {s.grund && <span className="block text-[12px] text-brand-ink-soft [overflow-wrap:anywhere]">{s.grund}</span>}
              </span>
              <button
                type="button"
                disabled={laeuft}
                onClick={() =>
                  starte(async () => {
                    const r = await chatSperreAufheben(s.id);
                    setMeldung(r);
                    if (!r.error) router.refresh();
                  })
                }
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-line px-2.5 text-[12.5px] font-semibold hover:bg-brand-bg"
              >
                <Unlock size={13} /> Aufheben
              </button>
            </li>
          ))}
        </ul>
      )}
      {meldung && <Meldung ergebnis={meldung} />}
    </section>
  );
}

export function SchutzEinstellungen({ werte }: { werte: Record<string, number> }) {
  const [w, setW] = useState<Record<string, number>>(Object.fromEntries(SCHWELLEN.map((s) => [s.key, werte[s.key] ?? s.standard])));
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();
  return (
    <section className={`${KARTE} flex flex-col gap-3`}>
      <h2 className="text-[17px] font-bold text-brand-ink">Schwellenwerte der Schutzprüfung</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SCHWELLEN.map((s) => (
          <label key={s.key} className="field">
            {s.label}
            <input type="number" inputMode="numeric" min={0} value={w[s.key]} onChange={(e) => setW({ ...w, [s.key]: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
          </label>
        ))}
      </div>
      <p className="text-[12px] text-brand-ink-soft">Kai ist nicht beteiligt: Die Schutzprüfung ist ein eigenes technisches Schutzsystem. Dauerhafte Kontosperren entscheiden immer Menschen.</p>
      <button
        type="button"
        disabled={laeuft}
        onClick={() => starte(async () => setMeldung(await chatEinstellungenSpeichern(w)))}
        className="btn-primary mt-0 min-h-11 w-fit disabled:opacity-60"
      >
        Speichern
      </button>
      {meldung && <Meldung ergebnis={meldung} />}
    </section>
  );
}
