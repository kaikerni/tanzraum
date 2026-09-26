# Archiv: Stripe (erste Version)

Die erste Stripe-Anbindung (`create-checkout-session`, alter `stripe-webhook`) liegt hier als Quellcode.

Stand heute ist Stripe **wieder aktiv**, aber neu gebaut:
- `zahlung-starten` erstellt die Checkout-Session (Stripe) bzw. das PayPal-Abo,
- `stripe-webhook` (neu) übersetzt Stripe-Ereignisse in die zentrale Tariflogik der Datenbank.

`create-checkout-session` bleibt in Supabase als HTTP-410-Stub bestehen.
