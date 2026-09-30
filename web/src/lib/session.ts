/**
 * Who is using this tab.
 *
 * There is no backend, so a "user" is a local profile. Two rules make the
 * multi-user requirement real rather than decorative:
 *
 *   1. The active profile lives in **sessionStorage**, which is per-tab.
 *      localStorage is shared across every tab of an origin, so putting it
 *      there would mean two tabs could never be two different learners.
 *   2. Nothing in this file is exported as a mutable module-level value.
 *      There is no `let currentUser` for a second learner to overwrite.
 *      Every reader passes a userId, and the only ambient thing is which
 *      profile *this tab* has selected.
 */

const ACTIVE_KEY = 'flw:activeProfile';
const INDEX_KEY = 'flw:profiles';

export type Profile = { id: string; name: string; createdAt: number };

function safely<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

function newId(): string {
  // crypto.randomUUID is unavailable over plain http on some browsers.
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const hasDom = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

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
}

/**
 * The profile for this tab, creating a first one if the browser is new.
 * Anonymous-first: a learner never has to name themselves to start studying.
 */
export function resolveActiveProfile(): Profile {
  // Prerendering has no storage and no learner. A fixed placeholder id keeps
  // the markup deterministic; the browser replaces it on hydration.
  if (!hasDom()) return { id: 'prerender', name: 'Learner', createdAt: 0 };
  const active = getActiveProfileId();
  const all = listProfiles();
  const found = all.find((p) => p.id === active);
  if (found) return found;
  const first = all[0] ?? createProfile('Learner');
  setActiveProfileId(first.id);
  return first;
}

/**
 * Every storage key in the application goes through here. A key that forgets
 * the user id is how one learner sees another's progress, and it is the kind
 * of bug that is invisible until two people share a laptop.
 */
export function userKey(userId: string, name: string): string {
  if (!userId) throw new Error('userKey called without a user id');
  return `flw:u:${userId}:${name}`;
}
