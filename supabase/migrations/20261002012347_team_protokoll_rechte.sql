create policy "Protokoll fuer Plattform-Admin" on public.admin_protokoll for select to authenticated using (ist_plattform_admin_aktuell());
revoke all on public.admin_protokoll from public, anon, authenticated;
grant select on public.admin_protokoll to authenticated;
grant all on public.admin_protokoll to service_role;
