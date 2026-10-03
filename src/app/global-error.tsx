"use client";

// Letzte Auffangseite, falls sogar das Grundgeruest der App nicht dargestellt werden kann.
// Ersetzt die englische Standardmeldung "Application error" durch einen verstaendlichen Hinweis.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="de">
      <body style={{ fontFamily: "Arial, Helvetica, sans-serif", background: "#f5f6f9", margin: 0 }}>
        <div style={{ maxWidth: 440, margin: "12vh auto", background: "#fff", borderRadius: 16, padding: 28 }}>
          <h1 style={{ fontSize: 22, margin: "0 0 12px", color: "#1b2130" }}>Da ist etwas schiefgelaufen</h1>
          <p style={{ color: "#5f6778", lineHeight: 1.55 }}>
            Die Seite konnte nicht geladen werden. Bitte lade sie neu. Wenn es weiterhin nicht klappt, versuche es in ein paar
            Minuten noch einmal.
          </p>
          {error.digest && <p style={{ color: "#98a0b0", fontSize: 12 }}>Fehlerkennung: {error.digest}</p>}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginTop: 12, background: "#e11d2e", color: "#fff", border: 0, borderRadius: 999, padding: "12px 22px", fontWeight: 700, cursor: "pointer" }}
          >
            Seite neu laden
          </button>
        </div>
      </body>
    </html>
  );
}
