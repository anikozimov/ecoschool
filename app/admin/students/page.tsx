"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { initials, useSession } from "@/lib/session";
import { AdminTitle } from "@/components/admin/AdminShell";
import { Alert, ConfirmDialog, EmptyState, Modal, Skeleton, Spinner } from "@/components/ui";

type Student = {
  id: string;
  full_name: string | null;
  class_name: string | null;
  points: number | null;
  role: string | null;
  school_id?: string | number | null;
};

export default function AdminStudentsPage() {
  const { user } = useSession();
  const [supabase] = useState(() => createClient());
  const [rows, setRows] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [query, setQuery] = useState("");
  const [cls, setCls] = useState("all");
  const [sort, setSort] = useState<"points" | "name">("points");

  const [editing, setEditing] = useState<Student | null>(null);
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [roleChange, setRoleChange] = useState<Student | null>(null);
  // Maktab sinflari ro'yxati (Maktab va sinflar bo'limi sozlangan bo'lsa)
  const [schoolClasses, setSchoolClasses] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("profiles").select("id, full_name, class_name, points, role, school_id");
    if (error) {
      console.error(error);
      setMessage({ text: "O‘quvchilar ro‘yxatini yuklab bo‘lmadi (admin o‘qish ruxsatini tekshiring).", error: true });
    } else setRows((data as Student[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const classes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.class_name).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, "uz", { numeric: true })),
    [rows]
  );

  const q = query.trim().toLowerCase();
  const visible = rows
    .filter((r) => cls === "all" || r.class_name === cls)
    .filter((r) => !q || r.full_name?.toLowerCase().includes(q))
    .sort((a, b) => (sort === "points" ? (b.points ?? 0) - (a.points ?? 0) : (a.full_name ?? "").localeCompare(b.full_name ?? "")));

  const totalPoints = rows.reduce((s, r) => s + (r.points ?? 0), 0);
  const admins = rows.filter((r) => r.role === "admin").length;

  async function openEdit(s: Student) {
    setEditing(s);
    setName(s.full_name ?? "");
    setClassName(s.class_name ?? "");
    setFormError("");
    setSchoolClasses(null);
    if (s.school_id != null) {
      const { data, error } = await supabase.rpc("admin_list_classes", { p_school_id: String(s.school_id) });
      if (!error && Array.isArray(data) && data.length) {
        setSchoolClasses((data as { class_name: string }[]).map((c) => c.class_name));
      }
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (name.trim().length < 3) return setFormError("Ism-familiyani to‘liq kiriting.");
    setSaving(true);
    const { data, error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim().slice(0, 80), class_name: className.trim().slice(0, 20) || null })
      .eq("id", editing.id)
      .select("id");
    setSaving(false);
    if (error || !data?.length) {
      console.error(error);
      setFormError("Saqlab bo‘lmadi. Adminga profillarni tahrirlash ruxsati berilganini tekshiring.");
      return;
    }
    setRows((p) => p.map((r) => (r.id === editing.id ? { ...r, full_name: name.trim(), class_name: className.trim() || null } : r)));
    setMessage({ text: "✓ Ma’lumotlar yangilandi.", error: false });
    setEditing(null);
  }

  async function toggleRole() {
    if (!roleChange) return;
    const next = roleChange.role === "admin" ? "student" : "admin";
    setSaving(true);
    const { data, error } = await supabase.from("profiles").update({ role: next }).eq("id", roleChange.id).select("id");
    setSaving(false);
    if (error || !data?.length) {
      console.error(error);
      setMessage({ text: "Rolni o‘zgartirib bo‘lmadi.", error: true });
    } else {
      setRows((p) => p.map((r) => (r.id === roleChange.id ? { ...r, role: next } : r)));
      setMessage({ text: next === "admin" ? `✓ ${roleChange.full_name} endi admin.` : `${roleChange.full_name} oddiy foydalanuvchiga aylantirildi.`, error: false });
    }
    setRoleChange(null);
  }

  return (
    <>
      <AdminTitle
        title="O‘quvchilar"
        text="Ro‘yxatni ko‘ring, qidiring va ism yoki sinfdagi xatolarni tuzating."
        action={
          <div className="flex gap-3">
            <div className="card px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Jami</p>
              <p className="font-display text-2xl font-semibold">{rows.length}</p>
            </div>
            <div className="card px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Ballar</p>
              <p className="font-display text-2xl font-semibold text-accent">{totalPoints.toLocaleString("uz-UZ")}</p>
            </div>
          </div>
        }
      />

      <div className="mb-5 flex flex-col gap-3 md:flex-row">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="🔍 Ism bo‘yicha qidirish" className="input py-2.5 md:max-w-xs" />
        <select value={cls} onChange={(e) => setCls(e.target.value)} className="input py-2.5 md:max-w-[180px]" aria-label="Sinf">
          <option value="all">Barcha sinflar</option>
          {classes.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as "points" | "name")} className="input py-2.5 md:max-w-[200px]" aria-label="Tartib">
          <option value="points">Ball bo‘yicha</option>
          <option value="name">Ism bo‘yicha</option>
        </select>
      </div>

      {message && (
        <div className="mb-5">
          <Alert tone={message.error ? "error" : "success"} onClose={() => setMessage(null)}>{message.text}</Alert>
        </div>
      )}

      {loading ? (
        <Skeleton className="h-96" />
      ) : visible.length === 0 ? (
        <EmptyState icon="👥" title="Hech kim topilmadi" />
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-line">
            {visible.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="hidden w-6 text-center text-sm font-bold text-muted sm:block">{i + 1}</span>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-leaf-200 text-xs font-black text-accent">
                  {initials(s.full_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold">
                    {s.full_name || "Nomsiz"}
                    {s.role === "admin" && <span className="chip ml-2 bg-glow align-middle text-forest-950">Admin</span>}
                  </p>
                  <p className="text-xs text-muted">{s.class_name || "Sinf ko‘rsatilmagan"}</p>
                </div>
                <span className="font-display text-lg font-semibold text-accent">{(s.points ?? 0).toLocaleString("uz-UZ")}</span>
                <button onClick={() => openEdit(s)} className="btn btn-ghost btn-sm" aria-label="Tahrirlash">✏️</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">Adminlar soni: {admins}. Ballar faqat tasdiqlangan topshiriqlar orqali o‘zgaradi.</p>

      <Modal open={!!editing} onClose={() => !saving && setEditing(null)} title="O‘quvchini tahrirlash" subtitle={editing?.full_name ?? undefined}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label" htmlFor="s-name">Ism va familiya</label>
            <input id="s-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="s-class">Sinf</label>
            {schoolClasses ? (
              <>
                <select id="s-class" value={className} onChange={(e) => setClassName(e.target.value)} className="input">
                  {!schoolClasses.includes(className) && <option value={className}>{className || "— tanlang —"}</option>}
                  {schoolClasses.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <p className="hint">Ro‘yxatda yo‘q sinfni “Maktab va sinflar” bo‘limida qo‘shing.</p>
              </>
            ) : (
              <>
                <input id="s-class" value={className} onChange={(e) => setClassName(e.target.value)} maxLength={20} className="input" placeholder="Masalan: 9-A" list="class-list" />
                <datalist id="class-list">
                  {classes.map((c) => <option key={c} value={c} />)}
                </datalist>
              </>
            )}
          </div>
          {formError && <Alert tone="error">{formError}</Alert>}
          <div className="flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:items-center">
            {editing && editing.id !== user?.id && (
              <button type="button" onClick={() => { setRoleChange(editing); setEditing(null); }} className="btn btn-ghost btn-sm sm:mr-auto">
                {editing.role === "admin" ? "Adminlikdan olish" : "⚙️ Admin qilish"}
              </button>
            )}
            <button type="button" onClick={() => setEditing(null)} disabled={saving} className="btn btn-ghost">Bekor qilish</button>
            <button type="submit" disabled={saving} className="btn btn-primary">{saving && <Spinner />} Saqlash</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!roleChange}
        busy={saving}
        tone={roleChange?.role === "admin" ? "danger" : "primary"}
        title={roleChange?.role === "admin" ? "Adminlikdan olasizmi?" : "Admin qilasizmi?"}
        text={
          roleChange?.role === "admin"
            ? `${roleChange?.full_name} admin panelga kira olmaydi.`
            : `${roleChange?.full_name} barcha topshiriqlarni tasdiqlash va saytni boshqarish huquqiga ega bo‘ladi.`
        }
        confirmLabel="Ha, tasdiqlayman"
        onConfirm={toggleRole}
        onCancel={() => setRoleChange(null)}
      />
    </>
  );
}
