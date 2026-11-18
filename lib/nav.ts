"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Demo rejimda (claude.ai havolasi) sahifalar `#/yo'l` orqali almashadi. */
export const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

export function hashPath() {
  if (typeof window === "undefined") return "/";
  const raw = window.location.hash.replace(/^#/, "") || "/";
  return raw.split("?")[0] || "/";
}

export function hashQuery() {
  if (typeof window === "undefined") return new URLSearchParams();
  const raw = window.location.hash.replace(/^#/, "");
  return new URLSearchParams(raw.includes("?") ? raw.split("?")[1] : "");
}

export function navigate(path: string, replace = false) {
  const url = "#" + path;
  if (replace) window.location.replace(url);
  else window.location.hash = path;
  window.scrollTo({ top: 0 });
}

function useHashPathname() {
  const [path, setPath] = useState("/");
  useEffect(() => {
    const update = () => setPath(hashPath());
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return path;
}

function useHashRouter() {
  return {
    push: (p: string) => navigate(p),
    replace: (p: string) => navigate(p, true),
    refresh: () => {},
  };
}

export const useAppPathname: () => string = DEMO ? useHashPathname : usePathname;
export const useAppRouter: () => { push: (p: string) => void; replace: (p: string) => void; refresh: () => void } =
  DEMO ? useHashRouter : useRouter;
