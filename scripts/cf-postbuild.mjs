// Cloudflare uchun: statik build (out/) ichiga _headers va _redirects fayllarini yozadi.
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildSecurityHeaders } from "../security.config.mjs";

const OUT = "out";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

if (!existsSync(OUT)) {
  console.error("✖ out/ papkasi topilmadi — avval `STATIC_EXPORT=1 next build` ishlashi kerak.");
  process.exit(1);
}
if (!supabaseUrl || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  console.error(
    "✖ NEXT_PUBLIC_SUPABASE_URL va NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY o‘rnatilmagan.\n" +
      "  Cloudflare'da ularni build o‘zgaruvchilari (Build variables) sifatida qo‘shing."
  );
  process.exit(1);
}

const security = buildSecurityHeaders({ supabaseUrl })
  .map((h) => `  ${h.key}: ${h.value}`)
  .join("\n");

const headers = `# Avtomatik yaratilgan (scripts/cf-postbuild.mjs) — qo'lda tahrirlamang
/*
${security}

/_next/static/*
  Cache-Control: public, max-age=31536000, immutable

/admin/*
  X-Robots-Tag: noindex, nofollow
  Cache-Control: no-store
`;

const redirects = `# Avtomatik yaratilgan (scripts/cf-postbuild.mjs)
/recycling-admin /admin/recycling/ 301
/recycling-admin/ /admin/recycling/ 301
`;

writeFileSync(join(OUT, "_headers"), headers);
writeFileSync(join(OUT, "_redirects"), redirects);
console.log("✓ out/_headers va out/_redirects yozildi (Supabase:", supabaseUrl + ")");
