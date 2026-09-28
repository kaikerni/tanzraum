// Supabase Edge Function: mitgliedsantrag
// PDF, Versand und E-Mail-Benachrichtigungen fuer die digitalen Mitgliedsantraege.
//
//   POST { aktion: "pdf", antrag_id }                         -> PDF (Antragsteller, verknuepfte Eltern, Verein)
//   POST { aktion: "muster", verein_id }                      -> Vorschau-PDF des Vereinsformulars (Verein)
//   POST { aktion: "eingereicht", antrag_id }                 -> PDF an die Vereinsadresse (+ Kopie an Antragsteller)
//   POST { aktion: "benachrichtigen", antrag_id, anlass }     -> E-Mail an die Person bei "hinzugefuegt" / "entschieden"
//                                                                (+ Aufnahme-PDF ablegen, je nach Vereinseinstellung)
//
// Zugriff: angemeldete Nutzer (verify_jwt aus, Pruefung hier). Alle Lesezugriffe auf Antraege laufen ALS
// angemeldete Person (RLS: nur Antragsteller, verknuepfte Eltern, Vereinsadmins/Bereich "beitritt").
// Der Service-Client wird nur fuer Adressen (auth.users), Vereinsdaten, Ablage des Aufnahme-PDFs und das
// Versandprotokoll genutzt – jeweils erst nach bestandener Pruefung.

import { CORS, appUrl, esc, istEmail, json, layout, NEUTRALER_FEHLER, sendeMail } from "../_shared/mail.ts";
import { angemeldet, dienst, protokollieren, UUID, versandSeit } from "../_shared/zugriff.ts";
import { datenAus, einstellungenAus, inhaltAus, mitVerein, type Unterschriften, type Verfahren } from "../_shared/antrag-vorlage.ts";
import { antragPdf, type PdfVerein } from "../_shared/antrag-pdf.ts";

const ART = "mitgliedsantrag";
const heute = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
type Antrag = Record<string, unknown> & { id: string; verein_id: string; user_id: string | null; status: string };

function dateiname(verein: string, name: string) {
  const s = (x: string) => x.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 40);
  return `Mitgliedsantrag-${s(verein) || "Verein"}${name ? `-${s(name)}` : ""}.pdf`;
}

async function logoLaden(url: unknown): Promise<Uint8Array | null> {
  const basis = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/`;
  if (typeof url !== "string" || !url.startsWith(basis)) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const b = new Uint8Array(await r.arrayBuffer());
    return b.length < 3_000_000 ? b : null;
  } catch {
    return null;
  }
}

async function pdfFuer(antrag: Antrag, verein: Record<string, unknown>, aktuellesInhalt: unknown, extra: { angenommenAm?: string | null } = {}) {
  // Eingereichte Antraege: Formularstand zum Zeitpunkt der Einreichung (was bestaetigt wurde)
  const vorlage = (antrag.vorlage ?? null) as { inhalt?: unknown; verein?: Record<string, unknown> } | null;
  const inhalt = inhaltAus(vorlage?.inhalt ?? aktuellesInhalt);
  const v = (vorlage?.verein ?? verein) as Record<string, unknown>;
  return await antragPdf({
    verein: { name: String(v.name ?? "Verein"), ...v } as PdfVerein,
    inhalt,
    daten: datenAus(antrag.daten),
    verfahren: (antrag.unterschrift_verfahren as Verfahren | null) ?? null,
    unterschriften: (antrag.unterschriften ?? {}) as Unterschriften,
    status: {
      eingereichtAm: (antrag.eingereicht_am as string | null) ?? null,
      angenommenAm: extra.angenommenAm ?? (antrag.status === "angenommen" ? (antrag.entschieden_am as string | null) : null),
      mitgliedsnummer: (antrag.mitgliedsnummer as string | null) ?? null,
      familiennummer: (antrag.familiennummer as string | null) ?? null,
    },
    logo: await logoLaden(verein.logo_url),
    heute: heute(),
  });
}

function pdfAntwort(bytes: Uint8Array, name: string) {
  return new Response(bytes, {
    headers: {
      ...CORS,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Nicht erlaubt" }, 405);
  const sitzung = await angemeldet(req);
  if (!sitzung) return json({ error: "Nicht angemeldet." }, 401);
  const { nutzer, userId } = sitzung;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400);
  }
  const aktion = body.aktion;
  const admin = dienst();

  // --------------------------------------------------------------- Muster (Vorschau)
  if (aktion === "muster") {
    const vereinId = body.verein_id;
    if (typeof vereinId !== "string" || !UUID.test(vereinId)) return json({ error: "Ungültiger Verein." }, 400);
    const { data: darf } = await nutzer.rpc("darf_antraege", { p_verein_id: vereinId });
    if (darf !== true) return json({ error: "Nicht berechtigt." }, 403);
    const [{ data: verein }, { data: vorlage }] = await Promise.all([
      admin.from("vereine").select("name, logo_url, strasse, hausnummer, plz, ort, email, telefon, webseite").eq("id", vereinId).maybeSingle(),
      nutzer.from("antrag_vorlagen").select("inhalt").eq("verein_id", vereinId).maybeSingle(),
    ]);
    if (!verein) return json({ error: "Verein nicht gefunden." }, 404);
    const bytes = await antragPdf({
      verein: verein as PdfVerein,
      inhalt: inhaltAus(vorlage?.inhalt),
      daten: datenAus({}),
      verfahren: null,
      unterschriften: {},
      status: { muster: true },
      logo: await logoLaden(verein.logo_url),
      heute: heute(),
    });
    return pdfAntwort(bytes, dateiname(verein.name, "Muster"));
  }

  const antragId = body.antrag_id;
  if (typeof antragId !== "string" || !UUID.test(antragId)) return json({ error: "Ungültiger Antrag." }, 400);
  // Lesen als angemeldete Person: RLS entscheidet, ob der Antrag sichtbar ist
  const { data: antrag } = await nutzer.from("beitrittsantraege").select("*").eq("id", antragId).maybeSingle();
  if (!antrag) return json({ error: "Antrag nicht gefunden." }, 404);
  const a = antrag as Antrag;
  const [{ data: verein }, { data: vorlage }, { data: darfVerwalten }] = await Promise.all([
    admin.from("vereine").select("name, logo_url, strasse, hausnummer, plz, ort, email, telefon, webseite").eq("id", a.verein_id).maybeSingle(),
    admin.from("antrag_vorlagen").select("inhalt, einstellungen").eq("verein_id", a.verein_id).maybeSingle(),
    nutzer.rpc("darf_antraege", { p_verein_id: a.verein_id }),
  ]);
  if (!verein) return json({ error: "Verein nicht gefunden." }, 404);
  const einstellungen = einstellungenAus(vorlage?.einstellungen);
  const daten = datenAus(a.daten);
  const name = [daten.vorname, daten.nachname].filter(Boolean).join(" ");

  // --------------------------------------------------------------- PDF
  if (aktion === "pdf") {
    const bytes = await pdfFuer(a, verein, vorlage?.inhalt);
    return pdfAntwort(bytes, dateiname(verein.name, name));
  }

  // --------------------------------------------------------------- Nach dem Einreichen: an den Verein senden
  if (aktion === "eingereicht") {
    const eingereicht = a.eingereicht_am ? new Date(a.eingereicht_am as string).getTime() : 0;
    if (a.status !== "eingereicht" || a.eingereicht_von !== userId || Date.now() - eingereicht > 15 * 60_000) {
      return json({ error: "Dieser Antrag kann nicht (mehr) versendet werden." }, 409);
    }
    if ((await versandSeit(admin, { art: ART, bezug_id: antragId }, 24)) >= 3) return json({ error: "Bereits versendet." }, 429);
    const empfaenger = istEmail(einstellungen.empfaenger_email) ? einstellungen.empfaenger_email : istEmail(verein.email) ? verein.email : null;
    const bytes = await pdfFuer(a, verein, vorlage?.inhalt);
    const anhang = [{ name: dateiname(verein.name, name), inhalt: bytes }];
    let anVerein = false;
    if (empfaenger) {
      const html = layout({
        vorschau: `Neuer Mitgliedsantrag: ${name}`,
        titel: "Neuer Mitgliedsantrag",
        absaetze: [
          `Über TanzRaum ist ein neuer Mitgliedsantrag für <strong>${esc(verein.name)}</strong> eingegangen: <strong>${esc(name)}</strong>.`,
          a.unterschrift_verfahren === "papier"
            ? "Die Person hat „Ausdrucken und unterschreiben“ gewählt – die unterschriebene Fassung wird nachgereicht."
            : "Der Antrag liegt als PDF bei.",
        ],
        button: { text: "Antrag in TanzRaum öffnen", url: `${appUrl()}/dashboard/mitgliedsantraege/${antragId}` },
        hinweis: "Der Antrag enthält personenbezogene Daten (ggf. Bankverbindung). Bitte vertraulich behandeln und nicht weiterleiten.",
      });
      const r = await sendeMail({
        art: ART,
        an: [{ email: empfaenger, name: verein.name }],
        betreff: `Mitgliedsantrag: ${name}`,
        html,
        antwortAn: istEmail(daten.email) ? { email: daten.email, name } : undefined,
        anhaenge: anhang,
      });
      anVerein = r.ok;
    }
    let kopie = false;
    if (einstellungen.kopie_an_antragsteller && istEmail(daten.email)) {
      const html = layout({
        vorschau: `Dein Mitgliedsantrag bei ${verein.name}`,
        titel: "Dein Mitgliedsantrag ist eingegangen",
        absaetze: [
          `Hallo ${esc(daten.vorname)},`,
          `dein Mitgliedsantrag bei <strong>${esc(verein.name)}</strong> wurde übermittelt. Eine Kopie liegt als PDF bei.`,
          a.unterschrift_verfahren === "papier"
            ? "Du hast „Ausdrucken und unterschreiben“ gewählt: Bitte drucke das PDF aus, unterschreibe es und gib es beim Verein ab oder lade es in TanzRaum hoch."
            : "Der Verein prüft deinen Antrag und meldet sich bei dir.",
        ],
        button: { text: "Antrag ansehen", url: `${appUrl()}/dashboard/mitgliedsantrag/${antragId}` },
      });
      kopie = (await sendeMail({ art: ART, an: [{ email: daten.email, name }], betreff: `Dein Mitgliedsantrag bei ${verein.name}`, html, anhaenge: anhang })).ok;
    }
    await protokollieren(admin, { art: ART, absender_user: userId, verein_id: a.verein_id, bezug_id: antragId, empfaenger_anzahl: Number(anVerein) + Number(kopie), erfolgreich: anVerein || kopie });
    return json({ an_verein: anVerein, kopie, ohne_vereinsadresse: !empfaenger });
  }

  // --------------------------------------------------------------- E-Mail an die Person
  if (aktion === "benachrichtigen") {
    const anlass = body.anlass;
    if (anlass !== "hinzugefuegt" && anlass !== "entschieden") return json({ error: "Ungültiger Anlass." }, 400);
    if (!a.user_id) return json({ gesendet: false });

    // Wer darf ausloesen: der Verein; bei "hinzugefuegt" nach einer Freigabe auch der freigebende Verein
    let erlaubt = darfVerwalten === true;
    if (!erlaubt && anlass === "hinzugefuegt") {
      const { data: w } = await admin
        .from("vereinswechsel_anfragen")
        .select("quell_verein_id")
        .eq("mitglied_user_id", a.user_id)
        .eq("ziel_verein_id", a.verein_id)
        .eq("status", "abgeschlossen")
        .gte("quell_verein_bestaetigt_at", new Date(Date.now() - 15 * 60_000).toISOString())
        .limit(1)
        .maybeSingle();
      if (w) {
        const { data: istQuellAdmin } = await nutzer.rpc("darf_antraege", { p_verein_id: w.quell_verein_id });
        erlaubt = istQuellAdmin === true;
      }
    }
    if (!erlaubt) return json({ error: "Nicht berechtigt." }, 403);

    const bezug = `${antragId}`;
    const artAnlass = `${ART}-${anlass}`;
    if ((await versandSeit(admin, { art: artAnlass, bezug_id: bezug }, 24)) >= 2) return json({ gesendet: false, grund: "bereits" });

    let einstellung = einstellungen.hinzufuegen_benachrichtigung;
    let textRoh = einstellungen.hinzufuegen_text;
    let titel = "Mitgliedsantrag ausfüllen";
    let button = { text: "Mitgliedsantrag ausfüllen", url: `${appUrl()}/dashboard/mitgliedsantrag/${antragId}` };
    let aufnahmePdf: string | null = null;

    if (anlass === "entschieden") {
      if (a.status === "angenommen") {
        einstellung = einstellungen.annahme_benachrichtigung;
        textRoh = einstellungen.annahme_text;
        titel = "Willkommen im Verein";
        button = { text: "TanzRaum öffnen", url: `${appUrl()}/dashboard` };
        if (einstellungen.aufnahme_pdf_speichern && !a.aufnahme_pdf) {
          const bytes = await pdfFuer(a, verein, vorlage?.inhalt, { angenommenAm: (a.entschieden_am as string) ?? new Date().toISOString() });
          const pfad = `${a.verein_id}/${antragId}/aufnahme.pdf`;
          const { error } = await admin.storage.from("mitgliedsantraege").upload(pfad, bytes, { contentType: "application/pdf", upsert: true });
          if (!error) {
            await admin.from("beitrittsantraege").update({ aufnahme_pdf: pfad }).eq("id", antragId);
            aufnahmePdf = pfad;
          }
        }
      } else if (a.status === "abgelehnt") {
        einstellung = einstellungen.ablehnung_benachrichtigung;
        textRoh = einstellungen.ablehnung_text;
        titel = "Dein Mitgliedsantrag";
        button = { text: "TanzRaum öffnen", url: `${appUrl()}/dashboard/mitgliedsantrag/${antragId}` };
      } else {
        return json({ gesendet: false });
      }
    }
    if (einstellung !== "app_email") return json({ gesendet: false, aufnahme_pdf: aufnahmePdf });

    // Empfaenger: Kontoadresse der Person und verknuepfter Eltern
    const { data: eltern } = await admin.from("eltern_verknuepfungen").select("eltern_id").eq("kind_id", a.user_id).eq("status", "bestaetigt");
    const ids = [a.user_id, ...(eltern ?? []).map((e) => e.eltern_id as string)];
    const an: { email: string }[] = [];
    for (const id of ids) {
      const { data } = await admin.auth.admin.getUserById(id);
      if (data?.user?.email && istEmail(data.user.email)) an.push({ email: data.user.email });
    }
    if (an.length === 0) return json({ gesendet: false, aufnahme_pdf: aufnahmePdf });
    const html = layout({
      vorschau: mitVerein(textRoh, verein.name),
      titel,
      absaetze: [esc(mitVerein(textRoh, verein.name))],
      button,
    });
    const r = await sendeMail({ art: artAnlass, an, betreff: `${verein.name}: ${titel}`, html });
    await protokollieren(admin, { art: artAnlass, absender_user: userId, verein_id: a.verein_id, bezug_id: bezug, empfaenger_anzahl: r.gesendet, erfolgreich: r.ok });
    return r.ok ? json({ gesendet: true, aufnahme_pdf: aufnahmePdf }) : json({ error: NEUTRALER_FEHLER }, 502);
  }

  return json({ error: "Unbekannte Aktion." }, 400);
});
