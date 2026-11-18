import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
// next.config.ts dagi alias: demo buildda haqiqiy mock, aks holda bo'sh stub
import { createDemoClient } from "demo-client";

const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let demoClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (DEMO) {
    demoClient ??= createDemoClient() as unknown as SupabaseClient;
    return demoClient;
  }
  if (!URL || !KEY) {
    throw new Error(
      "Supabase sozlanmagan: NEXT_PUBLIC_SUPABASE_URL va NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ni .env.local yoki hosting sozlamalariga kiriting."
    );
  }
  return createBrowserClient(URL, KEY);
}
