-- قفل رمز الدخول: سجل محاولات الدخول تستخدمه دالة pin-login فقط (بمفتاح الخادم)
-- لا أحد من المتصفح يستطيع قراءته أو الكتابة عليه.

create table if not exists public.login_attempts (
  id bigserial primary key,
  ip text not null,
  ok boolean not null,
  at timestamptz not null default now()
);
create index if not exists login_attempts_ip_at_idx on public.login_attempts (ip, at desc);
create index if not exists login_attempts_at_idx on public.login_attempts (at desc);

alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;
revoke all on sequence public.login_attempts_id_seq from anon, authenticated;
