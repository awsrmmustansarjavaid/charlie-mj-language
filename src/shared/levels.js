/*
 * Charlie MJ Language - CEFR helpers
 * -----------------------------------
 * Provides lightweight UI-level helpers for CEFR and learner-friendly labels.
 * A production dictionary/morphology provider can replace the heuristic layer
 * without changing the rest of the extension.
 */

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export const LEVEL_LABELS = {
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper-Intermediate",
  C1: "Advanced",
  C2: "Proficient"
};

export function levelLabel(level) {
  return LEVEL_LABELS[level] || "Unknown";
}

/** A transparent fallback estimate when no frequency/CEFR dictionary exists. */
export function estimateLevel(word) {
  const length = [...(word || "")].length;
  if (length <= 4) return "A1";
  if (length <= 6) return "A2";
  if (length <= 8) return "B1";
  if (length <= 10) return "B2";
  if (length <= 13) return "C1";
  return "C2";
}
