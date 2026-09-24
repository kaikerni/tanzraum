import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getJuryKontext } from "@/lib/juryraum/getJuryContext";
import { getJuryVerfuegbarkeiten } from "@/lib/juryraum/getJuryDashboard";
import { VerfuegbarkeitSelect } from "./VerfuegbarkeitSelect";

function formatDatum(iso: string | null): string {
  if (!iso) return "Datum offen";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function VerfuegbarkeitenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const kontext = await getJuryKontext(supabase, user.id);
  if (!kontext) redirect("/dashboard");

  const turniere = await getJuryVerfuegbarkeiten(supabase, kontext, user.id);

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 className="brand-font page-title">Meine Verfügbarkeit</h1>
      <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginBottom: 24 }}>
        Gib für jedes bevorstehende Turnier an, ob du als Jury zur Verfügung stehst.
      </p>

      <div className="card">
        {turniere.length === 0 && (
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5 }}>
            Aktuell keine bevorstehenden Turniere sichtbar.
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {turniere.map((t) => (
            <div
              key={t.turnierId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingBottom: 14,
                borderBottom: "1px solid var(--line)",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t.turnierName}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
                  {formatDatum(t.erstesDatum)}
                  {t.ort ? ` · ${t.ort}` : ""}
                </div>
              </div>
              <VerfuegbarkeitSelect turnierId={t.turnierId} wert={t.eigeneVerfuegbarkeit} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
