-- Saisonplanung: Vereinstermine mit Treffpunkt, Treffzeit, Ansprechpartner, Mitbringen und optionalem
-- Bezug zu einem Turnier; neue Arten Turnier, Umzug, Fest. Nur neue, leere Spalten (bestehende Termine unveraendert).
alter table public.termine
  add column if not exists treffpunkt text,
  add column if not exists treffzeit time,
  add column if not exists verantwortlich text,
  add column if not exists mitbringen text,
  add column if not exists turnier_id uuid references public.turniere(id) on delete set null;

alter table public.termine
  add constraint termine_treffpunkt_laenge check (char_length(treffpunkt) <= 200),
  add constraint termine_verantwortlich_laenge check (char_length(verantwortlich) <= 120),
  add constraint termine_mitbringen_laenge check (char_length(mitbringen) <= 500),
  add constraint termine_turnier_nur_verein check (turnier_id is null or verein_id is not null);

alter table public.termine drop constraint termine_art_check;
alter table public.termine add constraint termine_art_check
  check (art = any (array['privat', 'veranstaltung', 'auftritt', 'sitzung', 'sonstiges', 'turnier', 'umzug', 'fest']));

create index if not exists termine_turnier_id_idx on public.termine (turnier_id) where turnier_id is not null;

comment on column public.termine.treffpunkt is 'Saisonplanung: Treffpunkt (z. B. Parkplatz Halle, Abfahrt Bus)';
comment on column public.termine.treffzeit is 'Saisonplanung: Uhrzeit am Treffpunkt';
comment on column public.termine.verantwortlich is 'Saisonplanung: Ansprechpartner/verantwortlich (Freitext)';
comment on column public.termine.mitbringen is 'Saisonplanung: Kostuem, Mitbringen, Hinweise';
comment on column public.termine.turnier_id is 'Saisonplanung: aus dem Turnierbereich uebernommenes Turnier';
