-- ECO SCHOOL — joylashdan oldin xavfsizlik tekshiruvi (faqat O'QIYDI, hech narsani o'zgartirmaydi)
-- Supabase → SQL Editor ga qo'yib ishga tushiring.

-- 1) RLS yoqilganmi? Barcha qatorlarda rls_enabled = true bo'lishi SHART.
select relname as jadval, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('profiles','challenges','challenge_submissions','recycling_submissions','eco_research','eco_events');

-- 2) Mavjud siyosatlar ro'yxati — har bir jadvalda kim nima qila olishini ko'ring.
select tablename as jadval, policyname as siyosat, cmd as amal, roles, qual as shart, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd;

-- 3) Ball/status ustunlarini avtomatik boshqaruvchi triggerlar bormi?
select event_object_table as jadval, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
order by 1;

-- 4) Storage bucket'lar yopiq (public = false) bo'lishi kerak.
select id as bucket, public from storage.buckets
where id in ('challenge-proofs','recycling-proofs');

-- 5) SECURITY DEFINER funksiyalar (RPC) — search_path belgilanganini tekshiring.
select p.proname as funksiya, p.prosecdef as security_definer, p.proconfig as sozlamalar
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname like 'get_school%';
