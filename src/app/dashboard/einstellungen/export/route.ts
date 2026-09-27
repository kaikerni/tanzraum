import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Datenexport (Art. 15/20 DSGVO): ausschliesslich die Daten der angemeldeten Person (Funktion meine_daten_export)
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  const { data, error } = await supabase.rpc("meine_daten_export");
  if (error || !data) return NextResponse.json({ error: "Der Export konnte gerade nicht erstellt werden." }, { status: 500 });
  const datum = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="tanzraum-meine-daten-${datum}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
