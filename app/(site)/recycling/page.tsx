"use client";

import { confetti, Reveal } from "@/components/effects";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase";
import { ALLOWED_IMAGE_TYPES, formatDate, formatNumber, useSession } from "@/lib/session";
import { useSiteContent } from "@/lib/content";
import { Alert, EmptyState, LoginRequired, PageHero, Skeleton, Spinner, StatusBadge } from "@/components/ui";

type RecyclingSubmission = {
  id: number;
  material: "paper" | "plastic";
  amount_kg: number;
  verified_amount_kg?: number | null;
  status: "pending" | "approved" | "rejected";
  awarded_points: number;
  submitted_at: string;
};

const MAX_MB = 5;
const POINTS_PER_KG = 25;

const materials = {
  paper: { icon: "📄", label: "Qog‘oz", text: "Daftar, gazeta, karton", tint: "bg-sand-100", ring: "ring-sand-500" },
  plastic: { icon: "🧴", label: "Plastik", text: "Butilka, idish, paket", tint: "bg-sky-100", ring: "ring-sky-500" },
} as const;

export default function RecyclingPage() {
  const { user, loading: sessionLoading, isStaff } = useSession();
  const content = useSiteContent("recycling");
  const [supabase] = useState(() => createClient());
  const [material, setMaterial] = useState<"paper" | "plastic">("paper");
  const [amount, setAmount] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<RecyclingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const loadSubmissions = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("recycling_submissions")
      .select("id, material, amount_kg, status, awarded_points, submitted_at")
      .eq("student_id", user.id)
      .order("submitted_at", { ascending: false });
    if (error) {
      console.error(error);
      setMessage({ text: "Topshiruvlar tarixini yuklab bo‘lmadi.", error: true });
    } else {
      setSubmissions((data as RecyclingSubmission[]) || []);
    }
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) setLoading(false);
    else loadSubmissions();
  }, [sessionLoading, user, loadSubmissions]);

  useEffect(() => {
    if (!proofFile) return setPreview(null);
    const url = URL.createObjectURL(proofFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [proofFile]);

  function pickFile(file: File | null) {
    setMessage(null);
    if (!file) return setProofFile(null);
    if (!ALLOWED_IMAGE_TYPES[file.type]) {
      setMessage({ text: "Faqat JPG, PNG yoki WEBP formatidagi rasm yuklang.", error: true });
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setMessage({ text: `Rasm hajmi ${MAX_MB} MB dan oshmasligi kerak.`, error: true });
      return;
    }
    setProofFile(file);
  }

  async function submitRecycling(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    if (!user) return;

    const kg = Number(amount);
    if (!Number.isFinite(kg) || kg <= 0 || kg > 500) {
      setMessage({ text: "Iltimos, 0.01 dan 500 kg gacha bo‘lgan to‘g‘ri vazn kiriting.", error: true });
      return;
    }
    if (!proofFile) {
      setMessage({ text: "Iltimos, tarozi rasmini yuklang.", error: true });
      return;
    }
    const ext = ALLOWED_IMAGE_TYPES[proofFile.type];
    if (!ext) {
      setMessage({ text: "Rasm formati qo‘llab-quvvatlanmaydi.", error: true });
      return;
    }

    setSending(true);
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.school_id) {
        setMessage({ text: "Profilingizga maktab biriktirilmagan. Administratorga murojaat qiling.", error: true });
        return;
      }

      // Kengaytma foydalanuvchi fayl nomidan emas, MIME turidan olinadi
      const filePath = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("recycling-proofs")
        .upload(filePath, proofFile, { cacheControl: "3600", upsert: false, contentType: proofFile.type });

      if (uploadError) {
        console.error(uploadError);
        setMessage({ text: "Rasmni yuklab bo‘lmadi. Qayta urinib ko‘ring.", error: true });
        return;
      }

      const { error: insertError } = await supabase.from("recycling_submissions").insert({
        school_id: profile.school_id,
        student_id: user.id,
        material,
        amount_kg: Math.round(kg * 100) / 100,
        proof_image: filePath,
      });

      if (insertError) {
        await supabase.storage.from("recycling-proofs").remove([filePath]);
        console.error(insertError);
        setMessage({ text: "Topshiruvni yuborib bo‘lmadi. Qayta urinib ko‘ring.", error: true });
        return;
      }

      confetti();
      setMessage({ text: "Topshiruvingiz yuborildi! Eco Team vaznni tekshirib, ballarni qo‘shadi. 🌱", error: false });
      setAmount("");
      setProofFile(null);
      await loadSubmissions();
    } catch (err) {
      console.error(err);
      setMessage({ text: "Kutilmagan xatolik yuz berdi. Qayta urinib ko‘ring.", error: true });
    } finally {
      setSending(false);
    }
  }

  const approved = submissions.filter((s) => s.status === "approved");
  const totalKg = approved.reduce((sum, s) => sum + Number(s.amount_kg || 0), 0);
  const totalPoints = approved.reduce((sum, s) => sum + Number(s.awarded_points || 0), 0);
  const estimate = Math.max(0, Math.round((Number(amount) || 0) * POINTS_PER_KG));

  return (
    <>
      <PageHero
        eyebrow="Recycling"
        tone="sand"
        title={
          <>
            {content.title} <span className="text-gradient-anim italic">{content.accent}</span>
          </>
        }
        text={content.text}
        emoji="♻️"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { n: "1", icon: "🧺", title: "Topshiring", text: "Qog‘oz yoki plastikni Eco Team’ga olib keling" },
            { n: "2", icon: "⚖️", title: "Eco Team o‘lchaydi", text: "Chiqindi tarozida tortiladi va vazni tasdiqlanadi" },
            { n: "3", icon: "⭐", title: "Ball oling", text: `Har 1 kg uchun ${POINTS_PER_KG} ball hisobingizga tushadi` },
          ].map((s) => (
            <div key={s.n} className="glass-strong flex items-start gap-3 rounded-2xl p-4">
              <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-2xl">
                {s.icon}
                <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-glow text-[10px] font-black text-forest-950">{s.n}</span>
              </span>
              <span>
                <span className="block font-extrabold">{s.title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted">{s.text}</span>
              </span>
            </div>
          ))}
        </div>
        {isStaff && (
          <Link href="/admin/recycling" className="btn btn-lime btn-sm mt-5">
            ⚙️ Topshiruvlarni tekshirish
          </Link>
        )}
      </PageHero>

      <div className="container-page pb-20">
        {!sessionLoading && !user ? (
          <LoginRequired text="Recycling topshirish va ball olish uchun akkauntingizga kiring." />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            {/* Forma */}
            <Reveal from="left"><form onSubmit={submitRecycling} className="card p-6 sm:p-8">
              <h2 className="text-2xl font-semibold">Topshiruvni ro‘yxatdan o‘tkazish</h2>
              <p className="mt-1 text-sm text-muted">Chiqindini Eco Team’ga topshirganingizdan keyin shu yerda qayd eting. Yakuniy ball Eco Team tarozida o‘lchagan vazn bo‘yicha beriladi.</p>

              <p className="label mt-7">
                <span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-glow text-[11px] text-forest-950">1</span>
                Chiqindi turi
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(materials) as (keyof typeof materials)[]).map((key) => {
                  const m = materials[key];
                  const active = material === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setMaterial(key)}
                      aria-pressed={active}
                      className={`relative rounded-2xl border p-4 text-left transition sm:p-5 ${
                        active ? `border-transparent ${m.tint} ring-2 ${m.ring}` : "border-line bg-surface hover:bg-cream"
                      }`}
                    >
                      {active && (
                        <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-glow text-xs text-forest-950">
                          ✓
                        </span>
                      )}
                      <span className="text-3xl">{m.icon}</span>
                      <span className="mt-3 block text-lg font-extrabold">{m.label}</span>
                      <span className="block text-xs text-muted">{m.text}</span>
                      <span className="mt-2 inline-block rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-bold text-accent">
                        1 kg = {POINTS_PER_KG} ball
                      </span>
                    </button>
                  );
                })}
              </div>

              <label className="label mt-7" htmlFor="kg">
                <span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-glow text-[11px] text-forest-950">2</span>
                Tarozida ko‘rsatilgan vazn (kg)
              </label>
              <div className="relative">
                <input
                  id="kg"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  max="500"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Masalan: 2.5"
                  className="input pr-14 text-lg font-bold"
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">kg</span>
              </div>
              {estimate > 0 && (
                <p className="hint font-bold text-accent">
                  ≈ {estimate} ball (yakuniy ball Eco Team tasdiqlagan vazn asosida)
                </p>
              )}

              <p className="label mt-7">
                <span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-glow text-[11px] text-forest-950">3</span>
                Tarozidagi rasm (o‘lchash paytida)
              </p>
              <label
                htmlFor="proof-image"
                className="group flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-leaf-300 bg-leaf-100/40 p-5 text-center transition hover:bg-leaf-100"
              >
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="Tarozi rasmi" className="max-h-56 rounded-xl object-contain" />
                ) : (
                  <>
                    <span className="text-4xl transition-transform group-hover:scale-110">⚖️</span>
                    <span className="mt-3 text-sm font-extrabold text-accent">Rasmni tanlang yoki suratga oling</span>
                    <span className="mt-1 max-w-xs text-xs leading-5 text-muted">
                      Rasmda chiqindi va tarozidagi kg ko‘rsatkichi aniq ko‘rinsin · {MAX_MB} MB gacha
                    </span>
                  </>
                )}
              </label>
              <input
                id="proof-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={(e) => pickFile(e.target.files?.[0] || null)}
                className="sr-only"
              />
              {proofFile && (
                <button type="button" onClick={() => setProofFile(null)} className="mt-2 text-xs font-bold text-coral-500 hover:underline">
                  Rasmni almashtirish
                </button>
              )}

              {message && (
                <div className="mt-5">
                  <Alert tone={message.error ? "error" : "success"}>{message.text}</Alert>
                </div>
              )}

              <button type="submit" disabled={sending} className="btn btn-primary mt-6 w-full py-4 text-base">
                {sending && <Spinner />}
                {sending ? "Yuborilmoqda..." : "Topshiruvni yuborish"}
              </button>
            </form></Reveal>

            {/* Tarix */}
            <Reveal from="right" as="aside" className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="relative overflow-hidden rounded-[1.5rem] bg-glow p-5 text-forest-950">
                  <span className="absolute -right-3 -top-3 text-6xl opacity-15 animate-sway">♻️</span>
                  <p className="text-xs font-bold uppercase tracking-wider text-white/60">Topshirildi</p>
                  <p className="mt-2 font-display text-3xl font-semibold">
                    {formatNumber(totalKg, 2)} <span className="text-sm text-white/60">kg</span>
                  </p>
                </div>
                <div className="rounded-[1.5rem] bg-leaf-300 p-5 text-forest-950">
                  <p className="text-xs font-bold uppercase tracking-wider text-accent/70">Ballar</p>
                  <p className="mt-2 font-display text-3xl font-semibold">+{totalPoints}</p>
                </div>
              </div>

              <div className="card p-5 sm:p-6">
                <h2 className="text-xl font-semibold">Mening topshiruvlarim</h2>
                <div className="mt-4 space-y-3">
                  {loading ? (
                    <>
                      <Skeleton className="h-16" />
                      <Skeleton className="h-16" />
                    </>
                  ) : submissions.length === 0 ? (
                    <EmptyState icon="♻️" title="Hali topshiruv yo‘q" text="Birinchi topshiruvingizni yuboring!" />
                  ) : (
                    submissions.map((item) => {
                      const m = materials[item.material] ?? materials.paper;
                      return (
                        <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-cream p-3">
                          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl ${m.tint}`}>
                            {m.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-extrabold">
                              {m.label} · {formatNumber(item.amount_kg, 2)} kg
                            </p>
                            <p className="text-xs text-muted">{formatDate(item.submitted_at)}</p>
                          </div>
                          <div className="text-right">
                            <StatusBadge status={item.status} />
                            {item.status === "approved" && (
                              <p className="mt-1 text-sm font-extrabold text-accent">+{item.awarded_points}</p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </Reveal>
          </div>
        )}
      </div>
    </>
  );
}
