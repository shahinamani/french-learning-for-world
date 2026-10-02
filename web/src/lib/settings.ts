import { userKey } from './session';
import type { Locale } from './types';

export type Settings = { ui: Locale; meaning: Locale; theme: 'light' | 'dark' | 'system'; sound: boolean };

const DEFAULTS: Settings = { ui: 'en', meaning: 'en', theme: 'system', sound: true };
const safely = <T,>(fn: () => T, f: T): T => { try { return fn(); } catch { return f; } };

export function loadSettings(userId: string, fallbackUi: Locale): Settings {
  // `typeof localStorage` throws, not returns 'undefined', in a browser with
  // site data blocked: the property accessor itself raises SecurityError. This
  // line crashed the entire application for that learner — not degraded it,
  // crashed it — and the only visible result was a blank page.
  let storage = false;
  try { storage = typeof localStorage !== 'undefined'; } catch { storage = false; }
  if (!storage) return { ...DEFAULTS, ui: fallbackUi, meaning: fallbackUi === 'fr' ? 'en' : fallbackUi };
  const raw = safely(() => localStorage.getItem(userKey(userId, 'settings')), null);
  const parsed = raw ? safely(() => JSON.parse(raw), null) : null;
  return { ...DEFAULTS, ui: fallbackUi, meaning: fallbackUi === 'fr' ? 'en' : fallbackUi, ...(parsed ?? {}) };
}
export function saveSettings(userId: string, s: Settings): boolean {
  return safely(() => { localStorage.setItem(userKey(userId, 'settings'), JSON.stringify(s)); return true; }, false);
}
