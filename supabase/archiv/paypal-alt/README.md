# Archiv: alte PayPal-/Kündigungsfunktionen (abgelöst)

Diese drei Edge Functions schrieben den Tarif direkt in `profiles`/`vereine` und kündigten das
persönliche BASIC-Abo, sobald jemand einem zahlenden Verein beitrat. Das widerspricht der neuen
zentralen Tariflogik (BASIC wird bei Vereinslizenz **pausiert**, nicht gekündigt; Tarife ändern
sich nur über `abo_aktualisieren` / `tarif_neu_berechnen_*`).

In Supabase sind sie durch Versionen ersetzt, die nur noch HTTP 410 zurückgeben. Der ursprüngliche
Quellcode liegt hier.

| alt | neu |
|---|---|
| `create-paypal-order` | `zahlung-starten` (Stripe + PayPal) |
| `cancel-my-subscription` | `abo-verwalten` (`aktion: "kuendigen"`) |
| `cancel-paypal-subscription` | entfällt – Pausieren/Fortsetzen macht `abo-abgleich` automatisch |
