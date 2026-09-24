# Archiv: Stripe (abgeschaltet)

TanzRaum bietet keine Kreditkartenzahlung an. Bezahlt wird per PayPal, SEPA-Lastschrift über PayPal
oder – beim Vereinstarif jährlich – per Überweisung.

Die beiden Stripe-Edge-Functions `create-checkout-session` (Version 12) und `stripe-webhook` (Version 10)
wurden deshalb in Supabase durch eine Version ersetzt, die nur noch HTTP 410 zurückgibt.
Der ursprüngliche Quellcode liegt hier, damit er bei Bedarf wiederhergestellt werden kann.
