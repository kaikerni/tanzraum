-- Ausgeschaltete Bereiche und Statistik-Inhalte duerfen alle lesen, die den Verein sehen (Zeilen weiter per RLS)
grant select (module_aus, statistik_inhalte) on public.vereine to authenticated;
