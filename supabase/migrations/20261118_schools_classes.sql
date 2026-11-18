-- ═══════════════════════════════════════════════════════════════════
-- ECO SCHOOL — admin paneldan MAKTAB va SINFLARni boshqarish
--
-- Supabase → SQL Editor ga to'liq qo'yib, Run bosing.
--
-- Bu skript bazangizni O'ZI tekshiradi:
--   • maktablar jadvalini profiles.school_id bog'lanishidan topadi;
--   • kod va nom ustunlarini aniqlaydi (code / school_code, name / school_name ...);
--   • sinflar jadvali bo'lsa — o'shandan foydalanadi, bo'lmasa yangisini yaratib,
--     hozirgi sinflarni unga ko'chiradi (ro'yxatdan o'tish buzilmaydi);
--   • admin panel uchun xavfsiz funksiyalarni yaratadi (faqat adminlar chaqira oladi).
--
-- Tushunmagan tuzilma uchrasa — XATO bilan to'xtaydi va HECH NARSANI O'ZGARTIRMAYDI.
-- Qayta ishga tushirish xavfsiz. Baribir avval zaxira (backup) olishni tavsiya qilamiz.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- Admin tekshiruvi (avvalgi migratsiyada ham bor — bu yerda ham bo'lishi xavfsiz)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

do $mig$
declare
  s_tbl      regclass;
  s_id       text;
  s_id_type  text;
  s_code     text;
  s_name     text;
  c_tbl      regclass;
  c_fk       text;
  c_name     text := 'class_name';
  cand       text;
  r          record;
  legacy     regprocedure;
  seeded     int := 0;
  created_classes boolean := false;
  has_profile_school_code boolean;
  id_insert  text;   -- yangi maktab id'si qanday yaratiladi
begin
  if to_regclass('public.profiles') is null then
    raise exception 'profiles jadvali topilmadi — bu skript ECO SCHOOL bazasi uchun.';
  end if;

  -- ───── 1. Maktablar jadvali ─────
  select con.confrelid::regclass, a2.attname
    into s_tbl, s_id
  from pg_constraint con
  join pg_attribute a1 on a1.attrelid = con.conrelid  and a1.attnum = con.conkey[1]
  join pg_attribute a2 on a2.attrelid = con.confrelid and a2.attnum = con.confkey[1]
  where con.contype = 'f'
    and con.conrelid = 'public.profiles'::regclass
    and a1.attname = 'school_id'
  limit 1;

  if s_tbl is null and to_regclass('public.schools') is not null then
    s_tbl := 'public.schools'::regclass;
    s_id  := 'id';
  end if;

  if s_tbl is null then
    raise exception 'Maktablar jadvali aniqlanmadi (profiles.school_id hech qaysi jadvalga bog''lanmagan va "schools" jadvali yo''q). Hech narsa o''zgartirilmadi.';
  end if;

  select format_type(atttypid, atttypmod) into s_id_type
  from pg_attribute where attrelid = s_tbl and attname = s_id and not attisdropped;

  -- id avtomatik (default/identity) bo'lmasa, yangi maktab uchun id'ni o'zimiz beramiz
  if exists (select 1 from pg_attribute where attrelid = s_tbl and attname = s_id
             and not attisdropped and (atthasdef or attidentity <> '')) then
    id_insert := null;
  elsif s_id_type in ('smallint', 'integer', 'bigint') then
    id_insert := format('(select coalesce(max(%I), 0) + 1 from %s)', s_id, s_tbl);
  elsif s_id_type = 'uuid' then
    id_insert := 'gen_random_uuid()';
  else
    id_insert := null;
  end if;

  foreach cand in array array['code', 'school_code', 'invite_code', 'join_code', 'slug'] loop
    if exists (select 1 from pg_attribute where attrelid = s_tbl and attname = cand and attnum > 0 and not attisdropped) then
      s_code := cand; exit;
    end if;
  end loop;
  if s_code is null then
    raise exception 'Maktablar jadvalida (%) maktab kodi ustuni topilmadi (code / school_code). Hech narsa o''zgartirilmadi.', s_tbl;
  end if;

  foreach cand in array array['name', 'school_name', 'title', 'full_name'] loop
    if exists (select 1 from pg_attribute where attrelid = s_tbl and attname = cand and attnum > 0 and not attisdropped) then
      s_name := cand; exit;
    end if;
  end loop;
  if s_name is null then
    execute format('alter table %s add column name text', s_tbl);
    execute format('update %s set name = %I::text where name is null', s_tbl, s_code);
    s_name := 'name';
    raise notice 'Maktablar jadvaliga "name" ustuni qo''shildi.';
  end if;

  -- ───── 2. Sinflar jadvali ─────
  select con.conrelid::regclass, a1.attname
    into c_tbl, c_fk
  from pg_constraint con
  join pg_attribute a1 on a1.attrelid = con.conrelid and a1.attnum = con.conkey[1]
  where con.contype = 'f'
    and con.confrelid = s_tbl
    and con.conrelid <> 'public.profiles'::regclass
    and exists (select 1 from pg_attribute x where x.attrelid = con.conrelid and x.attname = 'class_name' and not x.attisdropped)
    and exists (select 1 from pg_attribute x where x.attrelid = con.conrelid and x.attname = 'id' and not x.attisdropped)
    and not exists (select 1 from pg_attribute x where x.attrelid = con.conrelid and x.attname in ('student_id', 'user_id') and not x.attisdropped)
  order by (con.conrelid::regclass::text in ('school_classes', 'classes')) desc
  limit 1;

  if c_tbl is null then
    foreach cand in array array['school_classes', 'classes'] loop
      if to_regclass('public.' || cand) is not null
         and exists (select 1 from pg_attribute where attrelid = to_regclass('public.' || cand) and attname = 'school_id' and not attisdropped)
         and exists (select 1 from pg_attribute where attrelid = to_regclass('public.' || cand) and attname = 'class_name' and not attisdropped)
         and exists (select 1 from pg_attribute where attrelid = to_regclass('public.' || cand) and attname = 'id' and not attisdropped) then
        c_tbl := to_regclass('public.' || cand);
        c_fk := 'school_id';
        exit;
      end if;
    end loop;
  end if;

  if c_tbl is null then
    -- Sinflar alohida jadvalda saqlanmagan — yangi jadval yaratamiz
    execute format($q$
      create table public.school_classes (
        id bigint generated always as identity primary key,
        school_id %s not null references %s (%I) on delete cascade,
        class_name text not null check (char_length(class_name) between 1 and 20),
        created_at timestamptz not null default now(),
        unique (school_id, class_name)
      )$q$, s_id_type, s_tbl, s_id);
    execute 'alter table public.school_classes enable row level security';
    c_tbl := to_regclass('public.school_classes');
    c_fk := 'school_id';
    created_classes := true;

    -- 2a. Hozir ro'yxatdan o'tishda ko'rinayotgan sinflarni ko'chiramiz
    select p.oid::regprocedure into legacy
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = 'get_school_classes_by_code'
    limit 1;

    if legacy is not null then
      for r in execute format('select %I::text as sid, %I::text as scode from %s', s_id, s_code, s_tbl) loop
        begin
          execute format(
            'insert into public.school_classes (school_id, class_name)
             select $1::%s, x.class_name::text from public.get_school_classes_by_code($2) x where x.class_name is not null
             on conflict do nothing',
            s_id_type
          ) using r.sid, r.scode;
        exception when others then
          raise notice 'Eski funksiyadan sinflarni o''qib bo''lmadi (%): %', r.scode, sqlerrm;
        end;
      end loop;
    end if;

    -- 2b. O'quvchilar profilidagi sinflarni ham qo'shamiz
    execute format(
      'insert into public.school_classes (school_id, class_name)
       select distinct p.school_id, trim(p.class_name) from public.profiles p
       where p.school_id is not null and coalesce(trim(p.class_name), '''') <> ''''
       on conflict do nothing');

    execute 'select count(*) from public.school_classes' into seeded;

    -- 2c. Ro'yxatdan o'tish funksiyasini yangi jadvalga ulaymiz (eskisi _legacy nomi bilan saqlanadi)
    if legacy is not null then
      if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'get_school_classes_by_code_legacy') then
        execute format('drop function %s', legacy);
      else
        execute format('alter function %s rename to get_school_classes_by_code_legacy', legacy);
      end if;
    end if;

    execute format($q$
      create function public.get_school_classes_by_code(input_school_code text)
      returns table (class_name text)
      language sql stable security definer set search_path = public
      as $f$
        select c.class_name::text
        from public.school_classes c
        join %1$s s on s.%2$I = c.school_id
        where upper(s.%3$I::text) = upper(trim(input_school_code))
        order by nullif(regexp_replace(c.class_name, '\D', '', 'g'), '')::int nulls last, c.class_name
      $f$$q$, s_tbl, s_id, s_code);
    grant execute on function public.get_school_classes_by_code(text) to anon, authenticated;
  end if;

  has_profile_school_code := exists (
    select 1 from pg_attribute where attrelid = 'public.profiles'::regclass and attname = 'school_code' and not attisdropped);

  -- ───── 3. Admin funksiyalari ─────
  -- Maktablar ro'yxati
  execute format($q$
    create or replace function public.admin_list_schools()
    returns table (id text, name text, code text, students bigint, classes bigint)
    language plpgsql stable security definer set search_path = public
    as $f$
    begin
      if not public.is_admin() then raise exception 'Ruxsat yo''q'; end if;
      return query
        select s.%2$I::text, s.%3$I::text, s.%4$I::text,
               (select count(*) from public.profiles p where p.school_id = s.%2$I),
               (select count(*) from %5$s c where c.%6$I = s.%2$I)
        from %1$s s
        order by s.%3$I;
    end $f$$q$, s_tbl, s_id, s_name, s_code, c_tbl, c_fk);

  -- Maktab qo'shish / tahrirlash
  execute format($q$
    create or replace function public.admin_save_school(p_id text, p_name text, p_code text)
    returns text
    language plpgsql security definer set search_path = public
    as $f$
    declare
      v_id text;
      v_name text := trim(coalesce(p_name, ''));
      v_code text := upper(trim(coalesce(p_code, '')));
    begin
      if not public.is_admin() then raise exception 'Ruxsat yo''q'; end if;
      if char_length(v_name) < 3 then raise exception 'Maktab nomini kiriting (kamida 3 belgi).'; end if;
      if v_code !~ '^[A-Z0-9_-]{3,32}$' then
        raise exception 'Kod 3–32 belgidan iborat bo''lsin: lotin harflari, raqamlar, - yoki _.';
      end if;
      if exists (select 1 from %1$s s where upper(s.%4$I::text) = v_code and (p_id is null or s.%2$I::text <> p_id)) then
        raise exception 'Bu kod boshqa maktabda band.';
      end if;

      if p_id is null then
        %6$s
      else
        update %1$s set %3$I = v_name, %4$I = v_code where %2$I::text = p_id returning %2$I::text into v_id;
        if v_id is null then raise exception 'Maktab topilmadi.'; end if;
        %5$s
      end if;
      return v_id;
    end $f$$q$,
    s_tbl, s_id, s_name, s_code,
    case when has_profile_school_code
      then format('update public.profiles set school_code = v_code where school_id::text = v_id;')
      else '' end,
    case when id_insert is null
      then format('insert into %s (%I, %I) values (v_name, v_code) returning %I::text into v_id;', s_tbl, s_name, s_code, s_id)
      else format('insert into %s (%I, %I, %I) values (%s, v_name, v_code) returning %I::text into v_id;', s_tbl, s_id, s_name, s_code, id_insert, s_id)
    end);

  -- Maktabni o'chirish (o'quvchilari bo'lmasa)
  execute format($q$
    create or replace function public.admin_delete_school(p_id text)
    returns void
    language plpgsql security definer set search_path = public
    as $f$
    declare n bigint;
    begin
      if not public.is_admin() then raise exception 'Ruxsat yo''q'; end if;
      select count(*) into n from public.profiles where school_id::text = p_id;
      if n > 0 then raise exception 'Bu maktabda %% ta foydalanuvchi bor — avval ularni boshqa maktabga o''tkazing.', n; end if;
      delete from %3$s where %4$I::text = p_id;
      delete from %1$s where %2$I::text = p_id;
      if not found then raise exception 'Maktab topilmadi.'; end if;
    end $f$$q$, s_tbl, s_id, c_tbl, c_fk);

  -- Sinflar ro'yxati
  execute format($q$
    create or replace function public.admin_list_classes(p_school_id text)
    returns table (id text, class_name text, students bigint)
    language plpgsql stable security definer set search_path = public
    as $f$
    begin
      if not public.is_admin() then raise exception 'Ruxsat yo''q'; end if;
      return query
        select c.id::text, c.class_name::text,
               (select count(*) from public.profiles p
                 where p.school_id::text = p_school_id and p.class_name = c.class_name)
        from %1$s c
        where c.%2$I::text = p_school_id
        order by nullif(regexp_replace(c.class_name, '\D', '', 'g'), '')::int nulls last, c.class_name;
    end $f$$q$, c_tbl, c_fk);

  -- Sinf(lar) qo'shish: "9-A, 9-B" yoki har biri yangi qatorda
  execute format($q$
    create or replace function public.admin_add_classes(p_school_id text, p_names text)
    returns int
    language plpgsql security definer set search_path = public
    as $f$
    declare v text; added int := 0;
    begin
      if not public.is_admin() then raise exception 'Ruxsat yo''q'; end if;
      if not exists (select 1 from %3$s s where s.%4$I::text = p_school_id) then
        raise exception 'Maktab topilmadi.';
      end if;
      foreach v in array regexp_split_to_array(coalesce(p_names, ''), '[,;\n]+') loop
        v := upper(trim(v));
        continue when v = '';
        if char_length(v) > 20 then raise exception 'Sinf nomi juda uzun: %%', v; end if;
        if not exists (select 1 from %1$s c where c.%2$I::text = p_school_id and upper(c.class_name) = v) then
          insert into %1$s (%2$I, class_name) values (p_school_id::%5$s, v);
          added := added + 1;
        end if;
      end loop;
      return added;
    end $f$$q$, c_tbl, c_fk, s_tbl, s_id, s_id_type);

  -- Sinf nomini o'zgartirish (o'quvchilar profili ham yangilanadi)
  execute format($q$
    create or replace function public.admin_rename_class(p_id text, p_name text)
    returns void
    language plpgsql security definer set search_path = public
    as $f$
    declare v_new text := upper(trim(coalesce(p_name, ''))); v_old text; v_school text;
    begin
      if not public.is_admin() then raise exception 'Ruxsat yo''q'; end if;
      if v_new = '' or char_length(v_new) > 20 then raise exception 'Sinf nomi 1–20 belgi bo''lsin.'; end if;
      select c.class_name, c.%2$I::text into v_old, v_school from %1$s c where c.id::text = p_id;
      if v_old is null then raise exception 'Sinf topilmadi.'; end if;
      if v_old = v_new then return; end if;
      if exists (select 1 from %1$s c where c.%2$I::text = v_school and upper(c.class_name) = v_new and c.id::text <> p_id) then
        raise exception 'Bu maktabda %% sinfi allaqachon bor.', v_new;
      end if;
      update %1$s set class_name = v_new where id::text = p_id;
      update public.profiles set class_name = v_new where school_id::text = v_school and class_name = v_old;
    end $f$$q$, c_tbl, c_fk);

  -- Sinfni o'chirish (o'quvchilari bo'lmasa)
  execute format($q$
    create or replace function public.admin_delete_class(p_id text)
    returns void
    language plpgsql security definer set search_path = public
    as $f$
    declare v_name text; v_school text; n bigint;
    begin
      if not public.is_admin() then raise exception 'Ruxsat yo''q'; end if;
      select c.class_name, c.%2$I::text into v_name, v_school from %1$s c where c.id::text = p_id;
      if v_name is null then raise exception 'Sinf topilmadi.'; end if;
      select count(*) into n from public.profiles where school_id::text = v_school and class_name = v_name;
      if n > 0 then raise exception 'Bu sinfda %% ta o''quvchi bor — avval ularni boshqa sinfga o''tkazing.', n; end if;
      delete from %1$s where id::text = p_id;
    end $f$$q$, c_tbl, c_fk);

  -- Ruxsatlar: faqat tizimga kirganlar chaqira oladi, ichida admin tekshiriladi
  revoke all on function public.admin_list_schools() from public, anon;
  revoke all on function public.admin_save_school(text, text, text) from public, anon;
  revoke all on function public.admin_delete_school(text) from public, anon;
  revoke all on function public.admin_list_classes(text) from public, anon;
  revoke all on function public.admin_add_classes(text, text) from public, anon;
  revoke all on function public.admin_rename_class(text, text) from public, anon;
  revoke all on function public.admin_delete_class(text) from public, anon;
  grant execute on function public.admin_list_schools() to authenticated;
  grant execute on function public.admin_save_school(text, text, text) to authenticated;
  grant execute on function public.admin_delete_school(text) to authenticated;
  grant execute on function public.admin_list_classes(text) to authenticated;
  grant execute on function public.admin_add_classes(text, text) to authenticated;
  grant execute on function public.admin_rename_class(text, text) to authenticated;
  grant execute on function public.admin_delete_class(text) to authenticated;

  raise notice '✓ Tayyor. Maktablar: %  (kod: %, nom: %).  Sinflar: % %',
    s_tbl, s_code, s_name, c_tbl,
    case when created_classes then format('  — yangi yaratildi, %s ta sinf ko''chirildi', seeded) else '  — mavjud jadvaldan foydalanildi' end;
end
$mig$;

commit;

-- Supabase API (PostgREST) yangi funksiyalarni darhol ko'rishi uchun
notify pgrst, 'reload schema';
