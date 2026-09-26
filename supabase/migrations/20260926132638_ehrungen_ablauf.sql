-- Ehrungen & Orden – Bestellablauf, Dokumente (Urkunde, Foto, PDF)
--
-- Dokumente liegen in einem eigenen privaten Bucket "ehrungs-dokumente" (Ordner = Vereins-ID). Die allgemeine
-- Vereinsablage ist fuer alle Vereinsmitglieder lesbar und daher fuer interne Ehrungsunterlagen ungeeignet.

-- ---------------------------------------------------------------------------------------------
-- Bestellung vorbereiten: mehrere vorgemerkte/gepruefte Ehrungen zu einer Bestellung zusammenfassen
-- ---------------------------------------------------------------------------------------------
create or replace function public.ehrungen_bestellung_vorbereiten(p_verein_id uuid, p_vorgaenge uuid[], p_bezeichnung text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if not ehrungen_berechtigt(p_verein_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if coalesce(array_length(p_vorgaenge, 1), 0) = 0 then
    raise exception 'Bitte mindestens eine Ehrung auswählen.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from unnest(p_vorgaenge) x(id)
    left join mitglied_ehrungen me on me.id = x.id
    left join ehrungsarten a on a.id = me.ehrungsart_id
    where me.id is null or me.verein_id <> p_verein_id or me.status not in ('geprueft', 'vorgemerkt')
       or me.bestellung_id is not null or not a.bestellung_erforderlich) then
    raise exception 'Nur geprüfte oder vorgemerkte Ehrungen, die bestellt werden müssen und noch keiner Bestellung zugeordnet sind, können vorbereitet werden.'
      using errcode = 'P0001';
  end if;
  insert into ehrungs_bestellungen (verein_id, bezeichnung)
  values (p_verein_id, coalesce(nullif(trim(p_bezeichnung), ''), 'Bestellung vom ' || to_char(now() at time zone 'Europe/Berlin', 'DD.MM.YYYY')))
  returning id into v_id;
  update mitglied_ehrungen set bestellung_id = v_id, status = 'vorgemerkt',
         aenderungs_begruendung = 'Für Bestellung vorbereitet'
  where id = any(p_vorgaenge);
  return v_id;
end;
$function$;

-- Status einer Bestellung fuer alle enthaltenen Ehrungen setzen (bestellt nur mit Pruefbestaetigung)
create or replace function public.ehrungen_bestellung_status(p_bestellung_id uuid, p_status text, p_datum date default null,
                                                            p_bestellnummer text default null, p_anbieter text default null,
                                                            p_bemerkung text default null, p_geprueft boolean default false)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  b ehrungs_bestellungen%rowtype;
  v_tag date := coalesce(p_datum, (now() at time zone 'Europe/Berlin')::date);
begin
  select * into b from ehrungs_bestellungen where id = p_bestellung_id;
  if b.id is null or not ehrungen_berechtigt(b.verein_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if p_status = 'bestellt' then
    if b.status <> 'vorbereitet' then raise exception 'Diese Bestellung ist nicht mehr in Vorbereitung.' using errcode = 'P0001'; end if;
    if not coalesce(p_geprueft, false) then
      raise exception 'Bitte bestätigen Sie vor der Bestellung, dass Sie die Angaben geprüft haben.' using errcode = 'P0001';
    end if;
    update ehrungs_bestellungen set status = 'bestellt', bestellt_am = v_tag, bestellnummer = nullif(trim(p_bestellnummer), ''),
           anbieter = nullif(trim(p_anbieter), ''), bemerkung = coalesce(nullif(trim(p_bemerkung), ''), bemerkung)
    where id = b.id;
    update mitglied_ehrungen set status = 'bestellt', bestellt_am = v_tag, bestellung_geprueft_am = now(),
           bestellung_geprueft_von = auth.uid(), aenderungs_begruendung = 'Bestellung: ' || b.bezeichnung
    where bestellung_id = b.id and status in ('geprueft', 'vorgemerkt');
  elsif p_status = 'erhalten' then
    if b.status <> 'bestellt' then raise exception 'Nur bestellte Bestellungen können als erhalten markiert werden.' using errcode = 'P0001'; end if;
    update ehrungs_bestellungen set status = 'erhalten', geliefert_am = v_tag where id = b.id;
    update mitglied_ehrungen set status = 'erhalten', erhalten_am = v_tag, aenderungs_begruendung = 'Bestellung erhalten: ' || b.bezeichnung
    where bestellung_id = b.id and status = 'bestellt';
  elsif p_status = 'storniert' then
    if b.status not in ('vorbereitet', 'bestellt') then raise exception 'Diese Bestellung kann nicht mehr storniert werden.' using errcode = 'P0001'; end if;
    update mitglied_ehrungen set status = 'vorgemerkt', bestellung_id = null, aenderungs_begruendung = 'Bestellung storniert: ' || b.bezeichnung
    where bestellung_id = b.id and status in ('vorgemerkt', 'geprueft', 'bestellt');
    update ehrungs_bestellungen set status = 'storniert', bemerkung = coalesce(nullif(trim(p_bemerkung), ''), bemerkung) where id = b.id;
  else
    raise exception 'Unbekannter Status.' using errcode = 'P0001';
  end if;
end;
$function$;

-- ---------------------------------------------------------------------------------------------
-- Dokumente zu einer Ehrung
-- ---------------------------------------------------------------------------------------------
create table public.mitglied_ehrung_dokumente (
  id uuid primary key default gen_random_uuid(),
  verein_id uuid not null references public.vereine(id) on delete cascade,
  mitglied_ehrung_id uuid not null references public.mitglied_ehrungen(id) on delete cascade,
  art text not null default 'dokument' check (art in ('urkunde', 'foto', 'dokument')),
  name text not null,
  storage_path text not null unique,
  mime_type text,
  groesse_bytes bigint not null default 0,
  hochgeladen_von uuid default auth.uid(),
  hochgeladen_am timestamptz not null default now()
);
create index mitglied_ehrung_dokumente_vorgang_idx on public.mitglied_ehrung_dokumente (mitglied_ehrung_id);

create or replace function public.mitglied_ehrung_dokumente_pruefen()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from mitglied_ehrungen me where me.id = new.mitglied_ehrung_id and me.verein_id = new.verein_id) then
      raise exception 'Die Ehrung gehört nicht zu diesem Verein.' using errcode = 'P0001';
    end if;
    if split_part(new.storage_path, '/', 1) <> new.verein_id::text then
      raise exception 'Ungültiger Speicherort.' using errcode = 'P0001';
    end if;
    insert into ehrungs_historie (verein_id, mitglied_ehrung_id, aktion, neu)
    values (new.verein_id, new.mitglied_ehrung_id, 'dokument', jsonb_build_object('dokument', new.name, 'art', new.art));
    return new;
  end if;
  insert into ehrungs_historie (verein_id, mitglied_ehrung_id, aktion, alt)
  select old.verein_id, old.mitglied_ehrung_id, 'dokument_entfernt', jsonb_build_object('dokument', old.name, 'art', old.art)
  where exists (select 1 from mitglied_ehrungen me where me.id = old.mitglied_ehrung_id);
  return old;
end;
$function$;
create trigger mitglied_ehrung_dokumente_pruefen before insert or delete on public.mitglied_ehrung_dokumente
  for each row execute function public.mitglied_ehrung_dokumente_pruefen();

alter table public.mitglied_ehrung_dokumente enable row level security;
create policy "Ehrungen: Dokumente (Vereinsadmin)" on public.mitglied_ehrung_dokumente for all to authenticated
  using (ehrungen_berechtigt(verein_id)) with check (ehrungen_berechtigt(verein_id));

revoke all on table public.mitglied_ehrung_dokumente from public, anon, authenticated;
grant select, insert, delete on table public.mitglied_ehrung_dokumente to authenticated;
grant all on table public.mitglied_ehrung_dokumente to service_role;

-- Privater Speicher: nur Vereinsadmins mit Vereinslizenz des jeweiligen Vereins (Ordner = Vereins-ID)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ehrungs-dokumente', 'ehrungs-dokumente', false, 10485760, '{application/pdf,image/jpeg,image/png,image/webp}'::text[])
on conflict (id) do nothing;

create policy "Ehrungsdokumente lesen (Vereinsadmin)" on storage.objects for select to authenticated
  using (bucket_id = 'ehrungs-dokumente' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
         and public.ehrungen_berechtigt(((storage.foldername(name))[1])::uuid));
create policy "Ehrungsdokumente hochladen (Vereinsadmin)" on storage.objects for insert to authenticated
  with check (bucket_id = 'ehrungs-dokumente' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
              and public.ehrungen_berechtigt(((storage.foldername(name))[1])::uuid));
create policy "Ehrungsdokumente loeschen (Vereinsadmin)" on storage.objects for delete to authenticated
  using (bucket_id = 'ehrungs-dokumente' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
         and public.ehrungen_berechtigt(((storage.foldername(name))[1])::uuid));

-- ---------------------------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------------------------
revoke all on function public.ehrungen_bestellung_vorbereiten(uuid, uuid[], text) from public, anon;
revoke all on function public.ehrungen_bestellung_status(uuid, text, date, text, text, text, boolean) from public, anon;
grant execute on function public.ehrungen_bestellung_vorbereiten(uuid, uuid[], text),
  public.ehrungen_bestellung_status(uuid, text, date, text, text, text, boolean) to authenticated, service_role;
revoke all on function public.mitglied_ehrung_dokumente_pruefen() from public, anon, authenticated;
