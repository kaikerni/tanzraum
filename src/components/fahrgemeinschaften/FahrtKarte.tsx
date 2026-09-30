"use client";

import { useActionState, useState, useTransition } from "react";
import { Ban, Car, CheckCircle2, Clock, MapPin, MessageCircle, Pencil, RotateCcw, Search, Trash2, Users, X } from "lucide-react";
import { fahrtLoeschen, fahrtStatusSetzen, reagieren, reaktionEntfernen } from "@/app/dashboard/fahrgemeinschaften/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS, type AktionsErgebnis } from "@/components/ui/SendenButton";
import { RICHTUNG_LABEL, fahrtDatum, initialen, type Fahrt } from "@/lib/fahrgemeinschaften";
import { FahrtFormular } from "./FahrtFormular";

const TEXTFELD =
  "w-full rounded-[var(--radius-s)] border border-brand-line px-3 py-2.5 text-[13.5px] text-brand-ink outline-none focus:border-brand-red";
const KLEIN =
  "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-line bg-white px-2.5 text-[12.5px] font-semibold text-brand-ink hover:bg-brand-bg disabled:opacity-50";

function Kreis({ name, klein = false }: { name: string; klein?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-brand-ink font-bold text-white ${klein ? "h-7 w-7 text-[11px]" : "h-10 w-10 text-[13px]"}`}
      aria-hidden
    >
      {initialen(name)}
    </span>
  );
}

// Eine Fahrgemeinschaft: Eckdaten, Plaetze, Reaktionen, Mitfahren/Anbieten/Nachricht, Verwaltung fuer die eigene Fahrt
export function FahrtKarte({ fahrt, darfSchreiben, vergangen = false }: { fahrt: Fahrt; darfSchreiben: boolean; vergangen?: boolean }) {
  const [bearbeiten, setBearbeiten] = useState(false);
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [ergebnis, aktion] = useActionState(reagieren, LEERES_ERGEBNIS);

  const angebot = fahrt.art === "angebot";
  const frei = Math.max(0, fahrt.plaetze - fahrt.belegt);
  const offen = fahrt.status === "offen" && !vergangen;
  const meine = fahrt.antworten.find((a) => a.ist_meine && a.art !== "nachricht");
  const eintraege = fahrt.antworten.filter((a) => a.art !== "nachricht");
  const nachrichten = fahrt.antworten.filter((a) => a.art === "nachricht");
  const maxPersonen = angebot ? Math.max(1, frei + (meine?.personen ?? 0)) : 8;
  const voll = angebot && frei === 0 && !meine;

  const ausfuehren = (f: () => Promise<AktionsErgebnis>) => starte(async () => setMeldung(await f()));

  const statusBadge =
    fahrt.status === "abgesagt"
      ? { text: "Abgesagt", stil: "border-brand-red/40 bg-brand-red-wash text-brand-red" }
      : fahrt.status === "erledigt"
        ? { text: angebot ? "Voll / geschlossen" : "Mitfahrt gefunden", stil: "border-brand-line bg-brand-bg text-brand-ink-soft" }
        : angebot
          ? frei > 0
            ? { text: frei === 1 ? "1 Platz frei" : `${frei} Plätze frei`, stil: "border-brand-green/40 bg-brand-green-wash text-brand-green" }
            : { text: "Voll", stil: "border-brand-gold/40 bg-brand-gold-wash text-brand-ink" }
          : { text: fahrt.plaetze === 1 ? "sucht 1 Platz" : `sucht ${fahrt.plaetze} Plätze`, stil: "border-brand-blue/30 bg-brand-bg text-brand-ink" };

  return (
    <article className={`flex flex-col gap-3 rounded-2xl border bg-white p-4 ${fahrt.status === "abgesagt" ? "border-brand-red/30 opacity-80" : "border-brand-line"}`}>
      <div className="flex items-start gap-3">
        <Kreis name={fahrt.ersteller.name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${angebot ? "bg-brand-red text-white" : "bg-brand-ink text-white"}`}>
              {angebot ? <Car size={12} /> : <Search size={12} />} {angebot ? "Biete Fahrt" : "Suche Mitfahrt"}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[11.5px] font-bold ${statusBadge.stil}`}>{statusBadge.text}</span>
          </div>
          <h3 className="mt-1 break-words text-[16px] font-extrabold text-brand-ink">{fahrt.anlass}</h3>
          <p className="text-[12.5px] text-brand-ink-soft">
            {fahrt.ist_meine ? "Deine Fahrt" : fahrt.ersteller.name} · {RICHTUNG_LABEL[fahrt.richtung]}
          </p>
        </div>
      </div>

      <dl className="grid gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-2">
        <div className="flex items-center gap-1.5 text-brand-ink">
          <Clock size={14} className="shrink-0 text-brand-ink-soft" />
          <span>
            {fahrtDatum(fahrt.datum)}
            {fahrt.uhrzeit ? `, ${fahrt.uhrzeit} Uhr` : ""}
          </span>
        </div>
        {fahrt.treffpunkt && (
          <div className="flex min-w-0 items-center gap-1.5 text-brand-ink">
            <MapPin size={14} className="shrink-0 text-brand-ink-soft" />
            <span className="break-words">
              {angebot ? "Treffpunkt" : "Abholung"}: {fahrt.treffpunkt}
            </span>
          </div>
        )}
        {fahrt.ziel && (
          <div className="flex min-w-0 items-center gap-1.5 text-brand-ink">
            <MapPin size={14} className="shrink-0 text-brand-red" />
            <span className="break-words">Ziel: {fahrt.ziel}</span>
          </div>
        )}
        {angebot && (
          <div className="flex items-center gap-1.5 text-brand-ink">
            <Users size={14} className="shrink-0 text-brand-ink-soft" />
            <span>
              {fahrt.belegt} von {fahrt.plaetze} Plätzen belegt
            </span>
          </div>
        )}
      </dl>
      {angebot && (
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: fahrt.plaetze }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < fahrt.belegt ? "bg-brand-red" : "bg-brand-line"}`} />
          ))}
        </div>
      )}
      {fahrt.notiz && <p className="whitespace-pre-line break-words rounded-xl bg-brand-bg px-3 py-2 text-[13px] text-brand-ink">{fahrt.notiz}</p>}

      {eintraege.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-bold uppercase tracking-wide text-brand-ink-soft">{angebot ? "Fahren mit" : "Können mitnehmen"}</span>
          <ul className="flex flex-col gap-1.5">
            {eintraege.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-[13px]">
                <Kreis name={a.name} klein />
                <span className="min-w-0 flex-1 break-words text-brand-ink">
                  <strong>{a.ist_meine ? "Du" : a.name}</strong>
                  {a.personen > 1 ? ` · ${a.personen} ${angebot ? "Personen" : "Plätze"}` : ""}
                  {a.text ? <span className="text-brand-ink-soft"> – {a.text}</span> : null}
                </span>
                {(a.ist_meine || fahrt.ist_meine) && !vergangen && (
                  <button
                    type="button"
                    disabled={laeuft}
                    onClick={() => {
                      if (window.confirm(a.ist_meine ? "Eintrag zurückziehen?" : `${a.name} aus der Fahrt entfernen?`)) ausfuehren(() => reaktionEntfernen(a.id));
                    }}
                    className="rounded-md p-1.5 text-brand-ink-soft hover:bg-brand-bg hover:text-brand-red"
                    aria-label={a.ist_meine ? "Eintrag zurückziehen" : `${a.name} entfernen`}
                  >
                    <X size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {nachrichten.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-brand-line pt-2">
          {nachrichten.map((a) => (
            <div key={a.id} className="flex items-start gap-2 text-[13px]">
              <MessageCircle size={14} className="mt-0.5 shrink-0 text-brand-ink-soft" />
              <p className="min-w-0 flex-1 break-words text-brand-ink">
                <strong>{a.ist_meine ? "Du" : a.name}:</strong> {a.text}
              </p>
              {(a.ist_meine || fahrt.ist_meine) && (
                <button
                  type="button"
                  disabled={laeuft}
                  onClick={() => ausfuehren(() => reaktionEntfernen(a.id))}
                  className="rounded-md p-1 text-brand-ink-soft hover:bg-brand-bg hover:text-brand-red"
                  aria-label="Nachricht löschen"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {offen && darfSchreiben && (
        <form action={aktion} className="flex flex-col gap-2 border-t border-brand-line pt-3">
          <input type="hidden" name="fahrt_id" value={fahrt.id} />
          <div className="flex flex-wrap items-center gap-2">
            <input name="text" maxLength={300} placeholder={fahrt.ist_meine ? "Nachricht an alle Eingetragenen …" : "Nachricht (optional), z. B. „Lea und ich“"} className={`${TEXTFELD} min-w-0 flex-1 basis-56`} />
            {!fahrt.ist_meine && !voll && (
              <select name="personen" defaultValue={String(meine?.personen ?? 1)} aria-label={angebot ? "Personen" : "Plätze"} className="min-h-10 rounded-[var(--radius-s)] border border-brand-line px-2 text-[13.5px]">
                {Array.from({ length: maxPersonen }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} {angebot ? (n === 1 ? "Person" : "Personen") : n === 1 ? "Platz" : "Plätze"}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {!fahrt.ist_meine && angebot && !voll && (
              <SendenButton name="art" value="mitfahren" laedtText="…">
                <Car size={15} /> {meine ? "Eintrag ändern" : "Ich fahre mit"}
              </SendenButton>
            )}
            {!fahrt.ist_meine && !angebot && (
              <SendenButton name="art" value="anbieten" laedtText="…">
                <Car size={15} /> {meine ? "Angebot ändern" : "Ich kann mitnehmen"}
              </SendenButton>
            )}
            <SendenButton name="art" value="nachricht" variante="sekundaer" laedtText="…">
              <MessageCircle size={15} /> Nachricht senden
            </SendenButton>
          </div>
          {voll && <p className="text-[12.5px] text-brand-ink-soft">Diese Fahrt ist voll. Du kannst trotzdem eine Nachricht schreiben oder selbst eine Mitfahrt suchen.</p>}
          <Meldung ergebnis={ergebnis} />
        </form>
      )}
      {offen && !darfSchreiben && (
        <p className="border-t border-brand-line pt-3 text-[12.5px] text-brand-ink-soft">Deine Eltern haben Nachrichten ausgeschaltet – bitte frag sie, ob sie dich eintragen.</p>
      )}

      {fahrt.ist_meine && !vergangen && (
        <div className="flex flex-wrap gap-2 border-t border-brand-line pt-3">
          {fahrt.status !== "abgesagt" && (
            <button type="button" className={KLEIN} onClick={() => setBearbeiten((b) => !b)}>
              <Pencil size={14} /> {bearbeiten ? "Bearbeiten schließen" : "Bearbeiten"}
            </button>
          )}
          {fahrt.status === "offen" && (
            <button type="button" className={KLEIN} disabled={laeuft} onClick={() => ausfuehren(() => fahrtStatusSetzen(fahrt.id, "erledigt"))}>
              <CheckCircle2 size={14} /> {angebot ? "Als voll markieren" : "Mitfahrt gefunden"}
            </button>
          )}
          {fahrt.status !== "offen" && (
            <button type="button" className={KLEIN} disabled={laeuft} onClick={() => ausfuehren(() => fahrtStatusSetzen(fahrt.id, "offen"))}>
              <RotateCcw size={14} /> Wieder öffnen
            </button>
          )}
          {fahrt.status !== "abgesagt" && (
            <button
              type="button"
              className={KLEIN}
              disabled={laeuft}
              onClick={() => {
                if (window.confirm("Fahrt absagen? Alle Eingetragenen werden benachrichtigt.")) ausfuehren(() => fahrtStatusSetzen(fahrt.id, "abgesagt"));
              }}
            >
              <Ban size={14} /> Absagen
            </button>
          )}
          <button
            type="button"
            className={`${KLEIN} text-brand-red`}
            disabled={laeuft}
            onClick={() => {
              if (window.confirm("Fahrt endgültig löschen?")) ausfuehren(() => fahrtLoeschen(fahrt.id));
            }}
          >
            <Trash2 size={14} /> Löschen
          </button>
        </div>
      )}
      {bearbeiten && (
        <div className="rounded-xl border border-brand-line bg-brand-bg p-3">
          <FahrtFormular fahrt={fahrt} fertig={() => setBearbeiten(false)} />
        </div>
      )}
      {meldung?.error && <p className="form-error">{meldung.error}</p>}
      {meldung?.ok && <Meldung ergebnis={meldung} />}
    </article>
  );
}
