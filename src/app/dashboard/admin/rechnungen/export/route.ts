import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// CSV-Export aller Rechnungen fuer die TanzRaum-Administration (RLS: nur Plattform-Admins sehen alle)
function feld(w: unknown): string {
  const s = w === null || w === undefined ? "" : String(w);
  // Formel-Injection in Tabellenkalkulationen vermeiden
  const sicher = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${sicher.replace(/"/g, '""')}"`;
}

export async function GET() {
  const supabase = await createClient();
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
  const { data, error } = await supabase.from("rechnungen").select("*").order("rechnungsdatum").order("nummer");
  if (error) return NextResponse.json({ error: "Export fehlgeschlagen." }, { status: 500 });
  const spalten = [
    "nummer", "rechnungsdatum", "typ", "empfaenger_name", "empfaenger_adresse", "empfaenger_email", "leistung", "zeitraum",
    "betrag", "zahlungsweg", "versendet", "versendet_am", "aufbewahren_bis", "anonymisierung_gesperrt", "sperrgrund", "anonymisiert_am",
  ];
  const zeilen = [spalten.join(";"), ...(data ?? []).map((r: Record<string, unknown>) => spalten.map((s) => feld(r[s])).join(";"))];
  return new NextResponse("﻿" + zeilen.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tanzraum-rechnungen-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
