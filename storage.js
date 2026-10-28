const KEY = "studyverse.v1";
const defaults = {
  profile: { name: "طالب StudyVerse", goalMinutes: 120, language: "ar" },
  sessions: [],
  xp: 0,
  streak: { days: [], best: 0 },
  timer: { status: "idle", durationMs: 25 * 60 * 1000, remainingMs: 25 * 60 * 1000, endsAt: null, startedAt: null, subject: "رياضيات", breakEnabled: true, isBreak: false },
  rooms: [],
  theme: "light",
  designVersion: 2
};
function clone(value) { return JSON.parse(JSON.stringify(value)); }
export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return clone(defaults);
    const parsed = JSON.parse(raw);
    return { ...clone(defaults), ...parsed,
      theme: parsed.designVersion === 2 ? (parsed.theme || "light") : "light",
      designVersion: 2,
      profile: { ...defaults.profile, ...(parsed.profile || {}) },
      timer: { ...defaults.timer, ...(parsed.timer || {}) },
      streak: { ...defaults.streak, ...(parsed.streak || {}) },
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      rooms: Array.isArray(parsed.rooms) ? parsed.rooms : []
    };
  } catch (error) {
    console.error("Could not load StudyVerse state", error);
    return clone(defaults);
  }
}
export function saveState(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
  catch (error) { console.error("Could not save StudyVerse state", error); return false; }
}
export function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `studyverse-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
