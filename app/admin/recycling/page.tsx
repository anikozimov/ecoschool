"use client";

import { confetti } from "@/components/effects";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { formatDate, formatNumber, initials, useSession } from "@/lib/session";
import { AdminTitle, Lightbox, useAdmin } from "@/components/admin/AdminShell";
import { Alert, CardsSkeleton, ConfirmDialog, EmptyState, StatusBadge, Tabs } from "@/components/ui";

type Submission = {
  id: number;
  material: "paper" | "plastic";
  amount_kg: number;
  verified_amount_kg: number | null;
  status: "pending" | "approved" | "rejected";
  awarded_points: number;
  proof_image: string | null;
  submitted_at: string;
  profiles: { full_name: string; class_name: string | null } | null;
};

type Filter = "pending" | "approved" | "rejected" | "all";
const POINTS_PER_KG = 25;

export default function AdminRecyclingPage() {
  const { profile } = useSession();
  const { refreshCounts } = useAdmin();
  const [supabase] = useState(() => createClient());
  const [items, setItems] = useState<Submission[]>([]);
  const [weights, setWeights] = useState<Record<number, string>>({});
  const [imageUrls, setImageUrls] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [confirm, setConfirm] = useState<{ item: Submission; status: "approved" | "rejected"; kg?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.school_id) {
      setMessage({ text: "Profilingizga maktab biriktirilmagan.", error: true });
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("recycling_submissions")
      .select(
        `id, material, amount_kg, verified_amount_kg, status, awarded_points, proof_image, submitted_at,
         profiles!recycling_submissions_student_id_fkey (full_name, class_name)`
      )
      .eq("school_id", profile.school_id)
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error(error);
      setMessage({ text: "Topshiruvlarni yuklab bo‘lmadi.", error: true });
      setLoading(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = (data || []).map((item: any) => ({
      ...item,
      profiles: Array.isArray(item.profiles) ? item.profiles[0] || null : item.profiles,
    })) as Submission[];

    setItems(list);
    setWeights((prev) => {
      const next = { ...prev };
      list.forEach((i) => {
        if (next[i.id] === undefined) next[i.id] = String(i.amount_kg);
      });
      return next;
    });
    setLoading(false);

    const withProof = list.filter((i) => i.proof_image && i.status === "pending");
    if (withProof.length) {
      const { data: signed } = await supabase.storage
        .from("recycling-proofs")
        .createSignedUrls(withProof.map((i) => i.proof_image as string), 60 * 10);
      const urls: Record<number, string> = {};
      signed?.forEach((s, idx) => {
        if (s.signedUrl) urls[withProof[idx].id] = s.signedUrl;
      });
      setImageUrls(urls);
    }
  }, [supabase, profile?.school_id]);

  useEffect(() => {
    load();
  }, [load]);

  function ask(item: Submission, status: "approved" | "rejected") {
    setMessage(null);
    if (status === "approved") {
      const kg = Number(weights[item.id]);
      if (!Number.isFinite(kg) || kg <= 0 || kg > 500) {
        setMessage({ text: "Iltimos, haqiqiy vaznni to‘g‘ri kiriting (0.01–500 kg).", error: true });
        return;
      }
      setConfirm({ item, status, kg: Math.round(kg * 100) / 100 });
    } else {
      setConfirm({ item, status });
    }
  }

  async function review() {
    if (!confirm) return;
    setBusy(true);
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setMessage({ text: "Sessiya tugagan. Qayta tizimga kiring.", error: true });
      setBusy(false);
      setConfirm(null);
      return;
    }

    const { item, status, kg } = confirm;
    const update =
      status === "approved"
        ? { status, reviewed_by: authData.user.id, verified_amount_kg: kg }
        : { status, reviewed_by: authData.user.id };

    const { data, error } = await supabase
      .from("recycling_submissions")
      .update(update)
      .eq("id", item.id)
      .eq("status", "pending")
      .select("id");

    if (error) {
      console.error(error);
      setMessage({ text: "Saqlab bo‘lmadi. Qayta urinib ko‘ring.", error: true });
    } else if (!data?.length) {
      setMessage({ text: "Bu topshiruv allaqachon ko‘rib chiqilgan.", error: true });
    } else {
      setMessage({
        text: status === "approved" ? `✓ ${kg} kg tasdiqlandi. Ball haqiqiy vazn asosida berildi.` : "Topshiruv rad etildi.",
        error: false,
      });
      if (status === "approved") confetti({ count: 80 });
      await load();
      refreshCounts();
    }
    setBusy(false);
    setConfirm(null);
  }

  const visible = items.filter((i) => filter === "all" || i.status === filter);
  const count = (s: Filter) => (s === "all" ? items.length : items.filter((i) => i.status === s).length);
  const approvedKg = items
    .filter((i) => i.status === "approved")
    .reduce((s, i) => s + Number(i.verified_amount_kg ?? i.amount_kg ?? 0), 0);

  return (
    <>
      <AdminTitle
        icon="♻️"
        title="Recycling nazorati"
        text="Tarozi rasmini tekshiring va haqiqiy vaznni tasdiqlang. Ball = tasdiqlangan kg × 25."
        action={
          <div className="flex gap-3">
            <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/55">Kutilmoqda</p>
              <p className="font-display text-2xl font-semibold text-sand-400">{count("pending")}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/55">Tasdiqlangan</p>
              <p className="font-display text-2xl font-semibold text-leaf-300">{formatNumber(approvedKg, 1)} kg</p>
            </div>
          </div>
        }
      />

      <div className="mb-5">
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
            <EmptyState icon={filter === "pending" ? "🎉" : "🗂️"} title={filter === "pending" ? "Navbat bo‘sh!" : "Hech narsa topilmadi"} />
          </div>
        ) : (
          visible.map((item) => {
            const kg = Number(weights[item.id]);
            const preview = Number.isFinite(kg) && kg > 0 ? Math.round(kg * POINTS_PER_KG) : 0;
            return (
              <article key={item.id} data-status={item.status} className="admin-card card card-hover p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-leaf-300 to-forest-500 text-sm font-black text-white shadow-[0_8px_20px_-8px_rgb(58_143_92/0.8)]">
                    {initials(item.profiles?.full_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold">{item.profiles?.full_name || "O‘quvchi"}</p>
                    <p className="text-xs text-muted">
                      {item.profiles?.class_name || "Sinf yo‘q"} · {formatDate(item.submitted_at, true)}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>

                <div className="mt-4 flex gap-4">
                  {imageUrls[item.id] ? (
                    <button onClick={() => setLightbox(imageUrls[item.id])} className="group relative shrink-0 overflow-hidden rounded-2xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrls[item.id]} alt="Tarozi rasmi" className="h-32 w-32 object-cover transition group-hover:scale-105" />
                      <span className="absolute bottom-1.5 right-1.5 rounded-lg bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        🔍 Kattalashtirish
                      </span>
                    </button>
                  ) : (
                    <div className={`grid h-32 w-32 shrink-0 place-items-center rounded-2xl text-4xl ${item.material === "paper" ? "bg-sand-100" : "bg-sky-100"}`}>
                      {item.material === "paper" ? "📄" : "🧴"}
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <p className="font-extrabold">{item.material === "paper" ? "📄 Qog‘oz" : "🧴 Plastik"}</p>
                    <div className="rounded-xl bg-cream px-3 py-2">
                      <p className="text-[11px] font-bold text-muted">O‘quvchi kiritgan</p>
                      <p className="font-display text-xl font-semibold">{item.amount_kg} kg</p>
                    </div>
                    {item.status === "approved" && (
                      <div className="rounded-xl bg-leaf-100 px-3 py-2">
                        <p className="text-[11px] font-bold text-accent">Tasdiqlangan · +{item.awarded_points} ball</p>
                        <p className="font-display text-xl font-semibold text-accent">{item.verified_amount_kg ?? "—"} kg</p>
                      </div>
                    )}
                  </div>
                </div>

                {item.status === "pending" && (
                  <div className="mt-5 border-t border-line pt-4">
                    <label className="label text-xs" htmlFor={`w-${item.id}`}>Eco Team tasdiqlagan haqiqiy vazn</label>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="relative flex-1">
                        <input
                          id={`w-${item.id}`}
                          type="number"
                          inputMode="decimal"
                          min="0.01"
                          max="500"
                          step="0.01"
                          value={weights[item.id] ?? ""}
                          onChange={(e) => setWeights((p) => ({ ...p, [item.id]: e.target.value }))}
                          className="input py-3 pr-24 font-bold"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-extrabold text-accent">
                          kg = {preview} ball
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:flex">
                        <button onClick={() => ask(item, "rejected")} className="btn btn-danger">✕ Rad</button>
                        <button onClick={() => ask(item, "approved")} className="btn btn-primary">✓ Tasdiqlash</button>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      <ConfirmDialog
        open={!!confirm}
        busy={busy}
        tone={confirm?.status === "rejected" ? "danger" : "primary"}
        title={confirm?.status === "approved" ? `${confirm.kg} kg ni tasdiqlaysizmi?` : "Topshiruvni rad etasizmi?"}
        text={
          confirm?.status === "approved"
            ? `${confirm.item.profiles?.full_name || "O‘quvchi"}ga taxminan ${Math.round((confirm.kg ?? 0) * POINTS_PER_KG)} ball beriladi.`
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
