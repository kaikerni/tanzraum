-- TanzRaum – Baseline-Migration 10/12: Realtime-Publikation
-- Exportiert aus dem Produktionsstand (Supabase-Projekt oraiqjulxmohclfixwdq) am 2026-09-25.
-- Nur für den Aufbau einer NEUEN/LEEREN Supabase-Datenbank gedacht.
-- NICHT gegen die Produktions-DB ausführen (dort existiert alles bereits) – siehe README.md.

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.anruf_signale;
ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.anrufe;
ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.gespraech_teilnehmer;
ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.nachricht_reaktionen;
ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.nachrichten;
