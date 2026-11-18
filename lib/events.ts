export type EcoEvent = {
  id: number;
  title: string;
  description: string | null;
  event_type: "event" | "challenge" | "eco_day";
  start_date: string;
  end_date: string | null;
  location: string | null;
  school_id: number | null;
};

export const EVENT_TYPES = {
  event: { label: "Tadbir", dot: "bg-sky-500", chip: "bg-sky-100 text-[#8cc4f2]", icon: "🎪" },
  challenge: { label: "Challenge", dot: "bg-forest-500", chip: "bg-leaf-100 text-accent", icon: "🎯" },
  eco_day: { label: "Ekologik kun", dot: "bg-sand-500", chip: "bg-sand-100 text-[#f6d07e]", icon: "🌍" },
} as const;

