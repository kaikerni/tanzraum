-- TanzRaum – Baseline-Migration 4/12: Fremdschlüssel (172)
-- Exportiert aus dem Produktionsstand (Supabase-Projekt oraiqjulxmohclfixwdq) am 2026-09-25.
-- Nur für den Aufbau einer NEUEN/LEEREN Supabase-Datenbank gedacht.
-- NICHT gegen die Produktions-DB ausführen (dort existiert alles bereits) – siehe README.md.

ALTER TABLE ONLY public.abos
    ADD CONSTRAINT abos_pause_verein_id_fkey FOREIGN KEY (pause_verein_id) REFERENCES public.vereine(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.abos
    ADD CONSTRAINT abos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.abos
    ADD CONSTRAINT abos_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anruf_signale
    ADD CONSTRAINT anruf_signale_an_fkey FOREIGN KEY (an) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anruf_signale
    ADD CONSTRAINT anruf_signale_anruf_id_fkey FOREIGN KEY (anruf_id) REFERENCES public.anrufe(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anruf_signale
    ADD CONSTRAINT anruf_signale_von_fkey FOREIGN KEY (von) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anrufe
    ADD CONSTRAINT anrufe_angerufener_id_fkey FOREIGN KEY (angerufener_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anrufe
    ADD CONSTRAINT anrufe_anrufer_id_fkey FOREIGN KEY (anrufer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anrufe
    ADD CONSTRAINT anrufe_gespraech_id_fkey FOREIGN KEY (gespraech_id) REFERENCES public.gespraeche(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.beitraege
    ADD CONSTRAINT beitraege_beitragstyp_id_fkey FOREIGN KEY (beitragstyp_id) REFERENCES public.beitragstypen(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.beitraege
    ADD CONSTRAINT beitraege_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.beitraege
    ADD CONSTRAINT beitraege_vereins_mitglied_id_fkey FOREIGN KEY (vereins_mitglied_id) REFERENCES public.vereins_mitglieder(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.beitragstypen
    ADD CONSTRAINT beitragstypen_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.beitritts_anfragen
    ADD CONSTRAINT beitritts_anfragen_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.beitritts_anfragen
    ADD CONSTRAINT beitritts_anfragen_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.benachrichtigungen
    ADD CONSTRAINT benachrichtigungen_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.blockierungen
    ADD CONSTRAINT blockierungen_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.blockierungen
    ADD CONSTRAINT blockierungen_blockiert_id_fkey FOREIGN KEY (blockiert_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.chat_stumm
    ADD CONSTRAINT chat_stumm_gespraech_id_fkey FOREIGN KEY (gespraech_id) REFERENCES public.gespraeche(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.chat_stumm
    ADD CONSTRAINT chat_stumm_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.dateien
    ADD CONSTRAINT dateien_hochgeladen_von_fkey FOREIGN KEY (hochgeladen_von) REFERENCES auth.users(id);

ALTER TABLE ONLY public.dateien
    ADD CONSTRAINT dateien_turnier_id_fkey FOREIGN KEY (turnier_id) REFERENCES public.turniere(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.dateien
    ADD CONSTRAINT dateien_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.dateien
    ADD CONSTRAINT dateien_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.eigene_kontakte
    ADD CONSTRAINT eigene_kontakte_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.eigene_vereinsnotizen
    ADD CONSTRAINT eigene_vereinsnotizen_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.einladungen
    ADD CONSTRAINT einladungen_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE ONLY public.einladungen
    ADD CONSTRAINT einladungen_gruppe_id_fkey FOREIGN KEY (gruppe_id) REFERENCES public.gruppen(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.einladungen
    ADD CONSTRAINT einladungen_rolle_id_fkey FOREIGN KEY (rolle_id) REFERENCES public.rollen(id);

ALTER TABLE ONLY public.einladungen
    ADD CONSTRAINT einladungen_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.eltern_code_versuche
    ADD CONSTRAINT eltern_code_versuche_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.eltern_codes
    ADD CONSTRAINT eltern_codes_kind_id_fkey FOREIGN KEY (kind_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.eltern_kind_zuordnung
    ADD CONSTRAINT eltern_kind_zuordnung_eltern_vm_id_fkey FOREIGN KEY (eltern_vm_id) REFERENCES public.vereins_mitglieder(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.eltern_kind_zuordnung
    ADD CONSTRAINT eltern_kind_zuordnung_kind_vm_id_fkey FOREIGN KEY (kind_vm_id) REFERENCES public.vereins_mitglieder(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.eltern_kind_zuordnung
    ADD CONSTRAINT eltern_kind_zuordnung_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.eltern_verknuepfungen
    ADD CONSTRAINT eltern_verknuepfungen_bestaetigt_von_fkey FOREIGN KEY (bestaetigt_von) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.eltern_verknuepfungen
    ADD CONSTRAINT eltern_verknuepfungen_eltern_id_fkey FOREIGN KEY (eltern_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.eltern_verknuepfungen
    ADD CONSTRAINT eltern_verknuepfungen_kind_id_fkey FOREIGN KEY (kind_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.eltern_verknuepfungen
    ADD CONSTRAINT eltern_verknuepfungen_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.fernwartungs_anfragen
    ADD CONSTRAINT fernwartungs_anfragen_angefordert_von_fkey FOREIGN KEY (angefordert_von) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.fernwartungs_anfragen
    ADD CONSTRAINT fernwartungs_anfragen_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.gespraech_teilnehmer
    ADD CONSTRAINT gespraech_teilnehmer_gespraech_id_fkey FOREIGN KEY (gespraech_id) REFERENCES public.gespraeche(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.gespraech_teilnehmer
    ADD CONSTRAINT gespraech_teilnehmer_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.gespraeche
    ADD CONSTRAINT gespraeche_erstellt_von_fkey FOREIGN KEY (erstellt_von) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.gespraeche
    ADD CONSTRAINT gespraeche_gruppe_id_fkey FOREIGN KEY (gruppe_id) REFERENCES public.gruppen(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.gespraeche
    ADD CONSTRAINT gespraeche_turnier_id_fkey FOREIGN KEY (turnier_id) REFERENCES public.turniere(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.gespraeche
    ADD CONSTRAINT gespraeche_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.gruppen
    ADD CONSTRAINT gruppen_altersklasse_id_fkey FOREIGN KEY (altersklasse_id) REFERENCES public.altersklassen(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.gruppen
    ADD CONSTRAINT gruppen_disziplin_id_fkey FOREIGN KEY (disziplin_id) REFERENCES public.disziplinen(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.gruppen
    ADD CONSTRAINT gruppen_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.gruppen_mitglieder
    ADD CONSTRAINT gruppen_mitglieder_gruppe_id_fkey FOREIGN KEY (gruppe_id) REFERENCES public.gruppen(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.gruppen_mitglieder
    ADD CONSTRAINT gruppen_mitglieder_vereins_mitglied_id_fkey FOREIGN KEY (vereins_mitglied_id) REFERENCES public.vereins_mitglieder(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.invite_links
    ADD CONSTRAINT invite_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.invite_links
    ADD CONSTRAINT invite_links_used_by_fkey FOREIGN KEY (used_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.invite_links
    ADD CONSTRAINT invite_links_ziel_verein_id_fkey FOREIGN KEY (ziel_verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.juryraum_besetzungen
    ADD CONSTRAINT juryraum_besetzungen_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.juryraum_besetzungen
    ADD CONSTRAINT juryraum_besetzungen_turnier_id_fkey FOREIGN KEY (turnier_id) REFERENCES public.turniere(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.juryraum_einladungen
    ADD CONSTRAINT juryraum_einladungen_eingeladen_von_fkey FOREIGN KEY (eingeladen_von) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.juryraum_einladungen
    ADD CONSTRAINT juryraum_einladungen_verband_id_fkey FOREIGN KEY (verband_id) REFERENCES public.verbaende(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.juryraum_einsatz_zusagen
    ADD CONSTRAINT juryraum_einsatz_zusagen_eingeladen_von_fkey FOREIGN KEY (eingeladen_von) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.juryraum_einsatz_zusagen
    ADD CONSTRAINT juryraum_einsatz_zusagen_turnier_id_fkey FOREIGN KEY (turnier_id) REFERENCES public.turniere(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.juryraum_einsatz_zusagen
    ADD CONSTRAINT juryraum_einsatz_zusagen_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.juryraum_fahrgemeinschaften
    ADD CONSTRAINT juryraum_fahrgemeinschaften_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.juryraum_fahrgemeinschaften
    ADD CONSTRAINT juryraum_fahrgemeinschaften_turnier_id_fkey FOREIGN KEY (turnier_id) REFERENCES public.turniere(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.juryraum_fernwartungs_zugriff
    ADD CONSTRAINT juryraum_fernwartungs_zugriff_gewaehrt_von_fkey FOREIGN KEY (gewaehrt_von) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.juryraum_fernwartungs_zugriff
    ADD CONSTRAINT juryraum_fernwartungs_zugriff_ziel_user_id_fkey FOREIGN KEY (ziel_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.juryraum_mitglieder
    ADD CONSTRAINT juryraum_mitglieder_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.juryraum_mitglieder
    ADD CONSTRAINT juryraum_mitglieder_verband_id_fkey FOREIGN KEY (verband_id) REFERENCES public.verbaende(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.juryraum_unterkuenfte
    ADD CONSTRAINT juryraum_unterkuenfte_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.juryraum_unterkuenfte
    ADD CONSTRAINT juryraum_unterkuenfte_turnier_id_fkey FOREIGN KEY (turnier_id) REFERENCES public.turniere(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.juryraum_verfuegbarkeiten
    ADD CONSTRAINT juryraum_verfuegbarkeiten_turnier_id_fkey FOREIGN KEY (turnier_id) REFERENCES public.turniere(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.juryraum_verfuegbarkeiten
    ADD CONSTRAINT juryraum_verfuegbarkeiten_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.kassenbuch_eintraege
    ADD CONSTRAINT kassenbuch_eintraege_erstellt_von_fkey FOREIGN KEY (erstellt_von) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.kassenbuch_eintraege
    ADD CONSTRAINT kassenbuch_eintraege_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.kind_einstellungen
    ADD CONSTRAINT kind_einstellungen_geaendert_von_fkey FOREIGN KEY (geaendert_von) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.kind_einstellungen
    ADD CONSTRAINT kind_einstellungen_kind_id_fkey FOREIGN KEY (kind_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.kostuem_gruppen
    ADD CONSTRAINT kostuem_gruppen_altersklasse_id_fkey FOREIGN KEY (altersklasse_id) REFERENCES public.altersklassen(id);

ALTER TABLE ONLY public.kostuem_gruppen
    ADD CONSTRAINT kostuem_gruppen_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.kostueme
    ADD CONSTRAINT kostueme_kostuem_gruppe_id_fkey FOREIGN KEY (kostuem_gruppe_id) REFERENCES public.kostuem_gruppen(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.kostueme
    ADD CONSTRAINT kostueme_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.kostueme
    ADD CONSTRAINT kostueme_vereins_mitglied_id_fkey FOREIGN KEY (vereins_mitglied_id) REFERENCES public.vereins_mitglieder(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.login_ips
    ADD CONSTRAINT login_ips_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.mail_versand_log
    ADD CONSTRAINT mail_versand_log_absender_user_fkey FOREIGN KEY (absender_user) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.mail_versand_log
    ADD CONSTRAINT mail_versand_log_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.meldungen
    ADD CONSTRAINT meldungen_bearbeitet_von_fkey FOREIGN KEY (bearbeitet_von) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.meldungen
    ADD CONSTRAINT meldungen_melder_id_fkey FOREIGN KEY (melder_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.meldungen
    ADD CONSTRAINT meldungen_spotlight_id_fkey FOREIGN KEY (spotlight_id) REFERENCES public.spotlights(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.meldungen
    ADD CONSTRAINT meldungen_ziel_user_id_fkey FOREIGN KEY (ziel_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.mitglieder
    ADD CONSTRAINT mitglieder_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.mitglieder
    ADD CONSTRAINT mitglieder_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.mitgliedsantraege
    ADD CONSTRAINT mitgliedsantraege_mitglied_id_fkey FOREIGN KEY (mitglied_id) REFERENCES public.mitglieder(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.mitgliedsantraege
    ADD CONSTRAINT mitgliedsantraege_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.mitgliedsantraege
    ADD CONSTRAINT mitgliedsantraege_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.nachricht_reaktionen
    ADD CONSTRAINT nachricht_reaktionen_gespraech_id_fkey FOREIGN KEY (gespraech_id) REFERENCES public.gespraeche(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.nachricht_reaktionen
    ADD CONSTRAINT nachricht_reaktionen_nachricht_id_fkey FOREIGN KEY (nachricht_id) REFERENCES public.nachrichten(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.nachricht_reaktionen
    ADD CONSTRAINT nachricht_reaktionen_sticker_fk FOREIGN KEY (emoji) REFERENCES public.sticker(id);

ALTER TABLE ONLY public.nachricht_reaktionen
    ADD CONSTRAINT nachricht_reaktionen_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.nachrichten
    ADD CONSTRAINT nachrichten_antwort_auf_fkey FOREIGN KEY (antwort_auf) REFERENCES public.nachrichten(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.nachrichten
    ADD CONSTRAINT nachrichten_gespraech_id_fkey FOREIGN KEY (gespraech_id) REFERENCES public.gespraeche(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.nachrichten
    ADD CONSTRAINT nachrichten_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.nachrichten
    ADD CONSTRAINT nachrichten_sticker_fkey FOREIGN KEY (sticker) REFERENCES public.sticker(id);

ALTER TABLE ONLY public.onboarding_progress
    ADD CONSTRAINT onboarding_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.onboarding_progress
    ADD CONSTRAINT onboarding_progress_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.rechnungen
    ADD CONSTRAINT rechnungen_ziel_user_id_fkey FOREIGN KEY (ziel_user_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.rechnungen
    ADD CONSTRAINT rechnungen_ziel_verein_id_fkey FOREIGN KEY (ziel_verein_id) REFERENCES public.vereine(id);

ALTER TABLE ONLY public.spenden
    ADD CONSTRAINT spenden_erstellt_von_fkey FOREIGN KEY (erstellt_von) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.spenden
    ADD CONSTRAINT spenden_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.spotlight_reactions
    ADD CONSTRAINT spotlight_reactions_spotlight_id_fkey FOREIGN KEY (spotlight_id) REFERENCES public.spotlights(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.spotlight_reactions
    ADD CONSTRAINT spotlight_reactions_sticker_fk FOREIGN KEY (emoji) REFERENCES public.sticker(id);

ALTER TABLE ONLY public.spotlight_reactions
    ADD CONSTRAINT spotlight_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.spotlight_views
    ADD CONSTRAINT spotlight_views_spotlight_id_fkey FOREIGN KEY (spotlight_id) REFERENCES public.spotlights(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.spotlight_views
    ADD CONSTRAINT spotlight_views_viewer_user_id_fkey FOREIGN KEY (viewer_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.spotlights
    ADD CONSTRAINT spotlights_sticker_fkey FOREIGN KEY (sticker) REFERENCES public.sticker(id);

ALTER TABLE ONLY public.spotlights
    ADD CONSTRAINT spotlights_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tarif_ereignisse
    ADD CONSTRAINT tarif_ereignisse_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tarif_ereignisse
    ADD CONSTRAINT tarif_ereignisse_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.termin_rueckmeldungen
    ADD CONSTRAINT termin_rueckmeldungen_geaendert_von_fkey FOREIGN KEY (geaendert_von) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.termin_rueckmeldungen
    ADD CONSTRAINT termin_rueckmeldungen_termin_id_fkey FOREIGN KEY (termin_id) REFERENCES public.termine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.termin_rueckmeldungen
    ADD CONSTRAINT termin_rueckmeldungen_vereins_mitglied_id_fkey FOREIGN KEY (vereins_mitglied_id) REFERENCES public.vereins_mitglieder(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.termine
    ADD CONSTRAINT termine_erstellt_von_fkey FOREIGN KEY (erstellt_von) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.termine
    ADD CONSTRAINT termine_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.trainings_abmeldungen
    ADD CONSTRAINT trainings_abmeldungen_gruppe_id_fkey FOREIGN KEY (gruppe_id) REFERENCES public.gruppen(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.trainings_abmeldungen
    ADD CONSTRAINT trainings_abmeldungen_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.trainings_abmeldungen
    ADD CONSTRAINT trainings_abmeldungen_vereins_mitglied_id_fkey FOREIGN KEY (vereins_mitglied_id) REFERENCES public.vereins_mitglieder(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.trainings_anwesenheit
    ADD CONSTRAINT trainings_anwesenheit_erfasst_von_fkey FOREIGN KEY (erfasst_von) REFERENCES auth.users(id);

ALTER TABLE ONLY public.trainings_anwesenheit
    ADD CONSTRAINT trainings_anwesenheit_gruppe_id_fkey FOREIGN KEY (gruppe_id) REFERENCES public.gruppen(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.trainings_anwesenheit
    ADD CONSTRAINT trainings_anwesenheit_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.trainings_anwesenheit
    ADD CONSTRAINT trainings_anwesenheit_vereins_mitglied_id_fkey FOREIGN KEY (vereins_mitglied_id) REFERENCES public.vereins_mitglieder(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.trainingstermine
    ADD CONSTRAINT trainingstermine_erstellt_von_fkey FOREIGN KEY (erstellt_von) REFERENCES auth.users(id);

ALTER TABLE ONLY public.trainingstermine
    ADD CONSTRAINT trainingstermine_gruppe_id_fkey FOREIGN KEY (gruppe_id) REFERENCES public.gruppen(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.trainingstermine
    ADD CONSTRAINT trainingstermine_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.turnier_merkliste
    ADD CONSTRAINT turnier_merkliste_turnier_id_fkey FOREIGN KEY (turnier_id) REFERENCES public.turniere(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.turnier_merkliste
    ADD CONSTRAINT turnier_merkliste_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.turnier_start_rueckmeldungen
    ADD CONSTRAINT turnier_start_rueckmeldungen_geaendert_von_fkey FOREIGN KEY (geaendert_von) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.turnier_start_rueckmeldungen
    ADD CONSTRAINT turnier_start_rueckmeldungen_start_id_fkey FOREIGN KEY (start_id) REFERENCES public.turnier_starts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.turnier_start_rueckmeldungen
    ADD CONSTRAINT turnier_start_rueckmeldungen_vereins_mitglied_id_fkey FOREIGN KEY (vereins_mitglied_id) REFERENCES public.vereins_mitglieder(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.turnier_starts
    ADD CONSTRAINT turnier_starts_altersklasse_id_fkey FOREIGN KEY (altersklasse_id) REFERENCES public.altersklassen(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.turnier_starts
    ADD CONSTRAINT turnier_starts_disziplin_id_fkey FOREIGN KEY (disziplin_id) REFERENCES public.disziplinen(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.turnier_starts
    ADD CONSTRAINT turnier_starts_erstellt_von_fkey FOREIGN KEY (erstellt_von) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.turnier_starts
    ADD CONSTRAINT turnier_starts_gruppe_id_fkey FOREIGN KEY (gruppe_id) REFERENCES public.gruppen(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.turnier_starts
    ADD CONSTRAINT turnier_starts_turnier_id_fkey FOREIGN KEY (turnier_id) REFERENCES public.turniere(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.turnier_starts
    ADD CONSTRAINT turnier_starts_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.turniere
    ADD CONSTRAINT turniere_erstellt_von_fkey FOREIGN KEY (erstellt_von) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.turniere
    ADD CONSTRAINT turniere_verband_id_fkey FOREIGN KEY (verband_id) REFERENCES public.verbaende(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.turniere
    ADD CONSTRAINT turniere_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ueberweisungs_rechnungen
    ADD CONSTRAINT ueberweisungs_rechnungen_ziel_user_id_fkey FOREIGN KEY (ziel_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ueberweisungs_rechnungen
    ADD CONSTRAINT ueberweisungs_rechnungen_ziel_verein_id_fkey FOREIGN KEY (ziel_verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.umfrage_stimmen
    ADD CONSTRAINT umfrage_stimmen_nachricht_id_fkey FOREIGN KEY (nachricht_id) REFERENCES public.nachrichten(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.umfrage_stimmen
    ADD CONSTRAINT umfrage_stimmen_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.verband_altersklassen
    ADD CONSTRAINT verband_altersklassen_altersklasse_id_fkey FOREIGN KEY (altersklasse_id) REFERENCES public.altersklassen(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.verband_altersklassen
    ADD CONSTRAINT verband_altersklassen_verband_id_fkey FOREIGN KEY (verband_id) REFERENCES public.verbaende(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.verband_disziplinen
    ADD CONSTRAINT verband_disziplinen_disziplin_id_fkey FOREIGN KEY (disziplin_id) REFERENCES public.disziplinen(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.verband_disziplinen
    ADD CONSTRAINT verband_disziplinen_verband_id_fkey FOREIGN KEY (verband_id) REFERENCES public.verbaende(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vereine
    ADD CONSTRAINT vereine_verband_id_fkey FOREIGN KEY (verband_id) REFERENCES public.verbaende(id);

ALTER TABLE ONLY public.vereins_bereichsrechte
    ADD CONSTRAINT vereins_bereichsrechte_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vereins_bereichsrechte
    ADD CONSTRAINT vereins_bereichsrechte_vereins_mitglied_id_fkey FOREIGN KEY (vereins_mitglied_id) REFERENCES public.vereins_mitglieder(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vereins_lizenz_abdeckungen
    ADD CONSTRAINT vereins_lizenz_abdeckungen_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vereins_lizenz_abdeckungen
    ADD CONSTRAINT vereins_lizenz_abdeckungen_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vereins_lizenz_abdeckungen
    ADD CONSTRAINT vereins_lizenz_abdeckungen_vereins_mitglied_id_fkey FOREIGN KEY (vereins_mitglied_id) REFERENCES public.vereins_mitglieder(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vereins_mitglieder
    ADD CONSTRAINT vereins_mitglieder_rolle_id_fkey FOREIGN KEY (rolle_id) REFERENCES public.rollen(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vereins_mitglieder
    ADD CONSTRAINT vereins_mitglieder_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vereins_mitglieder
    ADD CONSTRAINT vereins_mitglieder_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vereins_software_verbindungen
    ADD CONSTRAINT vereins_software_verbindungen_erstellt_von_fkey FOREIGN KEY (erstellt_von) REFERENCES auth.users(id);

ALTER TABLE ONLY public.vereins_software_verbindungen
    ADD CONSTRAINT vereins_software_verbindungen_verein_id_fkey FOREIGN KEY (verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vereinswechsel_anfragen
    ADD CONSTRAINT vereinswechsel_anfragen_angefragt_von_fkey FOREIGN KEY (angefragt_von) REFERENCES auth.users(id);

ALTER TABLE ONLY public.vereinswechsel_anfragen
    ADD CONSTRAINT vereinswechsel_anfragen_mitglied_user_id_fkey FOREIGN KEY (mitglied_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vereinswechsel_anfragen
    ADD CONSTRAINT vereinswechsel_anfragen_quell_verein_id_fkey FOREIGN KEY (quell_verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vereinswechsel_anfragen
    ADD CONSTRAINT vereinswechsel_anfragen_vorgeschlagene_rolle_id_fkey FOREIGN KEY (vorgeschlagene_rolle_id) REFERENCES public.rollen(id);

ALTER TABLE ONLY public.vereinswechsel_anfragen
    ADD CONSTRAINT vereinswechsel_anfragen_ziel_verein_id_fkey FOREIGN KEY (ziel_verein_id) REFERENCES public.vereine(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.zahlungs_ereignisse
    ADD CONSTRAINT zahlungs_ereignisse_abo_id_fkey FOREIGN KEY (abo_id) REFERENCES public.abos(id) ON DELETE SET NULL;
