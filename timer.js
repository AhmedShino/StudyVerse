export function createTimer(state, hooks) {
  let interval = null;
  const persist = () => hooks.onChange(state.timer);
  const remaining = () => {
    const t = state.timer;
    if (t.status === "running" && t.endsAt) return Math.max(0, t.endsAt - Date.now());
    return Math.max(0, t.remainingMs);
  };
  function snapshot() {
    state.timer.remainingMs = remaining();
    if (state.timer.status === "running") state.timer.endsAt = Date.now() + state.timer.remainingMs;
    persist();
  }
  function clearTick() { if (interval) clearInterval(interval); interval = null; }
  function tick() {
    const left = remaining();
    hooks.onTick(left, state.timer);
    if (left <= 0 && state.timer.status === "running") completePhase();
  }
  function start() {
    const t = state.timer;
    if (t.status === "running") return;
    if (t.remainingMs <= 0) t.remainingMs = t.durationMs;
    t.status = "running";
    t.startedAt = t.startedAt || Date.now();
    t.endsAt = Date.now() + t.remainingMs;
    persist(); clearTick(); interval = setInterval(tick, 250); tick();
  }
  function pause() {
    if (state.timer.status !== "running") return;
    state.timer.remainingMs = remaining();
    state.timer.endsAt = null;
    state.timer.status = "paused";
    clearTick(); persist(); hooks.onTick(state.timer.remainingMs, state.timer);
  }
  function reset() {
    clearTick();
    const t = state.timer;
    t.status = "idle"; t.endsAt = null; t.startedAt = null; t.remainingMs = t.durationMs;
    persist(); hooks.onTick(t.remainingMs, t);
  }
  function finish(savePartial = false) {
    clearTick();
    const t = state.timer;
    const elapsed = Math.max(0, t.durationMs - remaining());
    if (savePartial && elapsed >= 60_000 && !t.isBreak) hooks.onComplete({ subject: t.subject, durationMs: elapsed, completedAt: Date.now(), completed: false });
    t.status = "idle"; t.endsAt = null; t.startedAt = null; t.remainingMs = t.durationMs; t.isBreak = false;
    persist(); hooks.onTick(t.remainingMs, t);
  }
  function completePhase() {
    clearTick();
    const t = state.timer;
    if (t.isBreak) {
      t.status = "idle"; t.isBreak = false; t.endsAt = null; t.startedAt = null; t.remainingMs = t.durationMs;
      persist(); hooks.onPhaseComplete("break"); hooks.onTick(t.remainingMs, t); return;
    }
    hooks.onComplete({ subject: t.subject, durationMs: t.durationMs, completedAt: Date.now(), completed: true });
    hooks.onPhaseComplete("study");
    if (t.breakEnabled) {
      t.isBreak = true; t.status = "running"; t.durationMs = 5 * 60_000; t.remainingMs = t.durationMs;
      t.startedAt = Date.now(); t.endsAt = Date.now() + t.durationMs; persist();
      interval = setInterval(tick, 250); hooks.onTick(t.remainingMs, t);
    } else {
      t.status = "idle"; t.endsAt = null; t.startedAt = null; t.remainingMs = t.durationMs; persist(); hooks.onTick(t.remainingMs, t);
    }
  }
  function restore() {
    const t = state.timer;
    if (t.status === "running" && t.endsAt) {
      if (t.endsAt <= Date.now()) { completePhase(); return; }
      clearTick(); interval = setInterval(tick, 250);
    }
    hooks.onTick(remaining(), t);
  }
  function setDuration(minutes) {
    if (state.timer.status === "running") return false;
    const t = state.timer;
    t.durationMs = minutes * 60_000; t.remainingMs = t.durationMs; t.endsAt = null; t.startedAt = null; t.status = "idle"; t.isBreak = false;
    persist(); hooks.onTick(t.remainingMs, t); return true;
  }
  function setSubject(subject) { if (state.timer.status === "running") return false; state.timer.subject = subject; persist(); return true; }
  function setBreakEnabled(enabled) { state.timer.breakEnabled = enabled; persist(); }
  function destroy() { clearTick(); }
  return { start, pause, reset, finish, restore, setDuration, setSubject, setBreakEnabled, destroy, remaining };
}
