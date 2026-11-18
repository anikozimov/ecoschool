// Xavfsizlik sarlavhalari — Next.js server (next start) va Cloudflare (_headers) uchun umumiy manba.

/** @param {{ supabaseUrl?: string, isDev?: boolean }} opts */
export function buildSecurityHeaders({ supabaseUrl = "", isDev = false } = {}) {
  const supabaseWs = supabaseUrl.replace(/^http/, "ws");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabaseUrl}`.trim(),
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseUrl} ${supabaseWs}`.trim(),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}
