"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Meldung, type AktionsErgebnis } from "@/components/ui/SendenButton";
import { meldungSetzen, nutzerEntsperren, nutzerSperren } from "@/app/dashboard/treff/actions";
import { GRUND_LABEL, MELDESTATUS } from "@/lib/treff/treff";

export type TreffMeldung = {
  id: string;
  grund: string;
  text: string | null;
  status: string;
  erstellt_am: string;
  art: string;
  thema_id: string | null;
  thema_titel: string | null;
  beitrag_id: string | null;
  auszug: string | null;
  ziel_user_id: string | null;
  ziel_handle: string | null;
  ziel_treff_gesperrt: boolean;
  admin_notiz: string | null;
  anzahl_zum_ziel: number;
};

// Meldung bearbeiten: Status setzen (die meldende Person erfaehrt nur das Ergebnis), optional Treff-Sperre
export function MeldungKarte({ m, darfSperren }: { m: TreffMeldung; darfSperren: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState(m.status);
  const [notiz, setNotiz] = useState(m.admin_notiz ?? "");
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();
  const tun = (f: () => Promise<AktionsErgebnis>) =>
    starte(async () => {
      const r = await f();
      setMeldung(r);
      if (!r.error) router.refresh();
    });
  const ziel = m.thema_id ? `/dashboard/treff/thema/${m.thema_id}${m.beitrag_id ? `#beitrag-${m.beitrag_id}` : ""}` : null;
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-brand-line bg-white p-3.5">
      <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
        <span className="rounded-full bg-brand-red-wash px-2 py-0.5 text-brand-red">{GRUND_LABEL[m.grund] ?? m.grund}</span>
        <span className="rounded-full bg-brand-bg px-2 py-0.5 text-brand-ink-soft">{m.art === "beitrag" ? "Beitrag" : m.art === "thema" ? "Thema" : "Nutzer"}</span>
        <span className="rounded-full bg-brand-bg px-2 py-0.5 text-brand-ink-soft">{MELDESTATUS[m.status] ?? m.status}</span>
        <span className="text-brand-ink-soft">{new Date(m.erstellt_am).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })}</span>
      </div>
      {m.thema_titel && (
        <p className="text-[14px] font-bold text-brand-ink">
          {ziel ? (
            <Link href={ziel} className="hover:underline">
              {m.thema_titel}
            </Link>
          ) : (
            m.thema_titel
          )}
        </p>
      )}
      {m.auszug && <p className="rounded-xl bg-brand-bg px-3 py-2 text-[13px] text-brand-ink [overflow-wrap:anywhere]">„{m.auszug}“</p>}
      {m.text && <p className="text-[13px] text-brand-ink-soft">Hinweis: {m.text}</p>}
      <p className="text-[12.5px] text-brand-ink-soft">
        Betrifft {m.ziel_handle ?? "Gelöschtes Konto"} · {m.anzahl_zum_ziel} Treff-Meldung{m.anzahl_zum_ziel === 1 ? "" : "en"} insgesamt
        {m.ziel_treff_gesperrt ? " · im Treff gesperrt" : ""}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="field min-w-[160px]">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(MELDESTATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field min-w-0 flex-1">
          Interne Notiz
          <input value={notiz} maxLength={2000} onChange={(e) => setNotiz(e.target.value)} />
        </label>
        <button type="button" disabled={laeuft} onClick={() => tun(() => meldungSetzen(m.id, status, notiz))} className="min-h-11 rounded-xl bg-brand-ink px-4 text-[13.5px] font-semibold text-white disabled:opacity-60">
          Speichern
        </button>
      </div>
      {darfSperren && m.ziel_user_id && (
        <div className="flex flex-wrap gap-2">
          {m.ziel_treff_gesperrt ? (
            <button type="button" disabled={laeuft} onClick={() => tun(() => nutzerEntsperren(m.ziel_user_id!))} className="min-h-9 rounded-lg border border-brand-line px-3 text-[12.5px] font-semibold">
              Treff-Sperre aufheben
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={laeuft}
                onClick={() => tun(() => nutzerSperren(m.ziel_user_id!, new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), `Meldung: ${GRUND_LABEL[m.grund] ?? m.grund}`))}
                className="min-h-9 rounded-lg border border-brand-red/40 px-3 text-[12.5px] font-semibold text-brand-red"
              >
                7 Tage im Treff sperren
              </button>
              <button
                type="button"
                disabled={laeuft}
                onClick={() => tun(() => nutzerSperren(m.ziel_user_id!, null, `Meldung: ${GRUND_LABEL[m.grund] ?? m.grund}`))}
                className="min-h-9 rounded-lg border border-brand-red/40 px-3 text-[12.5px] font-semibold text-brand-red"
              >
                Unbefristet sperren
              </button>
            </>
          )}
        </div>
      )}
      {meldung && <Meldung ergebnis={meldung} />}
    </li>
  );
}
