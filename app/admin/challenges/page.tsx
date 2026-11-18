"use client";

import { confetti } from "@/components/effects";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { formatDate, initials } from "@/lib/session";
import { AdminTitle, Lightbox, useAdmin } from "@/components/admin/AdminShell";
import { Alert, CardsSkeleton, ConfirmDialog, EmptyState, StatusBadge, Tabs } from "@/components/ui";

type Submission = {
  id: number;
  proof_text: string | null;
  proof_url: string | null;
  status: "pending" | "approved" | "rejected";
  awarded_points: number;
  submitted_at: string;
  challenges: { title: string; points: number } | null;
  profiles: { full_name: string | null; class_name: string | null } | null;
};

type Filter = "pending" | "approved" | "rejected" | "all";

export default function AdminChallengesPage() {
  const { refreshCounts } = useAdmin();
  const [supabase] = useState(() => createClient());
  const [items, setItems] = useState<Submission[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [confirm, setConfirm] = useState<{ item: Submission; status: "approved" | "rejected" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("challenge_submissions")
      .select(
        "id, proof_text, proof_url, status, awarded_points, submitted_at, challenges (title, points), profiles (full_name, class_name)"
      )
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error(error);
      setMessage({ text: "Topshiriqlarni yuklab bo‘lmadi.", error: true });
      setLoading(false);
      return;
    }

    const list = (data || []) as unknown as Submission[];
    setItems(list);
    setLoading(false);

    const withProof = list.filter((i) => i.proof_url);
    if (withProof.length) {
      const { data: signed } = await supabase.storage
        .from("challenge-proofs")
        .createSignedUrls(withProof.map((i) => i.proof_url as string), 60 * 10);
      const urls: Record<number, string> = {};
      signed?.forEach((s, idx) => {
        if (s.signedUrl) urls[withProof[idx].id] = s.signedUrl;
      });
      setImageUrls(urls);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function review() {
    if (!confirm) return;
    setBusy(true);
    setMessage(null);
    const { item, status } = confirm;
    const { data, error } = await supabase
      .from("challenge_submissions")
      .update({ status })
      .eq("id", item.id)
      .eq("status", "pending")
      .select("id");

    if (error) {
      console.error(error);
      setMessage({ text: "Saqlab bo‘lmadi. Qayta urinib ko‘ring.", error: true });
    } else if (!data?.length) {
      setMessage({ text: "Bu topshiriq allaqachon ko‘rib chiqilgan.", error: true });
    } else {
      setMessage({
        text:
          status === "approved"
            ? `✓ Tasdiqlandi — ${item.profiles?.full_name || "o‘quvchi"}ga ${item.challenges?.points ?? 0} ball qo‘shildi.`
            : "Topshiriq rad etildi.",
        error: false,
      });
      if (status === "approved") confetti({ count: 80 });
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, status } : p)));
      refreshCounts();
    }
    setBusy(false);
    setConfirm(null);
  }

  const q = query.trim().toLowerCase();
  const visible = items
    .filter((i) => filter === "all" || i.status === filter)
    .filter(
      (i) =>
        !q ||
        i.profiles?.full_name?.toLowerCase().includes(q) ||
        i.profiles?.class_name?.toLowerCase().includes(q) ||
        i.challenges?.title?.toLowerCase().includes(q)
    );
  const count = (s: Filter) => (s === "all" ? items.length : items.filter((i) => i.status === s).length);

  return (
    <>
      <AdminTitle icon="🎯" title="Challenge topshiriqlari" text="O‘quvchilar yuborgan dalillarni ko‘rib chiqing. Tasdiqlanganda ballar avtomatik qo‘shiladi." />

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs
          value={filter}
          onChange={setFilter}
          items={[
            { value: "pending", label: "Kutilmoqda", count: count("pending") },
            { value: "approved", label: "Tasdiqlangan", count: count("approved") },
            { value: "rejected", label: "Rad etilgan", count: count("rejected") },
            { value: "all", label: "Hammasi", count: count("all") },
          ]}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 O‘quvchi, sinf yoki challenge"
          className="input py-2.5 md:max-w-xs"
        />
      </div>

      {message && (
        <div className="mb-5">
          <Alert tone={message.error ? "error" : "success"} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {loading ? (
          <CardsSkeleton count={4} className="h-64" />
        ) : visible.length === 0 ? (
          <div className="xl:col-span-2">
            <EmptyState
              icon={filter === "pending" ? "🎉" : "🗂️"}
              title={filter === "pending" ? "Hammasi tekshirilgan!" : "Hech narsa topilmadi"}
              text={filter === "pending" ? "Yangi topshiriqlar kelganda shu yerda paydo bo‘ladi." : undefined}
            />
          </div>
        ) : (
          visible.map((item) => (
            <article key={item.id} data-status={item.status} className="admin-card card card-hover flex flex-col p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-leaf-300 to-forest-500 text-sm font-black text-white shadow-[0_8px_20px_-8px_rgb(58_143_92/0.8)]">
                  {initials(item.profiles?.full_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold">{item.profiles?.full_name || "Noma’lum o‘quvchi"}</p>
                  <p className="text-xs text-muted">
                    {item.profiles?.class_name || "Sinf yo‘q"} · {formatDate(item.submitted_at, true)}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-leaf-100/70 px-4 py-3">
                <p className="font-extrabold text-accent">🎯 {item.challenges?.title || "Challenge"}</p>
                <span className="shrink-0 text-sm font-black text-accent">+{item.challenges?.points ?? 0}</span>
              </div>

              <div className="mt-4 flex flex-1 gap-4">
                {imageUrls[item.id] && (
                  <button onClick={() => setLightbox(imageUrls[item.id])} className="group relative shrink-0 overflow-hidden rounded-2xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrls[item.id]} alt="Dalil" className="h-28 w-28 object-cover transition group-hover:scale-105" />
                    <span className="absolute inset-0 grid place-items-center bg-black/0 text-lg text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                      🔍
                    </span>
                  </button>
                )}
                <p className="whitespace-pre-wrap text-sm leading-6 text-ink/80">
                  {item.proof_text || <span className="italic text-muted">Izoh kiritilmagan</span>}
                </p>
              </div>

              {item.status === "pending" && (
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4">
                  <button onClick={() => setConfirm({ item, status: "rejected" })} className="btn btn-danger">
                    ✕ Rad etish
                  </button>
                  <button onClick={() => setConfirm({ item, status: "approved" })} className="btn btn-primary">
                    ✓ Tasdiqlash
                  </button>
                </div>
              )}
            </article>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!confirm}
        busy={busy}
        tone={confirm?.status === "rejected" ? "danger" : "primary"}
        title={confirm?.status === "approved" ? "Topshiriqni tasdiqlaysizmi?" : "Topshiriqni rad etasizmi?"}
        text={
          confirm?.status === "approved"
            ? `${confirm.item.profiles?.full_name || "O‘quvchi"}ga ${confirm.item.challenges?.points ?? 0} ball qo‘shiladi.`
            : "Bu amalni ortga qaytarib bo‘lmaydi."
        }
        confirmLabel={confirm?.status === "approved" ? "Ha, tasdiqlash" : "Ha, rad etish"}
        onConfirm={review}
        onCancel={() => setConfirm(null)}
      />
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </>
  );
}
