-- Automatische Erinnerungen (Kostüm-Rückgabe, Beiträge) + wiederkehrende Beiträge (Sollstellung automatisch)
-- Läuft täglich per pg_cron; nur für Vereine mit aktiver Vereinslizenz. Jede Erinnerung höchstens einmal.

-- Wiederkehrende Beiträge
alter table public.beitragstypen add column if not exists automatisch boolean not null default false;
alter table public.beitragstypen add column if not exists naechste_faelligkeit date;

-- Merker, damit jede automatische Erinnerung nur einmal verschickt wird
alter table public.beitraege add column if not exists hinweis_faellig_am timestamptz;
alter table public.beitraege add column if not exists hinweis_ueberfaellig_am timestamptz;
alter table public.kostuem_ausgaben add column if not exists hinweis_bald_am timestamptz;
alter table public.kostuem_ausgaben add column if not exists hinweis_ueberfaellig_am timestamptz;

-- Nächstes Fälligkeitsdatum nach Rhythmus (einmalig: keins)
create or replace function public.beitrag_naechster_termin(p_datum date, p_rhythmus text)
returns date language sql immutable set search_path = public as $$
  select case p_rhythmus
    when 'monatlich' then (p_datum + interval '1 month')::date
    when 'vierteljährlich' then (p_datum + interval '3 months')::date
    when 'halbjährlich' then (p_datum + interval '6 months')::date
    when 'jährlich' then (p_datum + interval '1 year')::date
    else null end;
$$;

-- Empfänger: das Mitglied selbst und verknüpfte Eltern
create or replace function public.mitglied_und_eltern(p_vm_id uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select vm.user_id from vereins_mitglieder vm where vm.id = p_vm_id and vm.user_id is not null
  union
  select ve.user_id from eltern_kind_zuordnung ekz join vereins_mitglieder ve on ve.id = ekz.eltern_vm_id
   where ekz.kind_vm_id = p_vm_id and ve.user_id is not null;
$$;
revoke all on function public.mitglied_und_eltern(uuid) from public, anon, authenticated;

create or replace function public.vereins_erinnerungen_taeglich()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  heute date := (now() at time zone 'Europe/Berlin')::date;
  t record;
  r record;
  n_soll int := 0;
  n int;
  n_beitrag int := 0;
  n_kostuem int := 0;
begin
  -- 1) Wiederkehrende Beiträge: Sollstellung 14 Tage vor Fälligkeit für alle aktiven Mitglieder (ohne Eltern-Rolle)
  for t in
    select bt.* from beitragstypen bt
    where bt.automatisch and bt.aktiv and bt.naechste_faelligkeit is not null
      and bt.naechste_faelligkeit <= heute + 14 and verein_hat_lizenz(bt.verein_id)
    for update
  loop
    insert into beitraege (verein_id, vereins_mitglied_id, beitragstyp_id, beitragstyp_name, betrag, faellig, bezahlt, zahlungsweg)
    select t.verein_id, vm.id, t.id, t.name, t.betrag, t.naechste_faelligkeit, false, 'Überweisung'
    from vereins_mitglieder vm
    left join rollen ro on ro.id = vm.rolle_id
    where vm.verein_id = t.verein_id and coalesce(vm.aktiv, true) and vm.aufnahme_status = 'aufgenommen'
      and rollen_typ(ro.name) <> 'eltern'
    on conflict (vereins_mitglied_id, beitragstyp_id, faellig) where beitragstyp_id is not null do nothing;
    get diagnostics n = row_count;
    n_soll := n_soll + n;
    -- Weiterschalten (einmalig: Automatik endet)
    update beitragstypen
       set naechste_faelligkeit = beitrag_naechster_termin(t.naechste_faelligkeit, t.rhythmus),
           automatisch = beitrag_naechster_termin(t.naechste_faelligkeit, t.rhythmus) is not null
     where id = t.id;
  end loop;

  -- 2) Beiträge: am Fälligkeitstag bzw. 7 Tage danach (noch offen) je einmal erinnern
  for r in
    select b.id, b.vereins_mitglied_id, b.beitragstyp_name, b.betrag, b.faellig, v.name vname,
           (b.faellig < heute - 6) as ueberfaellig
    from beitraege b join vereine v on v.id = b.verein_id
    where not b.bezahlt and b.faellig is not null and verein_hat_lizenz(b.verein_id)
      and ((b.faellig <= heute and b.faellig > heute - 7 and b.hinweis_faellig_am is null)
        or (b.faellig < heute - 6 and b.hinweis_ueberfaellig_am is null))
    limit 5000
  loop
    insert into benachrichtigungen (user_id, typ, text)
    select u, 'beitrag',
           case when r.ueberfaellig then 'Beitrag überfällig bei ' else 'Beitrag heute fällig bei ' end
           || coalesce(r.vname, 'deinem Verein') || ': ' || r.beitragstyp_name || ' – '
           || to_char(r.betrag, 'FM999G990D00') || ' €, fällig ' || to_char(r.faellig, 'DD.MM.YYYY') || '.'
    from mitglied_und_eltern(r.vereins_mitglied_id) u;
    get diagnostics n = row_count;
    n_beitrag := n_beitrag + n;
    if r.ueberfaellig then
      update beitraege set hinweis_ueberfaellig_am = now(), hinweis_faellig_am = coalesce(hinweis_faellig_am, now()) where id = r.id;
    else
      update beitraege set hinweis_faellig_am = now() where id = r.id;
    end if;
  end loop;

  -- 3) Kostüme: 3 Tage vor Rückgabe und am Tag nach Ablauf je einmal erinnern (nur offene Ausgaben)
  for r in
    select a.id, a.vereins_mitglied_id, a.rueckgabe_bis, k.teil, k.groesse, v.name vname,
           (a.rueckgabe_bis < heute) as ueberfaellig
    from kostuem_ausgaben a
    join kostueme k on k.id = a.kostuem_id and k.vereins_mitglied_id = a.vereins_mitglied_id
    join vereine v on v.id = a.verein_id
    where a.zurueck_am is null and a.rueckgabe_bis is not null and verein_hat_lizenz(a.verein_id)
      and ((a.rueckgabe_bis between heute and heute + 3 and a.hinweis_bald_am is null)
        or (a.rueckgabe_bis < heute and a.hinweis_ueberfaellig_am is null))
    limit 5000
  loop
    insert into benachrichtigungen (user_id, typ, text)
    select u, 'kostuem',
           'Kostüme & Requisiten (' || coalesce(r.vname, 'Verein') || '): „' || r.teil || '“' || coalesce(' (Größe ' || r.groesse || ')', '')
           || case when r.ueberfaellig then ' hätte bis ' || to_char(r.rueckgabe_bis, 'DD.MM.YYYY') || ' zurückgegeben werden sollen – bitte bald zurückbringen.'
                   else ' bitte bis ' || to_char(r.rueckgabe_bis, 'DD.MM.YYYY') || ' zurückgeben.' end
    from mitglied_und_eltern(r.vereins_mitglied_id) u;
    get diagnostics n = row_count;
    n_kostuem := n_kostuem + n;
    if r.ueberfaellig then
      update kostuem_ausgaben set hinweis_ueberfaellig_am = now(), hinweis_bald_am = coalesce(hinweis_bald_am, now()) where id = r.id;
    else
      update kostuem_ausgaben set hinweis_bald_am = now() where id = r.id;
    end if;
  end loop;

  return jsonb_build_object('sollstellungen', n_soll, 'beitrag_hinweise', n_beitrag, 'kostuem_hinweise', n_kostuem);
end;
$$;
revoke all on function public.vereins_erinnerungen_taeglich() from public, anon, authenticated;

-- Täglich 07:05 UTC (vormittags in Deutschland)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'vereins-erinnerungen') then
    perform cron.unschedule('vereins-erinnerungen');
  end if;
  perform cron.schedule('vereins-erinnerungen', '5 7 * * *', 'select public.vereins_erinnerungen_taeglich()');
end $$;
