"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Ban, CheckCircle2, ExternalLink, Trash2, UserX } from "lucide-react";
import { moderationEntscheiden, moderationLoeschen, moderationSperre } from "@/app/dashboard/boerse/actions";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";
import { MELDEGRUENDE, preisText, type Angebot } from "@/lib/boerse";

type Gemeldet = Angebot & { meldungen: { id: string; grund: string; text: string | null; erstellt_am: string }[]; anbieter_boerse_gesperrt: boolean };
const GRUND = new Map(MELDEGRUENDE);
const KNOPF = "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-line bg-white px-2.5 text-[12.5px] font-semibold hover:bg-brand-bg disabled:opacity-50";

// Moderation der Boerse: nur Angebot, Meldegruende und Name der anbietenden Person (keine Vereins-/Mitgliederdaten)
export function BoerseModeration({ gemeldet, bilder }: { gemeldet: Gemeldet[]; bilder: Record<string, string> }) {
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const aktion = (f: () => Promise<AktionsErgebnis>) => starte(async () => setMeldung(await f()));

  if (gemeldet.length === 0) return <p className="text-[13.5px] text-brand-ink-soft">Keine offenen Meldungen.</p>;
  return (
    <div className="flex flex-col gap-3">
      {meldung?.error && <p className="form-error">{meldung.error}</p>}
      {meldung?.ok && <p className="form-success">{meldung.ok}</p>}
      {gemeldet.map((a) => (
        <div key={a.id} className="flex flex-col gap-3 rounded-2xl border border-brand-line p-3 sm:flex-row">
          <div className="h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-brand-bg">
            {bilder[a.bilder[0]] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bilder[a.bilder[0]]} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/dashboard/boerse/${a.id}`} target="_blank" className="inline-flex items-center gap-1 text-[15px] font-bold text-brand-ink hover:text-brand-red">
                {a.titel} <ExternalLink size={13} />
              </Link>
              <span className="text-[12.5px] text-brand-ink-soft">
                {preisText(a)} · von {a.anbieter?.name ?? "–"}
                {a.anbieter_boerse_gesperrt ? " · Börse eingeschränkt" : ""}
              </span>
            </div>
            {a.beschreibung && <p className="line-clamp-3 whitespace-pre-line break-words text-[13px] text-brand-ink">{a.beschreibung}</p>}
            <ul className="flex flex-col gap-1">
              {a.meldungen.map((m) => (
                <li key={m.id} className="rounded-lg bg-brand-red-wash px-2.5 py-1.5 text-[12.5px] text-brand-ink">
                  <strong>{GRUND.get(m.grund) ?? m.grund}</strong>
                  {m.text ? ` – ${m.text}` : ""}
                  <span className="text-brand-ink-soft"> · {new Date(m.erstellt_am).toLocaleDateString("de-DE")}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={laeuft}
                className={`${KNOPF} text-brand-red`}
                onClick={() => {
                  const grund = window.prompt("Grund für die Deaktivierung (sieht die anbietende Person):", "Verstoß gegen die Börsen-Regeln");
                  if (grund) aktion(() => moderationEntscheiden(a.id, "sperren", grund));
                }}
              >
                <Ban size={14} /> Deaktivieren
              </button>
              <button type="button" disabled={laeuft} className={`${KNOPF} text-brand-ink`} onClick={() => aktion(() => moderationEntscheiden(a.id, "freigeben", ""))}>
                <CheckCircle2 size={14} /> Meldung verwerfen
              </button>
              <button
                type="button"
                disabled={laeuft}
                className={`${KNOPF} text-brand-red`}
                onClick={() => window.confirm("Angebot endgültig löschen (z. B. bei eindeutig verbotenem Inhalt)?") && aktion(() => moderationLoeschen(a.id))}
              >
                <Trash2 size={14} /> Löschen
              </button>
              {a.anbieter && !a.anbieter_boerse_gesperrt && (
                <button
                  type="button"
                  disabled={laeuft}
                  className={`${KNOPF} text-brand-ink`}
                  onClick={() => {
                    const grund = window.prompt("Warum wird die Person für die Börse eingeschränkt?", "Wiederholter Missbrauch der Börse");
                    if (!grund) return;
                    const tage = window.prompt("Wie viele Tage? (0 = unbefristet)", "30");
                    if (tage === null) return;
                    aktion(() => moderationSperre(a.anbieter!.id, grund, Math.max(0, Number(tage) || 0)));
                  }}
                >
                  <UserX size={14} /> Person für die Börse einschränken
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SperreAufheben({ userId }: { userId: string }) {
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={laeuft} className={`${KNOPF} text-brand-ink`} onClick={() => starte(async () => setMeldung(await moderationSperre(userId, "", null)))}>
        Aufheben
      </button>
      {meldung?.error && <span className="text-[12px] text-brand-red">{meldung.error}</span>}
    </span>
  );
}
