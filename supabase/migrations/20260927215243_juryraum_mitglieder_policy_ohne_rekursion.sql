-- Policy "JuryAdmins verwalten JuryMitglieder" las fuer die Admin-Pruefung dieselbe Tabelle
-- juryraum_mitglieder erneut aus -> RLS wertet sich selbst aus -> 42P17 "infinite recursion"
-- bei jeder Abfrage der Tabelle (auch fuer Personen ohne Jury-Mitgliedschaft).
-- Jetzt ueber die vorhandene SECURITY-DEFINER-Funktion juryraum_eigene_rolle() (umgeht RLS).
-- Gleiche Bedeutung wie vorher, da user_id eindeutig ist (UNIQUE (user_id)).
-- Nur diese eine Policy; Name, Befehl (ALL) und Rolle (authenticated) bleiben unveraendert.
alter policy "JuryAdmins verwalten JuryMitglieder" on public.juryraum_mitglieder
  using ((select public.juryraum_eigene_rolle()) = 'admin')
  with check ((select public.juryraum_eigene_rolle()) = 'admin');
