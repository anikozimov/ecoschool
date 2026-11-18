"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

/**
 * Oynalarni (modal, menyu, rasm ko'rish) to'g'ridan-to'g'ri <body> ga chiqaradi.
 * Shunda ota elementlardagi animatsiya, transform yoki blur ularni kesib qo'ymaydi.
 */
export default function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}
