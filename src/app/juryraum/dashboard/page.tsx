import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getJuryKontext } from "@/lib/juryraum/getJuryContext";
import { getJuryDashboardData } from "@/lib/juryraum/getJuryDashboard";
import { EinladungAntwort } from "./EinladungAntwort";

const STATUS_LABEL: Record<string, string> = {
  offen: "Einladung offen",
  zugesagt: "Bestätigt",
  abgesagt: "Abgesagt",
  kann: "Verfügbar",
  kann_nicht: "Nicht verfügbar",
  vielleicht: "Eingeschränkt verfügbar",
};

function formatDatum(iso: string | null): string {
  if (!iso) return "Datum offen";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function JuryDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const kontext = await getJuryKontext(supabase, user.id);
  if (!kontext) redirect("/dashboard");

  const daten = await getJuryDashboardData(supabase, kontext, user.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 720 }}>
      <h1 className="brand-font page-title">JuryRaum</h1>

      {daten.offeneEinladungen.length > 0 && (
        <section className="card">
          <h2 className="brand-font" style={{ fontSize: 16, margin: "0 0 12px" }}>
            Offene Einladungen
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {daten.offeneEinladungen.map((e) => (
              <div
                key={e.zusageId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingBottom: 12,
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{e.turnierName}</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
                    {formatDatum(e.erstesDatum)}
                    {e.ort ? ` · ${e.ort}` : ""}
                  </div>
                </div>
                <EinladungAntwort zusageId={e.zusageId} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="brand-font" style={{ fontSize: 16, margin: "0 0 12px" }}>
          Meine nächsten Einsätze
        </h2>
        {daten.naechsteEinsaetze.length === 0 && (
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5 }}>
            Aktuell keine Einsätze eingeteilt.
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {daten.naechsteEinsaetze.map((e) => (
            <div key={e.turnierId} style={{ paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{e.turnierName}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 6 }}>
                {formatDatum(e.erstesDatum)}
                {e.ort ? ` · ${e.ort}` : ""} · {e.funktionen.join(", ")}
              </div>
              {e.zusageStatus && (
                <span className={`status-badge ${e.zusageStatus}`}>
                  {STATUS_LABEL[e.zusageStatus]}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="brand-font" style={{ fontSize: 16, margin: "0 0 12px" }}>
          Bevorstehende Turniere
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {daten.bevorstehendeTurniere.map((t) => (
            <div
              key={t.turnierId}
              style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}
            >
              <span>
                {t.turnierName}
                <span style={{ color: "var(--ink-soft)" }}> · {formatDatum(t.erstesDatum)}</span>
              </span>
              {t.eigeneVerfuegbarkeit && (
                <span className={`status-badge ${t.eigeneVerfuegbarkeit}`}>
                  {STATUS_LABEL[t.eigeneVerfuegbarkeit]}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
