import Link from "next/link";
import { redirect } from "next/navigation";
import { Flag, ShieldCheck, CreditCard, Medal, Building2, Receipt, Megaphone, BarChart3, LifeBuoy, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { DashboardStatus } from "@/components/dashboard/DashboardStatus";

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
    { href: "/dashboard/admin/vorschau", icon: Eye, farbe: "bg-brand-purple-wash text-brand-purple", titel: "Oberflächen-Vorschau", text: "FREE, BASIC, VEREIN, ADMIN und JuryRaum mit Beispieldaten ansehen" },
  ];

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
        <ShieldCheck size={24} className="text-brand-red" /> TanzRaum-Administration
      </h1>
      <DashboardStatus className={`${KARTE} !py-3`} />
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
