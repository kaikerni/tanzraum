import { DruckKnopf } from "./EhrungenAblauf";

export function DruckKopf({ verein, titel, untertitel }: { verein: string; titel: string; untertitel?: string }) {
  const heute = new Date().toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
  return (
    <header className="mb-5 flex items-start justify-between gap-4 border-b-2 border-brand-red pb-3">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-brand-ink-soft">{verein} · Ehrungen & Orden</p>
        <h1 className="text-[22px] font-extrabold">{titel}</h1>
        {untertitel && <p className="text-[12.5px] text-brand-ink-soft">{untertitel}</p>}
        <p className="text-[11.5px] text-brand-ink-faint">Erstellt am {heute} mit TanzRaum · intern – nur für die Vereinsverwaltung</p>
      </div>
      <DruckKnopf />
    </header>
  );
}

export function DruckFuss() {
  return (
    <p className="mt-6 border-t border-brand-line pt-2 text-[10.5px] text-brand-ink-soft">
      Hinweis: Die Angaben basieren auf den in TanzRaum hinterlegten Kriterien und teilweise auf einer ungeprüften Arbeitsgrundlage. Vor einer Bestellung bzw.
      Beantragung sind die aktuell gültigen Voraussetzungen des zuständigen Verbandes zu prüfen. Mögliche Ehrungen begründen keinen Anspruch.
    </p>
  );
}
