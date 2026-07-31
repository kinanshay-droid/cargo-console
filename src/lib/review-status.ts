// The color-coded "סטטוס לבדיקה" (review status) glossary used on the
// CritiLog tracking sheet the courier/ops team works from day to day.
// Kept as a flat, ordered list (not an enum on the DB) since this is a
// free-text operational tag, same "migration-free" reasoning as the rest
// of payload.critilog — values live in the JSONB payload, this list is
// just what populates the picker + what colors the badge everywhere the
// status is displayed (case detail, today's-tasks dashboard).
export type ReviewStatusOption = {
  value: string;
  bg: string;
  fg: string;
};

export const REVIEW_STATUS_OPTIONS: ReviewStatusOption[] = [
  { value: "HOLD", bg: "#ec4899", fg: "#ffffff" },
  { value: "איסוף", bg: "#7dd3fc", fg: "#0c2733" },
  { value: "נחיתה", bg: "#c9b896", fg: "#2b2417" },
  { value: "חשבוניות", bg: "#f9a8d4", fg: "#3a1428" },
  { value: "ממתין לאישור", bg: "#a8a4c4", fg: "#211f38" },
  { value: "אחסנה+שקילה", bg: "#2a9d9d", fg: "#ffffff" },
  { value: "קליטה", bg: "#e0a598", fg: "#2f1712" },
  { value: "נעצר בשדה", bg: "#d9534f", fg: "#ffffff" },
  { value: "ממתין לניירת", bg: "#8896b3", fg: "#ffffff" },
  { value: "ביטחון", bg: "#5b8def", fg: "#ffffff" },
  { value: "מכס", bg: "#a9826a", fg: "#ffffff" },
  { value: "נעצר טרם איסוף", bg: "#f2994a", fg: "#3a1f04" },
  { value: "ממתין למסלול", bg: "#f4a9a0", fg: "#3a1410" },
  { value: "בנייה", bg: "#2563eb", fg: "#ffffff" },
  { value: "OFD", bg: "#4a2f27", fg: "#ffffff" },
  { value: "נמצא בבירור", bg: "#f5c6cb", fg: "#3a1418" },
  { value: "ממתין לאור ירוק", bg: "#a8dede", fg: "#0c2b2b" },
  { value: "המראה", bg: "#4a6fa5", fg: "#ffffff" },
  { value: "POD", bg: "#6b7280", fg: "#ffffff" },
  { value: "ממתין ל-PA", bg: "#e0c341", fg: "#332b04" },
  { value: "לוודא המשכיות", bg: "#8b6fb3", fg: "#ffffff" },
  { value: "נתוני רשם", bg: "#d16b7f", fg: "#ffffff" },
  { value: "חשבון מסוכן", bg: "#7dd8d8", fg: "#0c2b2b" },
];

export function getReviewStatusStyle(value: string): ReviewStatusOption | null {
  return REVIEW_STATUS_OPTIONS.find((o) => o.value === value) ?? null;
}
