# ECO SCHOOL — Xavfsizlik eslatmalari

Sayt to‘liq **brauzerda** ishlaydi va Supabase bilan to‘g‘ridan-to‘g‘ri gaplashadi.
Shuning uchun haqiqiy himoya **Supabase RLS siyosatlari va triggerlarida** bo‘lishi shart.
Admin paneldagi rol tekshiruvi faqat interfeys uchun — uni brauzerda chetlab o‘tish mumkin.

## Kodda tuzatilganlar

| # | Muammo | Tuzatish |
|---|--------|----------|
| 1 | `next@16.4.3` — ma’lum zaiflik (GHSA-mfr8-8qww-v76h) | `next@16.4.6` ga yangilandi, `npm audit --omit=dev` → 0 |
| 2 | `/recycling-admin` sahifasida admin roli tekshirilmasdi | Barcha admin sahifalar `/admin/*` ostida, umumiy rol tekshiruvi bilan; eski manzil yo‘naltiriladi |
| 3 | Recycling rasm kengaytmasi foydalanuvchi fayl nomidan olinardi | Kengaytma faqat MIME turidan (`jpg/png/webp`) olinadi |
| 4 | Challenge rasm limiti 50 MB edi | 15 MB + brauzerda siqish |
| 5 | Baza xato matnlari foydalanuvchiga ko‘rsatilardi | Do‘stona xabar, texnik tafsilot faqat `console.error` da |
| 6 | Xavfsizlik HTTP sarlavhalari yo‘q edi | `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `HSTS`, `Permissions-Policy`; `X-Powered-By` o‘chirildi |
| 7 | Ikki marta tasdiqlash xavfi | Barcha ko‘rib chiqishlar `.eq("status","pending")` + natija tekshiruvi bilan |
| 8 | `onAuthStateChange` ichida auth so‘rovi (deadlock) | So‘rov `setTimeout` bilan kechiktirildi |
| 9 | Content-Security-Policy yo‘q edi | Faqat o‘z sayt + Supabase'ga ruxsat beruvchi CSP, `frame-ancestors 'none'`, COOP |
| 10 | Demo ma’lumotlari asosiy buildga tushardi | Build vaqtida bo‘sh stub bilan almashtiriladi |
| 11 | Env yo‘q bo‘lsa tushunarsiz xato | Aniq xabar beruvchi tekshiruv (`lib/supabase.ts`) |
| 12 | Admin/profil sahifalari qidiruv tizimlarida | `robots.txt` orqali yopildi |

## Supabase'da albatta tekshiring (kodda ko‘rinmaydi)

Tez tekshirish uchun: `supabase/security-check.sql` (faqat o‘qiydi).

Repo'da SQL/migratsiya fayllari yo‘q, shuning uchun quyidagilarni Supabase panelida tekshiring:

1. **Barcha jadvallarda RLS yoqilgan** — `profiles`, `challenges`, `challenge_submissions`,
   `recycling_submissions`, `eco_research`, `eco_events`.
2. **O‘quvchi o‘z yozuviga ball/status yoza olmasin.** INSERT siyosati `status = 'pending'`
   va `awarded_points = 0` ni majburlasin (yoki trigger bu ustunlarni qayta yozsin).
   Aks holda o‘quvchi brauzer konsolidan o‘ziga ball berishi mumkin.
3. **UPDATE faqat admin uchun** — `challenge_submissions`, `recycling_submissions`, `eco_research`
   (status, ball, `verified_amount_kg`). `eco_events` INSERT/DELETE ham faqat admin.
4. **`profiles.role` va `profiles.points` ni foydalanuvchi o‘zi o‘zgartira olmasin.**
   Ro‘yxatdan o‘tishda `user_metadata` dan faqat `full_name`, `class_name`, `school_code` olinsin;
   `role` hech qachon metadata'dan olinmasin.
5. **Ball triggerlar orqali hisoblansin** (recycling: `verified_amount_kg × 25`, research: 0–40 chegarasi bazada).
6. **Storage bucket'lar** (`challenge-proofs`, `recycling-proofs`) **private** bo‘lsin; o‘quvchi faqat
   `auth.uid()/...` papkasiga yoza olsin, o‘qishni faqat admin (signed URL) qilsin.
7. **Reyting RPC'lari** (`get_school_leaderboard` va b.) faqat o‘z maktabi ma’lumotini qaytarsin.
8. Supabase Auth: email tasdiqlash yoqilgan, parol minimal uzunligi 8+.

> Eslatma: reytingda voyaga yetmaganlarning ism-familiyasi chiqadi — maktab va ota-onalar
> roziligini oling yoki ismni qisqartirib ko‘rsating.
