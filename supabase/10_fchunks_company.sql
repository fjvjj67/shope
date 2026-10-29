-- Attachment pieces (fchunks): staff may write a piece only for a new file or a file of their own account.
-- Before: staff could overwrite pieces of any file (e.g. a Guangzhou receipt) if they knew its id.
-- Uploads still work: pieces are written before the file row, so "file not created yet" is allowed.
create or replace function public.staff_can(c text, i text, d jsonb) returns boolean language sql stable security definer set search_path to 'public' as $$
  select case
    when c = 'meta' then false
    when c = 'companies' then i = public.my_company()
    when c = 'fchunks' then public.my_company() is null or not exists(
      select 1 from public.docs f
      where f.col = 'files' and f.id = d->>'fid'
        and coalesce(f.data->>'companyId','main') <> public.my_company())
    else coalesce(d->>'companyId','main') = coalesce(public.my_company(), coalesce(d->>'companyId','main'))
  end
$$;
