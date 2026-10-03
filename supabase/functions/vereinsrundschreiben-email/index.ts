// Supabase Edge Function: vereinsrundschreiben-email
// Versendet ein Vereinsrundschreiben an alle Mitglieder des Vereins mit hinterlegter E-Mail-Adresse.
//
//   POST { verein_id, betreff?, text }   (Authorization: Bearer <Nutzer-JWT>)
//
// Serverseitige Pruefung:
//   - angemeldet und berechtigt (mail_darf_rundschreiben: Vereinsadmin oder Trainer des Vereins, mit Vereinslizenz)
//   - Empfaenger bestimmt ausschliesslich der Server (Mitgliederliste des Vereins), nie der Browser
//   - Text wird escaped und in der Laenge begrenzt; Absender ist fest TanzRaum <noreply@tanzraum.app>
//   - Ratenbegrenzung: 3 Rundschreiben pro Verein und Tag
// Jede Person erhaelt eine eigene E-Mail (keine sichtbaren Empfaengerlisten).

import { CORS, json, NEUTRALER_FEHLER, sendeMail, type Empfaenger } from "../_shared/mail.ts";
import { rundschreiben } from "../_shared/vorlagen.ts";
import { angemeldet, dienst, protokollieren, UUID, versandSeit } from "../_shared/zugriff.ts";

const ART = "rundschreiben";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Nicht erlaubt" }, 405);

  const sitzung = await angemeldet(req);
  if (!sitzung) return json({ error: "Bitte melde dich an." }, 401);

  let eingabe: Record<string, unknown>;
  try {
    eingabe = await req.json();
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400);
  }
  const vereinId = eingabe.verein_id ?? eingabe.vereinId;
  const text = typeof eingabe.text === "string" ? eingabe.text.trim() : "";
  const betreff = typeof eingabe.betreff === "string" && eingabe.betreff.trim() ? eingabe.betreff.trim().slice(0, 150) : "Rundschreiben";
  if (typeof vereinId !== "string" || !UUID.test(vereinId)) return json({ error: "Ungültiger Verein." }, 400);
  if (!text) return json({ error: "Bitte gib einen Text ein." }, 400);
  if (text.length > 10000) return json({ error: "Der Text ist zu lang (maximal 10.000 Zeichen)." }, 400);

  const { data: darf } = await sitzung.nutzer.rpc("mail_darf_rundschreiben", { p_verein_id: vereinId });
  if (darf !== true) return json({ error: "Nicht berechtigt." }, 403);

  const admin = dienst();
  if ((await versandSeit(admin, { art: ART, verein_id: vereinId }, 24)) >= 3) {
    return json({ error: "Für heute wurden bereits genug Rundschreiben versendet. Bitte versuche es morgen erneut." }, 429);
  }

  const [{ data: verein }, { data: mitglieder }, { data: profil }] = await Promise.all([
    admin.from("vereine").select("name").eq("id", vereinId).maybeSingle(),
    admin.from("mitglieder").select("vorname, nachname, email").eq("verein_id", vereinId).not("email", "is", null),
    sitzung.nutzer.from("profiles").select("vorname, nachname").eq("id", sitzung.userId).maybeSingle(),
  ]);
  const gesehen = new Set<string>();
  const an: Empfaenger[] = [];
  for (const m of mitglieder ?? []) {
    const adresse = String(m.email ?? "").trim().toLowerCase();
    if (!adresse || gesehen.has(adresse)) continue;
    gesehen.add(adresse);
    an.push({ email: adresse, name: [m.vorname, m.nachname].filter(Boolean).join(" ") });
  }
  if (an.length === 0) return json({ error: "Für diesen Verein sind keine E-Mail-Adressen hinterlegt." }, 400);

  const absender = [profil?.vorname, profil?.nachname].filter(Boolean).join(" ") || null;
  const mail = rundschreiben({ vereinName: verein?.name ?? "Dein Verein", absender, betreff, text });
  const r = await sendeMail({ art: ART, an, betreff: mail.betreff, html: mail.html });
  await protokollieren(admin, { art: ART, absender_user: sitzung.userId, verein_id: vereinId, empfaenger_anzahl: an.length, erfolgreich: r.gesendet > 0 });

  if (r.gesendet === 0) return json({ error: NEUTRALER_FEHLER }, 502);
  return json({ ok: true, gesendet: r.gesendet, nicht_gesendet: an.length - r.gesendet });
});
