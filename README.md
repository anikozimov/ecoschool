# ECO SCHOOL 🌱

> **Joylash (Cloudflare):** `DEPLOY.md` · **Xavfsizlik:** `SECURITY.md` · **Demo build:** `npm run build:demo`

Maktab o‘quvchilari uchun ekologik platforma: challenge’lar, recycling, tadqiqotlar, reyting, eko-taqvim va admin panel.

## Ishga tushirish

```bash
npm install
# .env.local fayliga:
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
npm run dev
```

## Tuzilma

- `app/(site)/` — o‘quvchilar sahifalari (umumiy header/footer bilan)
- `app/admin/` — admin panel: boshqaruv paneli, challenge’lar, recycling, tadqiqotlar, tadbirlar
- `app/login/` — kirish / ro‘yxatdan o‘tish
- `components/` — UI komponentlar (`ui.tsx`), header, footer, podium, admin shell
- `lib/session.tsx` — foydalanuvchi sessiyasi va yordamchi funksiyalar
- `app/globals.css` — dizayn tizimi (ranglar, shriftlar, tugmalar)

Xavfsizlik bo‘yicha: **SECURITY.md** ni albatta o‘qing.
