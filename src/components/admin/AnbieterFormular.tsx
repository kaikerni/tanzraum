"use client";

import { useActionState } from "react";
import { anbieterSpeichern } from "@/app/dashboard/admin/anbieter/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";

export type AnbieterDaten = {
  name: string;
  unternehmen: string | null;
  strasse: string;
  plz: string;
  ort: string;
  land: string;
  telefon: string | null;
  email: string;
  verantwortlich_inhalt: string | null;
  kleinunternehmer: boolean;
  kleinunternehmer_hinweis: string;
  ust_id: string | null;
  steuernummer: string | null;
  bank_inhaber: string | null;
  iban: string | null;
  bic: string | null;
  bank_name: string | null;
};

export function AnbieterFormular({ a }: { a: AnbieterDaten }) {
  const [ergebnis, aktion] = useActionState(anbieterSpeichern, LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span>Name (Betreiber)</span>
          <input name="name" defaultValue={a.name} required maxLength={200} />
        </label>
        <label className="field">
          <span>Unternehmen / Projektträger (optional)</span>
          <input name="unternehmen" defaultValue={a.unternehmen ?? ""} maxLength={200} />
        </label>
        <label className="field sm:col-span-2">
          <span>Straße und Hausnummer</span>
          <input name="strasse" defaultValue={a.strasse} required maxLength={200} />
        </label>
        <label className="field">
          <span>PLZ</span>
          <input name="plz" defaultValue={a.plz} required maxLength={10} />
        </label>
        <label className="field">
          <span>Ort</span>
          <input name="ort" defaultValue={a.ort} required maxLength={200} />
        </label>
        <label className="field">
          <span>Land</span>
          <input name="land" defaultValue={a.land} maxLength={60} />
        </label>
        <label className="field">
          <span>Telefon (optional)</span>
          <input name="telefon" defaultValue={a.telefon ?? ""} maxLength={40} />
        </label>
        <label className="field sm:col-span-2">
          <span>E-Mail (Kontakt, Support, Datenschutz)</span>
          <input name="email" type="email" defaultValue={a.email} required maxLength={200} />
        </label>
        <label className="field sm:col-span-2">
          <span>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV (optional)</span>
          <input name="verantwortlich_inhalt" defaultValue={a.verantwortlich_inhalt ?? ""} maxLength={300} />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2 rounded-xl border border-brand-line p-3">
        <legend className="px-1 text-[12px] font-semibold uppercase tracking-wide text-brand-ink-soft">Steuer & Rechnungen</legend>
        <label className="flex items-center gap-2 text-[14px]">
          <input type="checkbox" name="kleinunternehmer" defaultChecked={a.kleinunternehmer} /> Kleinunternehmer (§ 19 UStG)
        </label>
        <label className="field">
          <span>Hinweis auf Rechnungen und in den Preisangaben (bei Kleinunternehmer)</span>
          <textarea name="kleinunternehmer_hinweis" defaultValue={a.kleinunternehmer_hinweis} rows={2} maxLength={500} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field">
            <span>USt-IdNr. (optional, öffentlich im Impressum)</span>
            <input name="ust_id" defaultValue={a.ust_id ?? ""} maxLength={30} />
          </label>
          <label className="field">
            <span>Steuernummer (nur auf Rechnungen, nicht öffentlich)</span>
            <input name="steuernummer" defaultValue={a.steuernummer ?? ""} maxLength={30} />
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2 rounded-xl border border-brand-line p-3">
        <legend className="px-1 text-[12px] font-semibold uppercase tracking-wide text-brand-ink-soft">Bankverbindung (Vereinslizenz per Überweisung)</legend>
        <p className="text-[12.5px] text-brand-ink-soft">
          Erscheint nur auf Zahlungsaufforderungen und bei Vereinsadmins mit offener Überweisung – nicht öffentlich. Ohne IBAN und
          Kontoinhaber wird die Zahlart „Überweisung“ nicht angeboten.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field">
            <span>Kontoinhaber</span>
            <input name="bank_inhaber" defaultValue={a.bank_inhaber ?? ""} maxLength={120} autoComplete="off" />
          </label>
          <label className="field">
            <span>Bank (optional)</span>
            <input name="bank_name" defaultValue={a.bank_name ?? ""} maxLength={120} autoComplete="off" />
          </label>
          <label className="field">
            <span>IBAN</span>
            <input name="iban" defaultValue={a.iban ?? ""} maxLength={42} autoComplete="off" spellCheck={false} />
          </label>
          <label className="field">
            <span>BIC (optional)</span>
            <input name="bic" defaultValue={a.bic ?? ""} maxLength={11} autoComplete="off" spellCheck={false} />
          </label>
        </div>
      </fieldset>

      <Meldung ergebnis={ergebnis} />
      <SendenButton>Speichern</SendenButton>
    </form>
  );
}
