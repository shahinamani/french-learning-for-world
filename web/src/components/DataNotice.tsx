/**
 * What happens to a learner's progress, said before they need to know.
 *
 * This product keeps everything in the browser: no account, no server, nothing
 * sent anywhere. That is the right default and it has one sharp edge — clear
 * the browser and six months of review history is gone, with no way back and
 * nobody to ask. A learner who finds that out afterwards does not come back.
 *
 * So it is said on the first visit, before there is anything to lose, and it
 * stays reachable afterwards from Settings. It is not a cookie banner: there is
 * nothing to consent to, so there is no "accept". It is a notice with one
 * dismissal, remembered per profile.
 */
import { useState } from 'react';
import { useApp, useUserId } from '../app-context';
import { userKey } from '../lib/session';

const SEEN = 'dataNoticeSeen';

function seen(userId: string): boolean {
  try { return localStorage.getItem(userKey(userId, SEEN)) === '1'; }
  catch { return true; }   // storage blocked: do not nag on every paint
}

/** The text itself, used both on first entry and as a permanent section. */
export function DataNoticeBody() {
  const { t } = useApp();
  return (
    <>
      <p>{t('dataStored')}</p>
      <p>{t('dataNotSent')}</p>
      <p><strong>{t('dataClear')}</strong></p>
      <p>{t('dataExport')}</p>
    </>
  );
}

/** Shown once per profile, on first entry. */
export function DataNotice() {
  const { t } = useApp();
  const userId = useUserId();
  const [dismissed, setDismissed] = useState(() => !userId || seen(userId));
  if (dismissed) return null;
  return (
    <section className="card card--raised" data-testid="data-notice"
             aria-labelledby="data-notice-h">
      <h2 id="data-notice-h" className="h3">{t('dataTitle')}</h2>
      <DataNoticeBody />
      <button className="btn btn--primary" data-testid="data-notice-dismiss"
              onClick={() => {
                try { localStorage.setItem(userKey(userId, SEEN), '1'); } catch { /* blocked */ }
                setDismissed(true);
              }}>
        {t('dataUnderstood')}
      </button>
    </section>
  );
}
