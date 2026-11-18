"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div className="card max-w-md p-10">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-coral-100 text-3xl">⚠️</div>
        <h1 className="mt-5 text-3xl font-semibold">Nimadir noto‘g‘ri ketdi</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Kutilmagan xatolik yuz berdi. Sahifani qayta yuklab ko‘ring — muammo davom etsa, administratorga xabar bering.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={reset} className="btn btn-primary">Qayta urinish</button>
          <Link href="/" className="btn btn-ghost">Bosh sahifa</Link>
        </div>
      </div>
    </main>
  );
}
