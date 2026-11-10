-- Cartons arriving at the shipping company's warehouse (China): new collection `ctn` {orderId, n, date, note}.
-- Applied 2026-11-10. Security (RLS) is the generic companyId rule from 08_staff_company.sql; history via docs_audit.
alter table public.docs drop constraint if exists docs_col_ok;
alter table public.docs add constraint docs_col_ok check (col = any (array['factories','orders','payments','carriers','shipments','activity','meta','companies','ledger','files','fchunks','ctx','ctn']));
