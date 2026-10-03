import Link from "next/link";
import { redirect } from "next/navigation";
import { History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { rechtLabel } from "@/lib/team/rechte";

export const metadata = { title: "Protokoll – TanzRaum-Administration" };

const AKTION: Record<string, string> = {
  team_hinzugefuegt: "Teammitglied hinzugefügt",
  team_entfernt: "Teammitglied entfernt",
  recht_vergeben: "Recht vergeben",
  recht_entfernt: "Recht entfernt",
  moderator_aktiviert: "Moderator aktiviert",
  moderator_deaktiviert: "Moderator deaktiviert",
  team_basic_freigeschaltet: "Team-BASIC freigeschaltet",
  team_basic_verlaengert: "Team-BASIC geändert",
  team_basic_beendet: "Team-BASIC beendet",
  nutzer_freigeschaltet: "Nutzer kostenlos/manuell freigeschaltet",
  freischaltung_beendet: "Freischaltung deaktiviert",
  lizenz_verlaengert: "Lizenz verlängert",
  tarif_geaendert: "Lizenz geändert",
  navigation_geaendert: "Navigation geändert",
  speicher_geaendert: "Speicherlimit geändert",
  nutzer_gesperrt: "Nutzer gesperrt",
  nutzer_entsperrt: "Nutzer entsperrt",
  meldung_bearbeitet: "Meldung bearbeitet",
  workshop_freigegeben: "Workshop freigegeben",
  workshop_abgelehnt: "Workshop abgelehnt",
  workshop_archiviert: "Workshop archiviert",
  workshop_bearbeitet: "Workshop bearbeitet",
  workshop_geloescht: "Workshop gelöscht",
  treff_thema_geloescht: "Thema gelöscht",
  treff_thema_bearbeitet: "Thema bearbeitet",
  treff_beitrag_geloescht: "Beitrag gelöscht",
  treff_beitrag_bearbeitet: "Beitrag bearbeitet",
  treff_thema_schliessen: "Thema geschlossen",
  treff_thema_oeffnen: "Thema geöffnet",
  treff_thema_anpinnen: "Thema angepinnt",
  treff_thema_entpinnen: "Thema entpinnt",
  treff_thema_verschieben: "Thema verschoben",
  treff_nutzer_gesperrt: "Nutzer im Treff gesperrt",
  treff_nutzer_entsperrt: "Treff-Sperre aufgehoben",
  treff_nutzer_entfernt: "Nutzer aus dem Treff entfernt",
  treff_kategorie_gespeichert: "Treff-Kategorie gespeichert",
  treff_kategorie_geloescht: "Treff-Kategorie gelöscht",
  wissen_erstellt: "Wissensbeitrag erstellt",
  wissen_bearbeitet: "Wissensbeitrag bearbeitet",
  wissen_veroeffentlicht: "Wissensbeitrag veröffentlicht",
  wissen_zurueckgezogen: "Wissensbeitrag zurückgezogen",
  wissen_geloescht: "Wissensbeitrag gelöscht",
};

function detailText(aktion: string, d: Record<string, unknown>): string {
  const teile: string[] = [];
  if (Array.isArray(d.rechte) && d.rechte.length) teile.push((d.rechte as string[]).map(rechtLabel).join(", "));
  if (d.alle_rechte === true) teile.push("alle Team-Bereiche");
  if (typeof d.titel === "string") teile.push(`„${d.titel}“`);
  if (aktion === "speicher_geaendert" && typeof d.bereich === "string") {
    const mbT = (x: unknown) => (typeof x === "number" ? `${x.toLocaleString("de-DE")} MB` : "–");
    teile.push(`${d.bereich}: ${mbT(d.alt_mb)} → ${mbT(d.neu_mb)}`);
    if (typeof d.alt_aktiv === "boolean" && d.alt_aktiv !== d.neu_aktiv) teile.push(d.neu_aktiv ? "Uploads wieder erlaubt" : "Uploads gesperrt");
  }
  if (typeof d.zugang === "string") teile.push(`${String(d.zugang).toUpperCase()}${d.art ? ` (${d.art})` : ""}${d.bis ? ` bis ${d.bis}` : ""}`);
  if (typeof d.lizenzart === "string") teile.push(String(d.lizenzart));
  if (aktion.startsWith("treff_meldung_")) teile.push(aktion.replace("treff_meldung_", "Status: "));
  if (typeof d.grund === "string" && d.grund) teile.push(`Grund: ${d.grund}`);
  if (typeof d.notiz === "string" && d.notiz) teile.push(`Notiz: ${d.notiz}`);
  return teile.join(" · ");
}

// Audit-Protokoll: wer hat was wann getan (nur TanzRaum-Admin)
export default async function ProtokollSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) redirect("/dashboard");
  const { data } = await supabase.rpc("admin_protokoll_liste", { p_limit: 300 });
  const eintraege = (data ?? []) as { id: string; akteur: string; aktion: string; ziel: string | null; details: Record<string, unknown>; erstellt_am: string }[];

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <Link href="/dashboard/admin" className="text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        ← Administration
      </Link>
      <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
        <History size={24} className="text-brand-red" /> Protokoll
      </h1>
      <p className="text-[13.5px] text-brand-ink-soft">Administrative Aktionen des TanzRaum-Admins und des TanzRaum Teams – wer, was, wann.</p>
      <section className={KARTE}>
        {eintraege.length === 0 ? (
          <p className="text-[13.5px] text-brand-ink-soft">Noch keine Einträge.</p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {eintraege.map((e) => (
              <li key={e.id} className="flex flex-col gap-0.5 py-2.5 text-[13.5px] sm:flex-row sm:gap-3">
                <span className="shrink-0 text-[12.5px] text-brand-ink-soft sm:w-[130px]">
                  {new Date(e.erstellt_am).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="text-brand-ink">{AKTION[e.aktion] ?? e.aktion.replace(/_/g, " ")}</strong>
                  {e.ziel && <span className="text-brand-ink"> · {e.ziel}</span>}
                  <span className="block text-[12.5px] text-brand-ink-soft">
                    von {e.akteur}
                    {detailText(e.aktion, e.details ?? {}) ? ` · ${detailText(e.aktion, e.details ?? {})}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
