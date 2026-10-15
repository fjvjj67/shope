-- سجل تغييرات محمي: كل إضافة/تعديل/حذف على الطلبات والدفعات وغيرها ينحفظ تلقائياً
-- ولا أحد (حتى المدير) يستطيع تعديله أو مسحه من التطبيق. المدير فقط يقرأه.

create table if not exists public.docs_history (
  id bigserial primary key,
  col text not null,
  doc_id text not null,
  action text not null check (action in ('insert','update','delete')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index if not exists docs_history_doc_idx on public.docs_history (col, doc_id, changed_at desc);
create index if not exists docs_history_action_idx on public.docs_history (action, changed_at desc);

create or replace function public.docs_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.docs_history (col, doc_id, action, new_data, changed_by)
    values (new.col, new.id, 'insert', new.data, auth.uid());
    return new;
  elsif tg_op = 'UPDATE' then
    if new.data is distinct from old.data then
      insert into public.docs_history (col, doc_id, action, old_data, new_data, changed_by)
      values (new.col, new.id, 'update', old.data, new.data, auth.uid());
    end if;
    return new;
  else
    insert into public.docs_history (col, doc_id, action, old_data, changed_by)
    values (old.col, old.id, 'delete', old.data, auth.uid());
    return old;
  end if;
end $$;
revoke execute on function public.docs_audit() from public, anon, authenticated;

drop trigger if exists docs_audit on public.docs;
create trigger docs_audit after insert or update or delete on public.docs
  for each row execute function public.docs_audit();

alter table public.docs_history enable row level security;
revoke all on public.docs_history from anon, authenticated;
grant select on public.docs_history to authenticated;
drop policy if exists docs_history_admin_read on public.docs_history;
create policy docs_history_admin_read on public.docs_history for select to authenticated
  using (public.my_role() = 'admin');

-- نقطة بداية: نسخة من البيانات الموجودة حالياً
insert into public.docs_history (col, doc_id, action, new_data, changed_at)
select col, id, 'insert', data, created_at from public.docs
where not exists (select 1 from public.docs_history h where h.col = docs.col and h.doc_id = docs.id);
