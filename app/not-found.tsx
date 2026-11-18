import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="font-display text-[8rem] font-semibold leading-none text-aurora">404</p>
        <h1 className="mt-4 text-3xl font-semibold">Bu sahifa o‘rmonda adashib qoldi 🌿</h1>
        <p className="mx-auto mt-3 max-w-sm text-muted">Siz qidirgan sahifa topilmadi yoki ko‘chirilgan.</p>
        <Link href="/" className="btn btn-primary mt-8 px-8 py-4">Bosh sahifaga qaytish</Link>
      </div>
    </main>
  );
}
