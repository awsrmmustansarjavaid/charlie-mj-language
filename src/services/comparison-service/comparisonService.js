export function compareTexts(a, b) {
  return { same: String(a || '') === String(b || ''), source: String(a || ''), target: String(b || '') };
}
