-- 1) Cache for the "translate" edge function (Chinese <-> Arabic for typed text).
--    RLS on with no policies: only the server function (service role) can read/write it.
create table if not exists public.translations (h text primary key, tl text not null, src text not null, out text not null, created_at timestamptz not null default now());
alter table public.translations enable row level security;

-- 2) History: don't copy big file chunks on insert/update (saves database space). Deletes are still kept.
CREATE OR REPLACE FUNCTION public.docs_audit()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    if new.col <> 'fchunks' then
      insert into public.docs_history (col, doc_id, action, new_data, changed_by)
      values (new.col, new.id, 'insert', new.data, auth.uid());
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if new.data is distinct from old.data and new.col <> 'fchunks' then
      insert into public.docs_history (col, doc_id, action, old_data, new_data, changed_by)
      values (new.col, new.id, 'update', old.data, new.data, auth.uid());
    end if;
    return new;
  else
    insert into public.docs_history (col, doc_id, action, old_data, changed_by)
    values (old.col, old.id, 'delete', old.data, auth.uid());
    return old;
  end if;
end $function$;
