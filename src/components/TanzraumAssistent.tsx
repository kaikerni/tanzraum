"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Nachricht = { rolle: "user" | "assistent"; text: string };

const BEISPIELE = [
  "Wer fehlt heute beim Training?",
  "Erstelle eine Nachricht an die Eltern.",
  "Welche Turniere stehen an?",
  "Zeige mir offene Beiträge.",
];

export function TanzraumAssistent() {
  const [verlauf, setVerlauf] = useState<Nachricht[]>([]);
  const [eingabe, setEingabe] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const endeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endeRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [verlauf]);

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
    <div className="card flex flex-col">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-gold to-brand-red text-white">
          <Sparkles size={16} />
        </span>
        <div>
          <h2 className="font-display text-base font-bold text-brand-ink">TanzRaum Assistent</h2>
          <p className="text-[11.5px] text-brand-ink-soft">Dein smarter Helfer für den Vereinsalltag.</p>
        </div>
      </div>

      {verlauf.length > 0 && (
        <div className="my-3 flex max-h-56 flex-col gap-2 overflow-y-auto rounded-lg bg-brand-bg p-3">
          {verlauf.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-[12.5px] leading-snug ${
                m.rolle === "user"
                  ? "self-end bg-brand-red text-white"
                  : "self-start bg-white text-brand-ink shadow-sm"
              }`}
            >
              {m.text}
            </div>
          ))}
          {laedt && (
            <div className="self-start rounded-lg bg-white px-3 py-2 text-[12.5px] text-brand-ink-soft shadow-sm">
              …
            </div>
          )}
          <div ref={endeRef} />
        </div>
      )}

      {verlauf.length === 0 && (
        <div className="my-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {BEISPIELE.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => senden(b)}
              className="rounded-lg border border-brand-line bg-white px-3 py-2 text-left text-[12px] text-brand-ink-soft transition-colors hover:border-brand-gold hover:bg-brand-gold-wash hover:text-brand-ink"
            >
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
        className="mt-auto flex items-center gap-2 rounded-full border border-brand-line bg-brand-bg px-3 py-1.5 focus-within:border-brand-red"
      >
        <input
          type="text"
          value={eingabe}
          onChange={(e) => setEingabe(e.target.value)}
          placeholder="Stelle eine Frage oder gib einen Befehl ein …"
          className="flex-1 bg-transparent text-[13px] outline-none"
          disabled={laedt}
        />
        <button
          type="submit"
          disabled={laedt || !eingabe.trim()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-red text-white disabled:opacity-40"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
