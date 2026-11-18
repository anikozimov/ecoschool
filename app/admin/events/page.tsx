"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { formatDate, formatMonth, MONTHS_SHORT, useSession } from "@/lib/session";
import { EVENT_TYPES, type EcoEvent } from "@/lib/events";
import { AdminTitle } from "@/components/admin/AdminShell";
import { Alert, CardsSkeleton, ConfirmDialog, EmptyState, Modal, Spinner, Tabs } from "@/components/ui";

type EventType = EcoEvent["event_type"];

export default function AdminEventsPage() {
  const { profile } = useSession();
  const [supabase] = useState(() => createClient());
  const [events, setEvents] = useState<EcoEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState("");
  const [view, setView] = useState<"upcoming" | "past">("upcoming");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<EventType>("event");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<EcoEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("eco_events").select("*").order("start_date", { ascending: true });
    if (error) {
      console.error(error);
      setMessage({ text: "Tadbirlarni yuklab bo‘lmadi.", error: true });
    } else setEvents((data as EcoEvent[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const n = new Date();
    setToday(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`);
    load();
  }, [load]);

  function openEdit(ev: EcoEvent) {
    setEditId(ev.id);
    setTitle(ev.title);
    setDescription(ev.description ?? "");
    setEventType(ev.event_type);
    setStartDate(ev.start_date);
    setEndDate(ev.end_date ?? "");
    setLocation(ev.location ?? "");
    setFormError("");
    setFormOpen(true);
  }

  function resetForm() {
    setEditId(null);
    setTitle("");
    setDescription("");
    setEventType("event");
    setStartDate("");
    setEndDate("");
    setLocation("");
    setFormError("");
  }

  async function addEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    if (!title.trim() || !startDate) return setFormError("Tadbir nomi va boshlanish sanasini kiriting.");
    if (endDate && endDate < startDate) return setFormError("Tugash sanasi boshlanish sanasidan oldin bo‘lishi mumkin emas.");

    setSaving(true);
    const payload = {
      title: title.trim().slice(0, 200),
      description: description.trim().slice(0, 2000) || null,
      event_type: eventType,
      start_date: startDate,
      end_date: endDate || null,
      location: location.trim().slice(0, 200) || null,
    };
    const wasEdit = editId !== null;
    const { error } = wasEdit
      ? await supabase.from("eco_events").update(payload).eq("id", editId)
      : await supabase.from("eco_events").insert({ ...payload, school_id: profile?.school_id ?? null });
    setSaving(false);

    if (error) {
      console.error(error);
      setFormError("Tadbirni saqlab bo‘lmadi. Qayta urinib ko‘ring.");
      return;
    }
    setFormOpen(false);
    resetForm();
    setMessage({ text: wasEdit ? "✓ Tadbir yangilandi." : "✓ Tadbir taqvimga qo‘shildi!", error: false });
    load();
  }

  async function deleteEvent() {
    if (!toDelete) return;
    setDeleting(true);
    const { data, error } = await supabase.from("eco_events").delete().eq("id", toDelete.id).select("id");
    setDeleting(false);
    if (error || !data?.length) {
      console.error(error);
      setMessage({ text: "Tadbirni o‘chirib bo‘lmadi (ruxsat yo‘q yoki allaqachon o‘chirilgan).", error: true });
    } else {
      setEvents((prev) => prev.filter((e) => e.id !== toDelete.id));
      setMessage({ text: "Tadbir o‘chirildi.", error: false });
    }
    setToDelete(null);
  }

  const upcoming = events.filter((e) => (e.end_date || e.start_date) >= today);
  const past = events.filter((e) => (e.end_date || e.start_date) < today).reverse();
  const visible = view === "upcoming" ? upcoming : past;

  return (
    <>
      <AdminTitle
        icon="📅"
        title="Tadbirlar"
        text="Eko-taqvimdagi tadbirlar, challenge’lar va ekologik kunlarni boshqaring."
        action={
          <button onClick={() => { resetForm(); setFormOpen(true); }} className="btn btn-lime pulse-ring">
            + Yangi tadbir
          </button>
        }
      />

      <div className="mb-5">
        <Tabs
          value={view}
          onChange={setView}
          items={[
            { value: "upcoming", label: "Kelgusi", count: upcoming.length },
            { value: "past", label: "O‘tgan", count: past.length },
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

      <div className="grid gap-3">
        {loading ? (
          <CardsSkeleton count={3} className="h-24" />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="📅"
            title={view === "upcoming" ? "Kelgusi tadbirlar yo‘q" : "O‘tgan tadbirlar yo‘q"}
            action={view === "upcoming" ? <button onClick={() => setFormOpen(true)} className="btn btn-primary">+ Birinchi tadbirni qo‘shish</button> : undefined}
          />
        ) : (
          visible.map((e) => {
            const t = EVENT_TYPES[e.event_type];
            const d = new Date(e.start_date + "T12:00:00");
            return (
              <article key={e.id} className="card flex items-center gap-4 p-4 sm:p-5">
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-glow leading-none text-forest-950">
                  <span className="text-center">
                    <span className="block font-display text-2xl font-semibold">{d.getDate()}</span>
                    <span className="block text-[10px] font-bold uppercase">{MONTHS_SHORT[d.getMonth()]}</span>
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <span className={`chip ${t.chip}`}>{t.icon} {t.label}</span>
                  <h3 className="mt-1.5 truncate text-lg font-extrabold">{e.title}</h3>
                  <p className="truncate text-xs text-muted">
                    {e.location ? `📍 ${e.location} · ` : ""}
                    {e.end_date && e.end_date !== e.start_date ? `${formatDate(e.end_date)} gacha` : formatDate(e.start_date)}
                  </p>
                </div>
                <button onClick={() => openEdit(e)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-leaf-100 hover:text-accent" aria-label="Tahrirlash">
                  ✏️
                </button>
                <button onClick={() => setToDelete(e)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-coral-100 hover:text-coral-500" aria-label="O‘chirish">
                  🗑
                </button>
              </article>
            );
          })
        )}
      </div>

      <Modal open={formOpen} onClose={() => !saving && setFormOpen(false)} title={editId !== null ? "Tadbirni tahrirlash" : "Yangi tadbir"} subtitle="O‘quvchilar uni eko-taqvimda ko‘radi.">
        <form onSubmit={addEvent} className="space-y-4">
          <div>
            <label className="label" htmlFor="ev-title">Nomi</label>
            <input id="ev-title" required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Masalan: Daraxt ekish kuni" className="input" />
          </div>
          <div>
            <p className="label">Turi</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(EVENT_TYPES) as EventType[]).map((k) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setEventType(k)}
                  className={`rounded-2xl border p-3 text-center text-sm font-bold transition ${
                    eventType === k ? "border-forest-600 bg-leaf-100 ring-2 ring-forest-500" : "border-line hover:bg-cream"
                  }`}
                >
                  <span className="block text-xl">{EVENT_TYPES[k].icon}</span>
                  {EVENT_TYPES[k].label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ev-start">Boshlanish</label>
              <input id="ev-start" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="ev-end">Tugash <span className="font-semibold text-muted">(ixtiyoriy)</span></label>
              <input id="ev-end" type="date" min={startDate || undefined} value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="ev-loc">Joylashuv <span className="font-semibold text-muted">(ixtiyoriy)</span></label>
            <input id="ev-loc" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} placeholder="Masalan: Maktab hovlisi" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="ev-desc">Tavsif <span className="font-semibold text-muted">(ixtiyoriy)</span></label>
            <textarea id="ev-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} className="input resize-none" />
          </div>
          {formError && <Alert tone="error">{formError}</Alert>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setFormOpen(false)} disabled={saving} className="btn btn-ghost">Bekor qilish</button>
            <button type="submit" disabled={saving} className="btn btn-primary">{saving && <Spinner />} Saqlash</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        busy={deleting}
        tone="danger"
        title="Tadbirni o‘chirasizmi?"
        text={toDelete ? `“${toDelete.title}” taqvimdan butunlay o‘chiriladi.` : undefined}
        confirmLabel="Ha, o‘chirish"
        onConfirm={deleteEvent}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
