/** Profiles, languages, theme, data. Switching profile changes this tab only. */
import { useState } from 'react';
import { useApp } from '../app-context';
import { createProfile, listProfiles, setActiveProfileId } from '../lib/session';
import { eraseUser, importForUser } from '../lib/db';
import { parseExport } from '../lib/progress';
import { LOCALES } from '../lib/i18n';
import type { Locale } from '../lib/types';
import { DataNoticeBody } from '../components/DataNotice';

export function Account() {
  const { t, settings, update, profile, setProfile, storageWorks } = useApp();
  const [profiles, setProfiles] = useState(() => listProfiles());
  const [confirming, setConfirming] = useState(false);
  const [imported, setImported] = useState<string | null>(null);

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
          <span className="field__label">{t('theme')}</span>
          <select className="select" value={settings.theme} data-testid="theme"
                  onChange={(e) => update({ theme: e.target.value as 'light' | 'dark' | 'system' })}>
            <option value="system">{t('themeSystem')}</option><option value="light">{t('themeLight')}</option><option value="dark">{t('themeDark')}</option>
          </select>
        </label>
      </section>

      <section className="card" aria-labelledby="i-h">
        <h2 id="i-h" className="eyebrow">{t('importData')}</h2>
        <p className="muted">{t('importBody')}</p>
        <label className="btn btn--sm" style={{ display: 'inline-flex' }}>
          {t('chooseFile')}
          <input type="file" accept="application/json,.json" data-testid="import-file"
                 className="u-hidden-visually"
                 onChange={async (e) => {
                   const file = e.target.files?.[0];
                   e.target.value = '';
                   if (!file) return;
                   setImported(null);
                   try {
                     const data = parseExport(await file.text());
                     const r = await importForUser(profile.id, data);
                     setImported(t('importDone', { n: r.rows, s: r.rowsSkipped, c: r.cards }));
                   } catch (err) {
                     const code = err instanceof Error ? err.message : 'notOurs';
                     setImported(t(code === 'notJson' ? 'importNotJson'
                       : code === 'version' ? 'importVersion' : 'importNotOurs'));
                   }
                 }} />
        </label>
        {imported && <p className="muted" role="status" data-testid="import-result">{imported}</p>}
      </section>

      <section className="card" aria-labelledby="dn-h" data-testid="data-notice-always">
        <h2 id="dn-h" className="h3">{t('dataTitle')}</h2>
        <DataNoticeBody />
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
