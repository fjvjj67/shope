-- نسخة 2: الحسابات (كوانزو/ايو) + محفظة شركات الشحن + الحوالات والوصولات
alter table public.docs drop constraint if exists docs_col_ok;
alter table public.docs add constraint docs_col_ok check (col = any (array['factories','orders','payments','carriers','shipments','activity','meta','companies','ledger','files','fchunks','ctx']));
drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert to authenticated
  with check ((public.my_role() = 'admin') or (public.my_role() = 'staff' and col = any (array['orders','shipments','activity','files','fchunks'])));
drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update to authenticated
  using ((public.my_role() = 'admin') or (public.my_role() = 'staff' and col = any (array['orders','shipments','files','fchunks'])))
  with check ((public.my_role() = 'admin') or (public.my_role() = 'staff' and col = any (array['orders','shipments','files','fchunks'])));
