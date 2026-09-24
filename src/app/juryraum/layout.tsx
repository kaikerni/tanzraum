import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getJuryKontext } from "@/lib/juryraum/getJuryContext";

const NAV = [
  { href: "/juryraum/dashboard", label: "Dashboard" },
  { href: "/juryraum/turniere", label: "Turniere" },
  { href: "/juryraum/besetzungen", label: "Besetzungen" },
  { href: "/juryraum/verfuegbarkeiten", label: "Verfügbarkeit" },
  { href: "/juryraum/einladungen", label: "Einladungen", mindestens: "verantwortlicher" as const },
  { href: "/juryraum/anreise", label: "Anreise" },
  { href: "/juryraum/unterkunft", label: "Unterkunft" },
  { href: "/juryraum/nachrichten", label: "Nachrichten" },
  { href: "/juryraum/dokumente", label: "Dokumente" },
  { href: "/juryraum/admin", label: "Administration", mindestens: "admin" as const },
];

const ROLLEN_RANG = { mitglied: 0, verantwortlicher: 1, admin: 2 };

export default async function JuryraumLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const kontext = await getJuryKontext(supabase, user.id);
  // Kein aktives JuryRaum-Mitglied -> der Bereich existiert fuer diesen Nutzer nicht (§1).
  if (!kontext) redirect("/dashboard");

  const sichtbareNav = NAV.filter(
    (item) => !item.mindestens || ROLLEN_RANG[kontext.rolle] >= ROLLEN_RANG[item.mindestens],
  );

  return (
    <div style={{ display: "flex", minHeight: "100%" }}>
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          background: "var(--paper)",
          borderRight: "1px solid var(--line)",
          padding: "24px 16px",
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <div className="brand-font" style={{ fontSize: 18, fontWeight: 700 }}>
            JuryRaum
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
            {kontext.verbandName ?? "Alle Verbände"} ·{" "}
            {kontext.rolle === "admin"
              ? "Administrator"
              : kontext.rolle === "verantwortlicher"
                ? "Verantwortlich"
                : "Juror·in"}
          </div>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {sichtbareNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-item"
              style={{ padding: "8px 10px", borderRadius: "var(--radius-s)", fontSize: 13.5 }}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/dashboard"
            style={{
              marginTop: 16,
              padding: "8px 10px",
              fontSize: 12.5,
              color: "var(--ink-soft)",
            }}
          >
            ← Zurück zu TanzRaum
          </Link>
        </nav>
      </aside>
      <main style={{ flex: 1, padding: "32px 40px" }}>{children}</main>
    </div>
  );
}
