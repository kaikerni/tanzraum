"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, ChevronDown, Info } from "lucide-react";
import { chatFreigabeSetzen } from "@/app/dashboard/nachrichten/actions";
import type { ChatStatus } from "@/lib/chat/getChat";

// Eltern schalten den Chat fuer ihre minderjaehrigen Kinder frei (Einwilligung, jederzeit widerrufbar).
export function ChatFreigaben({ status }: { status: ChatStatus }) {
  const kinder = status.kinder.filter((k) => k.minderjaehrig);
  const offen = kinder.filter((k) => !k.freigeschaltet).length;
  const [auf, setAuf] = useState(offen > 0);
  const [laeuft, starte] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);

  if (status.ichMinderjaehrig && !status.ichFreigeschaltet) {
    return (
      <div className="mx-4 mb-3 flex gap-2 rounded-xl bg-brand-amber-wash px-3 py-2.5 text-[12.5px] text-brand-ink">
        <Info size={16} className="mt-0.5 shrink-0 text-brand-amber" />
        <span>
          Zum Schreiben müssen deine Eltern den Chat für dich freischalten. Nachrichten deiner Trainer kannst du schon jetzt lesen.
        </span>
      </div>
    );
  }
  if (kinder.length === 0) return null;

  return (
    <div className="mx-4 mb-3 rounded-xl border border-brand-line">
      <button type="button" onClick={() => setAuf(!auf)} aria-expanded={auf} className="flex min-h-11 w-full items-center gap-2 px-3 text-left">
        <ShieldCheck size={17} className={offen ? "text-brand-amber" : "text-brand-green"} />
        <span className="flex-1 text-[13px] font-semibold text-brand-ink">
          Chat-Freigabe für deine Kinder{offen ? ` · ${offen} offen` : ""}
        </span>
        <ChevronDown size={16} className={`text-brand-ink-soft transition-transform ${auf ? "rotate-180" : ""}`} />
      </button>
      {auf && (
        <div className="flex flex-col gap-2 border-t border-brand-line px-3 py-2.5">
          <p className="text-[12px] text-brand-ink-soft">
            Mit deiner Freigabe darf dein Kind selbst schreiben: an dich, an seine Trainer und Betreuer und an andere freigeschaltete Tänzer, mit denen es
            verbunden ist. Trainer und Betreuer seiner Gruppen können es unabhängig davon immer erreichen.
          </p>
          {kinder.map((k) => (
            <label key={k.userId} className="flex min-h-10 items-center justify-between gap-3 text-[13.5px] text-brand-ink">
              <span className="font-medium">{k.name}</span>
              <input
                type="checkbox"
                role="switch"
                checked={k.freigeschaltet}
                disabled={laeuft}
                onChange={(e) => {
                  const erteilt = e.target.checked;
                  if (!erteilt && !confirm(`Chat-Freigabe für ${k.name} widerrufen? ${k.name} kann dann nicht mehr selbst schreiben.`)) return;
                  starte(async () => setFehler((await chatFreigabeSetzen(k.userId, erteilt)).error));
                }}
                className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-brand-line transition-colors before:block before:h-4 before:w-4 before:translate-x-0.5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-brand-green checked:before:translate-x-[18px]"
              />
            </label>
          ))}
          {fehler && <p className="form-error">{fehler}</p>}
        </div>
      )}
    </div>
  );
}
