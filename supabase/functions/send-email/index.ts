// Supabase Edge Function: send-email  –  STILLGELEGT
//
// Diese Funktion hat frueher beliebige E-Mails (freier Empfaenger, Betreff, Inhalt und Absender) fuer jeden
// angemeldeten Nutzer versendet und war damit als offenes Mail-Relay missbrauchbar.
// Sie wird von der neuen TanzRaum-App nicht verwendet und versendet deshalb nichts mehr.
//
// E-Mails laufen ausschliesslich ueber zweckgebundene, serverseitig gepruefte Funktionen:
//   auth-email (Konto-E-Mails), send-beitritt-einladung, vereinsrundschreiben-email,
//   rechnung-versenden, spendenbescheinigung-senden.
// Die Funktion bleibt bewusst bestehen (statt geloescht zu werden), damit alte Aufrufe eine klare Antwort erhalten.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const NEUTRALER_FEHLER = "Die E-Mail konnte momentan nicht versendet werden. Bitte versuche es später erneut.";

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  return new Response(JSON.stringify({ error: NEUTRALER_FEHLER, code: "deaktiviert" }), {
    status: 410,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});
