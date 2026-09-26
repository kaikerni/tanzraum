"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileUp, Printer, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SendenButton, Meldung, LEERES_ERGEBNIS, type AktionsErgebnis } from "@/components/ui/SendenButton";
import {
  bestellungVorbereiten,
  bestellungStatus,
  ausBestellungEntfernen,
  dokumentRegistrieren,
  dokumentLoeschen,
} from "@/app/dashboard/vereinsverwaltung/ehrungen/actions";
import { HINWEIS_BESTELLUNG, TYP, datum, type Vorgang } from "@/lib/ehrungen/typen";

const KNOPF_KLEIN =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-brand-line bg-white px-3 text-[13px] font-semibold text-brand-ink hover:bg-brand-bg disabled:opacity-60";

// ---------------------------------------------------------------------------------------------
export function BestellAuswahl({ vereinId, vorgaenge }: { vereinId: string; vorgaenge: Vorgang[] }) {
  const [ergebnis, aktion] = useActionState(bestellungVorbereiten, LEERES_ERGEBNIS);
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set(vorgaenge.map((v) => v.id)));
  const umschalten = (id: string) =>
    setGewaehlt((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  if (vorgaenge.length === 0) {
    return <p className="text-[13.5px] text-brand-ink-soft">Keine vorgemerkten Ehrungen, die bestellt werden müssen.</p>;
  }
  return (
    <form action={aktion} className="flex flex-col gap-3">
      <input type="hidden" name="verein_id" value={vereinId} />
      <ul className="divide-y divide-brand-line overflow-hidden rounded-xl border border-brand-line">
        {vorgaenge.map((v) => (
          <li key={v.id}>
            <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-brand-bg">
              <input
                type="checkbox"
                name="vorgang"
                value={v.id}
                checked={gewaehlt.has(v.id)}
                onChange={() => umschalten(v.id)}
                className="mt-1 h-4 w-4 accent-brand-red"
              />
              <span className="min-w-0 text-[13.5px]">
                <span className="font-semibold text-brand-ink">{v.personName}</span>
                <span className="text-brand-ink"> – {v.auszeichnung}</span>
                <span className="block text-[12px] text-brand-ink-soft">
                  {TYP[v.typ].zeichen} {v.organisation ?? TYP[v.typ].kurz} · Grund: {v.grundlageText ?? "laut Berechnung"} · gewünscht{" "}
                  {datum(v.wunschDatum ?? v.faelligAm)}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <label className="field">
        <span>Bezeichnung der Bestellung</span>
        <input name="bezeichnung" placeholder="z. B. Orden Kampagne 2027" />
      </label>
      <Meldung ergebnis={ergebnis} />
      <SendenButton>📦 {gewaehlt.size} Ehrung{gewaehlt.size === 1 ? "" : "en"} für Bestellung vorbereiten</SendenButton>
    </form>
  );
}

// ---------------------------------------------------------------------------------------------
export function BestellungAktionen({ bestellungId, status }: { bestellungId: string; status: string }) {
  const [ergebnis, aktion] = useActionState(bestellungStatus, LEERES_ERGEBNIS);
  if (status === "vorbereitet") {
    return (
      <div className="flex flex-col gap-4">
        <form action={aktion} className="auth-form">
          <input type="hidden" name="id" value={bestellungId} />
          <input type="hidden" name="status" value="bestellt" />
          <div className="flex flex-col gap-2 rounded-xl border border-brand-amber/50 bg-brand-amber-wash p-3 text-[13px] text-brand-ink">
            <p className="flex gap-2">
              <AlertTriangle size={17} className="mt-0.5 shrink-0 text-[#8a5a00]" />
              {HINWEIS_BESTELLUNG}
            </p>
            <label className="flex items-start gap-2 font-semibold">
              <input type="checkbox" name="geprueft" value="ja" required className="mt-0.5 h-4 w-4 accent-brand-red" />
              Ich habe die Angaben geprüft und möchte die Ehrungen bestellen.
            </label>
          </div>
          <div className="field-row flex-wrap">
            <label className="field">
              <span>Bestelldatum</span>
              <input type="date" name="datum" />
            </label>
            <label className="field">
              <span>Bestellnummer</span>
              <input name="bestellnummer" />
            </label>
            <label className="field">
              <span>Anbieter / Verband</span>
              <input name="anbieter" />
            </label>
          </div>
          <Meldung ergebnis={ergebnis} />
          <SendenButton>🟠 Als bestellt markieren</SendenButton>
        </form>
        <Stornieren bestellungId={bestellungId} />
      </div>
    );
  }
  if (status === "bestellt") {
    return (
      <div className="flex flex-col gap-4">
        <form action={aktion} className="auth-form">
          <input type="hidden" name="id" value={bestellungId} />
          <input type="hidden" name="status" value="erhalten" />
          <label className="field sm:max-w-[240px]">
            <span>Erhalten am</span>
            <input type="date" name="datum" />
          </label>
          <Meldung ergebnis={ergebnis} />
          <SendenButton>📦 Als erhalten markieren</SendenButton>
        </form>
        <Stornieren bestellungId={bestellungId} />
      </div>
    );
  }
  return null;
}

function Stornieren({ bestellungId }: { bestellungId: string }) {
  const [ergebnis, aktion] = useActionState(bestellungStatus, LEERES_ERGEBNIS);
  return (
    <form
      action={aktion}
      onSubmit={(e) => {
        if (!confirm("Bestellung stornieren? Die Ehrungen werden wieder auf „vorgemerkt“ gesetzt.")) e.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="id" value={bestellungId} />
      <input type="hidden" name="status" value="storniert" />
      <Meldung ergebnis={ergebnis} />
      <SendenButton variante="gefahr" laedtText="Wird storniert …">
        Bestellung stornieren
      </SendenButton>
    </form>
  );
}

export function AusBestellungEntfernen({ vorgangId }: { vorgangId: string }) {
  const [laeuft, starten] = useTransition();
  const [ergebnis, setErgebnis] = useState<AktionsErgebnis>(LEERES_ERGEBNIS);
  const router = useRouter();
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        aria-label="Aus Bestellung entfernen"
        disabled={laeuft}
        onClick={() =>
          starten(async () => {
            const e = await ausBestellungEntfernen(vorgangId);
            setErgebnis(e);
            if (!e.error) router.refresh();
          })
        }
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-ink-soft hover:bg-brand-red-wash hover:text-brand-red"
      >
        <X size={15} />
      </button>
      {ergebnis.error && <span className="text-[11px] text-brand-red">{ergebnis.error}</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
const ERLAUBT = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export function DokumentUpload({ vereinId, vorgangId }: { vereinId: string; vorgangId: string }) {
  const eingabe = useRef<HTMLInputElement>(null);
  const [art, setArt] = useState("urkunde");
  const [status, setStatus] = useState<{ fehler?: string; ok?: string; laedt?: boolean }>({});
  const router = useRouter();

  async function hochladen(datei: File) {
    if (!ERLAUBT.includes(datei.type)) {
      setStatus({ fehler: "Bitte eine PDF-Datei oder ein Bild (JPG, PNG, WebP) wählen." });
      return;
    }
    if (datei.size > 10 * 1024 * 1024) {
      setStatus({ fehler: "Die Datei darf höchstens 10 MB groß sein." });
      return;
    }
    setStatus({ laedt: true });
    const supabase = createClient();
    const endung = (datei.name.split(".").pop() ?? "pdf").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "pdf";
    const pfad = `${vereinId}/${vorgangId}/${crypto.randomUUID()}.${endung}`;
    const { error } = await supabase.storage.from("ehrungs-dokumente").upload(pfad, datei, { contentType: datei.type, upsert: false });
    if (error) {
      setStatus({ fehler: "Hochladen fehlgeschlagen – nur Vereinsadmins können Dokumente zu Ehrungen ablegen." });
      return;
    }
    const e = await dokumentRegistrieren({ vereinId, vorgangId, art, name: datei.name, pfad, mime: datei.type, groesse: datei.size });
    setStatus(e.error ? { fehler: e.error } : { ok: "Dokument gespeichert." });
    if (!e.error) router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select value={art} onChange={(e) => setArt(e.target.value)} aria-label="Dokumentart" className="min-h-10 rounded-xl border border-brand-line bg-white px-3 text-[13px]">
          <option value="urkunde">Urkunde</option>
          <option value="foto">Foto</option>
          <option value="dokument">Sonstiges Dokument</option>
        </select>
        <input
          ref={eingabe}
          type="file"
          accept={ERLAUBT.join(",")}
          className="hidden"
          onChange={(e) => {
            const d = e.target.files?.[0];
            if (d) hochladen(d);
            e.target.value = "";
          }}
        />
        <button type="button" onClick={() => eingabe.current?.click()} disabled={status.laedt} className={KNOPF_KLEIN}>
          <FileUp size={15} /> {status.laedt ? "Wird hochgeladen …" : "Datei hochladen"}
        </button>
      </div>
      <p className="text-[12px] text-brand-ink-faint">PDF, JPG, PNG oder WebP bis 10 MB. Nur für Vereinsadmins sichtbar.</p>
      {status.fehler && <p className="form-error">{status.fehler}</p>}
      {status.ok && <p className="text-[12.5px] text-brand-green">{status.ok}</p>}
    </div>
  );
}

export function DokumentLoeschen({ dokumentId }: { dokumentId: string }) {
  const [laeuft, starten] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Dokument löschen"
      disabled={laeuft}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-ink-soft hover:bg-brand-red-wash hover:text-brand-red"
      onClick={() => {
        if (!confirm("Dokument löschen?")) return;
        starten(async () => {
          await dokumentLoeschen(dokumentId);
          router.refresh();
        });
      }}
    >
      <Trash2 size={14} />
    </button>
  );
}

// ---------------------------------------------------------------------------------------------
export function DruckKnopf() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="druck-aus inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-red px-4 text-[13.5px] font-semibold text-white hover:bg-brand-red-deep"
    >
      <Printer size={16} /> Drucken / als PDF speichern
    </button>
  );
}
