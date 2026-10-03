-- TanzRaum – Baseline-Migration 11/12: Cron-Jobs (6)
-- Exportiert aus dem Produktionsstand (Supabase-Projekt oraiqjulxmohclfixwdq) am 2026-09-25.
-- Nur für den Aufbau einer NEUEN/LEEREN Supabase-Datenbank gedacht.
-- NICHT gegen die Produktions-DB ausführen (dort existiert alles bereits) – siehe README.md.

-- Voraussetzung: Vault-Secret 'chat_push_geheimnis' ist gesetzt (siehe README.md).
-- Bei einem anderen Projekt die Projekt-URL in den http_post-Aufrufen anpassen.
-- cron.schedule mit gleichem Namen aktualisiert einen bestehenden Job (idempotent).
SELECT cron.schedule('abo-abgleich', '3-59/10 * * * *', '
  select net.http_post(
    url := ''https://oraiqjulxmohclfixwdq.supabase.co/functions/v1/abo-abgleich'',
    headers := jsonb_build_object(''Content-Type'',''application/json'',''x-tanzraum-geheimnis'',(select decrypted_secret from vault.decrypted_secrets where name = ''chat_push_geheimnis'')),
    body := ''{}''::jsonb
  );
');
SELECT cron.schedule('abos-ablaufen', '*/10 * * * *', 'select public.abos_ablaufen()');
SELECT cron.schedule('anrufe-aufraeumen', '* * * * *', 'select public.anrufe_aufraeumen()');
SELECT cron.schedule('cleanup-expired-spotlights-hourly', '5 * * * *', '
  select net.http_post(
    url := ''https://oraiqjulxmohclfixwdq.supabase.co/functions/v1/cleanup-expired-spotlights'',
    headers := ''{"Content-Type": "application/json"}''::jsonb
  );
  ');
SELECT cron.schedule('mail-log-aufraeumen', '17 3 * * *', 'delete from public.mail_versand_log where erstellt_am < now() - interval ''90 days''');
SELECT cron.schedule('termin-erinnerungen', '0 16 * * *', 'select public.termin_erinnerungen_senden()');
