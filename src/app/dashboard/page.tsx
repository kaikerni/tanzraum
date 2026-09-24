import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import { signOut } from "@/app/actions";

const TARIF_LABEL: Record<string, string> = {
  free: "Free",
  basic: "Basic",
  verein: "Verein",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const daten = await getDashboardData(supabase, user.id);
  if (!daten) redirect("/login");
  if (daten.gesperrt) redirect("/gesperrt");

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 className="brand-font page-title">
            Willkommen zurück, {daten.vorname ?? "bei TanzRaum"}!
          </h1>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, margin: 0 }}>
            {daten.istPlattformAdmin ? "Plattform-Admin · " : ""}
            Persönlicher Tarif: {TARIF_LABEL[daten.persoenlicherTarif] ?? daten.persoenlicherTarif}
          </p>
        </div>
        <form action={signOut}>
          <button type="submit" className="btn-secondary">
            Abmelden
          </button>
        </form>
      </header>

      <section
        style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-l)",
          padding: 24,
        }}
      >
        <h2 className="brand-font" style={{ fontSize: 18, margin: "0 0 12px" }}>
          Deine Vereine
        </h2>
        {daten.vereine.length === 0 && (
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5 }}>
            Du bist aktuell in keinem Verein Mitglied.
          </p>
        )}
        {daten.vereine.map((v) => (
          <div
            key={v.vereinId}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: "1px solid var(--line)",
              fontSize: 13.5,
            }}
          >
            <span>
              {v.vereinName}
              {v.rolleName ? ` · ${v.rolleName}` : ""}
            </span>
            <span style={{ color: "var(--ink-soft)" }}>
              {v.vereinTarif ? TARIF_LABEL[v.vereinTarif] ?? v.vereinTarif : "—"}
              {v.vereinGesperrt ? " · gesperrt" : ""}
            </span>
          </div>
        ))}
      </section>

      {daten.istJuryMitglied && (
        <Link
          href="/juryraum/dashboard"
          className="card"
          style={{
            display: "block",
            marginTop: 16,
            textDecoration: "none",
          }}
        >
          <span className="brand-font" style={{ fontSize: 15, fontWeight: 700 }}>
            JuryRaum öffnen →
          </span>
          <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-soft)", marginTop: 2 }}>
            Einsätze, Verfügbarkeit und Jury-Organisation
          </span>
        </Link>
      )}
    </div>
  );
}
