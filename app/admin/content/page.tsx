"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { CONTENT_FIELDS, CONTENT_PAGES, type ContentPage, type PageContent } from "@/lib/content";
import { AdminTitle } from "@/components/admin/AdminShell";
import { Alert, Skeleton, Spinner, Tabs } from "@/components/ui";

type All = Record<ContentPage, PageContent>;
const PAGES = Object.keys(CONTENT_PAGES) as ContentPage[];
const defaults = () => Object.fromEntries(PAGES.map((p) => [p, { ...CONTENT_PAGES[p].defaults }])) as All;

export default function AdminContentPage() {
  const { user } = useSession();
  const [supabase] = useState(() => createClient());
  const [page, setPage] = useState<ContentPage>("recycling");
  const [values, setValues] = useState<All>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [missingTable, setMissingTable] = useState(false);

  useEffect(() => {
    supabase
      .from("site_content")
      .select("key, value")
      .then(({ data, error }) => {
        if (error) {
          setMissingTable(true);
        } else {
          const next = defaults();
          (data as { key: string; value: string }[]).forEach(({ key, value }) => {
            const [p, f] = key.split(".") as [ContentPage, keyof PageContent];
            if (next[p] && f in next[p] && value?.trim()) next[p][f] = value;
          });
          setValues(next);
        }
        setLoading(false);
      });
  }, [supabase]);

  const current = values[page];
  const setField = (f: keyof PageContent, v: string) => setValues((all) => ({ ...all, [page]: { ...all[page], [f]: v } }));

  async function save() {
    setSaving(true);
    setMessage(null);
    const rows = CONTENT_FIELDS.map((f) => ({
      key: `${page}.${f}`,
      value: current[f].trim().slice(0, f === "text" ? 400 : 80),
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    }));
    const { error } = await supabase.from("site_content").upsert(rows, { onConflict: "key" });
    setSaving(false);
    if (error) {
      console.error(error);
      setMessage({ text: "Saqlab bo‘lmadi. `site_content` jadvali va admin ruxsatini tekshiring (SQL migratsiya).", error: true });
    } else {
      setMessage({ text: `✓ “${CONTENT_PAGES[page].label}” matnlari yangilandi — saytda darhol ko‘rinadi.`, error: false });
    }
  }

  function reset() {
    setValues((all) => ({ ...all, [page]: { ...CONTENT_PAGES[page].defaults } }));
  }

  return (
    <>
      <AdminTitle title="Sahifa matnlari" text="Sahifalarning sarlavhasi va tushuntirish matnini kod yozmasdan o‘zgartiring." />

      {missingTable && (
        <div className="mb-5">
          <Alert tone="warning">
            Bazada <code>site_content</code> jadvali topilmadi. Matnlarni saqlash uchun avval
            <code> supabase/migrations/20261117_admin_panel.sql</code> faylini Supabase’da ishga tushiring. Hozircha sayt standart matnlardan foydalanadi.
          </Alert>
        </div>
      )}

      <div className="mb-6">
        <Tabs value={page} onChange={setPage} items={PAGES.map((p) => ({ value: p, label: CONTENT_PAGES[p].label }))} />
      </div>

      {message && (
        <div className="mb-5">
          <Alert tone={message.error ? "error" : "success"} onClose={() => setMessage(null)}>{message.text}</Alert>
        </div>
      )}

      {loading ? (
        <Skeleton className="h-80" />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="card space-y-4 p-6">
            <div>
              <label className="label" htmlFor="t-title">Sarlavha</label>
              <input id="t-title" value={current.title} onChange={(e) => setField("title", e.target.value)} maxLength={80} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="t-accent">Rangli qism (sarlavha davomi)</label>
              <input id="t-accent" value={current.accent} onChange={(e) => setField("accent", e.target.value)} maxLength={80} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="t-text">Tushuntirish matni</label>
              <textarea id="t-text" value={current.text} onChange={(e) => setField("text", e.target.value)} rows={4} maxLength={400} className="input resize-none" />
              <p className="hint text-right">{current.text.length}/400</p>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:justify-end">
              <button onClick={reset} className="btn btn-ghost">Standartga qaytarish</button>
              <button onClick={save} disabled={saving || missingTable} className="btn btn-primary">{saving && <Spinner />} Saqlash</button>
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.2em] text-muted">Ko‘rinishi</p>
            <div className="relative overflow-hidden rounded-[1.5rem] border border-line bg-gradient-to-b from-leaf-200/60 to-transparent p-8">
              <div className="absolute inset-0 leaf-pattern opacity-50" />
              <div className="relative">
                <p className="eyebrow"><span className="h-px w-6 bg-leaf-400" />{CONTENT_PAGES[page].label}</p>
                <h2 className="mt-4 text-4xl font-semibold leading-tight">
                  {current.title} <span className="text-gradient-anim italic">{current.accent}</span>
                </h2>
                <p className="mt-4 leading-7 text-muted">{current.text}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
