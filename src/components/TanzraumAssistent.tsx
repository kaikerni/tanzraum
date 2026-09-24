"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Lightbulb } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Nachricht = { rolle: "user" | "assistent"; text: string };

const BEISPIELE = [
  "Wer fehlt heute beim Training?",
  "Erstelle eine Nachricht an die Eltern der Jugend.",
  "Welche Turniere stehen im nächsten Monat an?",
  "Zeige mir offene Beiträge.",
];

export function TanzraumAssistent() {
  const [verlauf, setVerlauf] = useState<Nachricht[]>([]);
  const [eingabe, setEingabe] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const listeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listeRef.current?.scrollTo({ top: listeRef.current.scrollHeight, behavior: "smooth" });
  }, [verlauf, laedt]);

  async function senden(frage: string) {
    const text = frage.trim();
    if (!text || laedt) return;

    setFehler(null);
    setEingabe("");
    const neuerVerlauf: Nachricht[] = [...verlauf, { rolle: "user", text }];
    setVerlauf(neuerVerlauf);
    setLaedt(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("tanzraum-assistent", {
        body: { frage: text, verlauf },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setVerlauf([...neuerVerlauf, { rolle: "assistent", text: data.antwort as string }]);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Der Assistent ist gerade nicht erreichbar.");
    } finally {
      setLaedt(false);
    }
  }

  return (
    <div className="flex h-full flex-col rounded-[var(--radius-l)] border border-brand-line bg-white p-4 shadow-[var(--shadow)] sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-purple-wash text-brand-purple">
          <Sparkles size={22} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[16px] font-bold text-brand-ink">
            TanzRaum Assistent
            <span className="rounded-md bg-brand-purple-wash px-1.5 py-0.5 text-[10.5px] font-bold text-brand-purple">KI</span>
          </h2>
          <p className="text-[12.5px] text-brand-ink-soft">Dein smarter Helfer für den Vereinsalltag.</p>
        </div>
      </div>

      {verlauf.length > 0 ? (
        <div
          ref={listeRef}
          aria-live="polite"
          className="mb-3 flex max-h-44 flex-col gap-2 overflow-y-auto rounded-xl bg-brand-bg p-2.5"
        >
          {verlauf.map((m, i) => (
            <div
              key={i}
              className={`max-w-[88%] whitespace-pre-line rounded-xl px-3 py-2 text-[12.5px] leading-snug ${
                m.rolle === "user"
                  ? "self-end bg-brand-red text-white"
                  : "self-start bg-white text-brand-ink shadow-sm"
              }`}
            >
              {m.text}
            </div>
          ))}
          {laedt && (
            <div className="self-start rounded-xl bg-white px-3 py-2 text-[12.5px] text-brand-ink-soft shadow-sm">
              Denkt nach …
            </div>
          )}
        </div>
      ) : (
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {BEISPIELE.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => senden(b)}
              className="flex items-start gap-2 rounded-xl border border-brand-line bg-white px-3 py-2.5 text-left text-[12px] leading-snug text-brand-ink transition-colors hover:border-brand-gold hover:bg-brand-gold-wash"
            >
              <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-amber text-white">
                <Lightbulb size={10} strokeWidth={2.5} />
              </span>
              {b}
            </button>
          ))}
        </div>
      )}

      {fehler && <p className="form-error mb-2">{fehler}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          senden(eingabe);
        }}
        className="mt-auto flex items-center gap-2 rounded-xl border border-brand-line bg-white py-1.5 pl-3.5 pr-1.5 focus-within:border-brand-red"
      >
        <label htmlFor="assistent-eingabe" className="sr-only">
          Frage an den Assistenten
        </label>
        <input
          id="assistent-eingabe"
          type="text"
          value={eingabe}
          onChange={(e) => setEingabe(e.target.value)}
          placeholder="Stelle eine Frage oder gib einen Befehl ein …"
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-brand-ink-faint"
          disabled={laedt}
        />
        <button
          type="submit"
          disabled={laedt || !eingabe.trim()}
          aria-label="Senden"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-navy text-white transition-opacity disabled:opacity-40"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
