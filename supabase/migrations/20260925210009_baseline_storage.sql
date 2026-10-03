-- TanzRaum – Baseline-Migration 9/12: Storage-Buckets (7) und Storage-Policies (22)
-- Exportiert aus dem Produktionsstand (Supabase-Projekt oraiqjulxmohclfixwdq) am 2026-09-25.
-- Nur für den Aufbau einer NEUEN/LEEREN Supabase-Datenbank gedacht.
-- NICHT gegen die Produktions-DB ausführen (dort existiert alles bereits) – siehe README.md.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('chat-bilder', 'chat-bilder', false, 5242880, '{image/jpeg,image/png,image/webp,image/gif}'::text[]) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('chat-dateien', 'chat-dateien', false, 26214400, '{application/pdf,text/plain,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.oasis.opendocument.text,application/vnd.oasis.opendocument.spreadsheet,application/zip,audio/webm,audio/ogg,audio/mp4,audio/mpeg,audio/aac,audio/wav,audio/x-m4a,video/mp4,video/quicktime,video/webm}'::text[]) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('kassenbuch-belege', 'kassenbuch-belege', false, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('spotlights', 'spotlights', false, 5242880, '{image/jpeg,image/png,image/webp}'::text[]) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('verein-logos', 'verein-logos', true, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('vereins-dateien', 'vereins-dateien', false, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('vereinsdokumente', 'vereinsdokumente', true, NULL, NULL) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin lädt Satzung hoch/ersetzt" ON storage.objects AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((bucket_id = 'vereinsdokumente'::text) AND (EXISTS ( SELECT 1
   FROM (public.vereins_mitglieder vm
     JOIN public.rollen r ON ((r.id = vm.rolle_id)))
  WHERE (((vm.verein_id)::text = (storage.foldername(r.name))[1]) AND (vm.user_id = auth.uid()) AND ((r.name ~~* '%admin%'::text) OR (r.name ~~* '%leitung%'::text)))))));

CREATE POLICY "Chatbilder hochladen" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'chat-bilder'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'::text) AND public.darf_im_gespraech_schreiben(((storage.foldername(name))[1])::uuid)));

CREATE POLICY "Chatbilder loeschen" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'chat-bilder'::text) AND ((owner = auth.uid()) OR (((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'::text) AND public.ist_chat_leitung(((storage.foldername(name))[1])::uuid)))));

CREATE POLICY "Chatbilder sehen" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'chat-bilder'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'::text) AND public.hat_gespraech_zugriff(((storage.foldername(name))[1])::uuid)));

CREATE POLICY "Chatdateien hochladen" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'chat-dateien'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'::text) AND public.darf_im_gespraech_schreiben(((storage.foldername(name))[1])::uuid)));

CREATE POLICY "Chatdateien loeschen" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'chat-dateien'::text) AND ((owner = auth.uid()) OR (((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'::text) AND public.ist_chat_leitung(((storage.foldername(name))[1])::uuid)))));

CREATE POLICY "Chatdateien sehen" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'chat-dateien'::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'::text) AND public.hat_gespraech_zugriff(((storage.foldername(name))[1])::uuid)));

CREATE POLICY "Hochladen: Berechtigte" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'vereins-dateien'::text) AND ((((storage.foldername(name))[1] = 'verein'::text) AND public.ist_trainer_betreuer_oder_admin(((storage.foldername(name))[2])::uuid)) OR (((storage.foldername(name))[1] = 'user'::text) AND (((storage.foldername(name))[2])::uuid = auth.uid())))));

CREATE POLICY "Lesen: eigene oder Vereins-Dateien" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'vereins-dateien'::text) AND ((((storage.foldername(name))[1] = 'verein'::text) AND (EXISTS ( SELECT 1
   FROM public.vereins_mitglieder vm
  WHERE ((vm.verein_id = ((storage.foldername(objects.name))[2])::uuid) AND (vm.user_id = auth.uid()))))) OR (((storage.foldername(name))[1] = 'user'::text) AND (((storage.foldername(name))[2])::uuid = auth.uid())))));

CREATE POLICY "Loeschen: Berechtigte" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'vereins-dateien'::text) AND ((((storage.foldername(name))[1] = 'verein'::text) AND public.ist_trainer_betreuer_oder_admin(((storage.foldername(name))[2])::uuid)) OR (((storage.foldername(name))[1] = 'user'::text) AND (((storage.foldername(name))[2])::uuid = auth.uid())))));

CREATE POLICY "Mitglieder lesen Satzung" ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING (((bucket_id = 'vereinsdokumente'::text) AND (EXISTS ( SELECT 1
   FROM public.vereins_mitglieder vm
  WHERE (((vm.verein_id)::text = (storage.foldername(objects.name))[1]) AND (vm.user_id = auth.uid()))))));

CREATE POLICY "Nutzer loescht eigenes Spotlight-Medium" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'spotlights'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "Oeffentliches Lesen von Vereinslogos" ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING ((bucket_id = 'verein-logos'::text));

CREATE POLICY "Satzung ist oeffentlich lesbar" ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING ((bucket_id = 'vereinsdokumente'::text));

CREATE POLICY "Spotlight-Medien nach Sichtbarkeit" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'spotlights'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.spotlight_medium_sichtbar(name))));

CREATE POLICY "Vereinsadmin kann Logo aktualisieren" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'verein-logos'::text) AND public.is_verein_admin(((storage.foldername(name))[1])::uuid)));

CREATE POLICY "Vereinsadmin kann Logo hochladen" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'verein-logos'::text) AND public.is_verein_admin(((storage.foldername(name))[1])::uuid)));

CREATE POLICY "Vereinsadmin kann Logo loeschen" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'verein-logos'::text) AND public.is_verein_admin(((storage.foldername(name))[1])::uuid)));

CREATE POLICY "Vereinsadmin kann Satzung ersetzen" ON storage.objects AS PERMISSIVE FOR UPDATE TO public
  USING (((bucket_id = 'vereinsdokumente'::text) AND public.is_verein_admin(((storage.foldername(name))[1])::uuid)));

CREATE POLICY "Vereinsadmin kann Satzung hochladen" ON storage.objects AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((bucket_id = 'vereinsdokumente'::text) AND public.is_verein_admin(((storage.foldername(name))[1])::uuid)));

CREATE POLICY "Vereinsadmin kann Satzung loeschen" ON storage.objects AS PERMISSIVE FOR DELETE TO public
  USING (((bucket_id = 'vereinsdokumente'::text) AND public.is_verein_admin(((storage.foldername(name))[1])::uuid)));

CREATE POLICY "Vereinsadmin verwaltet eigene Belege" ON storage.objects AS PERMISSIVE FOR ALL TO public
  USING (((bucket_id = 'kassenbuch-belege'::text) AND public.is_verein_admin(((storage.foldername(name))[1])::uuid)))
  WITH CHECK (((bucket_id = 'kassenbuch-belege'::text) AND public.is_verein_admin(((storage.foldername(name))[1])::uuid)));
