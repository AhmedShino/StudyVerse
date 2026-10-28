import { loadState, saveState, exportState } from "./storage.js";
import { createTimer } from "./timer.js";
import { CHALLENGES, getChallengeProgress, dayKey, challengeRewardKey } from "./challenges.js";

let state = loadState();
let activeChallengeFilter = "all";
let toastTimeout;
const $ = (id) => document.getElementById(id);
const views = ["home","timer","challenges","rooms","profile"];
const safeText = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const minutes = (ms) => Math.max(0, Math.floor(ms / 60000));
const timer = createTimer(state, {
  onChange: () => { saveState(state); render(); },
  onTick: (left, t) => renderTimer(left, t),
  onComplete: (session) => recordSession(session),
  onPhaseComplete: (phase) => showToast(phase === "study" ? "اكتملت الجلسة! تم حفظ تقدمك ✨" : "انتهت الاستراحة، خذ راحتك أو ابدأ من جديد.")
});
function showToast(message) {
  const el = $("toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toastTimeout); toastTimeout = setTimeout(() => el.classList.remove("show"), 2600);
}
function navigate(view) {
  if (!views.includes(view)) return;
  document.querySelectorAll(".view").forEach(el => el.classList.toggle("active", el.id === `view-${view}`));
  document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.nav === view));
  if (view === "timer") renderTimer(timer.remaining(), state.timer);
  if (view === "profile") renderHistory();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function todaySessions() { const key = dayKey(); return state.sessions.filter(s => dayKey(s.completedAt) === key); }
function weeklySessions() {
  const now = new Date(); const start = new Date(now); start.setHours(0,0,0,0); start.setDate(now.getDate() - ((now.getDay()+6)%7));
  return state.sessions.filter(s => new Date(s.completedAt) >= start);
}
function totalMs(sessions) { return sessions.reduce((sum,s) => sum + Math.max(0,s.durationMs || 0),0); }
function currentStreak() {
  const days = new Set(state.sessions.map(s => dayKey(s.completedAt)));
  let count = 0; const d = new Date(); d.setHours(0,0,0,0);
  if (!days.has(dayKey(d.getTime()))) d.setDate(d.getDate()-1);
  while (days.has(dayKey(d.getTime()))) { count++; d.setDate(d.getDate()-1); }
  return count;
}
function render() {
  const todayMin = Math.floor(totalMs(todaySessions()) / 60000);
  const goal = Math.max(15, Number(state.profile.goalMinutes) || 120);
  const pct = Math.min(100, Math.round(todayMin / goal * 100));
  $("userGreeting").textContent = state.profile.name || "يا بطل";
  $("todayMinutes").textContent = todayMin; $("goalMinutes").textContent = goal;
  $("dailyProgress").style.width = `${pct}%`; $("goalPercent").textContent = `${pct}%`;
  $("weekHours").textContent = `${(totalMs(weeklySessions())/3600000).toFixed(1)}س`;
  $("xpValue").textContent = `${state.xp} XP`;
  $("sessionCount").textContent = state.sessions.filter(s => s.completed).length;
  $("streakBadge").textContent = `🔥 ${currentStreak()} يوم`;
  const level = Math.floor(state.xp / 200) + 1;
  $("levelValue").textContent = level; $("profileLevel").textContent = `المستوى ${level}`;
  $("profileName").textContent = state.profile.name || "طالب StudyVerse";
  $("profileInitial").textContent = (state.profile.name || "S").trim().charAt(0).toUpperCase();
  $("nameInput").value = state.profile.name === "طالب StudyVerse" ? "" : state.profile.name;
  $("goalInput").value = goal; $("languageSelect").value = state.profile.language || "ar";
  document.body.classList.toggle("light", state.theme === "light");
  renderChallenges();
  renderRooms();
  renderHistory();
  renderTimer(timer.remaining(), state.timer);
}
function renderTimer(left, t) {
  if (!$("timerDisplay")) return;
  const secs = Math.ceil(Math.max(0,left)/1000);
  $("timerDisplay").textContent = `${String(Math.floor(secs/60)).padStart(2,"0")}:${String(secs%60).padStart(2,"0")}`;
  $("timerSubtext").textContent = t.isBreak ? "استراحة قصيرة" : "دقيقة تركيز";
  $("timerStatus").textContent = t.status === "running" ? (t.isBreak ? "استراحتك جارية" : "أنت في وضع التركيز") : t.status === "paused" ? "المؤقت متوقف مؤقتًا" : "جاهز لجلسة جديدة";
  const progress = t.durationMs ? Math.max(0,Math.min(1,left/t.durationMs)) : 1;
  $("timerRing").style.background = `conic-gradient(var(--blue) ${(1-progress)*360}deg,#26364c 0deg)`;
  $("timerStartPause").textContent = t.status === "running" ? "إيقاف مؤقت" : t.status === "paused" ? "استكمال التركيز" : "ابدأ التركيز";
  $("timerStartPause").disabled = t.isBreak && t.status === "running";
  $("timerReset").disabled = t.status === "running";
}
function renderChallenges() {
  const sessions = state.sessions;
  const markup = CHALLENGES.filter(c => activeChallengeFilter === "all" || c.period.startsWith(activeChallengeFilter)).map(c => {
    const progress = getChallengeProgress(c,sessions); const pct = Math.min(100,Math.round(progress/c.target*100));
    const done = progress >= c.target;
    return `<article class="challenge-card"><div class="challenge-symbol">${c.icon}</div><div class="challenge-body"><strong>${c.title}</strong><p>${c.description}</p><div class="mini-track"><span style="width:${pct}%"></span></div></div><div class="challenge-meta">${done ? "مكتمل ✓" : `${Math.min(progress,c.target)}/${c.target}`}<br>+${c.reward} XP</div></article>`;
  }).join("");
  $("challengeList").innerHTML = markup || `<div class="empty-state">لا توجد تحديات في هذا التصنيف.</div>`;
  $("challengePreview").innerHTML = CHALLENGES.slice(0,2).map(c => {
    const p = getChallengeProgress(c,sessions); const pct = Math.min(100,Math.round(p/c.target*100));
    return `<article class="challenge-card"><div class="challenge-symbol">${c.icon}</div><div class="challenge-body"><strong>${c.title}</strong><p>${c.description}</p><div class="mini-track"><span style="width:${pct}%"></span></div></div><div class="challenge-meta">${pct}%</div></article>`;
  }).join("");
}
function renderRooms() {
  const rooms = state.rooms || [];
  $("localRooms").innerHTML = rooms.length ? rooms.slice().reverse().map(room => `<div class="room-item"><div class="room-avatar">◉</div><div class="room-item-copy"><strong>${safeText(room.name)}</strong><small>${safeText(room.goal || "جلسة تركيز")} · ${room.durationMinutes} دقيقة · محلية</small></div><button data-delete-room="${safeText(room.id)}">حذف</button></div>`).join("") : `<div class="empty-state">لسه ما أنشأتش غرفة. أنشئ غرفة محلية لتجربة الواجهة، أو اربط الخادم لتصبح الغرف مشتركة.</div>`;
}
function renderHistory() {
  if (!$("sessionHistory")) return;
  const sessions = state.sessions.slice().sort((a,b) => b.completedAt-a.completedAt).slice(0,8);
  $("sessionHistory").innerHTML = sessions.length ? sessions.map(s => `<div class="history-item"><div><strong>${safeText(s.subject || "مذاكرة عامة")}</strong><small>${new Date(s.completedAt).toLocaleString(state.profile.language === "en" ? "en" : "ar-EG",{dateStyle:"medium",timeStyle:"short"})}${s.completed ? "" : " · جلسة غير مكتملة"}</small></div><b>${Math.max(1,Math.round(s.durationMs/60000))} د</b></div>`).join("") : `<div class="empty-state">سجل الجلسات هيظهر هنا بعد أول جلسة مذاكرة.</div>`;
}
function recordSession(session) {
  // A unique ID makes local writes idempotent if a lifecycle event fires twice.
  const id = `${session.completedAt}-${session.subject}-${session.durationMs}`;
  if (state.sessions.some(s => s.id === id)) return;
  const normalized = { ...session, id };
  state.sessions.push(normalized);
  if (normalized.completed) state.xp += Math.max(5, Math.floor(normalized.durationMs / 60000));
  state.sessions = state.sessions.slice(-500);
  awardCompletedChallenges();
  saveState(state); render();
}
function awardCompletedChallenges() {
  if (!state.claimedRewards) state.claimedRewards = [];
  for (const c of CHALLENGES) {
    const progress = getChallengeProgress(c,state.sessions);
    const key = challengeRewardKey(c,state.sessions);
    if (progress >= c.target && !state.claimedRewards.includes(key)) {
      state.claimedRewards.push(key); state.xp += c.reward; showToast(`أنجزت تحدي «${c.title}»! +${c.reward} XP`);
    }
  }
}
function bindEvents() {
  document.querySelectorAll("[data-nav]").forEach(btn => btn.addEventListener("click", () => navigate(btn.dataset.nav)));
  $("themeToggle").addEventListener("click", () => { state.theme = state.theme === "light" ? "dark" : "light"; saveState(state); render(); });
  $("startSessionBtn").addEventListener("click", () => navigate("timer"));
  document.querySelectorAll("[data-minutes]").forEach(btn => btn.addEventListener("click", () => {
    if (!timer.setDuration(Number(btn.dataset.minutes))) return showToast("أوقف المؤقت قبل تغيير المدة.");
    document.querySelectorAll("[data-minutes]").forEach(b => b.classList.toggle("selected", b === btn));
  }));
  $("subjectSelect").addEventListener("change", e => { if (!timer.setSubject(e.target.value)) showToast("أوقف المؤقت قبل تغيير المادة."); });
  $("breakToggle").checked = state.timer.breakEnabled;
  $("breakToggle").addEventListener("change", e => timer.setBreakEnabled(e.target.checked));
  $("timerStartPause").addEventListener("click", () => {
    if (state.timer.status === "running") timer.pause(); else timer.start();
  });
  $("timerReset").addEventListener("click", () => timer.reset());
  $("timerFinish").addEventListener("click", () => {
    if (state.timer.status === "running" && !state.timer.isBreak && !confirm("إنهاء الجلسة وحفظ الوقت المنقضي كجلسة غير مكتملة؟")) return;
    timer.finish(true); showToast("تم إنهاء الجلسة.");
  });
  document.querySelectorAll("[data-challenge-filter]").forEach(btn => btn.addEventListener("click", () => {
    activeChallengeFilter = btn.dataset.challengeFilter;
    document.querySelectorAll("[data-challenge-filter]").forEach(b => b.classList.toggle("selected",b===btn)); renderChallenges();
  }));
  $("createRoomBtn").addEventListener("click", () => {
    const name = $("roomName").value.trim();
    if (!name) return showToast("اكتب اسم الغرفة أولًا.");
    const room = { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, name, goal: $("roomGoal").value.trim(), durationMinutes: Number($("roomDuration").value), createdAt: Date.now() };
    state.rooms.push(room); saveState(state); $("roomName").value = ""; $("roomGoal").value = ""; renderRooms(); showToast("تم إنشاء غرفة محلية على جهازك.");
  });
  $("localRooms").addEventListener("click", e => {
    const button = e.target.closest("[data-delete-room]"); if (!button) return;
    state.rooms = state.rooms.filter(r => r.id !== button.dataset.deleteRoom); saveState(state); renderRooms(); showToast("تم حذف الغرفة.");
  });
  $("saveProfileBtn").addEventListener("click", () => {
    const name = $("nameInput").value.trim();
    const goal = Number($("goalInput").value);
    if (!Number.isFinite(goal) || goal < 15 || goal > 720) return showToast("الهدف لازم يكون من 15 إلى 720 دقيقة.");
    state.profile.name = name || "طالب StudyVerse"; state.profile.goalMinutes = Math.round(goal/15)*15; state.profile.language = $("languageSelect").value;
    saveState(state); render(); showToast("تم حفظ إعداداتك.");
  });
  $("exportDataBtn").addEventListener("click", () => exportState(state));
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { timer.restore(); render(); } });
window.addEventListener("pageshow", () => { timer.restore(); render(); });
window.addEventListener("pagehide", () => saveState(state));
bindEvents();
timer.restore();
render();
