-- Advisor "function_search_path_mutable": feste search_path fuer reine Hilfsfunktionen
alter function public.push_kategorie_standard(text) set search_path to 'public';
alter function public.kinderkonto_sperre() set search_path to 'public';
alter function public.zustimmung_textversion() set search_path to 'public';
