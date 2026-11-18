"use client";

import dynamic from "next/dynamic";

// Demo ilova faqat NEXT_PUBLIC_DEMO=1 bo'lganda yuklanadi (alohida chunk)
const DemoApp = dynamic(() => import("./DemoApp"), { ssr: false });

export default function DemoRoot() {
  return <DemoApp />;
}
