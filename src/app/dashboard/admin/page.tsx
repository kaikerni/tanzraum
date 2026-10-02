import Link from "next/link";
import { redirect } from "next/navigation";
import { Flag, ShieldCheck, CreditCard, Medal, Building2, Receipt, Megaphone, BarChart3, LifeBuoy, Eye, Store, Users, Sparkles, KeyRound, Shield, GraduationCap, MessageSquareText, ListOrdered, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { versionText } from "@/lib/version";
import { KARTE } from "@/components/dashboard/Karten";
import { DashboardStatus } from "@/components/dashboard/DashboardStatus";
import { SpotlightSchalter } from "@/components/admin/SpotlightSchalter";
import { MusikSchalter } from "@/components/admin/MusikSchalter";
import { JuryraumSchalter } from "@/components/admin/JuryraumSchalter";

export const metadata = { title: "TanzRaum-Administration" };

export default async function AdminSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) redirect("/dashboard");
  const { data: offen } = await supabase.rpc("meldungen_admin", { p_status: "offen" });
  const anzahl = ((offen ?? []) as unknown[]).length;
  const { data: fernwartungen } = await supabase.rpc("admin_fernwartungen");
  const aktiveFernwartungen = ((fernwartungen ?? []) as { aktiv: boolean }[]).filter((f) => f.aktiv).length;
  const { data: boerse } = await supabase.rpc("admin_boerse_meldungen");
  const boerseMeldungen = Number((boerse as { zahlen?: { offene_meldungen?: number } } | null)?.zahlen?.offene_meldungen ?? 0);
  const { data: spotlightEinstellung } = await supabase.from("plattform_einstellungen").select("spotlights_aktiv, spotlights_tarife, musik_aktiv, juryraum_aktiv").eq("id", true).maybeSingle();
  const { data: laufend } = await supabase.rpc("admin_benutzer_suche", { p_q: "" });
  const [{ data: pruefen }, { data: treffMeldungen }] = await Promise.all([supabase.rpc("workshops_pruefen"), supabase.rpc("treff_meldungen", { p_status: "offen" })]);
  const workshopsOffen = ((pruefen ?? []) as { status: string }[]).filter((w) => w.status === "eingereicht").length;
  const treffOffen = ((treffMeldungen ?? []) as unknown[]).length;
  const loeschungen = ((laufend ?? []) as unknown[]).length;
  const kacheln = [
    { href: "/dashboard/admin/statistik", icon: BarChart3, farbe: "bg-brand-blue-wash text-brand-blue", titel: "Plattform-Statistik", text: "Nutzer, Tarife, Vereine, Aktivität – nur zusammengefasste Zahlen" },
    { href: "/dashboard/admin/vereine", icon: Building2, farbe: "bg-brand-gold-wash text-brand-gold", titel: "Vereine", text: "Vereinskarten mit Lizenzstatus, Mitgliederzahl, Gruppen und Online-Zahl" },
    {
      href: "/dashboard/admin/fernwartung",
      icon: LifeBuoy,
      farbe: "bg-brand-red-wash text-brand-red",
      titel: "Fernwartung",
      text: "Support-Anfragen der Vereine – nur mit Freigabe, protokolliert",
      marke: aktiveFernwartungen > 0 ? `${aktiveFernwartungen} aktiv` : null,
    },
    {
      href: "/dashboard/admin/boerse",
      icon: Store,
      farbe: "bg-brand-gold-wash text-brand-gold",
      titel: "TanzRaum Börse",
      text: "Moderation: gemeldete Angebote, Deaktivieren, Einschränkungen",
      marke: boerseMeldungen > 0 ? `${boerseMeldungen} gemeldet` : null,
    },
    {
      href: "/dashboard/admin/benutzer",
      icon: Users,
      farbe: "bg-brand-red-wash text-brand-red",
      titel: "Benutzer",
      text: "Konten suchen und löschen – in 14 Tagen oder sofort, mit Protokoll",
      marke: loeschungen > 0 ? `${loeschungen} Löschung${loeschungen === 1 ? "" : "en"}` : null,
    },
    { href: "/dashboard/admin/vorschau", icon: Eye, farbe: "bg-brand-purple-wash text-brand-purple", titel: "Ansicht als …", text: "TanzRaum als FREE, BASIC oder VEREIN (Vereinsadmin, Trainer, Betreuer, Tänzer, Eltern) ansehen" },
    { href: "/dashboard/admin/lizenzen", icon: KeyRound, farbe: "bg-brand-green-wash text-brand-green", titel: "Nutzer freischalten", text: "Kostenlos oder regulär freischalten, verlängern, deaktivieren – mit Lizenzübersicht" },
    { href: "/dashboard/admin/team", icon: Shield, farbe: "bg-brand-blue-wash text-brand-blue", titel: "TanzRaum Team", text: "Teammitglieder, Moderatoren und ihre einzeln vergebenen Rechte" },
    {
      href: "/dashboard/workshops/pruefen",
      icon: GraduationCap,
      farbe: "bg-brand-gold-wash text-brand-gold",
      titel: "Workshops prüfen",
      text: "Eingereichte Workshops freigeben oder ablehnen",
      marke: workshopsOffen > 0 ? `${workshopsOffen} eingereicht` : null,
    },
    {
      href: "/dashboard/treff/meldungen",
      icon: MessageSquareText,
      farbe: "bg-brand-red-wash text-brand-red",
      titel: "TanzRaum Treff – Moderation",
      text: "Gemeldete Themen, Beiträge und Nutzer · Kategorien · Wissensbeiträge",
      marke: treffOffen > 0 ? `${treffOffen} offen` : null,
    },
    { href: "/dashboard/admin/navigation", icon: ListOrdered, farbe: "bg-brand-blue-wash text-brand-blue", titel: "Navigation & Bereiche", text: "Welche Bereiche FREE, BASIC und VEREIN im Menü sehen (nur Anzeige)" },
    { href: "/dashboard/admin/protokoll", icon: History, farbe: "bg-brand-bg text-brand-ink", titel: "Protokoll", text: "Wer hat was wann geändert – Team, Freischaltungen, Moderation" },
  ];

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
        <ShieldCheck size={24} className="text-brand-red" /> TanzRaum-Administration
      </h1>
      <DashboardStatus className={`${KARTE} !py-3`} />
      <section className={KARTE} aria-label="Spotlights">
        <SpotlightSchalter aktiv={spotlightEinstellung?.spotlights_aktiv ?? false} tarife={spotlightEinstellung?.spotlights_tarife ?? ["free", "basic", "verein"]} />
      </section>
      <section className={KARTE} aria-label="Musikbereich">
        <MusikSchalter aktiv={spotlightEinstellung?.musik_aktiv ?? false} />
      </section>
      <section className={KARTE} aria-label="JuryRaum">
        <JuryraumSchalter aktiv={spotlightEinstellung?.juryraum_aktiv ?? false} />
      </section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {kacheln.map((k) => (
          <Link key={k.href} href={k.href} className={`${KARTE} flex items-center gap-4 hover:border-brand-red`}>
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${k.farbe}`}>
              <k.icon size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-bold text-brand-ink">{k.titel}</span>
              <span className="block text-[13px] text-brand-ink-soft">{k.text}</span>
            </span>
            {"marke" in k && k.marke && <span className="rounded-full bg-brand-red px-2.5 py-0.5 text-[13px] font-bold text-white">{k.marke}</span>}
          </Link>
        ))}
      </div>
      <Link href="/dashboard/admin/meldungen" className={`${KARTE} flex items-center gap-4 hover:border-brand-red`}>
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-red-wash text-brand-red">
          <Flag size={22} />
        </span>
        <span className="flex-1">
          <span className="block text-[16px] font-bold text-brand-ink">Meldungen</span>
          <span className="block text-[13px] text-brand-ink-soft">Gemeldete Personen und Spotlights prüfen</span>
        </span>
        {anzahl > 0 && <span className="rounded-full bg-brand-red px-2.5 py-0.5 text-[13px] font-bold text-white">{anzahl} offen</span>}
      </Link>
      <Link href="/dashboard/admin/ankuendigungen" className={`${KARTE} flex items-center gap-4 hover:border-brand-red`}>
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-blue-wash text-brand-blue">
          <Megaphone size={22} />
        </span>
        <span className="flex-1">
          <span className="block text-[16px] font-bold text-brand-ink">Ankündigungen</span>
          <span className="block text-[13px] text-brand-ink-soft">Nachrichten an alle Dashboards – z. B. Wartungsarbeiten oder Neuheiten</span>
        </span>
      </Link>
      <Link href="/dashboard/admin/updates" className={`${KARTE} flex items-center gap-4 hover:border-brand-red`}>
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gold-wash text-brand-gold">
          <Sparkles size={22} />
        </span>
        <span className="flex-1">
          <span className="block text-[16px] font-bold text-brand-ink">Updates & Neuigkeiten</span>
          <span className="block text-[13px] text-brand-ink-soft">Release-Infos für Landingpage, „Was ist neu?“ und Kai · {versionText()}</span>
        </span>
      </Link>
      <Link href="/dashboard/admin/tarife" className={`${KARTE} flex items-center gap-4 hover:border-brand-red`}>
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gold-wash text-brand-gold">
          <CreditCard size={22} />
        </span>
        <span className="flex-1">
          <span className="block text-[16px] font-bold text-brand-ink">Tarife & Lizenzen</span>
          <span className="block text-[13px] text-brand-ink-soft">Wer hat FREE, BASIC oder VEREIN – Vereinslizenzen und Abos</span>
        </span>
      </Link>
      <Link href="/dashboard/admin/ehrungen" className={`${KARTE} flex items-center gap-4 hover:border-brand-red`}>
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gold-wash text-brand-gold">
          <Medal size={22} />
        </span>
        <span className="flex-1">
          <span className="block text-[16px] font-bold text-brand-ink">Ehrungskatalog</span>
          <span className="block text-[13px] text-brand-ink-soft">Verbände und Verbandsauszeichnungen pflegen und prüfen</span>
        </span>
      </Link>
      <Link href="/dashboard/admin/rechnungen" className={`${KARTE} flex items-center gap-4 hover:border-brand-red`}>
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-bg text-brand-ink">
          <Receipt size={22} />
        </span>
        <span className="flex-1">
          <span className="block text-[16px] font-bold text-brand-ink">Rechnungen</span>
          <span className="block text-[13px] text-brand-ink-soft">Alle Rechnungen, Aufbewahrungsfristen, CSV-Export</span>
        </span>
      </Link>
      <Link href="/dashboard/admin/anbieter" className={`${KARTE} flex items-center gap-4 hover:border-brand-red`}>
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-bg text-brand-ink">
          <Building2 size={22} />
        </span>
        <span className="flex-1">
          <span className="block text-[16px] font-bold text-brand-ink">Anbieterangaben</span>
          <span className="block text-[13px] text-brand-ink-soft">Impressum, Kontakt, Rechnungssteller, Kleinunternehmer-Hinweis – an einer Stelle</span>
        </span>
      </Link>
      <section className={`${KARTE} flex items-center gap-3 text-[13.5px] text-brand-ink-soft`}>
        <ShieldCheck size={18} /> Die Administration sieht keine privaten Chats und keine persönlichen Daten von Vereinsmitgliedern.
      </section>
    </div>
  );
}
