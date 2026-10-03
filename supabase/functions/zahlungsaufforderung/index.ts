// Supabase Edge Function: zahlungsaufforderung (Vereinslizenz per Ueberweisung)
//
//   POST { aufforderung_id, aktion: "senden" | "pdf" }
//
// Zugriff (verify_jwt aus, Pruefung hier):
//   - Server-zu-Server: Authorization: Bearer <Supabase Secret Key> (abo-abgleich bei Verlaengerungen), zeitkonstant verglichen
//   - oder angemeldete Person, die die Aufforderung per RLS sehen darf (Vereinsadmin des Vereins, Plattform-Administration)
// "senden": Mail mit Bankverbindung, Betrag, Referenz und PDF an empfaenger_email (max. 3 pro Aufforderung und Tag);
//           bei einer neuen Bestellung zusaetzlich kurzer Hinweis an die TanzRaum-Adresse.
// "pdf":    die Zahlungsaufforderung als PDF (nur solange sie offen ist).

import { appUrl, CORS, esc, gleich, istEmail, json, layout, NEUTRALER_FEHLER, sendeMail, serviceSchluessel } from "../_shared/mail.ts";
import { angemeldet, dienst, protokollieren, UUID, versandSeit } from "../_shared/zugriff.ts";
import { aufforderungPdf, datumDe, euro, ibanLesbar, rechnungLogo, type Aussteller } from "../_shared/rechnung-pdf.ts";

const ART = "zahlungsaufforderung";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Nicht erlaubt" }, 405);

  let body: { aufforderung_id?: unknown; aktion?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400);
  }
  const id = body.aufforderung_id;
  const aktion = body.aktion === "pdf" ? "pdf" : "senden";
  if (typeof id !== "string" || !UUID.test(id)) return json({ error: "Ungültige Zahlungsaufforderung." }, 400);

  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  let ausloeser: string | null = null;
  if (!gleich(bearer, serviceSchluessel())) {
    const sitzung = await angemeldet(req);
    if (!sitzung) return json({ error: "Nicht berechtigt." }, 401);
    const { data: sichtbar } = await sitzung.nutzer.from("zahlungsaufforderungen").select("id").eq("id", id).maybeSingle();
    if (!sichtbar) return json({ error: "Nicht berechtigt." }, 403);
    ausloeser = sitzung.userId;
  }

  const admin = dienst();
  const { data: z } = await admin.from("zahlungsaufforderungen").select("*").eq("id", id).maybeSingle();
  if (!z) return json({ error: "Zahlungsaufforderung nicht gefunden." }, 404);
  if (z.status !== "offen") return json({ error: "Diese Zahlungsaufforderung ist nicht mehr offen." }, 400);
  // Vereinsgruendung: der Verein entsteht erst nach dem Zahlungseingang – bis dahin gilt der bestellte Name
  const gruendung = !z.verein_id;
  const [{ data: vDb }, { data: a }, { data: abo }, { data: bestellung }] = await Promise.all([
    z.verein_id ? admin.from("vereine").select("name, strasse, hausnummer, plz, ort").eq("id", z.verein_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("plattform_anbieter").select("*").eq("id", true).maybeSingle(),
    z.abo_id ? admin.from("abos").select("laeuft_bis").eq("id", z.abo_id).maybeSingle() : Promise.resolve({ data: null }),
    gruendung && z.abo_id ? admin.from("vereinsgruendungen").select("verein_name").eq("abo_id", z.abo_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const v = vDb ?? (bestellung ? { name: (bestellung as { verein_name: string }).verein_name, strasse: null, hausnummer: null, plz: null, ort: null } : null);
  if (!v || !a) return json({ error: "Zahlungsaufforderung nicht gefunden." }, 404);
  if (!a.iban || !a.bank_inhaber) return json({ error: "Die Bankverbindung ist noch nicht hinterlegt." }, 400);

  const adresse = [[v.strasse, v.hausnummer].filter(Boolean).join(" "), [v.plz, v.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null;
  const bank = { inhaber: a.bank_inhaber, iban: a.iban, bic: a.bic, bank: a.bank_name };
  let pdf: Uint8Array | null = null;
  try {
    pdf = await aufforderungPdf(
      {
        referenz: z.referenz,
        art: z.art,
        betrag_cent: z.betrag_cent,
        faellig_am: z.faellig_am,
        erstellt_am: z.erstellt_am,
        verein_name: v.name,
        verein_adresse: adresse,
        empfaenger_email: z.empfaenger_email,
        lizenz_bis: (abo as { laeuft_bis?: string } | null)?.laeuft_bis ?? null,
      },
      a as Aussteller,
      bank,
      await rechnungLogo(appUrl()),
    );
  } catch {
    console.error("[zahlungsaufforderung] PDF konnte nicht erzeugt werden");
  }
  const dateiname = `TanzRaum-Zahlungsaufforderung-${z.referenz}.pdf`;

  if (aktion === "pdf") {
    if (!pdf) return json({ error: "Das PDF konnte gerade nicht erstellt werden." }, 502);
    return new Response(pdf, {
      headers: { ...CORS, "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${dateiname}"`, "Cache-Control": "no-store" },
    });
  }

  if (!istEmail(z.empfaenger_email)) return json({ error: "Für diese Zahlungsaufforderung ist keine gültige E-Mail-Adresse hinterlegt." }, 400);
  if ((await versandSeit(admin, { art: ART, bezug_id: id }, 24)) >= 3) {
    return json({ error: "Diese Zahlungsaufforderung wurde heute bereits mehrfach versendet." }, 429);
  }

  const zeile = (k: string, w: string, fett = false) =>
    `<tr><td style="padding:6px 10px 6px 0;font-size:14px;color:#5f6778;white-space:nowrap;">${esc(k)}</td><td style="padding:6px 0;font-size:14px;${fett ? "font-weight:bold;" : ""}">${esc(w)}</td></tr>`;
  const tabelle = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:4px 0 8px;background:#f5f6f9;border-radius:12px;padding:12px;">
    ${zeile("Kontoinhaber", bank.inhaber ?? "")}${zeile("IBAN", ibanLesbar(bank.iban), true)}${bank.bic ? zeile("BIC", bank.bic) : ""}${bank.bank ? zeile("Bank", bank.bank) : ""}
    ${zeile("Betrag", euro(z.betrag_cent / 100), true)}${zeile("Verwendungszweck", `${z.referenz} TanzRaum`, true)}${zeile("Zahlbar bis", datumDe(z.faellig_am))}
  </table>`;
  const vereinName = String(v.name).replace(/\.$/, "");
  const einleitung =
    z.art === "verlaengerung"
      ? `die Vereinslizenz von <strong>${esc(vereinName)}</strong> läuft am <strong>${esc(datumDe((abo as { laeuft_bis?: string } | null)?.laeuft_bis ?? z.faellig_am))}</strong> ab. Damit sie ohne Unterbrechung ein weiteres Jahr weiterläuft, überweise bitte den Jahresbeitrag.`
      : gruendung
        ? `vielen Dank für deine Bestellung der TanzRaum-Vereinslizenz für deinen neuen Verein <strong>${esc(vereinName)}</strong>. Bitte überweise den Jahresbeitrag – sobald die Zahlung eingegangen ist, wird dein Verein in TanzRaum angelegt, die Vereinslizenz freigeschaltet und du wirst automatisch Vereinsadmin.`
        : `vielen Dank für deine Bestellung der TanzRaum-Vereinslizenz für <strong>${esc(vereinName)}</strong>. Bitte überweise den Jahresbeitrag – die Lizenz wird freigeschaltet, sobald die Zahlung eingegangen ist.`;
  const html = layout({
    vorschau: `Zahlungsaufforderung ${z.referenz}: ${euro(z.betrag_cent / 100)} für die TanzRaum-Vereinslizenz.`,
    titel: "Zahlungsaufforderung Vereinslizenz",
    absaetze: [
      `Hallo,<br>${einleitung}`,
      tabelle,
      "Bitte gib unbedingt den Verwendungszweck an, damit wir die Zahlung zuordnen können. Die Zahlungsaufforderung findest du auch als PDF im Anhang und jederzeit unter „Mein Tarif“.",
      "Die Rechnung erhältst du nach Zahlungseingang automatisch per E-Mail.",
    ],
    button: { text: "Zu „Mein Tarif“", url: `${appUrl()}/dashboard/tarif` },
    fallbackLink: false,
    hinweis: `${a.kleinunternehmer ? `${esc(a.kleinunternehmer_hinweis)} ` : ""}Diese Zahlungsaufforderung ist keine Rechnung.`,
  });

  const ok = (
    await sendeMail({
      art: ART,
      an: [{ email: z.empfaenger_email, name: v.name }],
      betreff: z.art === "verlaengerung" ? `Verlängerung deiner TanzRaum-Vereinslizenz (${z.referenz})` : `Zahlungsaufforderung TanzRaum-Vereinslizenz (${z.referenz})`,
      html,
      anhaenge: pdf ? [{ name: dateiname, inhalt: pdf }] : [],
    })
  ).ok;
  await protokollieren(admin, { art: ART, absender_user: ausloeser, verein_id: z.verein_id, bezug_id: id, erfolgreich: ok });
  if (!ok) return json({ error: NEUTRALER_FEHLER }, 502);
  const erstmals = !z.versendet_am;
  await admin.from("zahlungsaufforderungen").update({ versendet_am: new Date().toISOString() }).eq("id", id);

  // Hinweis an TanzRaum bei jeder neuen Bestellung (nur beim ersten Versand)
  if (erstmals && istEmail(a.email)) {
    await sendeMail({
      art: `${ART}-hinweis`,
      an: [{ email: a.email }],
      betreff: `Neue Überweisung erwartet: ${vereinName} (${z.referenz})`,
      html: layout({
        vorschau: `${vereinName}: ${euro(z.betrag_cent / 100)} per Überweisung erwartet.`,
        titel: "Überweisung erwartet",
        absaetze: [
          gruendung
            ? `Neue Vereinsgründung <strong>${esc(vereinName)}</strong>: Vereinslizenz per Überweisung bestellt. Der Verein wird erst angelegt, wenn du den Zahlungseingang bestätigst.`
            : `<strong>${esc(vereinName)}</strong> hat die Vereinslizenz ${z.art === "verlaengerung" ? "zur Verlängerung" : "neu"} per Überweisung bestellt.`,
          `Betrag: <strong>${esc(euro(z.betrag_cent / 100))}</strong> · Verwendungszweck: <strong>${esc(z.referenz)}</strong> · zahlbar bis ${esc(datumDe(z.faellig_am))}`,
          "Sobald das Geld eingegangen ist: TanzRaum-Administration → Rechnungen → „Offene Überweisungen“ → „Zahlung eingegangen“.",
        ],
        button: { text: "Offene Überweisungen", url: `${appUrl()}/dashboard/admin/rechnungen` },
        fallbackLink: false,
      }),
    });
  }
  return json({ ok: true, referenz: z.referenz });
});
