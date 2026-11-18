# ECO SCHOOL — Cloudflare'ga joylash

Sayt to‘liq brauzerda ishlaydi va Supabase'ga to‘g‘ridan-to‘g‘ri ulanadi. Shuning uchun u **statik fayllar** sifatida
Cloudflare Workers'ga joylanadi — server kodi yo‘q, bepul tarifda ishlaydi, butun dunyo bo‘ylab tez ochiladi.

Kerak bo‘ladi: Cloudflare akkaunt (bepul), GitHub akkaunt, mavjud Supabase loyihangiz. Taxminan 20 daqiqa.

---

## 1-qadam. Supabase'ni tayyorlang (eng muhim)

**A) Yangi (bo‘sh) Supabase loyihasi bo‘lsa** — eng oson yo‘l:
1. **SQL Editor → New query** → `supabase/schema.sql` faylini **to‘liq** qo‘ying → **Run**.
   Bu bitta fayl butun bazani yaratadi: jadvallar, ballar, reytinglar, xavfsizlik (RLS), rasm saqlash joylari
   va birinchi maktab (kodi **ECOIXMI**, 5–11-sinflar A/B). `migrations/` papkasidagi fayllar **kerak emas**.
2. Saytda **login va parol** bilan ro‘yxatdan o‘ting (maktab kodi: `ECOIXMI`).
3. O‘zingizni **bosh admin** qiling (SQL Editor'da, loginni almashtiring):
   ```sql
   update public.profiles set role = 'admin', is_owner = true where username = 'sizning_login';
   ```
4. Admin panel → **Maktab va sinflar** bo‘limida maktab nomi, kodi va sinflarni o‘zingizga moslang.

**B) Mavjud (eski) ECO SCHOOL bazasi bo‘lsa:**
1. Zaxira nusxa (backup) oling.
2. `supabase/security-check.sql` bilan RLS yoqilganini tekshiring (batafsil — `SECURITY.md`).
3. Tartib bilan ishga tushiring: `20261117_admin_panel.sql` → `20261118_schools_classes.sql` → `20261119_login_mentor_owner.sql`
   (hammasi `supabase/migrations/` ichida).
4. O‘zingizni bosh admin qiling (emailni almashtiring):
   ```sql
   update public.profiles set role = 'admin', is_owner = true
   where id = (select id from auth.users where email = 'sizning@email.com');
   ```

**Ikkala holatda ham:**
- **Authentication → Sign In / Providers → Email:** **“Confirm email” O‘CHIRILGAN** bo‘lsin
  (o‘quvchilar email emas, login bilan kiradi), parol kamida 8 belgi.
- **Project Settings → API** dan ikkita qiymatni ko‘chirib oling:
   - **Project URL** → `https://xxxx.supabase.co`
   - **publishable (anon) key**

> ⚠️ Faqat **publishable/anon** kalitdan foydalaning. `service_role` kalitni hech qachon saytga qo‘ymang.

---

## 2-qadam. Joylash — ikki usuldan birini tanlang

### A usul (tavsiya): GitHub orqali — har safar kod yangilansa, sayt o‘zi yangilanadi

1. Kodni GitHub'ga yuklang:
   ```bash
   cd eco-school-main
   git init
   git add .
   git commit -m "ECO SCHOOL"
   git branch -M main
   git remote add origin https://github.com/SIZNING_LOGIN/eco-school.git
   git push -u origin main
   ```
2. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → GitHub repo'ni ulang va `eco-school` ni tanlang.
3. Build sozlamalarini kiriting:
   | Sozlama | Qiymat |
   |---------|--------|
   | Build command | `npm run build:cf` |
   | Deploy command | `npx wrangler deploy` |
4. **Build variables** (build o‘zgaruvchilari) bo‘limiga qo‘shing:
   | Nomi | Qiymati |
   |------|---------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable (anon) kalit |
   | `NODE_VERSION` | `22` |
5. **Deploy** bosing. 1–3 daqiqada sayt `https://eco-school.<akkauntingiz>.workers.dev` manzilida ochiladi.

> Bu kalitlar **build paytida** kerak: sayt yig‘ilayotganda ular kodga va xavfsizlik sarlavhalariga yoziladi.
> Kalitni o‘zgartirsangiz, saytni qayta deploy qiling.

### B usul: o‘z kompyuteringizdan bitta buyruq bilan

Kompyuteringizda Node.js 20.9+ o‘rnatilgan bo‘lishi kerak.

```bash
cd eco-school-main
npm install
cp .env.example .env.local      # ichiga Supabase URL va kalitni yozing
npx wrangler login              # brauzerda Cloudflare'ga kirasiz
npm run deploy:cf               # build + joylash
```

Joylashdan oldin kompyuteringizda Cloudflare muhitida sinab ko‘rish: `npm run preview:cf` → http://localhost:8787

---

## 3-qadam. Joylagandan keyin

1. Supabase → **Authentication → URL Configuration**:
   - **Site URL** = saytingiz manzili (masalan `https://eco-school.xxx.workers.dev`);
   - **Redirect URLs** ga ham shu manzilni qo‘shing (email tasdiqlash havolalari uchun).
2. Tekshiruv ro‘yxati:
   - [ ] Ro‘yxatdan o‘tish → emailga tasdiqlash xati keladi.
   - [ ] Kirish → profil va ballar ko‘rinadi.
   - [ ] Challenge yuborish (rasm bilan) ishlaydi.
   - [ ] Admin bilan `/admin` ochiladi; oddiy o‘quvchi bilan “Ruxsat yo‘q” chiqadi.
   - [ ] Oddiy o‘quvchi brauzer konsolidan o‘z topshirig‘ini `approved` qila olmaydi (RLS sinovi).

## O‘z domeningiz (masalan ecoschool.uz)

Cloudflare → Workers & Pages → `eco-school` → **Settings → Domains & Routes → Add → Custom domain**.
Domen Cloudflare'da bo‘lsa, DNS avtomatik sozlanadi. Keyin Supabase'dagi **Site URL** ni yangi domenga almashtiring.

## Muammo bo‘lsa

| Belgi | Sabab va yechim |
|-------|-----------------|
| Build “NEXT_PUBLIC_SUPABASE_URL o‘rnatilmagan” deb to‘xtaydi | Build variables'ga ikkala kalitni qo‘shing va qayta deploy qiling |
| Sayt ochiladi, lekin ma’lumot yuklanmaydi | URL yoki kalit noto‘g‘ri; brauzer konsolida xatoni ko‘ring |
| Email tasdiqlash havolasi `localhost` ga olib boradi | Supabase'dagi **Site URL** ni sayt manziliga o‘zgartiring |
| Admin panelda “SQL’ni ishga tushiring” xabari | 1-qadamdagi migratsiya bajarilmagan |

## Texnik ma’lumot

- Statik build: `npm run build:cf` → `out/` papka (Next.js `output: "export"`).
- Xavfsizlik sarlavhalari (CSP va boshqalar) `out/_headers` ga, eski manzil yo‘naltirishlari `out/_redirects` ga
  `scripts/cf-postbuild.mjs` tomonidan avtomatik yoziladi.
- Cloudflare sozlamasi: `wrangler.jsonc` (statik fayllar, 404 sahifa).
- Kerak bo‘lsa, Vercel yoki boshqa Node.js hostingda ham ishlaydi: `npm run build` + `npm start`.

---

## Login, rollar va bosh admin

- **Kirish:** o‘quvchi login (masalan `aziza_k`) va parol bilan ro‘yxatdan o‘tadi va kiradi. Email kerak emas.
  Oldin email bilan ochilgan akkauntlar “Login” maydoniga emailni yozib kiraveradi.
- **Parolni unutsa:** Admin panel → Foydalanuvchilar → ✏️ → “Parolni tiklash”.
- **Rollar:**
  | Rol | Nima qila oladi |
  |-----|-----------------|
  | O‘quvchi | Topshiriq yuboradi, ball to‘playdi |
  | Mentor | Challenge, recycling va tadqiqotlarni tekshiradi, ball beradi |
  | Admin | Hammasini boshqaradi; mentor tayinlaydi |
  | 👑 Bosh admin | Admin kabi + adminlarni tayinlaydi/oladi. Faqat SQL Editor'dan tayinlanadi; sayt orqali uni hech kim adminlikdan ololmaydi, o‘chira olmaydi, parolini o‘zgartira olmaydi |
- Ichki email domeni `ecoschool.uz` (o‘zgartirish: `NEXT_PUBLIC_LOGIN_DOMAIN` build o‘zgaruvchisi). Uni keyin almashtirmang — eski loginlar ishlamay qoladi.
