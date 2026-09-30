// Study timer — 10 minutes to 1 hour.
//
// Nothing counts down. Starting the timer records the moment it ends, and the
// display is always the distance from now to that moment. A background tab is
// throttled and a locked phone stops painting entirely, so a counter that
// decrements on each tick silently runs slow: an hour quietly becomes ninety
// minutes. Given an end time and "now", the remaining seconds are the same
// whether the page was watched throughout or reopened later.

export const PRESETS_MIN = Object.freeze([10, 15, 20, 30, 45, 60]);
export const TIMER_KEY = 'flw.timer.v1';
export const SOUND_KEY = 'flw.timer.sound.v1';

/** "1h" reads as a clock; "60m" reads as a stopwatch. */
export function presetLabel(minutes) {
  return minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}m`;
}

/** The hour shows as 1:00:00 and crosses to 59:59, never 60:00. */
export function formatClock(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function remainingSeconds(endsAt, now) {
  return Math.max(0, Math.round((endsAt - now) / 1000));
}

// In a private window, with site data blocked, or when the quota is full,
// storage access throws rather than returning null — and a timer that cannot
// remember itself must still run.
function safely(action, fallback) {
  try { return action(); } catch { return fallback; }
}

function storageOrNull() {
  return safely(() => (typeof localStorage === 'undefined' ? null : localStorage), null);
}

export function saveTimer(endsAt, durationMin, storage = storageOrNull()) {
  if (!storage) return;
  safely(() => storage.setItem(TIMER_KEY, JSON.stringify({ endsAt, durationMin })), undefined);
}

export function clearTimer(storage = storageOrNull()) {
  if (!storage) return;
  safely(() => storage.removeItem(TIMER_KEY), undefined);
}

/** Ignores anything stored that is not a timer. */
export function readTimer(storage = storageOrNull()) {
  if (!storage) return null;
  const raw = safely(() => storage.getItem(TIMER_KEY), null);
  if (!raw) return null;
  const parsed = safely(() => JSON.parse(raw), null);
  if (!parsed || typeof parsed !== 'object') return null;
  const { endsAt, durationMin } = parsed;
  if (!Number.isFinite(endsAt) || !Number.isFinite(durationMin)) return null;
  return { endsAt, durationMin };
}

/**
 * A timer whose moment passed while the tab was closed did not fail to finish
 * — it finished, and nobody was there to see it. Saying so is better than
 * silently resetting, so the learner knows their hour is over rather than
 * wondering whether it ever started.
 */
export function restore(now, storage = storageOrNull()) {
  const saved = readTimer(storage);
  if (!saved) return { state: 'none' };
  const remaining = remainingSeconds(saved.endsAt, now);
  if (remaining <= 0) {
    clearTimer(storage);
    return { state: 'finishedWhileAway', durationMin: saved.durationMin };
  }
  return {
    state: 'running',
    durationMin: saved.durationMin,
    remainingSec: remaining,
    endsAt: saved.endsAt,
  };
}

/**
 * Unset means "not chosen yet", and the default then follows the system: a
 * learner who asked for reduced motion is telling the machine to be calmer, so
 * the timer starts quiet for them and audible for everyone else. Either way
 * the finish is always visible on screen.
 */
export function readSoundPreference(prefersReducedMotion, storage = storageOrNull()) {
  const raw = storage ? safely(() => storage.getItem(SOUND_KEY), null) : null;
  if (raw === 'on') return true;
  if (raw === 'off') return false;
  return !prefersReducedMotion;
}

export function writeSoundPreference(on, storage = storageOrNull()) {
  if (!storage) return;
  safely(() => storage.setItem(SOUND_KEY, on ? 'on' : 'off'), undefined);
}

/**
 * The finish never depends on the sound. A blocked, missing or broken chime
 * still reports `finished: true` — the screen is the announcement, audio is
 * only an addition to it.
 */
export async function announceFinish(play) {
  if (typeof play !== 'function') return { finished: true, soundPlayed: false };
  try { await play(); return { finished: true, soundPlayed: true }; }
  catch { return { finished: true, soundPlayed: false }; }
}
