-- TanzRaum-Administration: Benutzerkonten finden und löschen (geplant in 14 Tagen oder sofort).
-- Nutzt den bestehenden Lösch-Ablauf (konto_loeschungen + Edge Function konto-loeschung + Hindernisprüfung).
-- Vereinsmitglieder löscht nur der Verein (Hindernis bleibt), Plattform-Admins und das eigene Konto nie.

alter table public.konto_loeschungen add column if not exists durch_admin boolean not null default false;
alter table public.konto_loeschungen add column if not exists grund text check (char_length(grund) <= 500);

-- Nachweis der Admin-Aktionen (Wer hat wann warum gelöscht) – ohne weitere Personendaten
create table if not exists public.admin_konto_aktionen (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  ziel_user uuid not null,
  ziel_name text,
  aktion text not null check (aktion in ('loeschen_geplant', 'loeschen_sofort', 'loeschen_abgebrochen')),
  grund text check (char_length(grund) <= 500),
  erstellt_am timestamptz not null default now()
);
alter table public.admin_konto_aktionen enable row level security;
drop policy if exists "Admin-Konto-Aktionen: Administration liest" on public.admin_konto_aktionen;
create policy "Admin-Konto-Aktionen: Administration liest" on public.admin_konto_aktionen for select to authenticated using (ist_plattform_admin_aktuell());
revoke insert, update, delete on public.admin_konto_aktionen from authenticated, anon;

-- Suche: Name, @handle oder E-Mail; E-Mail nur maskiert
create or replace function public.admin_benutzer_suche(p_q text)
returns table(user_id uuid, name text, handle text, email_maskiert text, tarif text, registriert_am timestamptz, gesperrt boolean,
              verein text, ist_admin boolean, loeschen_ab timestamptz, loeschung_durch_admin boolean, blockiert text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_q text := btrim(coalesce(p_q, ''));
begin
  if not ist_plattform_admin_aktuell() then
    raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501';
  end if;
  return query
  select p.id,
         nullif(btrim(coalesce(p.vorname, '') || ' ' || coalesce(p.nachname, '')), ''),
         p.handle,
         case when u.email is null then null
              else left(split_part(u.email, '@', 1), 2) || '***@' || split_part(u.email, '@', 2) end,
         tarif_von(p.id),
         u.created_at,
         coalesce(p.gesperrt, false) or (u.banned_until is not null and u.banned_until > now()),
         (select string_agg(v.name, ', ') from vereins_mitglieder vm join vereine v on v.id = vm.verein_id where vm.user_id = p.id),
         coalesce(p.ist_plattform_admin, false),
         k.loeschen_ab,
         coalesce(k.durch_admin, false),
         k.zuletzt_blockiert
  from profiles p
  join auth.users u on u.id = p.id
  left join konto_loeschungen k on k.user_id = p.id
  where (v_q = '' and k.user_id is not null)
     or (char_length(v_q) >= 2 and (
          (coalesce(p.vorname, '') || ' ' || coalesce(p.nachname, '')) ilike '%' || v_q || '%'
          or p.handle ilike '%' || ltrim(v_q, '@') || '%'
          or u.email ilike '%' || v_q || '%'))
  order by k.loeschen_ab nulls last, p.vorname, p.nachname
  limit 50;
end;
$$;

create or replace function public.admin_konto_loeschen(p_user uuid, p_grund text, p_sofort boolean default false)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_grund text := nullif(btrim(left(coalesce(p_grund, ''), 500)), '');
  h record;
  v_ab timestamptz;
  v_name text;
begin
  if not ist_plattform_admin_aktuell() then
    raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501';
  end if;
  if p_user is null or p_user = auth.uid() then
    raise exception 'Das eigene Konto kann hier nicht gelöscht werden.' using errcode = 'P0001';
  end if;
  if v_grund is null then
    raise exception 'Bitte einen Grund angeben.' using errcode = 'P0001';
  end if;
  select nullif(btrim(coalesce(p.vorname, '') || ' ' || coalesce(p.nachname, '')), '') into v_name from profiles p where p.id = p_user;
  if not found then
    raise exception 'Konto nicht gefunden.' using errcode = 'P0001';
  end if;
  for h in select * from konto_loeschung_hindernisse(p_user) loop
    raise exception '%', case h.grund
      when 'verein' then 'Die Person ist noch Mitglied in einem Verein. Der Verein muss sie zuerst entfernen (Vereinsdaten verwaltet der Verein).'
      when 'lizenz' then 'Die Person hat noch eine laufende BASIC-Lizenz. Bitte zuerst kündigen (Tarife & Lizenzen).'
      when 'offene_zahlung' then 'Es gibt noch eine offene Überweisung dieser Person. Bitte zuerst begleichen oder stornieren.'
      when 'plattformadmin' then 'Konten der TanzRaum-Administration können nicht gelöscht werden.'
      when 'juryraum' then 'Die Person hat im JuryRaum noch Einträge angelegt. Bitte zuerst übergeben.'
      else h.text end using errcode = 'P0001';
  end loop;

  v_ab := case when p_sofort then now() else now() + interval '14 days' end;
  insert into konto_loeschungen (user_id, loeschen_ab, durch_admin, grund)
  values (p_user, v_ab, true, v_grund)
  on conflict (user_id) do update set loeschen_ab = least(konto_loeschungen.loeschen_ab, excluded.loeschen_ab), durch_admin = true,
    grund = excluded.grund, widerruf_token_hash = null, token_laeuft_ab = null
  returning loeschen_ab into v_ab;
  -- Sofort sperren und abmelden
  update auth.users set banned_until = '2999-12-31'::timestamptz where id = p_user;
  delete from auth.sessions where user_id = p_user;
  insert into admin_konto_aktionen (admin_id, ziel_user, ziel_name, aktion, grund)
  values (auth.uid(), p_user, v_name, case when p_sofort then 'loeschen_sofort' else 'loeschen_geplant' end, v_grund);

  -- Sofort: Lösch-Lauf direkt anstoßen (sonst nächtlich um 3:50 Uhr)
  if p_sofort then
    perform net.http_post(
      url := 'https://oraiqjulxmohclfixwdq.supabase.co/functions/v1/konto-loeschung',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-tanzraum-geheimnis',
                   (select decrypted_secret from vault.decrypted_secrets where name = 'chat_push_geheimnis')),
      body := jsonb_build_object('art', 'ausfuehren'));
  end if;
  return v_ab;
end;
$$;

create or replace function public.admin_konto_loeschung_abbrechen(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  if not ist_plattform_admin_aktuell() then
    raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501';
  end if;
  if not exists (select 1 from konto_loeschungen k where k.user_id = p_user and k.durch_admin and k.loeschen_ab > now()) then
    raise exception 'Keine geplante Löschung durch die Administration gefunden.' using errcode = 'P0001';
  end if;
  delete from konto_loeschungen where user_id = p_user;
  update auth.users set banned_until = null where id = p_user;
  select nullif(btrim(coalesce(p.vorname, '') || ' ' || coalesce(p.nachname, '')), '') into v_name from profiles p where p.id = p_user;
  insert into admin_konto_aktionen (admin_id, ziel_user, ziel_name, aktion, grund) values (auth.uid(), p_user, v_name, 'loeschen_abgebrochen', null);
end;
$$;

-- Von der Administration geplante Löschungen kann die Person nicht per Mail-Link widerrufen
do $$
declare
  d text := pg_get_functiondef('public.konto_loeschung_widerrufen(text)'::regprocedure);
  alt text := 'and k.loeschen_ab > now()';
begin
  if position(alt in d) = 0 then raise exception 'konto_loeschung_widerrufen: Stelle nicht gefunden'; end if;
  execute replace(d, alt, 'and k.loeschen_ab > now() and not k.durch_admin');
end $$;

revoke all on function public.admin_benutzer_suche(text), public.admin_konto_loeschen(uuid, text, boolean), public.admin_konto_loeschung_abbrechen(uuid) from public, anon;
grant execute on function public.admin_benutzer_suche(text), public.admin_konto_loeschen(uuid, text, boolean), public.admin_konto_loeschung_abbrechen(uuid) to authenticated;

-- Beim endgültigen Löschen auch eigene Börsen-Bilder und persönliche Musik aus dem Speicher entfernen
do $$
declare
  d text := pg_get_functiondef('public.konto_loeschungen_faellig(text)'::regprocedure);
  alt text := $a$'[]'::jsonb));$a$;
begin
  if position(alt in d) = 0 then raise exception 'konto_loeschungen_faellig: Stelle nicht gefunden'; end if;
  execute replace(d, alt, $n$'[]'::jsonb),
      'boerse', coalesce((select jsonb_agg(b) from boerse_angebote a cross join unnest(a.bilder) b where a.user_id = k.user_id), '[]'::jsonb),
      'musik', coalesce((select jsonb_agg(m.datei_pfad) from musik_titel m where m.user_id = k.user_id and m.verein_id is null), '[]'::jsonb));$n$);
end $$;
