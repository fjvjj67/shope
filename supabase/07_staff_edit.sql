-- Staff can add and edit everything except settings (meta). Only admin can delete.
alter policy docs_insert on public.docs with check ((public.my_role() = 'admin') or (public.my_role() = 'staff' and col <> 'meta'));
alter policy docs_update on public.docs using ((public.my_role() = 'admin') or (public.my_role() = 'staff' and col <> 'meta')) with check ((public.my_role() = 'admin') or (public.my_role() = 'staff' and col <> 'meta'));
