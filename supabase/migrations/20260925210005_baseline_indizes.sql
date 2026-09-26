-- TanzRaum – Baseline-Migration 5/12: Zusätzliche Indizes (32, ohne Constraint-Indizes)
-- Exportiert aus dem Produktionsstand (Supabase-Projekt oraiqjulxmohclfixwdq) am 2026-09-25.
-- Nur für den Aufbau einer NEUEN/LEEREN Supabase-Datenbank gedacht.
-- NICHT gegen die Produktions-DB ausführen (dort existiert alles bereits) – siehe README.md.

CREATE UNIQUE INDEX abos_anbieter_id ON public.abos USING btree (anbieter, anbieter_abo_id) WHERE (anbieter_abo_id IS NOT NULL);
CREATE INDEX abos_user ON public.abos USING btree (user_id);
CREATE INDEX abos_verein ON public.abos USING btree (verein_id);
CREATE INDEX anruf_signale_an ON public.anruf_signale USING btree (anruf_id, an);
CREATE INDEX anrufe_angerufener ON public.anrufe USING btree (angerufener_id, status);
CREATE UNIQUE INDEX connections_paar ON public.connections USING btree (LEAST(user_id, connected_to), GREATEST(user_id, connected_to));
CREATE INDEX eltern_code_versuche_idx ON public.eltern_code_versuche USING btree (user_id, am);
CREATE INDEX eltern_kind_zuordnung_eltern_idx ON public.eltern_kind_zuordnung USING btree (eltern_vm_id);
CREATE INDEX eltern_kind_zuordnung_kind_idx ON public.eltern_kind_zuordnung USING btree (kind_vm_id);
CREATE UNIQUE INDEX gespraeche_gruppenchat_eindeutig ON public.gespraeche USING btree (gruppe_id) WHERE (typ = 'trainingsgruppe'::text);
CREATE UNIQUE INDEX gespraeche_juryraum_turnier_key ON public.gespraeche USING btree (turnier_id) WHERE (typ = 'juryraum'::text);
CREATE UNIQUE INDEX gespraeche_vereinschat_eindeutig ON public.gespraeche USING btree (verein_id) WHERE (typ = 'verein'::text);
CREATE INDEX gruppen_altersklasse_id_idx ON public.gruppen USING btree (altersklasse_id);
CREATE INDEX gruppen_disziplin_id_idx ON public.gruppen USING btree (disziplin_id);
CREATE INDEX gruppen_verein_id_idx ON public.gruppen USING btree (verein_id);
CREATE INDEX gruppen_mitglieder_gruppe_id_idx ON public.gruppen_mitglieder USING btree (gruppe_id);
CREATE INDEX gruppen_mitglieder_mitglied_id_idx ON public.gruppen_mitglieder USING btree (vereins_mitglied_id);
CREATE INDEX invite_links_token_idx ON public.invite_links USING btree (token);
CREATE INDEX login_ips_user_id_idx ON public.login_ips USING btree (user_id, eingeloggt_am DESC);
CREATE INDEX mail_versand_log_suche ON public.mail_versand_log USING btree (art, absender_user, erstellt_am DESC);
CREATE INDEX meldungen_status_idx ON public.meldungen USING btree (status, erstellt_am DESC);
CREATE INDEX nachrichten_gespraech_zeit ON public.nachrichten USING btree (gespraech_id, gesendet_am DESC);
CREATE UNIQUE INDEX onboarding_progress_user_verein_key ON public.onboarding_progress USING btree (user_id, COALESCE(verein_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE UNIQUE INDEX spotlight_reactions_einmal ON public.spotlight_reactions USING btree (spotlight_id, user_id);
CREATE INDEX spotlights_aktiv_idx ON public.spotlights USING btree (user_id, ablauf_am DESC);
CREATE INDEX termine_ersteller ON public.termine USING btree (erstellt_von) WHERE (verein_id IS NULL);
CREATE INDEX termine_verein_datum ON public.termine USING btree (verein_id, datum);
CREATE INDEX turnier_starts_gruppe_idx ON public.turnier_starts USING btree (gruppe_id);
CREATE INDEX turnier_starts_turnier_idx ON public.turnier_starts USING btree (turnier_id);
CREATE INDEX turnier_starts_verein_idx ON public.turnier_starts USING btree (verein_id, turnier_id);
CREATE INDEX turniere_verein_idx ON public.turniere USING btree (verein_id);
CREATE UNIQUE INDEX active_club_coverage_per_user_key ON public.vereins_lizenz_abdeckungen USING btree (verein_id, user_id) WHERE (status = 'active'::text);
