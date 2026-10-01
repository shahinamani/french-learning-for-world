// Learner progress, kept on the learner's own device.
//
// There is no account and no server. Nothing about what anyone studies leaves
// their browser, which is the strongest privacy guarantee available: data that
// was never collected cannot be leaked, subpoenaed or sold.
//
// Progress is keyed by the card's content-derived key, never by its position.
// The previous generation of this idea stored "card 137 is known"; inserting
// one card at the top silently repointed every saved mark. Keys mean content
// can be revised, reordered or re-derived without orphaning anyone's progress.

const KEY = 'flw.progress.v1';
const SETTINGS_KEY = 'flw.settings.v1';

function safely(action, fallback) {
  try { return action(); } catch { return fallback; }
}

function store() {
  return safely(() => (typeof localStorage === 'undefined' ? null : localStorage), null);
}

export function loadProgress(storage = store()) {
  if (!storage) return {};
  const raw = safely(() => storage.getItem(KEY), null);
  if (!raw) return {};
  const parsed = safely(() => JSON.parse(raw), null);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

export function saveProgress(progress, storage = store()) {
  if (!storage) return false;
  return safely(() => { storage.setItem(KEY, JSON.stringify(progress)); return true; }, false);
}

export function loadSettings(storage = store()) {
  const fallback = { lang: null, sound: null, showTranslation: 'fa' };
  if (!storage) return fallback;
  const raw = safely(() => storage.getItem(SETTINGS_KEY), null);
  const parsed = raw ? safely(() => JSON.parse(raw), null) : null;
  return parsed && typeof parsed === 'object' ? { ...fallback, ...parsed } : fallback;
}

export function saveSettings(settings, storage = store()) {
  if (!storage) return false;
  return safely(() => { storage.setItem(SETTINGS_KEY, JSON.stringify(settings)); return true; }, false);
}

/**
 * Everything the learner has, as one file they can keep.
 * A free portal that holds your progress hostage is not free.
 */
export function exportProgress(storage = store()) {
  return JSON.stringify({
    format: 'french-learning-for-world/progress',
    version: 1,
    exportedAt: new Date().toISOString(),
    progress: loadProgress(storage),
  }, null, 2);
}

/** Merge rather than replace: the more recently reviewed record wins. */
export function importProgress(json, storage = store()) {
  const parsed = safely(() => JSON.parse(json), null);
  if (!parsed || parsed.format !== 'french-learning-for-world/progress') {
    throw new Error('Not a progress file from this portal.');
  }
  const incoming = parsed.progress && typeof parsed.progress === 'object' ? parsed.progress : {};
  const merged = { ...loadProgress(storage) };
  let count = 0;
  for (const [key, record] of Object.entries(incoming)) {
    if (!record || typeof record !== 'object') continue;
    const mine = merged[key];
    if (!mine || (record.lastReviewedAt ?? 0) > (mine.lastReviewedAt ?? 0)) {
      merged[key] = record;
      count += 1;
    }
  }
  saveProgress(merged, storage);
  return count;
}
