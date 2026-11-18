import { redirect } from "next/navigation";

// Eski manzil — yangi admin paneldagi bo‘limga yo‘naltiramiz
export default function RecyclingAdminRedirect() {
  redirect("/admin/recycling");
}
