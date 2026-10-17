-- إيصالات الحوالات: مخزن ملفات خاص (غير عام) لصور/PDF إيصالات الدفعات
-- القراءة: المدير والموظف · الرفع والحذف: المدير فقط (نفس صلاحية الدفعات)
-- إضافة فقط: لا يغيّر أي جدول أو بيانات موجودة.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 8388608,
        array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;

drop policy if exists receipts_read on storage.objects;
create policy receipts_read on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.my_role() in ('admin','staff'));

drop policy if exists receipts_insert on storage.objects;
create policy receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and public.my_role() = 'admin');

drop policy if exists receipts_delete on storage.objects;
create policy receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and public.my_role() = 'admin');
