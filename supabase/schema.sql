-- نظام إدارة الطلبات والشحن — مخطط قاعدة البيانات والصلاحيات
-- الأدوار: admin (كل شيء) · staff (يضيف ويعدّل الطلبات والشحنات فقط، بلا حذف) · pending (بانتظار موافقة المدير، لا يرى شيئاً)

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  role text not null default 'pending' check (role in ('admin','staff','pending')),
  created_at timestamptz not null default now()
);

create table if not exists public.docs (
  col text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (col, id),
  constraint docs_col_ok check (col in ('factories','orders','payments','carriers','shipments','activity','meta'))
);
create index if not exists docs_col_created_idx on public.docs (col, created_at desc);

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where user_id = auth.uid()), 'none')
$$;
revoke execute on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;

-- أول مستخدم يسجّل يصبح مديراً، والباقون بانتظار الموافقة
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(4242);
  insert into public.profiles (user_id, email, name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
          case when exists (select 1 from public.profiles where role = 'admin') then 'pending' else 'admin' end);
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.docs_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now(); new.updated_by := auth.uid();
  if tg_op <> 'INSERT' then new.created_at := old.created_at; end if;
  return new;
end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before insert or update on public.docs
  for each row execute function public.docs_touch();

alter table public.profiles enable row level security;
alter table public.docs enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.my_role() in ('admin','staff'));
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

drop policy if exists docs_read on public.docs;
create policy docs_read on public.docs for select to authenticated
  using (public.my_role() in ('admin','staff'));
drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert to authenticated
  with check (public.my_role() = 'admin'
    or (public.my_role() = 'staff' and col in ('orders','shipments','activity')));
drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update to authenticated
  using (public.my_role() = 'admin' or (public.my_role() = 'staff' and col in ('orders','shipments')))
  with check (public.my_role() = 'admin' or (public.my_role() = 'staff' and col in ('orders','shipments')));
drop policy if exists docs_delete on public.docs;
create policy docs_delete on public.docs for delete to authenticated
  using (public.my_role() = 'admin');

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.docs to authenticated;
revoke all on public.docs, public.profiles from anon;

do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;
