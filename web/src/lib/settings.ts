import { userKey } from './session';
import type { Locale } from './types';

export type Settings = { ui: Locale; meaning: Locale; theme: 'light' | 'dark' | 'system'; sound: boolean };

const DEFAULTS: Settings = { ui: 'en', meaning: 'en', theme: 'system', sound: true };
const safely = <T,>(fn: () => T, f: T): T => { try { return fn(); } catch { return f; } };

export function loadSettings(userId: string, fallbackUi: Locale): Settings {
  if (typeof localStorage === 'undefined') return { ...DEFAULTS, ui: fallbackUi, meaning: fallbackUi === 'fr' ? 'en' : fallbackUi };
  const raw = safely(() => localStorage.getItem(userKey(userId, 'settings')), null);
  const parsed = raw ? safely(() => JSON.parse(raw), null) : null;
  return { ...DEFAULTS, ui: fallbackUi, meaning: fallbackUi === 'fr' ? 'en' : fallbackUi, ...(parsed ?? {}) };
}
export function saveSettings(userId: string, s: Settings): boolean {
  return safely(() => { localStorage.setItem(userKey(userId, 'settings'), JSON.stringify(s)); return true; }, false);
}
