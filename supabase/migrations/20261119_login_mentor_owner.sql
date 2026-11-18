-- ═══════════════════════════════════════════════════════════════════════════
--  ECO SCHOOL — LOGIN BILAN KIRISH, MENTOR ROLI, BOSH ADMIN HIMOYASI
--
--  Ishlab turgan bazaga: Supabase → SQL Editor → New query → shu fayl → Run.
--  Qayta ishga tushirish xavfsiz. Mavjud ma'lumotlar o'chirilmaydi.
--
--  1) profiles.username — o'quvchi email o'rniga login bilan kiradi
--  2) 'mentor' roli — topshiriqlarni tekshiradi, saytni boshqara olmaydi
--  3) profiles.is_owner — BOSH ADMIN. Faqat SQL Editor'dan tayinlanadi;
--     sayt orqali uni hech kim adminlikdan ololmaydi, o'chira olmaydi,
--     parolini o'zgartira olmaydi
--  4) admin_set_password — admin o'quvchi parolini tiklaydi (email yo'q)
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Ustunlar va cheklovlar ──
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists is_owner boolean not null default false;

alter table public.profiles drop constraint if exists profiles_username_check;
alter table public.profiles add constraint profiles_username_check
  check (username is null or username ~ '^[a-z0-9_.]{3,24}$');
create unique index if not exists profiles_username_key on public.profiles (username);

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'mentor', 'admin'));

-- ── 2. Yordamchi funksiyalar ──
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'mentor'));
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_owner and role = 'admin');
$$;

-- Ro'yxatdan o'tganda profil + login yoziladi
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_code   text := upper(trim(coalesce(new.raw_user_meta_data ->> 'school_code', '')));
  v_user   text := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  v_school bigint;
begin
  select id into v_school from public.schools where code = v_code;
  if v_user !~ '^[a-z0-9_.]{3,24}$' then v_user := null; end if;
  insert into public.profiles (id, full_name, class_name, school_code, school_id, username)
  values (
    new.id,
    left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 80),
    left(upper(trim(coalesce(new.raw_user_meta_data ->> 'class_name', ''))), 20),
    nullif(v_code, ''),
    v_school,
    v_user
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- Profil himoyasi:
--  • oddiy foydalanuvchi o'z roli, bali, maktabini o'zgartira olmaydi
--  • login va "bosh admin" belgisini sayt orqali hech kim o'zgartira olmaydi
--  • bosh adminning rolini sayt orqali hech kim (o'zi ham) o'zgartira olmaydi
--  • adminlarning rolini faqat bosh admin o'zgartiradi
--  (SQL Editor'da auth.uid() bo'sh — u yerdan hammasi mumkin)
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('eco.points_sync', true), '') = '1' then
    return new;
  end if;
  if auth.uid() is null then
    return new;
  end if;
  new.is_owner := old.is_owner;
  new.username := old.username;
  if new.role is distinct from old.role then
    if old.is_owner then
      raise exception 'Bosh adminning rolini o''zgartirib bo''lmaydi' using errcode = '42501';
    end if;
    if (old.role = 'admin' or new.role = 'admin') and not public.is_owner() then
      raise exception 'Adminlarni faqat bosh admin tayinlaydi yoki olib tashlaydi' using errcode = '42501';
    end if;
  end if;
  if not public.is_admin() then
    new.role      := old.role;
    new.points    := old.points;
    new.school_id := old.school_id;
  end if;
  return new;
end $$;

-- Bosh admin profilini sayt orqali o'chirib bo'lmaydi
create or replace function public.protect_owner_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.is_owner and auth.uid() is not null then
    raise exception 'Bosh adminni o''chirib bo''lmaydi' using errcode = '42501';
  end if;
  return old;
end $$;

drop trigger if exists protect_owner_delete on public.profiles;
create trigger protect_owner_delete
  before delete on public.profiles
  for each row execute function public.protect_owner_delete();

-- ── 3. Tekshiruv: admin VA mentor ball bera oladi ──
create or replace function public.prepare_challenge_submission()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    if tg_op = 'INSERT' then
      new.status := 'pending'; new.awarded_points := 0; new.reviewed_by := null; new.reviewed_at := null;
    end if;
    return new;
  end if;
  if new.status = 'approved' then
    if tg_op = 'INSERT' or old.status <> 'approved' then
      select points into new.awarded_points from public.challenges where id = new.challenge_id;
    end if;
  else
    new.awarded_points := 0;
  end if;
  if tg_op = 'UPDATE' and new.status <> old.status then
    new.reviewed_at := now(); new.reviewed_by := coalesce(new.reviewed_by, auth.uid());
  end if;
  return new;
end $$;

create or replace function public.prepare_recycling_submission()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    if tg_op = 'INSERT' then
      new.status := 'pending'; new.awarded_points := 0; new.verified_amount_kg := null;
      new.reviewed_by := null; new.reviewed_at := null;
      new.school_id := public.my_school_id();
    end if;
    return new;
  end if;
  if new.status = 'approved' then
    new.awarded_points := round(coalesce(new.verified_amount_kg, new.amount_kg) * 25);
  else
    new.awarded_points := 0;
  end if;
  if tg_op = 'UPDATE' and new.status <> old.status then
    new.reviewed_at := now(); new.reviewed_by := coalesce(new.reviewed_by, auth.uid());
  end if;
  return new;
end $$;

create or replace function public.prepare_research()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    if tg_op = 'INSERT' then
      new.status := 'pending'; new.awarded_points := 0; new.reviewer_feedback := null; new.reviewed_at := null;
    end if;
    return new;
  end if;
  new.awarded_points := case when new.status = 'published' then least(100, greatest(0, coalesce(new.awarded_points, 0))) else 0 end;
  if tg_op = 'UPDATE' and new.status <> old.status then
    new.reviewed_at := now();
  end if;
  return new;
end $$;

-- ── 4. Parolni tiklash (email yo'qligi uchun) ──
--  • admin — o'quvchi va mentor parolini tiklaydi
--  • bosh admin — adminlar parolini ham (boshqa bosh adminnikini emas)
create or replace function public.admin_set_password(p_user uuid, p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  t public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Ruxsat yo''q' using errcode = '42501';
  end if;
  if char_length(coalesce(p_password, '')) < 8 or char_length(p_password) > 72 then
    raise exception 'Parol 8–72 ta belgidan iborat bo''lishi kerak';
  end if;
  select * into t from public.profiles where id = p_user;
  if not found then
    raise exception 'Foydalanuvchi topilmadi';
  end if;
  if t.is_owner and p_user <> auth.uid() then
    raise exception 'Bosh adminning parolini o''zgartirib bo''lmaydi' using errcode = '42501';
  end if;
  if t.role = 'admin' and p_user <> auth.uid() and not public.is_owner() then
    raise exception 'Admin parolini faqat bosh admin tiklaydi' using errcode = '42501';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_user;
end $$;

revoke all on function public.is_staff(), public.is_owner(), public.admin_set_password(uuid, text),
  public.protect_owner_delete() from public, anon;
grant execute on function public.is_staff(), public.is_owner(), public.admin_set_password(uuid, text) to authenticated;

-- ── 5. Ruxsatlar (RLS): mentor tekshiruv bo'limlarini ko'radi ──
drop policy if exists eco_profiles_staff_read on public.profiles;
create policy eco_profiles_staff_read on public.profiles for select to authenticated using (public.is_staff());

drop policy if exists eco_chsub_staff on public.challenge_submissions;
create policy eco_chsub_staff on public.challenge_submissions for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists eco_rec_staff on public.recycling_submissions;
create policy eco_rec_staff on public.recycling_submissions for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists eco_research_staff on public.eco_research;
create policy eco_research_staff on public.eco_research for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists eco_proofs_read on storage.objects;
create policy eco_proofs_read on storage.objects for select to authenticated
  using (bucket_id in ('challenge-proofs', 'recycling-proofs')
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

commit;

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
--  O'ZINGIZNI BOSH ADMIN QILISH (alohida, emailni o'zingiznikiga almashtiring):
--
--    update public.profiles set role = 'admin', is_owner = true
--    where id = (select id from auth.users where email = 'sizning@email.com');
--
--  Bosh adminlikni olib tashlash ham faqat shu yerdan:
--    update public.profiles set is_owner = false where id = '...';
-- ═══════════════════════════════════════════════════════════════════════════
