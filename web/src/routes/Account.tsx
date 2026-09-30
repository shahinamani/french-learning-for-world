/** Profiles, languages, theme, data. Switching profile changes this tab only. */
import { useState } from 'react';
import { useApp } from '../app-context';
import { createProfile, listProfiles, setActiveProfileId } from '../lib/session';
import { eraseUser } from '../lib/db';
import { LOCALES } from '../lib/i18n';
import type { Locale } from '../lib/types';

export function Account() {
  const { t, settings, update, profile, setProfile, storageWorks } = useApp();
  const [profiles, setProfiles] = useState(() => listProfiles());
  const [confirming, setConfirming] = useState(false);

  const switchTo = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    if (!p) return;
    setActiveProfileId(p.id);   // sessionStorage: this tab only
    setProfile(p);
  };

  return (
    <div className="page">
      <h1 className="h2">{t('account')}</h1>
      {!storageWorks && <div className="alert alert--warning"><div className="alert__body">{t('storageBlocked')}</div></div>}

      <section className="card" aria-labelledby="p-h">
        <h2 id="p-h" className="eyebrow">{t('profile')}</h2>
        <label className="field">
          <span className="field__label">{t('switchProfile')}</span>
          <select className="select" value={profile.id} data-testid="profile-select"
                  onChange={(e) => switchTo(e.target.value)}>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <button className="btn btn--sm" style={{ marginBlockStart: 'var(--space-3)' }} data-testid="new-profile"
                onClick={() => {
                  const p = createProfile(`Learner ${profiles.length + 1}`);
                  setProfiles(listProfiles());
                  setActiveProfileId(p.id);
                  setProfile(p);
                }}>{t('newProfile')}</button>
        <p className="muted" style={{ marginBlockStart: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>
          id <code data-testid="profile-id">{profile.id.slice(0, 8)}</code>
        </p>
      </section>

      <section className="card" aria-labelledby="l-h">
        <h2 id="l-h" className="eyebrow">{t('settings')}</h2>
        <label className="field">
          <span className="field__label">{t('interfaceLanguage')}</span>
          <select className="select" value={settings.ui} data-testid="ui-lang"
                  onChange={(e) => update({ ui: e.target.value as Locale })}>
            {(Object.keys(LOCALES) as Locale[]).map((l) => <option key={l} value={l}>{LOCALES[l].name}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field__label">{t('meaningLanguage')}</span>
          <select className="select" value={settings.meaning} data-testid="meaning-lang"
                  onChange={(e) => update({ meaning: e.target.value as Locale })}>
            {(Object.keys(LOCALES) as Locale[]).map((l) => <option key={l} value={l}>{LOCALES[l].name}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Theme</span>
          <select className="select" value={settings.theme} data-testid="theme"
                  onChange={(e) => update({ theme: e.target.value as 'light' | 'dark' | 'system' })}>
            <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
          </select>
        </label>
      </section>

      <section className="card" aria-labelledby="d-h">
        <h2 id="d-h" className="eyebrow">{t('exportData')}</h2>
        {!confirming ? (
          <button className="btn btn--sm danger" data-testid="erase" onClick={() => setConfirming(true)}>
            {t('eraseData')}
          </button>
        ) : (
          <div className="row gap-2 wrap">
            <span className="muted">{t('eraseConfirm')}</span>
            <button className="btn btn--sm danger" data-testid="erase-confirm"
                    onClick={async () => { await eraseUser(profile.id); setConfirming(false); location.reload(); }}>
              {t('eraseData')}
            </button>
            <button className="btn btn--sm" onClick={() => setConfirming(false)}>{t('close')}</button>
          </div>
        )}
      </section>

      <p className="muted foot-legal">{t('independence')}</p>
    </div>
  );
}
