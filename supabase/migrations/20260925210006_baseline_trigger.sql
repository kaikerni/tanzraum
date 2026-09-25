-- TanzRaum – Baseline-Migration 6/12: Trigger (22, inkl. auth.users → handle_new_user)
-- Exportiert aus dem Produktionsstand (Supabase-Projekt oraiqjulxmohclfixwdq) am 2026-09-25.
-- Nur für den Aufbau einer NEUEN/LEEREN Supabase-Datenbank gedacht.
-- NICHT gegen die Produktions-DB ausführen (dort existiert alles bereits) – siehe README.md.

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER anrufe_push AFTER INSERT ON public.anrufe FOR EACH ROW EXECUTE FUNCTION public.anruf_push_ausloesen();
CREATE TRIGGER einladungen_pruefen BEFORE INSERT OR UPDATE ON public.einladungen FOR EACH ROW EXECUTE FUNCTION public.pruefe_einladung();
CREATE TRIGGER pruefe_gleicher_verein BEFORE INSERT OR UPDATE ON public.eltern_kind_zuordnung FOR EACH ROW EXECUTE FUNCTION public.pruefe_gleicher_verein();
CREATE TRIGGER gruppen_chat_anlegen AFTER INSERT ON public.gruppen FOR EACH ROW EXECUTE FUNCTION public.gruppenchat_anlegen();
CREATE TRIGGER gruppen_thema_check BEFORE INSERT OR UPDATE ON public.gruppen FOR EACH ROW EXECUTE FUNCTION public.check_gruppen_thema();
CREATE TRIGGER pruefe_gleicher_verein BEFORE INSERT OR UPDATE ON public.gruppen_mitglieder FOR EACH ROW EXECUTE FUNCTION public.pruefe_gleicher_verein();
CREATE TRIGGER nachrichten_gesendet AFTER INSERT ON public.nachrichten FOR EACH ROW EXECUTE FUNCTION public.nachricht_gesendet();
CREATE TRIGGER nachrichten_pruefen BEFORE INSERT ON public.nachrichten FOR EACH ROW EXECUTE FUNCTION public.pruefe_nachricht();
CREATE TRIGGER nachrichten_push AFTER INSERT ON public.nachrichten FOR EACH ROW EXECUTE FUNCTION public.nachricht_push_ausloesen();
CREATE TRIGGER profiles_schuetzen BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profiles_schuetzen();
CREATE TRIGGER termine_benachrichtigen AFTER INSERT ON public.termine FOR EACH ROW EXECUTE FUNCTION public.termin_benachrichtigen();
CREATE TRIGGER termine_pruefen BEFORE INSERT OR UPDATE ON public.termine FOR EACH ROW EXECUTE FUNCTION public.pruefe_termin();
CREATE TRIGGER pruefe_training_konsistenz BEFORE INSERT OR UPDATE ON public.trainings_abmeldungen FOR EACH ROW EXECUTE FUNCTION public.pruefe_training_konsistenz();
CREATE TRIGGER pruefe_training_konsistenz BEFORE INSERT OR UPDATE ON public.trainings_anwesenheit FOR EACH ROW EXECUTE FUNCTION public.pruefe_training_konsistenz();
CREATE TRIGGER pruefe_training_konsistenz BEFORE INSERT OR UPDATE ON public.trainingstermine FOR EACH ROW EXECUTE FUNCTION public.pruefe_training_konsistenz();
CREATE TRIGGER pruefe_turnier_start BEFORE INSERT OR UPDATE ON public.turnier_starts FOR EACH ROW EXECUTE FUNCTION public.pruefe_turnier_start();
CREATE TRIGGER pruefe_turnier BEFORE INSERT OR UPDATE ON public.turniere FOR EACH ROW EXECUTE FUNCTION public.pruefe_turnier();
CREATE TRIGGER vereine_chat_anlegen AFTER INSERT ON public.vereine FOR EACH ROW EXECUTE FUNCTION public.vereinschat_anlegen();
CREATE TRIGGER vereine_schuetzen BEFORE INSERT OR UPDATE ON public.vereine FOR EACH ROW EXECUTE FUNCTION public.vereine_schuetzen();
CREATE TRIGGER letzten_admin_schuetzen BEFORE DELETE OR UPDATE ON public.vereins_mitglieder FOR EACH ROW EXECUTE FUNCTION public.letzten_admin_schuetzen();
CREATE TRIGGER trg_vereinswechsel_ausfuehren BEFORE UPDATE ON public.vereinswechsel_anfragen FOR EACH ROW EXECUTE FUNCTION public.vereinswechsel_ausfuehren();
