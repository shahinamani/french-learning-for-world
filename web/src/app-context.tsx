import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { resolveActiveProfile, type Profile } from './lib/session';
import { loadSettings, saveSettings, type Settings } from './lib/settings';
import { translator, LOCALES, detectLocale, loadDictionary, dictionaryFor } from './lib/i18n';
import type { Locale } from './lib/types';

type Ctx = {
  profile: Profile;
  setProfile: (p: Profile) => void;
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  t: ReturnType<typeof translator>;
  storageWorks: boolean;
};

// The context holds the CURRENT TAB's learner. There is no module-level
// mutable binding here on purpose: a second profile in a second tab gets its
// own React tree and its own provider state, and neither can reach the other.
const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(() => resolveActiveProfile());
  const detected = useMemo(() =>
    typeof navigator === 'undefined' ? 'en' : detectLocale(navigator.languages ?? [navigator.language]), []);
  const [settings, setSettings] = useState<Settings>(() => loadSettings(profile.id, detected));
  const [storageWorks, setStorageWorks] = useState(true);

  // Switching profile reloads that profile's settings. Nothing carries over.
  useEffect(() => { setSettings(loadSettings(profile.id, detected)); }, [profile.id, detected]);

  // Fetch the chosen language if it is not the bundled English. Until it
  // arrives every string falls back to English rather than to a blank screen
  // or a flash of key names; `dictReady` re-renders once it lands.
  const [dictReady, setDictReady] = useState(0);
  useEffect(() => {
    if (dictionaryFor(settings.ui)) return;
    let live = true;
    loadDictionary(settings.ui).then(() => { if (live) setDictReady((n) => n + 1); })
      .catch(() => { /* stays on English, which is still a working page */ });
    return () => { live = false; };
  }, [settings.ui]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.lang = settings.ui;
    const dir = LOCALES[settings.ui].dir;
    root.dir = dir;
    document.body.dir = dir;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.ui, settings.theme]);

  const update = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (!saveSettings(profile.id, next)) setStorageWorks(false);
      return next;
    });
  };

  const value: Ctx = {
    profile, setProfile, settings, update, storageWorks,
    t: useMemo(() => translator(settings.ui), [settings.ui, dictReady]),
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const v = useContext(AppContext);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}

/** The only way to get a user id. Nothing reads storage without one. */
export function useUserId(): string { return useApp().profile.id; }
export function useLocale(): Locale { return useApp().settings.ui; }
