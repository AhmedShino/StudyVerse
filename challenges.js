export const CHALLENGES = [
  { id: "daily-25", title: "خطوة البداية", description: "ذاكر 25 دقيقة اليوم", target: 25, period: "daily", icon: "✦", reward: 20 },
  { id: "daily-60", title: "ساعة لنفسك", description: "اجمع 60 دقيقة مذاكرة اليوم", target: 60, period: "daily", icon: "◷", reward: 35 },
  { id: "weekly-300", title: "رحلة الأسبوع", description: "اجمع 5 ساعات مذاكرة هذا الأسبوع", target: 300, period: "weekly", icon: "🚀", reward: 100 },
  { id: "weekly-5", title: "حضور متوازن", description: "أكمل جلسات في 5 أيام مختلفة هذا الأسبوع", target: 5, period: "weekly-days", icon: "🌱", reward: 80 }
];
export function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
export function getChallengeProgress(challenge, sessions) {
  const now = new Date();
  const today = dayKey();
  const weekStart = new Date(now); weekStart.setHours(0,0,0,0); weekStart.setDate(now.getDate() - ((now.getDay()+6)%7));
  const recent = sessions.filter(s => s.durationMs > 0 && (challenge.period === "daily" ? dayKey(s.completedAt) === today : new Date(s.completedAt) >= weekStart));
  if (challenge.period === "weekly-days") return new Set(recent.map(s => dayKey(s.completedAt))).size;
  return Math.floor(recent.reduce((sum,s) => sum + s.durationMs, 0) / 60000);
}
export function challengeRewardKey(challenge, sessions) {
  const period = challenge.period === "daily" ? dayKey() : `${new Date().getFullYear()}-W${Math.ceil((Date.now() - new Date(new Date().getFullYear(),0,1).getTime()) / 604800000)}`;
  return `${challenge.id}:${period}`;
}
