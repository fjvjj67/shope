-- Staff is locked to one account (profiles.company) and sees the UI in profiles.lang. Only admin deletes.
alter table public.profiles add column if not exists company text;
alter table public.profiles add column if not exists lang text;
create or replace function public.my_company() returns text language sql stable security definer set search_path to 'public' as $$
  select (select company from public.profiles where user_id = auth.uid())
$$;
create or replace function public.staff_can(c text, i text, d jsonb) returns boolean language sql stable security definer set search_path to 'public' as $$
  select case
    when c = 'meta' then false
    when c = 'companies' then i = public.my_company()
    when c = 'fchunks' then true
    else coalesce(d->>'companyId','main') = coalesce(public.my_company(), coalesce(d->>'companyId','main'))
  end
$$;
create or replace function public.staff_read(c text, i text, d jsonb) returns boolean language sql stable security definer set search_path to 'public' as $$
  select case
    when c = 'meta' then true
    when c = 'fchunks' then public.my_company() is null or exists(select 1 from public.docs f where f.col='files' and f.id = d->>'fid' and coalesce(f.data->>'companyId','main') = public.my_company())
    else public.staff_can(c,i,d)
  end
$$;
alter policy docs_read on public.docs using ((public.my_role() = 'admin') or (public.my_role() = 'staff' and public.staff_read(col,id,data)));
alter policy docs_insert on public.docs with check ((public.my_role() = 'admin') or (public.my_role() = 'staff' and public.staff_can(col,id,data)));
alter policy docs_update on public.docs using ((public.my_role() = 'admin') or (public.my_role() = 'staff' and public.staff_can(col,id,data))) with check ((public.my_role() = 'admin') or (public.my_role() = 'staff' and public.staff_can(col,id,data)));
