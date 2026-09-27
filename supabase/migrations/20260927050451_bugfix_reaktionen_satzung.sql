-- Zwei bekannte Fehler aus dem Produktionsstand
--
-- 1) Nachrichtenreaktionen: Die App reagiert mit TanzRaum-Smileys (Sticker-IDs, Fremdschluessel
--    nachricht_reaktionen_sticker_fk -> sticker.id). Der alte CHECK mit einer festen Unicode-Emoji-Liste
--    widerspricht dem Fremdschluessel, dadurch liess sich keine Reaktion speichern. Der CHECK entfaellt.
alter table public.nachricht_reaktionen drop constraint if exists nachricht_reaktionen_emoji_check;

-- 2) Satzung (Bucket vereinsdokumente): Die Regel "Admin laedt Satzung hoch/ersetzt" verglich die Vereins-ID mit
--    storage.foldername(r.name) (Rollenname statt Dateipfad) und griff daher nie. Hochladen, Ersetzen und Loeschen
--    regeln bereits die Policies "Vereinsadmin kann Satzung hochladen/ersetzen/loeschen" (is_verein_admin auf den
--    ersten Pfadteil). Die fehlerhafte, wirkungslose Regel wird entfernt.
drop policy if exists "Admin lädt Satzung hoch/ersetzt" on storage.objects;
