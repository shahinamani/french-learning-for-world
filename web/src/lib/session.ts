/**
 * Who is using this tab.
 *
 * There is no backend, so a "user" is a local profile. Two rules make the
 * multi-user requirement real rather than decorative:
 *
 *   1. The active profile lives in **sessionStorage**, which is per-tab.
 *      localStorage is shared across every tab of an origin, so putting it
 *      there would mean two tabs could never be two different learners.
 *   1b. Which profile the BROWSER last used lives in localStorage, so a
 *      restart resumes the right person rather than whoever was created first.
 *      sessionStorage still wins when a tab has chosen.
 *   2. Nothing in this file is exported as a mutable module-level value.
 *      There is no `let currentUser` for a second learner to overwrite.
 *      Every reader passes a userId, and the only ambient thing is which
 *      profile *this tab* has selected.
 */

const ACTIVE_KEY = 'flw:activeProfile';     // sessionStorage: this tab
const LAST_KEY = 'flw:lastProfile';         // localStorage: across restarts
const INDEX_KEY = 'flw:profiles';

export type Profile = { id: string; name: string; createdAt: number };

function safely<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

/** A short opaque id. Shared, because three features had their own copy. */
export function newId(): string {
  // crypto.randomUUID is unavailable over plain http on some browsers.
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// `typeof localStorage` THROWS in a browser with site data blocked — the
// property accessor itself raises SecurityError, so this cannot be a bare
// typeof. Found by running the app against a storage that refuses access.
const hasDom = () => {
  try { return typeof window !== 'undefined' && typeof localStorage !== 'undefined'; }
  catch { return false; }
};

export function listProfiles(): Profile[] {
  if (!hasDom()) return [];
  const raw = safely(() => localStorage.getItem(INDEX_KEY), null);
  const parsed = raw ? safely(() => JSON.parse(raw) as Profile[], null) : null;
  return Array.isArray(parsed) ? parsed.filter((p) => p && typeof p.id === 'string') : [];
}

export function createProfile(name: string): Profile {
  const profile: Profile = { id: newId(), name: name.trim() || 'Learner', createdAt: Date.now() };
  const all = [...listProfiles(), profile];
  safely(() => localStorage.setItem(INDEX_KEY, JSON.stringify(all)), undefined);
  return profile;
}

/** Which profile this tab is using. Per-tab by design. */
export function getActiveProfileId(): string | null {
  if (!hasDom()) return null;
  return safely(() => sessionStorage.getItem(ACTIVE_KEY), null);
}

export function setActiveProfileId(id: string): void {
  if (!hasDom()) return;
  safely(() => sessionStorage.setItem(ACTIVE_KEY, id), undefined);
  // Also remembered across restarts, so a returning learner resumes the profile
  // they were last using rather than whichever was created first. sessionStorage
  // keeps two tabs apart; this keeps a browser restart from picking the wrong
  // person on a shared laptop.
  safely(() => localStorage.setItem(LAST_KEY, id), undefined);
}

/** The profile this browser last used, across restarts. */
export function getLastProfileId(): string | null {
  if (!hasDom()) return null;
  return safely(() => localStorage.getItem(LAST_KEY), null);
}

/**
 * The profile for this tab, creating a first one if the browser is new.
 * Anonymous-first: a learner never has to name themselves to start studying.
 */
export function resolveActiveProfile(): Profile {
  // Prerendering has no storage and no learner. A fixed placeholder id keeps
  // the markup deterministic; the browser replaces it on hydration.
  if (!hasDom()) return { id: 'prerender', name: 'Learner', createdAt: 0 };
  const all = listProfiles();
  // 1. what this tab chose, 2. what this browser last used, 3. the first
  // profile, 4. a new one. Only step 4 creates, and only when the browser has
  // no profile at all — a learner's id must never be regenerated while one
  // exists, because every review row is keyed to it.
  const found = all.find((p) => p.id === getActiveProfileId())
    ?? all.find((p) => p.id === getLastProfileId())
    ?? all[0];
  if (found) {
    setActiveProfileId(found.id);
    return found;
  }
  const created = createProfile('Learner');
  setActiveProfileId(created.id);
  return created;
}

/**
 * Every storage key in the application goes through here. A key that forgets
 * the user id is how one learner sees another's progress, and it is the kind
 * of bug that is invisible until two people share a laptop.
 */
/**
 * The profile id is permanent, from the first visit onwards.
 *
 * This is the part that is expensive to retrofit. Every review row, card state
 * and setting is keyed to it, so when email accounts arrive, an existing
 * learner attaches an address to the profile they already have and keeps every
 * row — nobody starts again. That only works if the id was never regenerated,
 * which is why `resolveActiveProfile` creates one *only* when the browser holds
 * no profile at all, and why `tests/profile-id-is-permanent.test.js` asserts it.
 */
export function userKey(userId: string, name: string): string {
  if (!userId) throw new Error('userKey called without a user id');
  return `flw:u:${userId}:${name}`;
}
