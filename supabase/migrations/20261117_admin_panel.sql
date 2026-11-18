-- ═══════════════════════════════════════════════════════════════════
-- ECO SCHOOL — admin panel kengaytmasi uchun migratsiya
-- Supabase → SQL Editor ga qo'yib, BIR MARTA ishga tushiring.
-- Qayta ishga tushirsa ham xavfsiz (idempotent).
--
-- Nima qiladi:
--   1) Tadqiqotlarga jamoa nomi va a'zolari ustunlari qo'shiladi
--   2) Tadqiqot balli chegarasi 40 dan 100 ga oshiriladi
--   3) "Sahifa matnlari" uchun site_content jadvali yaratiladi
--   4) Adminga challenge, tadbir, o'quvchi va tadqiqotlarni boshqarish ruxsati beriladi
--
-- ⚠️ Avval Supabase'da zaxira (backup) oling yoki test loyihada sinab ko'ring.
-- ═══════════════════════════════════════════════════════════════════

-- 0) Admin tekshiruvchi yordamchi funksiya
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 1) Jamoa ustunlari
alter table public.eco_research add column if not exists team_name text;
alter table public.eco_research add column if not exists team_members text;

-- 2) Ball chegarasi: awarded_points ga tegishli eski CHECK cheklovlarini olib tashlab, 0–100 qo'yamiz
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.eco_research'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%awarded_points%'
  loop
    execute format('alter table public.eco_research drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.eco_research
  add constraint eco_research_awarded_points_range check (awarded_points between 0 and 100);

-- ESLATMA: agar ballni hisoblaydigan trigger/funksiyangizda "40" chegarasi yozilgan bo'lsa,
-- uni ham 100 ga o'zgartiring. Tekshirish:
--   select proname, prosrc from pg_proc where prosrc ilike '%40%' and pronamespace = 'public'::regnamespace;

-- 3) Sahifa matnlari
create table if not exists public.site_content (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.site_content enable row level security;

drop policy if exists "site_content_read_all" on public.site_content;
create policy "site_content_read_all" on public.site_content
  for select to anon, authenticated using (true);

drop policy if exists "site_content_admin_write" on public.site_content;
create policy "site_content_admin_write" on public.site_content
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 4) Admin ruxsatlari
-- Challenge'lar: qo'shish / tahrirlash / o'chirish
drop policy if exists "challenges_admin_write" on public.challenges;
create policy "challenges_admin_write" on public.challenges
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Tadbirlar: tahrirlash va o'chirish (qo'shish allaqachon bo'lishi mumkin)
drop policy if exists "eco_events_admin_write" on public.eco_events;
create policy "eco_events_admin_write" on public.eco_events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Tadqiqotlar: admin to'g'ridan-to'g'ri qo'shishi, tahrirlashi va o'chirishi
drop policy if exists "eco_research_admin_write" on public.eco_research;
create policy "eco_research_admin_write" on public.eco_research
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- O'quvchilar: admin ro'yxatni ko'rishi va ism/sinfni tuzatishi
drop policy if exists "profiles_admin_read" on public.profiles;
create policy "profiles_admin_read" on public.profiles
  for select to authenticated using (public.is_admin());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Muhim: oddiy foydalanuvchi o'z profilidagi role/points ni o'zgartira olmasligi kerak.
-- Agar sizda "foydalanuvchi o'z profilini yangilaydi" siyosati bo'lsa, quyidagi trigger
-- role va points ni faqat admin o'zgartirishiga kafolat beradi:
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and auth.uid() is not null then
    new.role := old.role;
    new.points := old.points;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Supabase API (PostgREST) yangi funksiyalarni darhol ko'rishi uchun
notify pgrst, 'reload schema';
