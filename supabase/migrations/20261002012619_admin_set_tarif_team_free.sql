-- Bestehende Admin-Funktion: TEAM_FREE bleibt beim Tarifwechsel unberuehrt (Team und Freischaltung sind getrennt)
CREATE OR REPLACE FUNCTION public.admin_set_tarif(p_typ text, p_ziel_id uuid, p_neuer_tarif text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  if p_typ = 'person' then
    update abos set status = 'expired', aktualisiert_am = now()
    where inhaber = 'person' and user_id = p_ziel_id and anbieter = 'manuell' and status in ('active', 'paused_by_organization')
      and freischaltung is distinct from 'team_free';
    if p_neuer_tarif = 'basic' then
      insert into abos (inhaber, user_id, tarif, periode, anbieter, status, freischaltung, erteilt_von)
      values ('person', p_ziel_id, 'basic', 'unbefristet', 'manuell', 'active', 'manual_free', auth.uid());
    end if;
    perform tarif_neu_berechnen_person(p_ziel_id, 'admin');
  elsif p_typ = 'verein' then
    update abos set status = 'expired', aktualisiert_am = now()
    where inhaber = 'verein' and verein_id = p_ziel_id and anbieter = 'manuell' and status = 'active';
    if p_neuer_tarif = 'verein' then
      insert into abos (inhaber, user_id, verein_id, tarif, periode, anbieter, status, freischaltung, erteilt_von)
      values ('verein', auth.uid(), p_ziel_id, 'verein', 'unbefristet', 'manuell', 'active', 'manual_free', auth.uid());
    end if;
    perform tarif_neu_berechnen_verein(p_ziel_id, 'admin');
  else
    return jsonb_build_object('success', false, 'error', 'Unbekannter Typ');
  end if;
  perform protokollieren('tarif_geaendert', case when p_typ = 'person' then p_ziel_id end,
    jsonb_build_object('typ', p_typ, 'verein_id', case when p_typ = 'verein' then p_ziel_id end, 'tarif', p_neuer_tarif));
  return jsonb_build_object('success', true);
end;
$function$;
