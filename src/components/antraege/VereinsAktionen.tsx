"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Printer, Upload, X } from "lucide-react";
import { antragEntscheiden, freigabeEntscheiden, papierVermerken, personHinzufuegen } from "@/app/dashboard/mitgliedsantraege/actions";
import { createClient } from "@/lib/supabase/client";
import { speicherVorpruefung } from "@/lib/speicher";
import { LEERES_ERGEBNIS, Meldung, SendenButton, type AktionsErgebnis } from "@/components/ui/SendenButton";

const EINGABE = "w-full rounded-lg border border-brand-line bg-white px-3 py-2.5 text-[13.5px] text-brand-ink outline-none focus:border-brand-red";

// Person mit TanzRaum-Konto hinzufuegen (E-Mail oder @Handle)
export function PersonHinzufuegen({
  vereinId,
  rollen,
  gruppen,
}: {
  vereinId: string;
  rollen: { id: string; name: string }[];
  gruppen: { id: string; name: string }[];
}) {
  const [ergebnis, aktion] = useActionState(personHinzufuegen, LEERES_ERGEBNIS);
  const mitgliedRolle = rollen.find((r) => /^tänzer/i.test(r.name))?.id ?? "";
  return (
    <form action={aktion} className="flex flex-col gap-3">
      <input type="hidden" name="verein_id" value={vereinId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
        <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-brand-ink-soft">
          E-Mail-Adresse oder @Handle
          <input name="suche" required maxLength={200} placeholder="name@beispiel.de oder @handle" className={EINGABE} autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-brand-ink-soft">
          Rolle
          <select name="rolle_id" defaultValue={mitgliedRolle} className={EINGABE}>
            {rollen.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-brand-ink-soft">
          Gruppe (optional)
          <select name="gruppe_id" defaultValue="" className={EINGABE}>
            <option value="">–</option>
            {gruppen.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Meldung ergebnis={ergebnis} />
      <div>
        <SendenButton laedtText="Wird hinzugefügt …">Person hinzufügen</SendenButton>
      </div>
    </form>
  );
}

export function FreigabeKnoepfe({ anfrageId }: { anfrageId: string }) {
  const [ergebnis, setErgebnis] = useState<AktionsErgebnis>(LEERES_ERGEBNIS);
  const [laeuft, starten] = useTransition();
  const router = useRouter();
  const los = (freigeben: boolean) =>
    starten(async () => {
      if (freigeben && !confirm("Person freigeben? Sie wird aus eurem Verein entfernt und dem anfragenden Verein zugeordnet.")) return;
      const r = await freigabeEntscheiden(anfrageId, freigeben);
      setErgebnis(r);
      router.refresh();
    });
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        <button type="button" disabled={laeuft} onClick={() => los(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-red px-3 text-[12.5px] font-semibold text-white disabled:opacity-60">
          <Check size={14} /> Freigeben
        </button>
        <button type="button" disabled={laeuft} onClick={() => los(false)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-line bg-white px-3 text-[12.5px] font-semibold text-brand-ink disabled:opacity-60">
          <X size={14} /> Ablehnen
        </button>
      </div>
      <Meldung ergebnis={ergebnis} />
    </div>
  );
}

export function EntscheidungKnoepfe({ antragId, name }: { antragId: string; name: string }) {
  const [ergebnis, setErgebnis] = useState<AktionsErgebnis>(LEERES_ERGEBNIS);
  const [grund, setGrund] = useState("");
  const [ablehnen, setAblehnen] = useState(false);
  const [laeuft, starten] = useTransition();
  const router = useRouter();
  const los = (annehmen: boolean) =>
    starten(async () => {
      if (annehmen && !confirm(`${name} als Mitglied aufnehmen?`)) return;
      const r = await antragEntscheiden(antragId, annehmen, annehmen ? "" : grund);
      setErgebnis(r);
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={laeuft} onClick={() => los(true)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-green px-4 text-[13.5px] font-semibold text-white disabled:opacity-60">
          <Check size={16} /> Annehmen
        </button>
        <button type="button" disabled={laeuft} onClick={() => setAblehnen(!ablehnen)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-red/40 bg-white px-4 text-[13.5px] font-semibold text-brand-red disabled:opacity-60">
          <X size={16} /> Ablehnen …
        </button>
      </div>
      {ablehnen && (
        <div className="flex flex-col gap-2 rounded-xl bg-brand-bg p-3">
          <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-brand-ink-soft">
            Grund (optional, nur intern)
            <textarea value={grund} onChange={(e) => setGrund(e.target.value.slice(0, 1000))} rows={2} className={EINGABE} />
          </label>
          <button type="button" disabled={laeuft} onClick={() => los(false)} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-xl bg-brand-red px-4 text-[13.5px] font-semibold text-white disabled:opacity-60">
            Antrag ablehnen
          </button>
          <p className="text-[12px] text-brand-ink-soft">Die Person wird aus dem Verein entfernt; der Antrag bleibt als abgelehnt dokumentiert.</p>
        </div>
      )}
      <Meldung ergebnis={ergebnis} />
    </div>
  );
}

export function DruckKnopf({ href, text = "Drucken / PDF" }: { href: string; text?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-line bg-white px-4 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg"
    >
      <Printer size={16} /> {text}
    </a>
  );
}

// Unterschriebenen Antrag (Scan/Foto/PDF) hochladen – Ablage im privaten Speicher des Antrags
export function PapierHochladen({ antragId, vereinId, text = "Unterschriebenen Antrag hochladen" }: { antragId: string; vereinId: string; text?: string }) {
  const [status, setStatus] = useState<AktionsErgebnis & { laedt?: boolean }>(LEERES_ERGEBNIS);
  const router = useRouter();
  async function hochladen(datei: File) {
    if (!["application/pdf", "image/jpeg", "image/png"].includes(datei.type)) {
      setStatus({ error: "Bitte ein PDF, JPG oder PNG wählen." });
      return;
    }
    if (datei.size > 10 * 1024 * 1024) {
      setStatus({ error: "Die Datei darf höchstens 10 MB groß sein." });
      return;
    }
    setStatus({ error: null, laedt: true });
    const endung = datei.type === "application/pdf" ? "pdf" : datei.type === "image/png" ? "png" : "jpg";
    const pfad = `${vereinId}/${antragId}/papier-${Date.now()}.${endung}`;
    const speicher = await speicherVorpruefung(createClient(), "mitgliedsantraege", pfad, datei.size);
    if (speicher) {
      setStatus({ error: speicher });
      return;
    }
    const { error } = await createClient().storage.from("mitgliedsantraege").upload(pfad, datei, { contentType: datei.type, upsert: false });
    if (error) {
      setStatus({ error: "Hochladen fehlgeschlagen." });
      return;
    }
    setStatus(await papierVermerken(antragId, pfad));
    router.refresh();
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label className="inline-flex min-h-10 w-fit cursor-pointer items-center gap-2 rounded-xl border border-brand-line bg-white px-4 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg">
        <Upload size={16} /> {status.laedt ? "Wird hochgeladen …" : text}
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          className="hidden"
          disabled={status.laedt}
          onChange={(e) => {
            const d = e.target.files?.[0];
            if (d) hochladen(d);
            e.target.value = "";
          }}
        />
      </label>
      <Meldung ergebnis={status} />
    </div>
  );
}
