// Was Kai sich merkt – nur auf diesem Geraet (localStorage), keine Datenbank.
// Spaeter kann der Zustand ohne Aenderung der Komponenten in ein Konto-Feld wandern (nur lesen/schreiben hier tauschen).

export type KaiSpeicher = {
  version: 1;
  // Begruessung/Einrichtung einmal angeboten
  begruesst: boolean;
  // Einrichtung: Schritt-ID -> erledigt/uebersprungen
  schritte: Record<string, "erledigt" | "uebersprungen">;
  // gelesene Neuigkeiten
  gelesen: string[];
  // ausgeblendete Hinweise (dismissKey der Sprechblasen)
  ausgeblendet: string[];
};

const SCHLUESSEL = "tr_kai";
const LEER: KaiSpeicher = { version: 1, begruesst: false, schritte: {}, gelesen: [], ausgeblendet: [] };

export function kaiLesen(): KaiSpeicher {
  try {
    const roh = window.localStorage.getItem(SCHLUESSEL);
    if (!roh) return { ...LEER };
    const d = JSON.parse(roh) as Partial<KaiSpeicher>;
    return {
      version: 1,
      begruesst: d.begruesst === true,
      schritte: d.schritte && typeof d.schritte === "object" ? d.schritte : {},
      gelesen: Array.isArray(d.gelesen) ? d.gelesen : [],
      ausgeblendet: Array.isArray(d.ausgeblendet) ? d.ausgeblendet : [],
    };
  } catch {
    return { ...LEER };
  }
}

export function kaiSchreiben(aenderung: (s: KaiSpeicher) => KaiSpeicher): KaiSpeicher {
  const neu = aenderung(kaiLesen());
  try {
    window.localStorage.setItem(SCHLUESSEL, JSON.stringify(neu));
  } catch {
    /* ohne Speicher (z. B. privates Fenster): gilt nur fuer diesen Seitenaufruf */
  }
  return neu;
}
