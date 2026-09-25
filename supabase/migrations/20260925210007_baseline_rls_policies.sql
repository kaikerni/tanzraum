-- TanzRaum – Baseline-Migration 7/12: Row Level Security (81 Tabellen) und Policies (179)
-- Exportiert aus dem Produktionsstand (Supabase-Projekt oraiqjulxmohclfixwdq) am 2026-09-25.
-- Nur für den Aufbau einer NEUEN/LEEREN Supabase-Datenbank gedacht.
-- NICHT gegen die Produktions-DB ausführen (dort existiert alles bereits) – siehe README.md.

ALTER TABLE public.abos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.altersklassen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anruf_signale ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anrufe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beitraege ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beitragstypen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beitritts_anfragen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benachrichtigungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blockierungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_stumm ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dateien ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disziplinen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eigene_kontakte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eigene_vereinsnotizen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.einladungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eltern_code_versuche ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eltern_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eltern_kind_zuordnung ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eltern_verknuepfungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fernwartungs_anfragen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gespraech_teilnehmer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gespraeche ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gruppen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gruppen_mitglieder ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.juryraum_besetzungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.juryraum_einladungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.juryraum_einsatz_zusagen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.juryraum_fahrgemeinschaften ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.juryraum_fernwartungs_zugriff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.juryraum_mitglieder ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.juryraum_unterkuenfte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.juryraum_verfuegbarkeiten ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kassenbuch_eintraege ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kind_einstellungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kostuem_gruppen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kostueme ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_versand_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meldungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mitglieder ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mitgliedsantraege ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nachricht_reaktionen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nachrichten ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paypal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rechnungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rechnungs_einstellungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rollen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spenden ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spotlight_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spotlight_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spotlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sticker ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarif_ereignisse ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarif_preise ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarif_system_freigabe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.termin_rueckmeldungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.termine ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainings_abmeldungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainings_anwesenheit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainingstermine ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnier_merkliste ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnier_start_rueckmeldungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnier_starts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turniere ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ueberweisungs_rechnungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.umfrage_stimmen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verbaende ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verband_altersklassen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verband_disziplinen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vereine ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vereins_bereichsrechte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vereins_lizenz_abdeckungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vereins_mitglieder ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vereins_software_verbindungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vereinswechsel_anfragen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zahlungs_ereignisse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Angemeldete Nutzer koennen Altersklassen lesen" ON public.altersklassen AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Eigene Signale sehen" ON public.anruf_signale AS PERMISSIVE FOR SELECT TO authenticated
  USING (((an = auth.uid()) OR (von = auth.uid())));

CREATE POLICY "Eigene Anrufe sehen" ON public.anrufe AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid() = anrufer_id) OR (auth.uid() = angerufener_id)));

CREATE POLICY "Bereich Beitraege verwaltet Beitraege" ON public.beitraege AS PERMISSIVE FOR ALL TO authenticated
  USING (public.hat_vereinsbereich(verein_id, 'beitraege'::text))
  WITH CHECK (public.hat_vereinsbereich(verein_id, 'beitraege'::text));

CREATE POLICY "Vereinsadmin sieht Beitraege" ON public.beitraege AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_verein_admin(verein_id));

CREATE POLICY "Vereinsadmin verwaltet Beitraege (delete)" ON public.beitraege AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.is_verein_admin(verein_id));

CREATE POLICY "Vereinsadmin verwaltet Beitraege (insert)" ON public.beitraege AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_verein_admin(verein_id));

CREATE POLICY "Vereinsadmin verwaltet Beitraege (update)" ON public.beitraege AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_verein_admin(verein_id))
  WITH CHECK (public.is_verein_admin(verein_id));

CREATE POLICY "Bereich Beitraege verwaltet Beitragstypen" ON public.beitragstypen AS PERMISSIVE FOR ALL TO authenticated
  USING (public.hat_vereinsbereich(verein_id, 'beitraege'::text))
  WITH CHECK (public.hat_vereinsbereich(verein_id, 'beitraege'::text));

CREATE POLICY "Vereinsadmin sieht Beitragstypen" ON public.beitragstypen AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_verein_admin(verein_id));

CREATE POLICY "Vereinsadmin verwaltet Beitragstypen (delete)" ON public.beitragstypen AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.is_verein_admin(verein_id));

CREATE POLICY "Vereinsadmin verwaltet Beitragstypen (insert)" ON public.beitragstypen AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_verein_admin(verein_id));

CREATE POLICY "Vereinsadmin verwaltet Beitragstypen (update)" ON public.beitragstypen AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_verein_admin(verein_id))
  WITH CHECK (public.is_verein_admin(verein_id));

CREATE POLICY "Bereich Beitritt entscheidet Beitrittsanfragen" ON public.beitritts_anfragen AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.hat_vereinsbereich(verein_id, 'beitritt'::text))
  WITH CHECK (public.hat_vereinsbereich(verein_id, 'beitritt'::text));

CREATE POLICY "Bereich Beitritt sieht Beitrittsanfragen" ON public.beitritts_anfragen AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.hat_vereinsbereich(verein_id, 'beitritt'::text));

CREATE POLICY "Nutzer kann eigene offene Anfrage zurueckziehen" ON public.beitritts_anfragen AS PERMISSIVE FOR DELETE TO public
  USING (((user_id = auth.uid()) AND (status = 'neu'::text)));

CREATE POLICY "Nutzer sieht eigene Anfragen" ON public.beitritts_anfragen AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = auth.uid()) OR public.is_verein_admin(verein_id)));

CREATE POLICY "Nutzer stellt eigene Anfrage" ON public.beitritts_anfragen AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Vereinsadmin entscheidet ueber Anfragen" ON public.beitritts_anfragen AS PERMISSIVE FOR UPDATE TO public
  USING (public.is_verein_admin(verein_id))
  WITH CHECK (public.is_verein_admin(verein_id));

CREATE POLICY "Nutzer kann sich selbst benachrichtigen" ON public.benachrichtigungen AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Nutzer markiert eigene Benachrichtigungen gelesen" ON public.benachrichtigungen AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Nutzer sieht eigene Benachrichtigungen" ON public.benachrichtigungen AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));

CREATE POLICY "Eigene Blockierungen sehen" ON public.blockierungen AS PERMISSIVE FOR SELECT TO authenticated
  USING ((blocker_id = auth.uid()));

CREATE POLICY "Eigene Stummschaltung sehen" ON public.chat_stumm AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));

CREATE POLICY "Nutzer sehen eigene Verbindungen" ON public.connections AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = auth.uid()) OR (connected_to = auth.uid())));

CREATE POLICY "Berechtigte laden Dateien hoch" ON public.dateien AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((((verein_id IS NOT NULL) AND public.ist_trainer_betreuer_oder_admin(verein_id) AND (hochgeladen_von = auth.uid())) OR ((user_id IS NOT NULL) AND (user_id = auth.uid()) AND (hochgeladen_von = auth.uid())) OR ((turnier_id IS NOT NULL) AND public.juryraum_verwaltet_turnier(turnier_id) AND (hochgeladen_von = auth.uid()))));

CREATE POLICY "Berechtigte loeschen Dateien" ON public.dateien AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((verein_id IS NOT NULL) AND public.ist_trainer_betreuer_oder_admin(verein_id)) OR ((user_id IS NOT NULL) AND (user_id = auth.uid())) OR ((turnier_id IS NOT NULL) AND public.juryraum_verwaltet_turnier(turnier_id))));

CREATE POLICY "Fernwartung sieht Turnier-Dokumente" ON public.dateien AS PERMISSIVE FOR SELECT TO authenticated
  USING (((turnier_id IS NOT NULL) AND public.juryraum_hat_aktive_fernwartung()));

CREATE POLICY "Vereinsmitglieder sehen Vereinsdateien" ON public.dateien AS PERMISSIVE FOR SELECT TO authenticated
  USING ((((verein_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.vereins_mitglieder vm
  WHERE ((vm.verein_id = dateien.verein_id) AND (vm.user_id = auth.uid()))))) OR ((user_id IS NOT NULL) AND (user_id = auth.uid())) OR ((turnier_id IS NOT NULL) AND public.juryraum_sieht_turnier(turnier_id))));

CREATE POLICY "Angemeldete Nutzer koennen Disziplinen lesen" ON public.disziplinen AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Eigene Kontakte verwalten" ON public.eigene_kontakte AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Eigene Vereinsnotizen verwalten" ON public.eigene_vereinsnotizen AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Vereinsadmin kann Einladungen anlegen" ON public.einladungen AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((public.is_verein_admin(verein_id) AND (created_by = auth.uid())));

CREATE POLICY "Vereinsadmin kann Einladungen widerrufen" ON public.einladungen AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_verein_admin(verein_id))
  WITH CHECK (public.is_verein_admin(verein_id));

CREATE POLICY "Vereinsadmin sieht eigene Einladungen" ON public.einladungen AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_verein_admin(verein_id));

CREATE POLICY "Eigene Familie oder Bereich Mitglieder" ON public.eltern_kind_zuordnung AS PERMISSIVE FOR SELECT TO authenticated
  USING ((public.ist_eigenes_oder_kind(kind_vm_id) OR (EXISTS ( SELECT 1
   FROM public.vereins_mitglieder vm
  WHERE ((vm.id = eltern_kind_zuordnung.eltern_vm_id) AND (vm.user_id = auth.uid())))) OR public.hat_vereinsbereich(verein_id, 'mitglieder'::text)));

CREATE POLICY "Vereinsadmin verwaltet Eltern-Kind-Zuordnung" ON public.eltern_kind_zuordnung AS PERMISSIVE FOR ALL TO public
  USING (public.is_verein_admin(verein_id))
  WITH CHECK (public.is_verein_admin(verein_id));

CREATE POLICY "Vereinsadmin kann anfordern" ON public.fernwartungs_anfragen AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((public.is_verein_admin(verein_id) AND (angefordert_von = auth.uid())));

CREATE POLICY "Vereinsadmin kann eigene widerrufen" ON public.fernwartungs_anfragen AS PERMISSIVE FOR UPDATE TO public
  USING ((public.is_verein_admin(verein_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.ist_plattform_admin = true))))));

CREATE POLICY "Vereinsadmin sieht eigene Fernwartungsanfragen" ON public.fernwartungs_anfragen AS PERMISSIVE FOR SELECT TO public
  USING ((public.is_verein_admin(verein_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.ist_plattform_admin = true))))));

CREATE POLICY "Teilnehmer sehen sich gegenseitig" ON public.gespraech_teilnehmer AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.hat_gespraech_zugriff(gespraech_id));

CREATE POLICY "Zugriff auf eigene Gespraeche" ON public.gespraeche AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.hat_gespraech_zugriff(id));

CREATE POLICY "Vereinsadmin/Trainer koennen Gruppen aendern" ON public.gruppen AS PERMISSIVE FOR UPDATE TO public
  USING (public.is_verein_admin_oder_trainer(verein_id));

CREATE POLICY "Vereinsadmin/Trainer koennen Gruppen anlegen" ON public.gruppen AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (public.is_verein_admin_oder_trainer(verein_id));

CREATE POLICY "Vereinsadmin/Trainer koennen Gruppen loeschen" ON public.gruppen AS PERMISSIVE FOR DELETE TO public
  USING (public.is_verein_admin_oder_trainer(verein_id));

CREATE POLICY "Vereinsmitglieder sehen die Gruppen ihres Vereins" ON public.gruppen AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.vereins_mitglieder vm
  WHERE ((vm.verein_id = gruppen.verein_id) AND (vm.user_id = auth.uid())))));

CREATE POLICY "Vereinsadmin/Trainer koennen Gruppenzuordnungen anlegen" ON public.gruppen_mitglieder AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.gruppen g
  WHERE ((g.id = gruppen_mitglieder.gruppe_id) AND public.is_verein_admin_oder_trainer(g.verein_id)))));

CREATE POLICY "Vereinsadmin/Trainer koennen Gruppenzuordnungen loeschen" ON public.gruppen_mitglieder AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM public.gruppen g
  WHERE ((g.id = gruppen_mitglieder.gruppe_id) AND public.is_verein_admin_oder_trainer(g.verein_id)))));

CREATE POLICY "Vereinsmitglieder sehen Gruppenzuordnungen ihres Vereins" ON public.gruppen_mitglieder AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (public.gruppen g
     JOIN public.vereins_mitglieder vm ON (((vm.verein_id = g.verein_id) AND (vm.user_id = auth.uid()))))
  WHERE (g.id = gruppen_mitglieder.gruppe_id))));

CREATE POLICY "Ersteller sieht eigene Einladungslinks" ON public.invite_links AS PERMISSIVE FOR SELECT TO public
  USING ((created_by = auth.uid()));

CREATE POLICY "Nutzer kann eigene Einladungslinks anlegen" ON public.invite_links AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((created_by = auth.uid()) AND ((type IS DISTINCT FROM 'verein_beitritt'::text) OR public.is_verein_admin(ziel_verein_id))));

CREATE POLICY "Fernwartung sieht Besetzungen" ON public.juryraum_besetzungen AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.juryraum_hat_aktive_fernwartung());

CREATE POLICY "JuryMitglieder sehen Besetzungen" ON public.juryraum_besetzungen AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.juryraum_sieht_turnier(turnier_id));

CREATE POLICY "Verwaltung verwaltet Besetzungen" ON public.juryraum_besetzungen AS PERMISSIVE FOR ALL TO authenticated
  USING (public.juryraum_verwaltet_turnier(turnier_id))
  WITH CHECK (public.juryraum_verwaltet_turnier(turnier_id));

CREATE POLICY "Eingeladene nehmen eigene Einladung an" ON public.juryraum_einladungen AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((lower(email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (status = 'offen'::text) AND ((expires_at IS NULL) OR (expires_at > now()))))
  WITH CHECK (((lower(email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (status = 'angenommen'::text)));

CREATE POLICY "Eingeladene sehen eigene offene Einladung" ON public.juryraum_einladungen AS PERMISSIVE FOR SELECT TO authenticated
  USING (((lower(email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (status = 'offen'::text) AND ((expires_at IS NULL) OR (expires_at > now()))));

CREATE POLICY "JuryAdmins verwalten Einladungen" ON public.juryraum_einladungen AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.juryraum_mitglieder jm
  WHERE ((jm.user_id = auth.uid()) AND (jm.rolle = 'admin'::text) AND (jm.aktiv = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.juryraum_mitglieder jm
  WHERE ((jm.user_id = auth.uid()) AND (jm.rolle = 'admin'::text) AND (jm.aktiv = true)))));

CREATE POLICY "TanzRaum-Admin bootstrapt ersten JuryRaum-Admin" ON public.juryraum_einladungen AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((rolle = 'admin'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.ist_plattform_admin = true)))) AND (NOT (EXISTS ( SELECT 1
   FROM public.juryraum_mitglieder jm
  WHERE ((jm.rolle = 'admin'::text) AND (jm.aktiv = true)))))));

CREATE POLICY "Eingeladene beantworten eigene Einladung" ON public.juryraum_einsatz_zusagen AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Fernwartung sieht Zusagen" ON public.juryraum_einsatz_zusagen AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.juryraum_hat_aktive_fernwartung());

CREATE POLICY "JuryMitglieder sehen Zusagen" ON public.juryraum_einsatz_zusagen AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.juryraum_sieht_turnier(turnier_id));

CREATE POLICY "Verwaltung bearbeitet Zusagen" ON public.juryraum_einsatz_zusagen AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.juryraum_verwaltet_turnier(turnier_id))
  WITH CHECK (public.juryraum_verwaltet_turnier(turnier_id));

CREATE POLICY "Verwaltung entfernt Einladungen" ON public.juryraum_einsatz_zusagen AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.juryraum_verwaltet_turnier(turnier_id));

CREATE POLICY "Verwaltung laedt zu Einsaetzen ein" ON public.juryraum_einsatz_zusagen AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((public.juryraum_verwaltet_turnier(turnier_id) AND (eingeladen_von = auth.uid())));

CREATE POLICY "Fernwartung sieht Fahrgemeinschaften" ON public.juryraum_fahrgemeinschaften AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.juryraum_hat_aktive_fernwartung());

CREATE POLICY "JuryMitglieder sehen Fahrgemeinschaften" ON public.juryraum_fahrgemeinschaften AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.juryraum_sieht_turnier(turnier_id));

CREATE POLICY "Verwaltung verwaltet Fahrgemeinschaften" ON public.juryraum_fahrgemeinschaften AS PERMISSIVE FOR ALL TO authenticated
  USING (public.juryraum_verwaltet_turnier(turnier_id))
  WITH CHECK (public.juryraum_verwaltet_turnier(turnier_id));

CREATE POLICY "Echter JuryAdmin gewaehrt Fernwartung" ON public.juryraum_fernwartungs_zugriff AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((gewaehrt_von = auth.uid()) AND (status = 'ausstehend'::text) AND (laeuft_ab_am IS NULL) AND (EXISTS ( SELECT 1
   FROM public.juryraum_mitglieder jm
  WHERE ((jm.user_id = auth.uid()) AND (jm.rolle = 'admin'::text) AND (jm.aktiv = true)))) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = juryraum_fernwartungs_zugriff.ziel_user_id) AND (p.ist_plattform_admin = true))))));

CREATE POLICY "Echter JuryAdmin sieht alle Fernwartungszugriffe" ON public.juryraum_fernwartungs_zugriff AS PERMISSIVE FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM public.juryraum_mitglieder jm
  WHERE ((jm.user_id = auth.uid()) AND (jm.rolle = 'admin'::text) AND (jm.aktiv = true)))) OR (ziel_user_id = auth.uid())));

CREATE POLICY "Widerruf durch JuryAdmin oder Plattform-Admin selbst" ON public.juryraum_fernwartungs_zugriff AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM public.juryraum_mitglieder jm
  WHERE ((jm.user_id = auth.uid()) AND (jm.rolle = 'admin'::text) AND (jm.aktiv = true)))) OR (ziel_user_id = auth.uid())))
  WITH CHECK ((status = 'widerrufen'::text));

CREATE POLICY "Eingeladene werden eigene JuryMitglieder" ON public.juryraum_mitglieder AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.juryraum_einladungen invitation
  WHERE ((lower(invitation.email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))) AND (invitation.status = 'offen'::text) AND ((invitation.expires_at IS NULL) OR (invitation.expires_at > now())) AND (invitation.rolle = juryraum_mitglieder.rolle) AND (NOT (invitation.verband_id IS DISTINCT FROM juryraum_mitglieder.verband_id)))))));

CREATE POLICY "Fernwartung sieht Mitgliederliste" ON public.juryraum_mitglieder AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.juryraum_hat_aktive_fernwartung());

CREATE POLICY "JuryAdmins verwalten JuryMitglieder" ON public.juryraum_mitglieder AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.juryraum_mitglieder jm
  WHERE ((jm.user_id = auth.uid()) AND (jm.rolle = 'admin'::text) AND (jm.aktiv = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.juryraum_mitglieder jm
  WHERE ((jm.user_id = auth.uid()) AND (jm.rolle = 'admin'::text) AND (jm.aktiv = true)))));

CREATE POLICY "JuryMitglieder sehen eigene Mitgliedschaft" ON public.juryraum_mitglieder AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));

CREATE POLICY "Fernwartung sieht Unterkuenfte" ON public.juryraum_unterkuenfte AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.juryraum_hat_aktive_fernwartung());

CREATE POLICY "JuryMitglieder sehen Unterkuenfte" ON public.juryraum_unterkuenfte AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.juryraum_sieht_turnier(turnier_id));

CREATE POLICY "Verwaltung verwaltet Unterkuenfte" ON public.juryraum_unterkuenfte AS PERMISSIVE FOR ALL TO authenticated
  USING (public.juryraum_verwaltet_turnier(turnier_id))
  WITH CHECK (public.juryraum_verwaltet_turnier(turnier_id));

CREATE POLICY "Fernwartung sieht Verfuegbarkeiten" ON public.juryraum_verfuegbarkeiten AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.juryraum_hat_aktive_fernwartung());

CREATE POLICY "JuryMitglieder sehen Verfuegbarkeiten" ON public.juryraum_verfuegbarkeiten AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.juryraum_sieht_turnier(turnier_id));

CREATE POLICY "JuryMitglieder verwalten eigene Verfuegbarkeit" ON public.juryraum_verfuegbarkeiten AS PERMISSIVE FOR ALL TO authenticated
  USING ((user_id = auth.uid()))
  WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.juryraum_mitglieder jm
  WHERE ((jm.user_id = auth.uid()) AND (jm.aktiv = true))))));

CREATE POLICY "Bereich Beitraege verwaltet Kassenbuch" ON public.kassenbuch_eintraege AS PERMISSIVE FOR ALL TO authenticated
  USING (public.hat_vereinsbereich(verein_id, 'beitraege'::text))
  WITH CHECK (public.hat_vereinsbereich(verein_id, 'beitraege'::text));

CREATE POLICY "Vereinsadmin verwaltet Kassenbuch" ON public.kassenbuch_eintraege AS PERMISSIVE FOR ALL TO public
  USING (public.is_verein_admin(verein_id))
  WITH CHECK (public.is_verein_admin(verein_id));

CREATE POLICY "Bereich Material verwaltet Kostuemgruppen" ON public.kostuem_gruppen AS PERMISSIVE FOR ALL TO authenticated
  USING (public.hat_vereinsbereich(verein_id, 'material'::text))
  WITH CHECK (public.hat_vereinsbereich(verein_id, 'material'::text));

CREATE POLICY "Vereinsadmin verwaltet Kostuemgruppen (delete)" ON public.kostuem_gruppen AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.is_verein_admin(verein_id));

CREATE POLICY "Vereinsadmin verwaltet Kostuemgruppen (insert)" ON public.kostuem_gruppen AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_verein_admin(verein_id));

CREATE POLICY "Vereinsadmin verwaltet Kostuemgruppen (update)" ON public.kostuem_gruppen AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_verein_admin(verein_id))
  WITH CHECK (public.is_verein_admin(verein_id));

CREATE POLICY "Vereinsmitglieder sehen Kostuemgruppen" ON public.kostuem_gruppen AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.vereins_mitglieder vm
  WHERE ((vm.verein_id = kostuem_gruppen.verein_id) AND (vm.user_id = auth.uid())))));

CREATE POLICY "Bereich Material verwaltet Kostueme" ON public.kostueme AS PERMISSIVE FOR ALL TO authenticated
  USING (public.hat_vereinsbereich(verein_id, 'material'::text))
  WITH CHECK (public.hat_vereinsbereich(verein_id, 'material'::text));

CREATE POLICY "Eigene Kostueme oder Bereich Material" ON public.kostueme AS PERMISSIVE FOR SELECT TO authenticated
  USING ((((vereins_mitglied_id IS NOT NULL) AND public.ist_eigenes_oder_kind(vereins_mitglied_id)) OR public.hat_vereinsbereich(verein_id, 'material'::text)));

CREATE POLICY "Vereinsadmin verwaltet Kostueme (delete)" ON public.kostueme AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.is_verein_admin(verein_id));

CREATE POLICY "Vereinsadmin verwaltet Kostueme (insert)" ON public.kostueme AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_verein_admin(verein_id));

CREATE POLICY "Vereinsadmin verwaltet Kostueme (update)" ON public.kostueme AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_verein_admin(verein_id))
  WITH CHECK (public.is_verein_admin(verein_id));

CREATE POLICY "Nur Plattform-Admin sieht Login-IPs" ON public.login_ips AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.ist_plattform_admin = true)))));

CREATE POLICY "Nutzer kann eigenen Login-Eintrag anlegen" ON public.login_ips AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Nutzer sieht eigene Login-Historie" ON public.login_ips AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));

CREATE POLICY "Vereinsadmin/Beitraege verwalten Mitgliederstammdaten" ON public.mitglieder AS PERMISSIVE FOR ALL TO authenticated
  USING (public.hat_vereinsbereich(verein_id, 'beitraege'::text))
  WITH CHECK (public.hat_vereinsbereich(verein_id, 'beitraege'::text));

CREATE POLICY "Bereich Beitritt entscheidet Mitgliedsantraege" ON public.mitgliedsantraege AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.hat_vereinsbereich(verein_id, 'beitritt'::text))
  WITH CHECK (public.hat_vereinsbereich(verein_id, 'beitritt'::text));

CREATE POLICY "Bereich Beitritt sieht Mitgliedsantraege" ON public.mitgliedsantraege AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.hat_vereinsbereich(verein_id, 'beitritt'::text));

CREATE POLICY "Jeder kann einen Mitgliedsantrag einreichen" ON public.mitgliedsantraege AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Vereinsadmin entscheidet ueber Antraege" ON public.mitgliedsantraege AS PERMISSIVE FOR UPDATE TO public
  USING (public.is_verein_admin(verein_id))
  WITH CHECK (public.is_verein_admin(verein_id));

CREATE POLICY "Vereinsadmin sieht Antraege seines Vereins" ON public.mitgliedsantraege AS PERMISSIVE FOR SELECT TO public
  USING ((public.is_verein_admin(verein_id) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.ist_plattform_admin = true))))));

CREATE POLICY "Reaktionen sehen" ON public.nachricht_reaktionen AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.hat_gespraech_zugriff(gespraech_id));

CREATE POLICY "Nachrichten lesen mit Gespraechszugriff" ON public.nachrichten AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.hat_gespraech_zugriff(gespraech_id));

CREATE POLICY "Nachrichten schreiben" ON public.nachrichten AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((sender_id = auth.uid()) AND (geloescht_am IS NULL) AND public.darf_im_gespraech_schreiben(gespraech_id) AND ((bild_pfad IS NULL) OR (bild_pfad ~~ ((gespraech_id)::text || '/%'::text))) AND ((anhang IS NULL) OR ((anhang ->> 'pfad'::text) ~~ ((gespraech_id)::text || '/%'::text)))));

CREATE POLICY "Nutzer verwalten eigenes Onboarding" ON public.onboarding_progress AS PERMISSIVE FOR ALL TO authenticated
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Nutzer aktualisieren eigenes Profil" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = id))
  WITH CHECK ((auth.uid() = id));

CREATE POLICY "Nutzer legen eigenes Profil an" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = id));

CREATE POLICY "Nutzer sehen eigenes Profil" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = id));

CREATE POLICY "Plattform-Admin kann Profile löschen" ON public.profiles AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM public.profiles p2
  WHERE ((p2.id = auth.uid()) AND (p2.ist_plattform_admin = true)))));

CREATE POLICY "Profile sichtbar nach Privatsphaere" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING (((COALESCE(konto_privat, false) = false) OR public.kann_privates_profil_sehen(id)));

CREATE POLICY "Nutzer verwaltet eigene Push-Abos (delete)" ON public.push_subscriptions AS PERMISSIVE FOR DELETE TO authenticated
  USING ((user_id = auth.uid()));

CREATE POLICY "Nutzer verwaltet eigene Push-Abos (insert)" ON public.push_subscriptions AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Nutzer verwaltet eigene Push-Abos (select)" ON public.push_subscriptions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));

CREATE POLICY "Empfaenger sieht eigene Rechnungen" ON public.rechnungen AS PERMISSIVE FOR SELECT TO authenticated
  USING (((ziel_user_id = auth.uid()) OR ((ziel_verein_id IS NOT NULL) AND public.is_verein_admin(ziel_verein_id)) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.ist_plattform_admin = true))))));

CREATE POLICY "Plattform-Admin bearbeitet Rechnungseinstellungen" ON public.rechnungs_einstellungen AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.ist_plattform_admin = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.ist_plattform_admin = true)))));

CREATE POLICY "Plattform-Admin sieht Rechnungseinstellungen" ON public.rechnungs_einstellungen AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.ist_plattform_admin = true)))));

CREATE POLICY "Angemeldete Nutzer koennen Rollen lesen" ON public.rollen AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Bereich Beitraege verwaltet Spenden" ON public.spenden AS PERMISSIVE FOR ALL TO authenticated
  USING (public.hat_vereinsbereich(verein_id, 'beitraege'::text))
  WITH CHECK (public.hat_vereinsbereich(verein_id, 'beitraege'::text));

CREATE POLICY "Vereinsadmin verwaltet Spenden" ON public.spenden AS PERMISSIVE FOR ALL TO public
  USING (public.is_verein_admin(verein_id))
  WITH CHECK (public.is_verein_admin(verein_id));

CREATE POLICY "Sticker lesen" ON public.sticker AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Nutzer sehen eigene Tarifereignisse" ON public.tarif_ereignisse AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));

CREATE POLICY "Preise lesen" ON public.tarif_preise AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Rueckmeldungen sehen" ON public.termin_rueckmeldungen AS PERMISSIVE FOR SELECT TO authenticated
  USING ((public.ist_eigenes_oder_kind(vereins_mitglied_id) OR (EXISTS ( SELECT 1
   FROM public.termine t
  WHERE ((t.id = termin_rueckmeldungen.termin_id) AND (t.verein_id IS NOT NULL) AND public.darf_vereinstermine_verwalten(t.verein_id))))));

CREATE POLICY "Termine aendern" ON public.termine AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((verein_id IS NULL) AND (erstellt_von = auth.uid())) OR ((verein_id IS NOT NULL) AND public.darf_vereinstermine_verwalten(verein_id))))
  WITH CHECK ((((verein_id IS NULL) AND (erstellt_von = auth.uid())) OR ((verein_id IS NOT NULL) AND public.darf_vereinstermine_verwalten(verein_id))));

CREATE POLICY "Termine anlegen" ON public.termine AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((((verein_id IS NULL) AND (erstellt_von = auth.uid()) AND (public.mein_tarif() = ANY (ARRAY['basic'::text, 'verein'::text]))) OR ((verein_id IS NOT NULL) AND public.darf_vereinstermine_verwalten(verein_id))));

CREATE POLICY "Termine loeschen" ON public.termine AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((verein_id IS NULL) AND (erstellt_von = auth.uid())) OR ((verein_id IS NOT NULL) AND public.darf_vereinstermine_verwalten(verein_id))));

CREATE POLICY "Termine sehen" ON public.termine AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.termin_zeile_sichtbar(verein_id, erstellt_von, zielgruppe, gruppe_ids));

CREATE POLICY "Eigene/Kinder oder Bereich Anwesenheit sehen Abmeldungen" ON public.trainings_abmeldungen AS PERMISSIVE FOR SELECT TO authenticated
  USING ((public.ist_eigenes_oder_kind(vereins_mitglied_id) OR public.hat_vereinsbereich(verein_id, 'anwesenheit'::text)));

CREATE POLICY "Elternteil meldet eigenes Kind ab" ON public.trainings_abmeldungen AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((datum >= CURRENT_DATE) AND (EXISTS ( SELECT 1
   FROM (public.eltern_kind_zuordnung ekz
     JOIN public.vereins_mitglieder vm_eltern ON ((vm_eltern.id = ekz.eltern_vm_id)))
  WHERE ((ekz.kind_vm_id = trainings_abmeldungen.vereins_mitglied_id) AND (vm_eltern.user_id = auth.uid()))))));

CREATE POLICY "Elternteil nimmt eigene Kind-Abmeldung zurueck" ON public.trainings_abmeldungen AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM (public.eltern_kind_zuordnung ekz
     JOIN public.vereins_mitglieder vm_eltern ON ((vm_eltern.id = ekz.eltern_vm_id)))
  WHERE ((ekz.kind_vm_id = trainings_abmeldungen.vereins_mitglied_id) AND (vm_eltern.user_id = auth.uid())))));

CREATE POLICY "Mitglied kann eigene Abmeldung zuruecknehmen" ON public.trainings_abmeldungen AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.vereins_mitglieder vm
  WHERE ((vm.id = trainings_abmeldungen.vereins_mitglied_id) AND (vm.user_id = auth.uid())))));

CREATE POLICY "Mitglied kann sich selbst abmelden" ON public.trainings_abmeldungen AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((datum >= CURRENT_DATE) AND (EXISTS ( SELECT 1
   FROM public.vereins_mitglieder vm
  WHERE ((vm.id = trainings_abmeldungen.vereins_mitglied_id) AND (vm.user_id = auth.uid()))))));

CREATE POLICY "Trainer/Betreuer/Admin verwalten Abmeldungen (delete)" ON public.trainings_abmeldungen AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.ist_gruppen_betreuung(gruppe_id));

CREATE POLICY "Trainer/Betreuer/Admin verwalten Abmeldungen (insert)" ON public.trainings_abmeldungen AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.ist_gruppen_betreuung(gruppe_id));

CREATE POLICY "Anwesenheit aktualisieren (Betreuung + Bereich)" ON public.trainings_anwesenheit AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((public.is_verein_admin(verein_id) OR (public.ist_gruppen_betreuung_erweitert(gruppe_id) AND public.hat_vereinsbereich(verein_id, 'anwesenheit'::text))))
  WITH CHECK (((erfasst_von = auth.uid()) AND (public.is_verein_admin(verein_id) OR (public.ist_gruppen_betreuung_erweitert(gruppe_id) AND public.hat_vereinsbereich(verein_id, 'anwesenheit'::text)))));

CREATE POLICY "Anwesenheit erfassen (Betreuung + Bereich)" ON public.trainings_anwesenheit AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((erfasst_von = auth.uid()) AND (public.is_verein_admin(verein_id) OR (public.ist_gruppen_betreuung_erweitert(gruppe_id) AND public.hat_vereinsbereich(verein_id, 'anwesenheit'::text)))));

CREATE POLICY "Eigene/Kinder oder Bereich Anwesenheit sehen Anwesenheit" ON public.trainings_anwesenheit AS PERMISSIVE FOR SELECT TO authenticated
  USING ((public.ist_eigenes_oder_kind(vereins_mitglied_id) OR public.hat_vereinsbereich(verein_id, 'anwesenheit'::text)));

CREATE POLICY "Relevante Trainingstermine sehen" ON public.trainingstermine AS PERMISSIVE FOR SELECT TO authenticated
  USING ((public.is_verein_admin(verein_id) OR public.ist_gruppen_betreuung_erweitert(gruppe_id) OR (EXISTS ( SELECT 1
   FROM public.sichtbare_trainings() s(id)
  WHERE (s.id = trainingstermine.id)))));

CREATE POLICY "Trainer/Betreuer/Admin bearbeiten Trainingstermine" ON public.trainingstermine AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.ist_gruppen_betreuung(gruppe_id))
  WITH CHECK (public.ist_gruppen_betreuung(gruppe_id));

CREATE POLICY "Trainer/Betreuer/Admin legen Trainingstermine an" ON public.trainingstermine AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((public.ist_gruppen_betreuung(gruppe_id) AND (erstellt_von = auth.uid())));

CREATE POLICY "Trainer/Betreuer/Admin loeschen Trainingstermine" ON public.trainingstermine AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.ist_gruppen_betreuung(gruppe_id));

CREATE POLICY "Eigene Merkliste" ON public.turnier_merkliste AS PERMISSIVE FOR ALL TO authenticated
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Eigene, Kinder oder Planung sehen Rueckmeldungen" ON public.turnier_start_rueckmeldungen AS PERMISSIVE FOR SELECT TO authenticated
  USING ((public.ist_eigenes_oder_kind(vereins_mitglied_id) OR (EXISTS ( SELECT 1
   FROM public.turnier_starts s
  WHERE ((s.id = turnier_start_rueckmeldungen.start_id) AND (public.darf_vereinstermine_verwalten(s.verein_id) OR ((s.gruppe_id IS NOT NULL) AND public.ist_gruppen_betreuung(s.gruppe_id))))))));

CREATE POLICY "Saisonplanung bearbeitet Starts" ON public.turnier_starts AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.darf_vereinstermine_verwalten(verein_id))
  WITH CHECK (public.darf_vereinstermine_verwalten(verein_id));

CREATE POLICY "Saisonplanung legt Starts an" ON public.turnier_starts AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.darf_vereinstermine_verwalten(verein_id));

CREATE POLICY "Saisonplanung loescht Starts" ON public.turnier_starts AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.darf_vereinstermine_verwalten(verein_id));

CREATE POLICY "Vereinsmitglieder sehen Starts" ON public.turnier_starts AS PERMISSIVE FOR SELECT TO authenticated
  USING ((((verein_id = ANY (public.meine_vereine())) AND public.verein_hat_lizenz(verein_id)) OR public.ist_plattform_admin_aktuell()));

CREATE POLICY "Plattform-Admin verwaltet Turniere (delete)" ON public.turniere AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.ist_plattform_admin = true)))));

CREATE POLICY "Plattform-Admin verwaltet Turniere (insert)" ON public.turniere AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.ist_plattform_admin = true)))));

CREATE POLICY "Plattform-Admin verwaltet Turniere (update)" ON public.turniere AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.ist_plattform_admin = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.ist_plattform_admin = true)))));

CREATE POLICY "Turniere sichtbar" ON public.turniere AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.turnier_sichtbar(verein_id));

CREATE POLICY "Verein bearbeitet eigene Turniere" ON public.turniere AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((verein_id IS NOT NULL) AND public.darf_vereinstermine_verwalten(verein_id)))
  WITH CHECK (((verein_id IS NOT NULL) AND public.darf_vereinstermine_verwalten(verein_id)));

CREATE POLICY "Verein legt eigene Turniere an" ON public.turniere AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((verein_id IS NOT NULL) AND public.darf_vereinstermine_verwalten(verein_id) AND public.verein_hat_lizenz(verein_id)));

CREATE POLICY "Verein loescht eigene Turniere" ON public.turniere AS PERMISSIVE FOR DELETE TO authenticated
  USING (((verein_id IS NOT NULL) AND public.darf_vereinstermine_verwalten(verein_id)));

CREATE POLICY "Eigene Rechnung sehen (Person)" ON public.ueberweisungs_rechnungen AS PERMISSIVE FOR SELECT TO authenticated
  USING (((ziel_user_id = auth.uid()) OR ((ziel_verein_id IS NOT NULL) AND public.is_verein_admin(ziel_verein_id))));

CREATE POLICY "Nutzer kann eigene Ueberweisungs-Rechnung anlegen (Person)" ON public.ueberweisungs_rechnungen AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((typ = 'basic'::text) AND (ziel_user_id = auth.uid())));

CREATE POLICY "Vereinsadmin kann Ueberweisungs-Rechnung fuer Verein anlegen" ON public.ueberweisungs_rechnungen AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((typ = 'verein'::text) AND public.is_verein_admin(ziel_verein_id)));

CREATE POLICY "Umfragestimmen sehen" ON public.umfrage_stimmen AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.nachrichten n
  WHERE ((n.id = umfrage_stimmen.nachricht_id) AND public.hat_gespraech_zugriff(n.gespraech_id)))));

CREATE POLICY "Angemeldete Nutzer koennen aktive Verbaende lesen" ON public.verbaende AS PERMISSIVE FOR SELECT TO authenticated
  USING ((aktiv = true));

CREATE POLICY "Plattformadmin verwaltet Verbaende" ON public.verbaende AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.ist_plattform_admin = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.ist_plattform_admin = true)))));

CREATE POLICY "Nutzer sehen passende Verbandsaltersklassen" ON public.verband_altersklassen AS PERMISSIVE FOR SELECT TO authenticated
  USING ((aktiv = true));

CREATE POLICY "Plattformadmin verwaltet Verbandsaltersklassen" ON public.verband_altersklassen AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.ist_plattform_admin = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.ist_plattform_admin = true)))));

CREATE POLICY "Nutzer sehen passende Verbandsdisziplinen" ON public.verband_disziplinen AS PERMISSIVE FOR SELECT TO authenticated
  USING ((aktiv = true));

CREATE POLICY "Plattformadmin verwaltet Verbandsdisziplinen" ON public.verband_disziplinen AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.ist_plattform_admin = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.ist_plattform_admin = true)))));

CREATE POLICY "Angemeldete Nutzer koennen Vereine sehen" ON public.vereine AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Vereinsadmin kann eigenen Verein bearbeiten" ON public.vereine AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_verein_admin(id))
  WITH CHECK (public.is_verein_admin(id));

CREATE POLICY "Mitglieder sehen eigene Bereichsrechte" ON public.vereins_bereichsrechte AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.vereins_mitglieder vm
  WHERE ((vm.id = vereins_bereichsrechte.vereins_mitglied_id) AND (vm.user_id = auth.uid())))));

CREATE POLICY "Nutzer sehen eigene Lizenzabdeckung" ON public.vereins_lizenz_abdeckungen AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));

CREATE POLICY "Mitgliedschaften sehen (eigene oder als Vereinsadmin)" ON public.vereins_mitglieder AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = auth.uid()) OR public.is_verein_admin(verein_id)));

CREATE POLICY "Plattform-Admin kann Vereinsmitgliedschaften löschen" ON public.vereins_mitglieder AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM public.profiles p2
  WHERE ((p2.id = auth.uid()) AND (p2.ist_plattform_admin = true)))));

CREATE POLICY "Relevante Vereinsmitgliedschaften sehen" ON public.vereins_mitglieder AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.ist_relevantes_mitglied(id));

CREATE POLICY "Vereinsadmin kann Mitglieder hinzufuegen" ON public.vereins_mitglieder AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_verein_admin(verein_id));

CREATE POLICY "Vereinsadmin kann Mitgliedschaften bearbeiten" ON public.vereins_mitglieder AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_verein_admin(verein_id));

CREATE POLICY "Vereinsadmin kann Mitgliedschaften entfernen" ON public.vereins_mitglieder AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.is_verein_admin(verein_id));

CREATE POLICY "Vereinsadmin verwaltet eigene Software-Verbindung" ON public.vereins_software_verbindungen AS PERMISSIVE FOR ALL TO authenticated
  USING (public.is_verein_admin(verein_id))
  WITH CHECK (public.is_verein_admin(verein_id));

CREATE POLICY "Beteiligte sehen die Wechselanfrage" ON public.vereinswechsel_anfragen AS PERMISSIVE FOR SELECT TO authenticated
  USING (((mitglied_user_id = auth.uid()) OR public.is_verein_admin(quell_verein_id) OR public.is_verein_admin(ziel_verein_id)));

CREATE POLICY "Mitglied bestaetigt oder lehnt ab" ON public.vereinswechsel_anfragen AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((mitglied_user_id = auth.uid()) AND (status = 'offen'::text)))
  WITH CHECK ((mitglied_user_id = auth.uid()));

CREATE POLICY "Quellverein-Admin bestaetigt oder lehnt ab" ON public.vereinswechsel_anfragen AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((public.is_verein_admin(quell_verein_id) AND (status = 'offen'::text)))
  WITH CHECK (public.is_verein_admin(quell_verein_id));

CREATE POLICY "Vereinsadmin kann Wechsel anfragen" ON public.vereinswechsel_anfragen AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((public.is_verein_admin(ziel_verein_id) AND (angefragt_von = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.vereins_mitglieder vm
  WHERE ((vm.user_id = vereinswechsel_anfragen.mitglied_user_id) AND (vm.verein_id = vereinswechsel_anfragen.quell_verein_id))))));
