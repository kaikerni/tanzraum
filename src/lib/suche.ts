import type { SupabaseClient } from "@supabase/supabase-js";
import { sichtbareNav, type Zugriff } from "@/lib/navigation";
import { getMitgliederListe, getMitgliederVereine } from "@/lib/mitglieder/getMitglieder";

// Globale Suche (Kopfzeile). Jede Quelle laeuft mit den Rechten der Person (RLS bzw. dieselben
// Datenbankfunktionen wie die jeweilige Seite) – gefunden wird nur, was man dort auch sehen darf.

export type SuchTreffer = { id: string; titel: string; zeile: string | null; href: string };
export type SuchGruppe = { art: string; titel: string; treffer: SuchTreffer[]; mehrHref?: string };

const JE_GRUPPE = 8;

function passt(q: string, ...felder: (string | null | undefined)[]): boolean {
  return felder.some((f) => f?.toLocaleLowerCase("de-DE").includes(q));
}

const datum = (d: string | null | undefined) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("de-DE") : null);
const isoTag = (plusTage: number) => new Date(Date.now() + plusTage * 86_400_000).toISOString().slice(0, 10);

// Fehler einer Quelle (z. B. Bereich im Tarif nicht enthalten) blenden nur diese Quelle aus
async function sicher<T>(f: () => PromiseLike<T> | T, ersatz: T): Promise<T> {
  try {
    return await f();
  } catch {
    return ersatz;
  }
}

export async function globaleSuche(supabase: SupabaseClient, eingabe: string, zugriff: Zugriff, istAdmin: boolean): Promise<SuchGruppe[]> {
  const q = eingabe.trim().toLocaleLowerCase("de-DE");
  // Fuer ilike-Filter: Platzhalter und PostgREST-Trennzeichen entschaerfen
  const muster = `%${eingabe.trim().replace(/[%_\\,()*]/g, " ").slice(0, 80)}%`;

  const seiten: SuchGruppe = {
    art: "seiten",
    titel: "Bereiche",
    treffer: sichtbareNav(zugriff)
      .filter((n) => passt(q, n.label, n.kurz))
      .slice(0, JE_GRUPPE)
      .map((n) => ({ id: n.href, titel: n.label, zeile: null, href: n.href })),
  };

  const [mitglieder, termine, dateien, chats, turniere, boerse, news, connect] = await Promise.all([
    // Mitglieder: nur Vereine, deren Mitgliederliste die Person oeffnen darf
    sicher(async () => {
      const vereine = [...(await getMitgliederVereine(supabase))];
      const listen = await Promise.all(vereine.map(async (v) => ({ v, liste: (await getMitgliederListe(supabase, v)) ?? [] })));
      return listen.flatMap(({ v, liste }) =>
        liste
          .filter((m) => passt(q, m.name, m.handle))
          .map((m) => ({ id: m.vmId, titel: m.name, zeile: [m.rolle, m.gruppen.map((g) => g.name).join(", ")].filter(Boolean).join(" · ") || null, href: `/dashboard/mitglieder?verein=${v}` })),
      );
    }, [] as SuchTreffer[]),
    sicher(async () => {
      const { data } = await supabase.rpc("kalender_termine", { p_von: isoTag(-60), p_bis: isoTag(365) });
      return ((data ?? []) as { id: string; titel: string; ort: string | null; beschreibung: string | null; datum: string; verein_name: string | null }[])
        .filter((t) => passt(q, t.titel, t.ort, t.beschreibung))
        .map((t) => ({ id: t.id, titel: t.titel, zeile: [datum(t.datum), t.ort, t.verein_name].filter(Boolean).join(" · "), href: `/dashboard/kalender/termin/${t.id}` }));
    }, [] as SuchTreffer[]),
    sicher(async () => {
      const { data } = await supabase.from("dateien").select("id, name, verein_id, ordner_pfad").ilike("name", muster).order("name").limit(20);
      return ((data ?? []) as { id: string; name: string; verein_id: string | null; ordner_pfad: string | null }[]).map((d) => ({
        id: d.id,
        titel: d.name,
        zeile: [d.verein_id ? "Vereinsdateien" : "Meine Dateien", d.ordner_pfad].filter(Boolean).join(" · "),
        href: d.verein_id ? "/dashboard/dateien" : "/dashboard/dateien?bereich=eigen",
      }));
    }, [] as SuchTreffer[]),
    sicher(async () => {
      const { data } = await supabase.rpc("chat_liste");
      return ((data ?? []) as { id: string; name: string | null; untertitel: string | null }[])
        .filter((c) => passt(q, c.name, c.untertitel))
        .map((c) => ({ id: c.id, titel: c.name ?? "Unterhaltung", zeile: c.untertitel, href: `/dashboard/nachrichten/${c.id}` }));
    }, [] as SuchTreffer[]),
    sicher(async () => {
      const { data } = await supabase.rpc("turniere_uebersicht", { p_von: isoTag(-30), p_bis: isoTag(365) });
      return ((data ?? []) as { id: string; name: string; ort: string | null; ausrichter: string | null; erster_tag: string | null }[])
        .filter((t) => passt(q, t.name, t.ort, t.ausrichter))
        .map((t) => ({ id: t.id, titel: t.name, zeile: [datum(t.erster_tag), t.ort].filter(Boolean).join(" · "), href: `/dashboard/turniere/${t.id}` }));
    }, [] as SuchTreffer[]),
    sicher(async () => {
      const { data } = await supabase.rpc("boerse_suche", { p: { q: eingabe.trim().slice(0, 80), seite: 1, sortierung: "neu" } });
      const angebote = ((data as { angebote?: { id: string; titel: string; ort: string | null; preis_cent: number | null }[] } | null)?.angebote ?? []);
      return angebote.map((a) => ({
        id: a.id,
        titel: a.titel,
        zeile: [a.preis_cent ? (a.preis_cent / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" }) : a.preis_cent === 0 ? "kostenlos" : null, a.ort].filter(Boolean).join(" · ") || null,
        href: `/dashboard/boerse/${a.id}`,
      }));
    }, [] as SuchTreffer[]),
    sicher(async () => {
      const { data } = await supabase.from("news").select("id, titel, erstellt_am").ilike("titel", muster).order("erstellt_am", { ascending: false }).limit(10);
      return ((data ?? []) as { id: string; titel: string; erstellt_am: string }[]).map((n) => ({ id: n.id, titel: n.titel, zeile: datum(n.erstellt_am), href: "/dashboard/news" }));
    }, [] as SuchTreffer[]),
    // TanzRaum Connect (BASIC/VEREIN): Personen und Vereine, die im Netzwerk sichtbar sind
    sicher(async () => {
      if (istAdmin || zugriff.tarif === "free") return [] as SuchTreffer[];
      const [personen, vereine] = await Promise.all(
        (["mitglieder", "vereine"] as const).map((k) => supabase.rpc("netzwerk_suche", { p_suche: eingabe.trim().slice(0, 80), p_kategorie: k, p_ort: "" })),
      );
      return [...((personen.data ?? []) as { art: string; id: string; name: string; zeile1: string | null }[]), ...((vereine.data ?? []) as { art: string; id: string; name: string; zeile1: string | null }[])].map(
        (t) => ({ id: `${t.art}-${t.id}`, titel: t.name, zeile: t.zeile1, href: t.art === "verein" ? `/dashboard/netzwerk/verein/${t.id}` : `/dashboard/netzwerk/person/${t.id}` }),
      );
    }, [] as SuchTreffer[]),
  ]);

  const gruppen: SuchGruppe[] = [
    seiten,
    { art: "mitglieder", titel: "Mitglieder", treffer: mitglieder },
    { art: "termine", titel: "Termine", treffer: termine, mehrHref: "/dashboard/kalender" },
    { art: "nachrichten", titel: "Nachrichten", treffer: chats },
    { art: "dateien", titel: "Dateien", treffer: dateien, mehrHref: "/dashboard/dateien" },
    { art: "news", titel: "News", treffer: news, mehrHref: "/dashboard/news" },
    { art: "turniere", titel: "Turniere", treffer: turniere, mehrHref: "/dashboard/turniere" },
    { art: "boerse", titel: "TanzRaum Börse", treffer: boerse, mehrHref: `/dashboard/boerse?q=${encodeURIComponent(eingabe.trim())}` },
    { art: "connect", titel: "TanzRaum Connect", treffer: connect, mehrHref: "/dashboard/netzwerk" },
  ];
  if (istAdmin) {
    gruppen.push({
      art: "benutzer",
      titel: "Benutzerkonten",
      treffer: [{ id: "benutzer", titel: `„${eingabe.trim()}“ in den Benutzerkonten suchen`, zeile: "Administration", href: `/dashboard/admin/benutzer?q=${encodeURIComponent(eingabe.trim())}` }],
    });
  }
  return gruppen.filter((g) => g.treffer.length > 0).map((g) => ({ ...g, treffer: g.treffer.slice(0, JE_GRUPPE) }));
}
