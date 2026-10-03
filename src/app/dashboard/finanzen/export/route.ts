import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Kassenbuch eines Jahres als CSV (Semikolon, deutsches Zahlenformat) – Rechte prueft die Datenbank (RLS darf_finanzen)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function feld(v: unknown): string {
  const s = String(v ?? "");
  // Formeln in Tabellenprogrammen verhindern
  const sicher = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${sicher.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const verein = req.nextUrl.searchParams.get("verein") ?? "";
  const jahr = req.nextUrl.searchParams.get("jahr") ?? "";
  if (!UUID.test(verein) || !/^\d{4}$/.test(jahr)) return new NextResponse("Ungültige Anfrage", { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });
  const { data: darf } = await supabase.rpc("darf_finanzen", { p_verein_id: verein });
  if (darf !== true) return new NextResponse("Keine Berechtigung", { status: 403 });

  const { data } = await supabase
    .from("kassenbuch_eintraege")
    .select("datum, typ, kategorie, beschreibung, zahlungsart, betrag, beleg_name")
    .eq("verein_id", verein)
    .gte("datum", `${jahr}-01-01`)
    .lte("datum", `${jahr}-12-31`)
    .order("datum")
    .limit(20000);
  const zahl = (n: number) => n.toFixed(2).replace(".", ",");
  let saldo = 0;
  const zeilen = ["Datum;Art;Kategorie;Beschreibung;Zahlungsart;Einnahme;Ausgabe;Saldo (Jahr);Beleg"];
  for (const b of data ?? []) {
    const betrag = Number(b.betrag);
    saldo += b.typ === "einnahme" ? betrag : -betrag;
    zeilen.push(
      [
        feld(new Date(`${b.datum}T12:00:00`).toLocaleDateString("de-DE")),
        feld(b.typ === "einnahme" ? "Einnahme" : "Ausgabe"),
        feld(b.kategorie),
        feld(b.beschreibung),
        feld(b.zahlungsart),
        b.typ === "einnahme" ? zahl(betrag) : "",
        b.typ === "ausgabe" ? zahl(betrag) : "",
        zahl(saldo),
        feld(b.beleg_name ? "ja" : ""),
      ].join(";"),
    );
  }
  return new NextResponse("﻿" + zeilen.join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="Kassenbuch-${jahr}.csv"`,
      "cache-control": "no-store",
    },
  });
}
