alter table public.abos add column if not exists freischaltung text;
alter table public.abos add constraint abos_freischaltung_check
  check (freischaltung is null or freischaltung in ('manual_free', 'team_free', 'manuell_bezahlt'));
alter table public.abos add column if not exists notiz text;
alter table public.abos add constraint abos_notiz_laenge check (char_length(notiz) <= 500);
alter table public.abos add column if not exists erteilt_von uuid references public.profiles(id) on delete set null;
comment on column public.abos.freischaltung is
  'Manuelle Freischaltung: manual_free (kostenlos, Admin), team_free (kostenlos als TanzRaum Team), manuell_bezahlt (regulaer bezahlt, manuell erfasst); NULL = Kauf (Stripe/PayPal/Ueberweisung) bzw. aeltere manuelle Lizenz';
