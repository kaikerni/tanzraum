// Nur serverseitig verwenden (Server Actions).
// Versand der Eltern-Mails ueber die Edge Function "eltern-zustimmung". Empfaenger, Inhalt und Link legt ausschliesslich
// der Server fest; hier werden nur Kennungen uebergeben. Fehlertexte sind neutral (keine Rohdaten von Brevo).
export async function elternMailSenden(
  auftrag: { art: "anfrage"; kind_id: string } | { art: "bestaetigung"; zustimmung_id: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const antwort = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/eltern-zustimmung`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
      body: JSON.stringify(auftrag),
      cache: "no-store",
    });
    if (antwort.ok) return { ok: true };
    const daten = (await antwort.json().catch(() => ({}))) as { error?: string };
    return {
      ok: false,
      error: antwort.status === 429 && daten.error ? daten.error : "Die E-Mail konnte momentan nicht versendet werden. Bitte versuche es später erneut.",
    };
  } catch {
    return { ok: false, error: "Die E-Mail konnte momentan nicht versendet werden. Bitte versuche es später erneut." };
  }
}
