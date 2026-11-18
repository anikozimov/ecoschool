export const RESEARCH_MAX_POINTS = 100;

/** Baholash mezonlari — jami 100 ball */
export const RESEARCH_RUBRIC = [
  { key: "relevance", label: "Mavzuning dolzarbligi", max: 15 },
  { key: "sources", label: "Ishonchli manbalar", max: 20 },
  { key: "analysis", label: "Mustaqil tahlil va tajriba", max: 25 },
  { key: "conclusions", label: "Foydali xulosalar", max: 20 },
  { key: "presentation", label: "Taqdimot va jamoaviy ish", max: 20 },
] as const;

export type Research = {
  id: number;
  student_id: string;
  title: string;
  summary: string;
  content: string;
  sources: string | null;
  status: "pending" | "published" | "rejected";
  awarded_points: number;
  reviewer_feedback: string | null;
  submitted_at: string;
  team_name?: string | null;
  team_members?: string | null;
};
